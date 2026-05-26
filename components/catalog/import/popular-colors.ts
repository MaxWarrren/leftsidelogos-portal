// Hardcoded "smart list" of colors most clients actually print on.
// Used by the SSA importer Step 2 panel to surface popular options first
// instead of forcing the admin to scan a 30+ color grid.

export const POPULAR_COLOR_NAMES = [
    'White',
    'Black',
    'Navy',
    'Heather Grey',
    'Athletic Heather',
    'Maroon',
    'Forest Green',
    'Charcoal',
    'Royal',
    'Red',
    'Kelly Green',
    'Sand',
];

// Normalize a color name for fuzzy matching: lowercase + strip everything
// that isn't an alpha character. This makes "Heather Grey" == "heather grey"
// == "heather-grey" == "HeatherGrey".
function norm(s: string): string {
    return s.toLowerCase().replace(/[^a-z]/g, '');
}

export function isPopularColor(name: string, family?: string | null): boolean {
    const n = norm(name);
    if (POPULAR_COLOR_NAMES.some((p) => norm(p) === n)) return true;
    // Also try the colorFamily field as a fallback (e.g. "Heather" family)
    if (family) {
        const f = norm(family);
        if (POPULAR_COLOR_NAMES.some((p) => norm(p) === f)) return true;
    }
    return false;
}
