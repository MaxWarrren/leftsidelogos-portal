import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
    downloadImage,
    lookupProduct,
    SsaApiError,
    type SsaColor,
    type SsaIdentifierKind,
    type SsaProductSummary,
} from "@/lib/ssactivewear";

type ImportBody = {
    identifier: string;
    kind: SsaIdentifierKind;
    mock?: boolean;
    // Subset of the lookup result the admin picked:
    selectedColorCodes: string[];
    selectedSizes: string[];
    // Catalog metadata
    name: string;
    slug: string;
    category_id: string;
    base_price: number;
    sku?: string;          // override; defaults to styleName
    description?: string;  // override; defaults to API description
    published?: boolean;
    featured?: boolean;
};

const STORAGE_BUCKET = "product-images";
const ANGLES = ["front", "side", "back", "onModelFront"] as const;
type Angle = (typeof ANGLES)[number];

function safeSegment(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 60) || "item";
}

function extensionFor(contentType: string): string {
    if (contentType.includes("png")) return "png";
    if (contentType.includes("webp")) return "webp";
    if (contentType.includes("gif")) return "gif";
    return "jpg";
}

export async function POST(req: NextRequest) {
    // Admin gate.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const adminSupabase = createAdminClient();
    const { data: profile } = await adminSupabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    if (profile?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: ImportBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const errors: string[] = [];
    if (!body.identifier?.trim()) errors.push("identifier is required");
    if (!body.name?.trim()) errors.push("name is required");
    if (!body.slug?.trim()) errors.push("slug is required");
    if (!body.category_id?.trim()) errors.push("category_id is required");
    if (!(body.base_price >= 0)) errors.push("base_price must be a number ≥ 0");
    if (!Array.isArray(body.selectedColorCodes) || body.selectedColorCodes.length === 0) {
        errors.push("at least one color must be selected");
    }
    if (!Array.isArray(body.selectedSizes) || body.selectedSizes.length === 0) {
        errors.push("at least one size must be selected");
    }
    if (errors.length) {
        return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    }

    // Re-fetch from SSA so we don't trust client-supplied image URLs.
    let summary: SsaProductSummary;
    try {
        summary = await lookupProduct(body.identifier, body.kind, { mock: body.mock });
    } catch (e) {
        if (e instanceof SsaApiError) {
            return NextResponse.json({ error: e.message }, { status: 502 });
        }
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }

    const colorsToImport = summary.colors.filter((c) =>
        body.selectedColorCodes.includes(c.colorCode)
    );
    if (colorsToImport.length === 0) {
        return NextResponse.json(
            { error: "None of the selected colors are available for this product" },
            { status: 400 }
        );
    }

    // Re-host every image into Supabase Storage.
    const slug = safeSegment(body.slug);
    const styleId = summary.styleID || summary.styleName;
    const basePath = `ssa/${styleId}/${Date.now()}`;
    const colorPublicSwatches: string[] = [];
    const imageVariants: Array<{ color: string; angle: string; url: string }> = [];
    const failedFetches: string[] = [];

    for (const color of colorsToImport) {
        const swatchUrl = await rehostImage(
            adminSupabase,
            color.swatch,
            `${basePath}/${safeSegment(color.colorCode)}/swatch`,
            failedFetches
        );
        if (swatchUrl) colorPublicSwatches.push(swatchUrl);

        for (const angle of ANGLES) {
            const src = color.images[angle as Angle];
            if (!src) continue;
            const url = await rehostImage(
                adminSupabase,
                src,
                `${basePath}/${safeSegment(color.colorCode)}/${angle}`,
                failedFetches
            );
            if (url) {
                imageVariants.push({
                    color: color.colorName,
                    angle,
                    url,
                });
            }
        }
    }

    if (imageVariants.length === 0) {
        return NextResponse.json(
            {
                error:
                    "Could not download any product images from SS Activewear. Check the URLs returned by the API.",
                failedFetches,
            },
            { status: 502 }
        );
    }

    // Use front images per color as the primary gallery; fall back to first variant.
    const galleryImages: string[] = [];
    for (const color of colorsToImport) {
        const front = imageVariants.find(
            (v) => v.color === color.colorName && v.angle === "front"
        );
        if (front) galleryImages.push(front.url);
    }
    if (galleryImages.length === 0 && imageVariants[0]) {
        galleryImages.push(imageVariants[0].url);
    }

    const insertPayload = {
        name: body.name.trim(),
        slug,
        category_id: body.category_id,
        sku: (body.sku?.trim() || summary.styleName).slice(0, 64),
        description:
            (body.description?.trim() || summary.description || "").slice(0, 2000) || null,
        base_price: body.base_price,
        featured: body.featured === true,
        published: body.published === true,
        colors: colorsToImport.map((c) => c.colorName),
        sizes: body.selectedSizes,
        images: galleryImages,
        image_variants: imageVariants,
        base_color: colorsToImport[0]?.colorName ?? null,
    };

    const { data: product, error: insertError } = await adminSupabase
        .from("catalog_products")
        .insert(insertPayload)
        .select("id, slug, name")
        .single();

    if (insertError) {
        // If new columns (image_variants / base_color) don't exist yet, retry
        // without them so the import still works on un-migrated databases.
        if (
            /image_variants|base_color|print_areas/.test(insertError.message)
        ) {
            const legacyPayload = { ...insertPayload };
            delete (legacyPayload as Record<string, unknown>).image_variants;
            delete (legacyPayload as Record<string, unknown>).base_color;
            const { data: legacyProduct, error: legacyError } = await adminSupabase
                .from("catalog_products")
                .insert(legacyPayload)
                .select("id, slug, name")
                .single();
            if (legacyError) {
                return NextResponse.json(
                    { error: "Failed to create product: " + legacyError.message },
                    { status: 500 }
                );
            }
            return NextResponse.json({
                success: true,
                product: legacyProduct,
                imageCount: galleryImages.length,
                variantCount: imageVariants.length,
                warning:
                    "Image variants and base_color were skipped — apply the 20260523_catalog_customizer_fields migration to enable them.",
                failedFetches,
            });
        }
        return NextResponse.json(
            { error: "Failed to create product: " + insertError.message },
            { status: 500 }
        );
    }

    return NextResponse.json({
        success: true,
        product,
        imageCount: galleryImages.length,
        variantCount: imageVariants.length,
        failedFetches,
    });
}

// Download an SSA image and upload to product-images bucket.
// Returns the public URL, or null on failure (failure is logged into the array).
async function rehostImage(
    adminSupabase: ReturnType<typeof createAdminClient>,
    sourceUrl: string | null,
    pathWithoutExt: string,
    failedFetches: string[]
): Promise<string | null> {
    if (!sourceUrl) return null;
    try {
        const { bytes, contentType } = await downloadImage(sourceUrl);
        const ext = extensionFor(contentType);
        const fullPath = `${pathWithoutExt}.${ext}`;
        const { error: uploadError } = await adminSupabase.storage
            .from(STORAGE_BUCKET)
            .upload(fullPath, bytes, {
                contentType,
                upsert: true,
                cacheControl: "3600",
            });
        if (uploadError) {
            failedFetches.push(`${sourceUrl} (upload: ${uploadError.message})`);
            return null;
        }
        const { data } = adminSupabase.storage.from(STORAGE_BUCKET).getPublicUrl(fullPath);
        return data.publicUrl;
    } catch (e) {
        const message = e instanceof Error ? e.message : "unknown error";
        failedFetches.push(`${sourceUrl} (${message})`);
        return null;
    }
}
