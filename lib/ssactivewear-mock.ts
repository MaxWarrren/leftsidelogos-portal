// Mock fixture for SS Activewear lookups. Returns realistic variant data for
// a Bella+Canvas 3001 tee so the import UI is fully testable before real
// credentials exist.
//
// Image URLs point at SSA's public CDN — they render in mock mode, but the
// import flow will attempt to re-host them. To test re-hosting end-to-end with
// no credentials, the import route accepts { mock: true } and uses these URLs
// as if they were API responses.

import type { SsaIdentifierKind, SsaVariant } from "./ssactivewear";

// Real placeholder images (placehold.co) so mock mode runs the rehost pipeline
// end-to-end and produces a working catalog product. The image URLs are
// absolute, so absoluteImageUrl() will pass them through unchanged.
function placeholder(label: string, hex: string, textHex = "FFFFFF") {
    const encoded = encodeURIComponent(label);
    return `https://placehold.co/600x600/${hex}/${textHex}/png?text=${encoded}`;
}

const COLORS: Array<{
    name: string;
    code: string;
    family: string;
    swatch: string;
    front: string;
    side: string;
    back: string;
}> = [
        {
            name: "Black",
            code: "BLK",
            family: "Black",
            swatch: placeholder("BLK", "0b0b0e"),
            front: placeholder("Black Front", "0b0b0e"),
            side: placeholder("Black Side", "0b0b0e"),
            back: placeholder("Black Back", "0b0b0e"),
        },
        {
            name: "White",
            code: "WHT",
            family: "White",
            swatch: placeholder("WHT", "f7f4ee", "0b0b0e"),
            front: placeholder("White Front", "f7f4ee", "0b0b0e"),
            side: placeholder("White Side", "f7f4ee", "0b0b0e"),
            back: placeholder("White Back", "f7f4ee", "0b0b0e"),
        },
        {
            name: "Athletic Heather",
            code: "ATH",
            family: "Grey",
            swatch: placeholder("ATH", "9ca3af"),
            front: placeholder("Athletic Heather Front", "9ca3af"),
            side: placeholder("Athletic Heather Side", "9ca3af"),
            back: placeholder("Athletic Heather Back", "9ca3af"),
        },
        {
            name: "Navy",
            code: "NVY",
            family: "Blue",
            swatch: placeholder("NVY", "003380"),
            front: placeholder("Navy Front", "003380"),
            side: placeholder("Navy Side", "003380"),
            back: placeholder("Navy Back", "003380"),
        },
        {
            name: "Heather Forest",
            code: "HFR",
            family: "Green",
            swatch: placeholder("HFR", "2e5e3a"),
            front: placeholder("Heather Forest Front", "2e5e3a"),
            side: placeholder("Heather Forest Side", "2e5e3a"),
            back: placeholder("Heather Forest Back", "2e5e3a"),
        },
        {
            name: "Cardinal",
            code: "CDL",
            family: "Red",
            swatch: placeholder("CDL", "9b1c1c"),
            front: placeholder("Cardinal Front", "9b1c1c"),
            side: placeholder("Cardinal Side", "9b1c1c"),
            back: placeholder("Cardinal Back", "9b1c1c"),
        },
];

const SIZES: Array<{ name: string; code: string; order: number; price: number }> = [
    { name: "XS", code: "XS", order: 1, price: 4.85 },
    { name: "S", code: "S", order: 2, price: 4.85 },
    { name: "M", code: "M", order: 3, price: 4.85 },
    { name: "L", code: "L", order: 4, price: 4.85 },
    { name: "XL", code: "XL", order: 5, price: 4.85 },
    { name: "2XL", code: "2XL", order: 6, price: 6.65 },
    { name: "3XL", code: "3XL", order: 7, price: 7.45 },
];

function buildMockVariants(): SsaVariant[] {
    const variants: SsaVariant[] = [];
    let skuCounter = 100;

    for (const color of COLORS) {
        for (const size of SIZES) {
            variants.push({
                sku: `B30001${color.code}${size.code}`,
                styleID: 3001,
                styleName: "3001",
                brandName: "Bella + Canvas",
                description:
                    "Bella+Canvas 3001 Unisex Jersey Short Sleeve Tee — Retail fit, side-seamed, 4.2 oz Airlume combed and ring-spun cotton.",
                colorName: color.name,
                colorCode: color.code,
                colorFamily: color.family,
                colorSwatchImage: color.swatch,
                colorFrontImage: color.front,
                colorSideImage: color.side,
                colorBackImage: color.back,
                colorOnModelFrontImage: null,
                sizeName: size.name,
                sizeCode: size.code,
                sizeOrder: size.order,
                piecePrice: size.price,
                casePrice: size.price * 0.85,
                customerPrice: size.price * 0.78,
                qty: 250 - skuCounter * 2,
                gtin: `00000${skuCounter}`,
            });
            skuCounter += 1;
        }
    }

    return variants;
}

const MOCK_VARIANTS = buildMockVariants();

export function MOCK_LOOKUP(
    identifier: string,
    _kind: SsaIdentifierKind
): SsaVariant[] {
    // In mock mode we ignore the identifier kind and return the 3001 fixture
    // regardless of what's typed — the goal is UI testing, not realism.
    void identifier;
    return MOCK_VARIANTS;
}
