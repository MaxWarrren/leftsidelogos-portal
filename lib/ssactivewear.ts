// SS Activewear API client.
//
// Docs: https://api.ssactivewear.com/V2/Default.aspx
// Auth: HTTP Basic — username = AccountNumber, password = APIKey.
// Rate limit: 60 req/min (X-Rate-Limit-Remaining header).
//
// Credentials must be requested by emailing api@ssactivewear.com from the
// account-holder's email; free for active wholesale accounts.
//
// Until we have real credentials, set SSA_MOCK=true (or omit credentials) and
// callers can pass { mock: true } — the client returns the fixture below.

import { MOCK_LOOKUP } from "./ssactivewear-mock";

const SSA_BASE_URL = "https://api.ssactivewear.com/v2";
const SSA_IMAGE_BASE = "https://www.ssactivewear.com/";

export type SsaIdentifierKind = "style" | "sku" | "partNumber" | "styleId";

export type SsaVariant = {
    sku: string;            // unique per color+size, e.g. "B00345002"
    styleID: number;
    styleName: string;      // "3001"
    brandName: string;      // "Bella + Canvas"
    description: string;    // marketing description
    colorName: string;      // "Black Heather"
    colorCode: string;      // "BLKH"
    colorFamily: string;    // "Black"
    colorSwatchImage: string | null;
    colorFrontImage: string | null;
    colorSideImage: string | null;
    colorBackImage: string | null;
    colorOnModelFrontImage?: string | null;
    sizeName: string;       // "L"
    sizeCode: string;
    sizeOrder: number;
    piecePrice: number;     // 1-piece price
    casePrice: number;      // 1-case price
    customerPrice?: number; // customer's negotiated price (basic auth required)
    qty: number;            // total stock across warehouses
    gtin?: string;
};

// Style-level metadata from the /v2/styles/{ident} endpoint. We hit this
// first to grab the proper `title` (e.g. "CVC Jersey Tee") and the long
// HTML `description` — both of which are absent from /v2/products/.
export type SsaStyle = {
    styleID: number;
    partNumber: string;
    brandName: string;
    styleName: string;
    title: string;          // e.g. "CVC Jersey Tee"
    description: string;    // HTML, usually containing a <ul> of features
    baseCategory?: string;
    categories?: string;
    brandImage?: string;
    styleImage?: string;
};

// What we return to the UI: variants regrouped by color, with per-color images
// and a full list of available sizes flattened.
export type SsaProductSummary = {
    styleID: number;
    styleName: string;
    brandName: string;
    title: string;          // from styles.title (e.g. "CVC Jersey Tee")
    description: string;    // raw HTML from styles.description
    bulletPoints: string[]; // parsed feature list from the description HTML
    productUrl: string;     // canonical SSA product page URL
    colors: SsaColor[];
    sizes: string[];        // unique, in size order
    sizeMap: Record<string, string[]>;  // colorCode -> sizes available for that color
    priceRange: { min: number; max: number };
    raw: SsaVariant[];      // keep raw for the import step
};

export type SsaColor = {
    colorName: string;
    colorCode: string;
    colorFamily: string;
    swatch: string | null;          // absolute URL
    images: {
        front: string | null;
        side: string | null;
        back: string | null;
        onModelFront: string | null;
    };
    availableSizes: string[];
    inStock: boolean;
};

export class SsaApiError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
        super(message);
        this.status = status;
        this.name = "SsaApiError";
    }
}

function basicAuthHeader(): string | null {
    const account = process.env.SSA_ACCOUNT_NUMBER;
    const key = process.env.SSA_API_KEY;
    if (!account || !key) return null;
    return "Basic " + Buffer.from(`${account}:${key}`).toString("base64");
}

function absoluteImageUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return SSA_IMAGE_BASE + path.replace(/^\/+/, "");
}

// Build the canonical SSA product page URL.
// Pattern: https://www.ssactivewear.com/p/{brand-slug}/{styleName}
// e.g. "BELLA + CANVAS" / "3001" -> /p/bella_+_canvas/3001
function buildProductUrl(brandName: string, styleName: string): string {
    const brandSlug = brandName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
    const styleSlug = encodeURIComponent(styleName.trim());
    return `${SSA_IMAGE_BASE}p/${encodeURI(brandSlug)}/${styleSlug}`;
}

// Extract bullet-point features from the HTML `description` returned by
// /v2/styles/{ident}. SSA's descriptions are basically `<p>…</p><ul><li>…</li></ul>`,
// so a regex is enough — no need to pull in cheerio. We strip whitespace and
// drop empty matches; nested tags inside <li> are rare on these endpoints and
// would just be passed through as text content.
export function parseBulletPoints(html: string): string[] {
    if (!html) return [];
    const out: string[] = [];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let m: RegExpExecArray | null;
    while ((m = liRegex.exec(html)) !== null) {
        // Strip any inline tags inside the <li>, collapse whitespace.
        const text = m[1]
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/\s+/g, " ")
            .trim();
        if (text) out.push(text);
    }
    return out;
}

