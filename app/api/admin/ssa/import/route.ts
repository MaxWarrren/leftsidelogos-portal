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
    brand?: string;
    name: string;
    slug: string;
    category_id: string;
    base_price: number;
    item_number?: string;
    style_number?: string;
    source_url?: string;
    description?: string;
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

    // Re-host every image into Supabase Storage and build the two image
    // shapes the customer-facing site expects:
    //   images_by_color: { [colorName]: string[] }    — ordered gallery per color
    //   image_variants:  { [angle]: { [colorSlug]: url } }   — MockupStudio lookup
    const slug = safeSegment(body.slug);
    const styleId = summary.styleID || summary.styleName;
    const basePath = `ssa/${styleId}/${Date.now()}`;
    const imagesByColor: Record<string, string[]> = {};
    const imageVariants: Record<string, Record<string, string>> = {};
    let totalRehosted = 0;
    const failedFetches: string[] = [];

    for (const color of colorsToImport) {
        // Per-color gallery: front, side, back, onModelFront — in that order so
        // the first image (front) becomes the catalog hero.
        const gallery: string[] = [];
        for (const angle of ANGLES) {
            const src = color.images[angle as Angle];
            if (!src) continue;
            const url = await rehostImage(
                adminSupabase,
                src,
                `${basePath}/${safeSegment(color.colorCode)}/${angle}`,
                failedFetches
            );
            if (!url) continue;
            gallery.push(url);
            // Populate image_variants for MockupStudio. Key = angle + colorSlug.
            const colorSlug = color.colorName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");
            if (!imageVariants[angle]) imageVariants[angle] = {};
            imageVariants[angle][colorSlug] = url;
            totalRehosted += 1;
        }
        if (gallery.length > 0) imagesByColor[color.colorName] = gallery;
    }

    if (totalRehosted === 0) {
        return NextResponse.json(
            {
                error:
                    "Could not download any product images from SS Activewear. Check the URLs returned by the API.",
                failedFetches,
            },
            { status: 502 }
        );
    }

    // Legacy flat `images[]`: take the front of each color (catalog hero per color).
    const galleryImages: string[] = [];
    for (const color of colorsToImport) {
        const first = imagesByColor[color.colorName]?.[0];
        if (first) galleryImages.push(first);
    }

    const styleNumber = (body.style_number?.trim() || summary.styleName).slice(0, 64);
    // Item # defaults to the first selected variant's SKU.
    const firstVariantSku = summary.raw.find((v) =>
        body.selectedColorCodes.includes(v.colorCode) &&
        body.selectedSizes.includes(v.sizeName)
    )?.sku;
    const itemNumber = (body.item_number?.trim() || firstVariantSku || "").slice(0, 64) || null;

    const insertPayload = {
        brand: (body.brand?.trim() || summary.brandName || "").slice(0, 120) || null,
        name: body.name.trim(),
        slug,
        category_id: body.category_id,
        // Keep legacy sku populated for back-compat (mirrors item_number).
        sku: itemNumber || styleNumber || null,
        item_number: itemNumber,
        style_number: styleNumber,
        source_url: (body.source_url?.trim() || summary.productUrl || "").slice(0, 500) || null,
        description:
            (body.description?.trim() || summary.description || "").slice(0, 2000) || null,
        base_price: body.base_price,
        featured: body.featured === true,
        published: body.published === true,
        colors: colorsToImport.map((c) => c.colorName),
        sizes: body.selectedSizes,
        images: galleryImages,
        images_by_color: imagesByColor,
        image_variants: imageVariants,
        base_color: colorsToImport[0]?.colorName ?? null,
    };

    const { data: product, error: insertError } = await adminSupabase
        .from("catalog_products")
        .insert(insertPayload)
        .select("id, slug, name")
        .single();

    if (insertError) {
        // If new columns (image_variants / base_color / brand / item_number /
        // style_number / source_url) don't exist yet, retry without them so
        // the import still works on un-migrated databases.
        if (
            /image_variants|images_by_color|base_color|print_areas|brand|item_number|style_number|source_url/.test(
                insertError.message
            )
        ) {
            const legacyPayload = { ...insertPayload };
            delete (legacyPayload as Record<string, unknown>).image_variants;
            delete (legacyPayload as Record<string, unknown>).images_by_color;
            delete (legacyPayload as Record<string, unknown>).base_color;
            delete (legacyPayload as Record<string, unknown>).brand;
            delete (legacyPayload as Record<string, unknown>).item_number;
            delete (legacyPayload as Record<string, unknown>).style_number;
            delete (legacyPayload as Record<string, unknown>).source_url;
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
                variantCount: totalRehosted,
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
