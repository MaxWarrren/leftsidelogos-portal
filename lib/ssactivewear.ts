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

// What we return to the UI: variants regrouped by color, with per-color images
// and a full list of available sizes flattened.
export type SsaProductSummary = {
    styleID: number;
    styleName: string;
    brandName: string;
    description: string;
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

function groupVariants(rawVariants: SsaVariant[]): SsaProductSummary {
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

    return {
        styleID: first.styleID,
        styleName: first.styleName,
        brandName: first.brandName,
        description: first.description,
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
        return groupVariants(MOCK_LOOKUP(identifier, kind));
    }
    const variants = await fetchVariants(identifier, kind);
    return groupVariants(variants);
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