function buildStyleLookupUrl(identifier: string, kind: SsaIdentifierKind): string {
    const id = identifier.trim();
    switch (kind) {
        case "styleId":
            return `${SSA_BASE_URL}/styles/?styleid=${encodeURIComponent(id)}&mediatype=json`;
        case "partNumber":
            return `${SSA_BASE_URL}/styles/?partnumber=${encodeURIComponent(id)}&mediatype=json`;
        case "sku":
        case "style":
        default:
            // /v2/styles/{ident} accepts StyleID, PartNumber, or "BrandName StyleName".
            // For a raw SKU we don't have a great path, but most SKUs start with the
            // partnumber, so fall back to the indexed endpoint by style name.
            return `${SSA_BASE_URL}/styles/${encodeURIComponent(id)}?mediatype=json`;
    }
}

async function fetchStyle(
    identifier: string,
    kind: SsaIdentifierKind
): Promise<SsaStyle | null> {
    const auth = basicAuthHeader();
    if (!auth) {
        throw new SsaApiError(
            "SS Activewear credentials are not configured. Set SSA_ACCOUNT_NUMBER and SSA_API_KEY, or use mock mode.",
            401
        );
    }

    const url = buildStyleLookupUrl(identifier, kind);
    const res = await fetch(url, {
        headers: { Authorization: auth, Accept: "application/json" },
        cache: "no-store",
    });

    // 404 from /styles isn't fatal — we can still recover the basics from
    // /products. Let the caller decide whether to bail.
    if (res.status === 404) return null;

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new SsaApiError(
            `SS Activewear styles API returned ${res.status}: ${body.slice(0, 200) || res.statusText}`,
            res.status
        );
    }

    const data = await res.json().catch(() => null);
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[0] as SsaStyle;
}

function buildLookupUrl(identifier: string, kind: SsaIdentifierKind): string {
    const id = identifier.trim();
    switch (kind) {
        case "style":
            return `${SSA_BASE_URL}/products/?style=${encodeURIComponent(id)}&mediatype=json`;
        case "styleId":
            return `${SSA_BASE_URL}/products/?styleid=${encodeURIComponent(id)}&mediatype=json`;
        case "partNumber":
            return `${SSA_BASE_URL}/products/?partnumber=${encodeURIComponent(id)}&mediatype=json`;
        case "sku":
        default:
            return `${SSA_BASE_URL}/products/${encodeURIComponent(id)}?mediatype=json`;
    }
}

async function fetchVariants(
    identifier: string,
    kind: SsaIdentifierKind
): Promise<SsaVariant[]> {
    const auth = basicAuthHeader();
    if (!auth) {
        throw new SsaApiError(
            "SS Activewear credentials are not configured. Set SSA_ACCOUNT_NUMBER and SSA_API_KEY, or use mock mode.",
            401
        );
    }

    const url = buildLookupUrl(identifier, kind);
    const res = await fetch(url, {
        headers: {
            Authorization: auth,
            Accept: "application/json",
        },
        // Keep response fresh; SSA inventory changes constantly.
        cache: "no-store",
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new SsaApiError(
            `SS Activewear API returned ${res.status}: ${body.slice(0, 200) || res.statusText}`,
            res.status
        );
    }

    const data = await res.json().catch(() => null);
    if (!Array.isArray(data)) {
        throw new SsaApiError("Unexpected response shape from SS Activewear", 500);
    }
    return data as SsaVariant[];
}

function groupVariants(
    rawVariants: SsaVariant[],
    style: SsaStyle | null = null
): SsaProductSummary {
    if (rawVariants.length === 0) {
        throw new SsaApiError("No variants returned for that identifier", 404);
    }
    const first = rawVariants[0];

    // Group by colorCode, preserving the first-seen image set per color.
    const colorMap = new Map<string, SsaColor>();
    const sizeMap: Record<string, string[]> = {};
    const allSizes = new Map<string, number>(); // sizeName -> sizeOrder

    for (const v of rawVariants) {
        allSizes.set(v.sizeName, v.sizeOrder);

        const existing = colorMap.get(v.colorCode);
        if (!existing) {
            colorMap.set(v.colorCode, {
                colorName: v.colorName,
                colorCode: v.colorCode,
                colorFamily: v.colorFamily,
                swatch: absoluteImageUrl(v.colorSwatchImage),
                images: {
                    front: absoluteImageUrl(v.colorFrontImage),
                    side: absoluteImageUrl(v.colorSideImage),
                    back: absoluteImageUrl(v.colorBackImage),
                    onModelFront: absoluteImageUrl(v.colorOnModelFrontImage),
                },
                availableSizes: [v.sizeName],
                inStock: v.qty > 0,
            });
            sizeMap[v.colorCode] = [v.sizeName];
        } else {
            if (!existing.availableSizes.includes(v.sizeName)) {
                existing.availableSizes.push(v.sizeName);
            }
            if (!sizeMap[v.colorCode].includes(v.sizeName)) {
                sizeMap[v.colorCode].push(v.sizeName);
            }
            if (v.qty > 0) existing.inStock = true;
        }
    }

    const sortedSizes = Array.from(allSizes.entries())
        .sort(([, a], [, b]) => a - b)
        .map(([s]) => s);

    // Ensure per-color size lists are also sorted by the global sizeOrder.
    for (const code of Object.keys(sizeMap)) {
        sizeMap[code] = sortedSizes.filter((s) => sizeMap[code].includes(s));
        const c = colorMap.get(code)!;
        c.availableSizes = sizeMap[code];
    }

    const prices = rawVariants
        .map((v) => v.customerPrice ?? v.piecePrice)
        .filter((p) => typeof p === "number" && p > 0);
    const priceRange = {
        min: prices.length ? Math.min(...prices) : 0,
        max: prices.length ? Math.max(...prices) : 0,
    };

    // Prefer style-level fields (`title`, HTML `description`) when available.
    // Fall back to whatever the variants gave us so mock mode + legacy code
    // paths still produce a valid summary.
    const descriptionHtml = style?.description ?? first.description ?? "";
    const bulletPoints = parseBulletPoints(descriptionHtml);
    const title = style?.title?.trim()
        || `${first.brandName} ${first.styleName}`.trim();

    return {
        styleID: style?.styleID ?? first.styleID,
        styleName: style?.styleName ?? first.styleName,
        brandName: style?.brandName ?? first.brandName,
        title,
        description: descriptionHtml,
        bulletPoints,
        productUrl: buildProductUrl(
            style?.brandName ?? first.brandName,
            style?.styleName ?? first.styleName
        ),
        colors: Array.from(colorMap.values()),
        sizes: sortedSizes,
        sizeMap,
        priceRange,
        raw: rawVariants,
    };
}

export async function lookupProduct(
    identifier: string,
    kind: SsaIdentifierKind,
    opts: { mock?: boolean } = {}
): Promise<SsaProductSummary> {
    if (!identifier?.trim()) {
        throw new SsaApiError("Identifier is required", 400);
    }
    if (opts.mock || process.env.SSA_MOCK === "true") {
        // Mock mode: synthesize a style record so the UI gets a realistic
        // title + bullet list to render, without hitting the network.
        const variants = MOCK_LOOKUP(identifier, kind);
        const first = variants[0];
        const mockStyle: SsaStyle = {
            styleID: first.styleID,
            partNumber: first.styleName,
            brandName: first.brandName,
            styleName: first.styleName,
            title: "Unisex Jersey Short Sleeve Tee",
            description:
                "<p>Bella+Canvas 3001 — the modern retail-fit tee.</p>" +
                "<ul>" +
                "<li>4.2 oz., 100% Airlume combed and ring-spun cotton</li>" +
                "<li>Retail fit, side-seamed</li>" +
                "<li>Shoulder taping</li>" +
                "<li>Heather Prism colors: 99% Airlume combed cotton, 1% poly</li>" +
                "</ul>",
        };
        return groupVariants(variants, mockStyle);
    }
    // Real API: hit /v2/styles first (for `title` + HTML description) and
    // /v2/products in parallel (for variants). We don't block on the styles
    // call failing — the importer will gracefully degrade to variant-derived
    // fields.
    const [style, variants] = await Promise.all([
        fetchStyle(identifier, kind).catch((e) => {
            console.warn("SSA style lookup failed, falling back to variant data:", e);
            return null;
        }),
        fetchVariants(identifier, kind),
    ]);
    return groupVariants(variants, style);
}

// Server-side image proxy: fetch from SSA's CDN, return bytes.
// We re-host into Supabase Storage so the public website doesn't depend on
// SSA's hotlink policy continuing to be lenient.
export async function downloadImage(url: string): Promise<{
    bytes: ArrayBuffer;
    contentType: string;
}> {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
        throw new SsaApiError(`Failed to fetch image ${url}: ${res.status}`, res.status);
    }
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const bytes = await res.arrayBuffer();
    return { bytes, contentType };
}
