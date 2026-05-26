"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Loader2,
    Search,
    PackagePlus,
    AlertCircle,
    FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/utils/supabase/client";

type IdentifierKind = "style" | "sku" | "partNumber" | "styleId";

type SsaColor = {
    colorName: string;
    colorCode: string;
    colorFamily: string;
    swatch: string | null;
    images: {
        front: string | null;
        side: string | null;
        back: string | null;
        onModelFront: string | null;
    };
    availableSizes: string[];
    inStock: boolean;
};

type SsaProductSummary = {
    styleID: number;
    styleName: string;
    brandName: string;
    description: string;
    productUrl: string;
    colors: SsaColor[];
    sizes: string[];
    priceRange: { min: number; max: number };
};

type CatalogCategory = { id: string; name: string };

const IDENTIFIER_OPTIONS: Array<{ value: IdentifierKind; label: string; hint: string }> = [
    { value: "style", label: "Style number", hint: "e.g. 3001, 18500" },
    { value: "sku", label: "SKU / GTIN", hint: "Single variant SKU" },
    { value: "partNumber", label: "Part number", hint: "Your custom part number" },
    { value: "styleId", label: "Style ID", hint: "SSA internal style ID" },
];

export default function ImportFromSsaPage() {
    const router = useRouter();
    const supabase = createClient();

    // ─── Step state ───
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [identifier, setIdentifier] = useState("");
    const [kind, setKind] = useState<IdentifierKind>("style");
    const [mock, setMock] = useState(false);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [product, setProduct] = useState<SsaProductSummary | null>(null);

    // ─── Step 2 selections ───
    const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
    const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());

    // ─── Step 3 catalog metadata ───
    const [categories, setCategories] = useState<CatalogCategory[]>([]);
    const [existingBrands, setExistingBrands] = useState<string[]>([]);
    const [brand, setBrand] = useState("");
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugManual, setSlugManual] = useState(false);
    const [categoryId, setCategoryId] = useState("");
    const [itemNumber, setItemNumber] = useState("");
    const [styleNumber, setStyleNumber] = useState("");
    const [sourceUrl, setSourceUrl] = useState("");
    const [description, setDescription] = useState("");
    const [basePrice, setBasePrice] = useState("");
    const [published, setPublished] = useState(false);
    const [featured, setFeatured] = useState(false);
    const [importing, setImporting] = useState(false);

    // Auto-slug from name on step 3
    useEffect(() => {
        if (slugManual) return;
        setSlug(
            name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "")
        );
    }, [name, slugManual]);

    // Load categories + existing brands once
    useEffect(() => {
        (async () => {
            const { data } = await supabase
                .from("catalog_categories")
                .select("id, name")
                .order("sort_order");
            if (data) setCategories(data as CatalogCategory[]);
        })();
        (async () => {
            const { data } = await supabase
                .from("catalog_products")
                .select("brand")
                .not("brand", "is", null);
            if (data) {
                const unique = Array.from(
                    new Set(
                        data
                            .map((r: { brand: string | null }) => (r.brand || "").trim())
                            .filter((b: string) => b.length > 0)
                    )
                ).sort((a, b) => a.localeCompare(b));
                setExistingBrands(unique);
            }
        })();
    }, [supabase]);

    // ─── Step 1: lookup ───
    const runLookup = async () => {
        if (!identifier.trim()) {
            toast.error("Enter an identifier first");
            return;
        }
        setLookupLoading(true);
        try {
            const res = await fetch("/api/admin/ssa/lookup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier: identifier.trim(), kind, mock }),
            });
            const body = await res.json();
            if (!res.ok || !body.success) {
                toast.error(body.error || "Lookup failed");
                return;
            }
            const summary = body.product as SsaProductSummary;
            setProduct(summary);
            // Pre-fill step 3 metadata from API data. Brand stays separate
            // from the product name so the admin sees a clean split.
            setBrand(summary.brandName);
            // The API description usually starts with the brand+style — strip
            // that prefix so the product name is just the descriptive part.
            const cleanedName = stripBrandStylePrefix(
                summary.description,
                summary.brandName,
                summary.styleName
            );
            setName(cleanedName);
            setStyleNumber(summary.styleName);
            setItemNumber("");
            setSourceUrl(summary.productUrl);
            setDescription(summary.description);
            setBasePrice(summary.priceRange.min ? summary.priceRange.min.toFixed(2) : "");
            setSelectedColors(new Set());
            setSelectedSizes(new Set(summary.sizes));
            setStep(2);
            if (body.mock) toast.message("Loaded mock product data");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Lookup failed");
        } finally {
            setLookupLoading(false);
        }
    };

    // ─── Step 2 helpers ───
    const toggleColor = (code: string) => {
        const next = new Set(selectedColors);
        if (next.has(code)) next.delete(code);
        else next.add(code);
        setSelectedColors(next);
    };
    const toggleSize = (size: string) => {
        const next = new Set(selectedSizes);
        if (next.has(size)) next.delete(size);
        else next.add(size);
        setSelectedSizes(next);
    };
    const allColorsSelected =
        product && selectedColors.size === product.colors.length && product.colors.length > 0;
    const toggleAllColors = () => {
        if (!product) return;
        setSelectedColors(
            allColorsSelected ? new Set() : new Set(product.colors.map((c) => c.colorCode))
        );
    };

    // ─── Step 3: import ───
    const runImport = async () => {
        if (!product) return;
        if (selectedColors.size === 0) {
            toast.error("Select at least one color");
            return;
        }
        if (selectedSizes.size === 0) {
            toast.error("Select at least one size");
            return;
        }
        if (!name.trim() || !slug.trim() || !categoryId) {
            toast.error("Name, slug, and category are required");
            return;
        }
        const priceNum = parseFloat(basePrice);
        if (!(priceNum >= 0)) {
            toast.error("Enter a valid base price");
            return;
        }

        if (sourceUrl.trim() && !/^https?:\/\//i.test(sourceUrl.trim())) {
            toast.error("Source URL must start with http:// or https://");
            return;
        }

        setImporting(true);
        try {
            const res = await fetch("/api/admin/ssa/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    identifier: identifier.trim(),
                    kind,
                    mock,
                    selectedColorCodes: Array.from(selectedColors),
                    selectedSizes: Array.from(selectedSizes),
                    brand: brand.trim(),
                    name: name.trim(),
                    slug: slug.trim(),
                    category_id: categoryId,
                    item_number: itemNumber.trim(),
                    style_number: styleNumber.trim(),
                    source_url: sourceUrl.trim(),
                    description: description.trim(),
                    base_price: priceNum,
                    published,
                    featured,
                }),
            });
            const body = await res.json();
            if (!res.ok || !body.success) {
                toast.error(body.error || "Import failed");
                if (body.failedFetches?.length) {
                    console.warn("Failed image fetches:", body.failedFetches);
                }
                return;
            }
            toast.success(
                `Imported ${body.product.name} — ${body.imageCount} images, ${body.variantCount} variants${body.warning ? " (with warning)" : ""}`
            );
            if (body.warning) {
                toast.warning(body.warning);
            }
            router.push(`/admin/catalog/${body.product.id}`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Import failed");
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <Header step={step} onBack={() => router.push("/admin/catalog")} />

            {step === 1 && (
                <Step1Lookup
                    identifier={identifier}
                    setIdentifier={setIdentifier}
                    kind={kind}
                    setKind={setKind}
                    mock={mock}
                    setMock={setMock}
                    loading={lookupLoading}
                    onSubmit={runLookup}
                />
            )}

            {step === 2 && product && (
                <Step2Variants
                    product={product}
                    mock={mock}
                    selectedColors={selectedColors}
                    selectedSizes={selectedSizes}
                    toggleColor={toggleColor}
                    toggleSize={toggleSize}
                    allColorsSelected={!!allColorsSelected}
                    toggleAllColors={toggleAllColors}
                    onBack={() => setStep(1)}
                    onNext={() => {
                        if (selectedColors.size === 0) {
                            toast.error("Select at least one color");
                            return;
                        }
                        if (selectedSizes.size === 0) {
                            toast.error("Select at least one size");
                            return;
                        }
                        setStep(3);
                    }}
                />
            )}

            {step === 3 && product && (
                <Step3Metadata
                    product={product}
                    selectedColors={selectedColors}
                    selectedSizes={selectedSizes}
                    categories={categories}
                    existingBrands={existingBrands}
                    brand={brand}
                    setBrand={setBrand}
                    name={name}
                    setName={setName}
                    slug={slug}
                    setSlug={(v) => {
                        setSlugManual(true);
                        setSlug(v);
                    }}
                    categoryId={categoryId}
                    setCategoryId={setCategoryId}
                    itemNumber={itemNumber}
                    setItemNumber={setItemNumber}
                    styleNumber={styleNumber}
                    setStyleNumber={setStyleNumber}
                    sourceUrl={sourceUrl}
                    setSourceUrl={setSourceUrl}
                    description={description}
                    setDescription={setDescription}
                    basePrice={basePrice}
                    setBasePrice={setBasePrice}
                    published={published}
                    setPublished={setPublished}
                    featured={featured}
                    setFeatured={setFeatured}
                    importing={importing}
                    onBack={() => setStep(2)}
                    onImport={runImport}
                />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header with stepper
// ─────────────────────────────────────────────────────────────────────────────
function Header({ step, onBack }: { step: 1 | 2 | 3; onBack: () => void }) {
    const steps = ["Look up", "Pick colors & sizes", "Catalog details"];
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="text-slate-500 hover:text-slate-700"
                >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Catalog
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Import from SS Activewear</h1>
                    <p className="text-slate-500">
                        Enter a style number, pick variants, and publish to the catalog with images re-hosted to Supabase.
                    </p>
                </div>
            </div>
            <ol className="flex items-center gap-2">
                {steps.map((label, i) => {
                    const idx = i + 1;
                    const done = step > idx;
                    const current = step === idx;
                    return (
                        <li key={label} className="flex items-center gap-2">
                            <div
                                className={`h-7 w-7 grid place-items-center rounded-full text-xs font-bold border ${done
                                        ? "bg-slate-900 text-white border-slate-900"
                                        : current
                                            ? "bg-white text-slate-900 border-slate-900"
                                            : "bg-slate-50 text-slate-400 border-slate-200"
                                    }`}
                            >
                                {done ? <Check className="h-3.5 w-3.5" /> : idx}
                            </div>
                            <span
                                className={`text-sm ${current ? "font-semibold text-slate-900" : "text-slate-500"
                                    }`}
                            >
                                {label}
                            </span>
                            {idx < steps.length && (
                                <div className="mx-2 h-px w-10 bg-slate-200" />
                            )}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — lookup
// ─────────────────────────────────────────────────────────────────────────────
function Step1Lookup({
    identifier,
    setIdentifier,
    kind,
    setKind,
    mock,
    setMock,
    loading,
    onSubmit,
}: {
    identifier: string;
    setIdentifier: (v: string) => void;
    kind: IdentifierKind;
    setKind: (v: IdentifierKind) => void;
    mock: boolean;
    setMock: (v: boolean) => void;
    loading: boolean;
    onSubmit: () => void;
}) {
    return (
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-5 max-w-2xl">
            <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-slate-400" />
                <h2 className="text-lg font-bold text-slate-900">Look up a product</h2>
            </div>
            <p className="text-sm text-slate-500">
                The lookup calls SS Activewear&apos;s Products endpoint, groups variants by
                color, and returns available sizes &amp; pricing. No data is written yet.
            </p>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label>Identifier type</Label>
                    <Select value={kind} onValueChange={(v) => setKind(v as IdentifierKind)}>
                        <SelectTrigger className="bg-white border-slate-200">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                            {IDENTIFIER_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-400">
                        {IDENTIFIER_OPTIONS.find((o) => o.value === kind)?.hint}
                    </p>
                </div>
                <div className="space-y-2">
                    <Label>Value</Label>
                    <Input
                        autoFocus
                        placeholder="e.g. 3001"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !loading && onSubmit()}
                        className="border-slate-200"
                    />
                </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/60 px-4 py-3">
                <div className="flex items-center gap-2.5">
                    <FlaskConical className="h-4 w-4 text-amber-600" />
                    <div>
                        <p className="text-sm font-medium text-slate-700">Manual / mock mode</p>
                        <p className="text-xs text-slate-500">
                            Returns a Bella+Canvas 3001 fixture so the UI is testable without API credentials.
                        </p>
                    </div>
                </div>
                <Switch checked={mock} onCheckedChange={setMock} />
            </div>

            <div className="flex justify-end">
                <Button
                    onClick={onSubmit}
                    disabled={loading || !identifier.trim()}
                    className="bg-slate-900 text-white hover:bg-slate-800"
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Search className="h-4 w-4 mr-2" />
                    )}
                    {loading ? "Looking up..." : "Look up product"}
                </Button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — variant picker
// ─────────────────────────────────────────────────────────────────────────────
function Step2Variants({
    product,
    mock,
    selectedColors,
    selectedSizes,
    toggleColor,
    toggleSize,
    allColorsSelected,
    toggleAllColors,
    onBack,
    onNext,
}: {
    product: SsaProductSummary;
    mock: boolean;
    selectedColors: Set<string>;
    selectedSizes: Set<string>;
    toggleColor: (code: string) => void;
    toggleSize: (size: string) => void;
    allColorsSelected: boolean;
    toggleAllColors: () => void;
    onBack: () => void;
    onNext: () => void;
}) {
    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-start justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs font-mono">
                                Style {product.styleName}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                                {product.brandName}
                            </Badge>
                            {mock && (
                                <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                                    Mock data
                                </Badge>
                            )}
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">
                            {product.brandName} {product.styleName}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1 max-w-3xl">
                            {product.description}
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                            {product.colors.length} colors · {product.sizes.length} sizes ·
                            {" "}
                            {product.priceRange.min
                                ? `$${product.priceRange.min.toFixed(2)}–$${product.priceRange.max.toFixed(2)} piece price`
                                : "pricing unavailable"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">Colors</h3>
                    <button
                        onClick={toggleAllColors}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 underline-offset-2 hover:underline"
                    >
                        {allColorsSelected ? "Deselect all" : "Select all"}
                    </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {product.colors.map((c) => {
                        const selected = selectedColors.has(c.colorCode);
                        return (
                            <button
                                key={c.colorCode}
                                onClick={() => toggleColor(c.colorCode)}
                                className={`group relative flex flex-col rounded-lg border p-3 text-left transition-all ${selected
                                        ? "border-slate-900 ring-2 ring-slate-900/10 bg-slate-50"
                                        : "border-slate-200 hover:border-slate-400 bg-white"
                                    }`}
                            >
                                <div className="aspect-square rounded-md bg-slate-100 overflow-hidden mb-2">
                                    {c.images.front ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={c.images.front}
                                            alt={c.colorName}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-full w-full grid place-items-center text-slate-300 text-xs">
                                            No image
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {c.swatch ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={c.swatch}
                                            alt=""
                                            className="h-4 w-4 rounded-full border border-slate-200 shrink-0"
                                        />
                                    ) : (
                                        <span className="h-4 w-4 rounded-full bg-slate-200 shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 truncate">
                                            {c.colorName}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-mono uppercase">
                                            {c.colorCode} · {c.availableSizes.length} sizes
                                        </p>
                                    </div>
                                </div>
                                {selected && (
                                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-slate-900 text-white grid place-items-center">
                                        <Check className="h-3 w-3" />
                                    </div>
                                )}
                                {!c.inStock && (
                                    <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded px-1.5 py-0.5">
                                        OOS
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Sizes</h3>
                <div className="flex flex-wrap gap-2">
                    {product.sizes.map((s) => {
                        const selected = selectedSizes.has(s);
                        return (
                            <button
                                key={s}
                                onClick={() => toggleSize(s)}
                                className={`h-10 min-w-[3rem] px-3 rounded-md border text-sm font-medium transition-all ${selected
                                        ? "border-slate-900 bg-slate-900 text-white"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                                    }`}
                            >
                                {s}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                </Button>
                <Button onClick={onNext} className="bg-slate-900 text-white hover:bg-slate-800">
                    Next: catalog details
                    <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — catalog metadata + import
// ─────────────────────────────────────────────────────────────────────────────
function Step3Metadata({
    product,
    selectedColors,
    selectedSizes,
    categories,
    existingBrands,
    brand,
    setBrand,
    name,
    setName,
    slug,
    setSlug,
    categoryId,
    setCategoryId,
    itemNumber,
    setItemNumber,
    styleNumber,
    setStyleNumber,
    sourceUrl,
    setSourceUrl,
    description,
    setDescription,
    basePrice,
    setBasePrice,
    published,
    setPublished,
    featured,
    setFeatured,
    importing,
    onBack,
    onImport,
}: {
    product: SsaProductSummary;
    selectedColors: Set<string>;
    selectedSizes: Set<string>;
    categories: CatalogCategory[];
    existingBrands: string[];
    brand: string;
    setBrand: (v: string) => void;
    name: string;
    setName: (v: string) => void;
    slug: string;
    setSlug: (v: string) => void;
    categoryId: string;
    setCategoryId: (v: string) => void;
    itemNumber: string;
    setItemNumber: (v: string) => void;
    styleNumber: string;
    setStyleNumber: (v: string) => void;
    sourceUrl: string;
    setSourceUrl: (v: string) => void;
    description: string;
    setDescription: (v: string) => void;
    basePrice: string;
    setBasePrice: (v: string) => void;
    published: boolean;
    setPublished: (v: boolean) => void;
    featured: boolean;
    setFeatured: (v: boolean) => void;
    importing: boolean;
    onBack: () => void;
    onImport: () => void;
}) {
    const selectedColorObjects = useMemo(
        () => product.colors.filter((c) => selectedColors.has(c.colorCode)),
        [product.colors, selectedColors]
    );
    const totalImages = selectedColorObjects.reduce((acc, c) => {
        return (
            acc +
            Object.values(c.images).filter(Boolean).length +
            (c.swatch ? 1 : 0)
        );
    }, 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
                    <h2 className="text-lg font-bold text-slate-900">Catalog details</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Brand</Label>
                            <BrandCombobox value={brand} onChange={setBrand} options={existingBrands} />
                        </div>
                        <div className="space-y-2">
                            <Label>Product Name *</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="border-slate-200"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>
                                Style #<span className="text-xs text-slate-400 ml-2">(optional)</span>
                            </Label>
                            <Input
                                value={styleNumber}
                                onChange={(e) => setStyleNumber(e.target.value)}
                                className="border-slate-200 font-mono text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>
                                Item #<span className="text-xs text-slate-400 ml-2">(optional)</span>
                            </Label>
                            <Input
                                placeholder="auto-filled from first variant"
                                value={itemNumber}
                                onChange={(e) => setItemNumber(e.target.value)}
                                className="border-slate-200 font-mono text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>
                                Slug<span className="text-xs text-slate-400 ml-2">(auto)</span>
                            </Label>
                            <Input
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                className="border-slate-200 font-mono text-sm"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>
                            Source URL
                            <span className="text-xs text-slate-400 ml-2">
                                (link customers click on the item page)
                            </span>
                        </Label>
                        <Input
                            placeholder="https://www.ssactivewear.com/p/..."
                            value={sourceUrl}
                            onChange={(e) => setSourceUrl(e.target.value)}
                            className="border-slate-200"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <textarea
                            rows={4}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Category *</Label>
                            <Select value={categoryId} onValueChange={setCategoryId}>
                                <SelectTrigger className="bg-white border-slate-200">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Base Price *</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-400 text-sm">$</span>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={basePrice}
                                    onChange={(e) => setBasePrice(e.target.value)}
                                    className="pl-7 border-slate-200"
                                />
                            </div>
                            {product.priceRange.min > 0 && (
                                <p className="text-xs text-slate-400">
                                    SSA piece price range: ${product.priceRange.min.toFixed(2)}–$
                                    {product.priceRange.max.toFixed(2)}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
                    <h2 className="text-lg font-bold text-slate-900">Status</h2>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-700">Published</p>
                            <p className="text-xs text-slate-400">Visible on the website</p>
                        </div>
                        <Switch checked={published} onCheckedChange={setPublished} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-700">Featured</p>
                            <p className="text-xs text-slate-400">Highlighted on the catalog page</p>
                        </div>
                        <Switch checked={featured} onCheckedChange={setFeatured} />
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
                    <h2 className="text-lg font-bold text-slate-900">Import summary</h2>
                    <div className="space-y-1.5 text-sm">
                        <Row label="Colors" value={`${selectedColors.size}`} />
                        <Row label="Sizes" value={`${selectedSizes.size}`} />
                        <Row label="Variants" value={`${selectedColors.size * selectedSizes.size}`} />
                        <Row label="Images to rehost" value={`~${totalImages}`} />
                    </div>
                    <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                            Images are downloaded from SS Activewear and re-uploaded to the{" "}
                            <span className="font-mono">product-images</span> bucket. This may take
                            10–30 seconds.
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <Button
                        onClick={onImport}
                        disabled={importing}
                        className="bg-slate-900 text-white hover:bg-slate-800 h-11"
                    >
                        {importing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <PackagePlus className="h-4 w-4 mr-2" />
                        )}
                        {importing ? "Importing..." : "Import to catalog"}
                    </Button>
                    <Button variant="ghost" onClick={onBack} disabled={importing}>
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back
                    </Button>
                </div>
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-slate-500">{label}</span>
            <span className="font-semibold text-slate-900">{value}</span>
        </div>
    );
}

// SSA descriptions usually begin with "{Brand} {Style} ..." — strip that prefix
// so the product name field gets just the descriptive part. Falls back to the
// raw description if no prefix is detected.
function stripBrandStylePrefix(
    description: string,
    brand: string,
    style: string
): string {
    if (!description) return `${brand} ${style}`.trim();
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
        `^\\s*${escape(brand)}\\s*${escape(style)}\\s*(?:[-–—]\\s*)?`,
        "i"
    );
    const stripped = description.replace(pattern, "").trim();
    return stripped || description.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// BrandCombobox (same behavior as the one in product-form.tsx).
// ─────────────────────────────────────────────────────────────────────────────
function BrandCombobox({
    value,
    onChange,
    options,
}: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
}) {
    const [open, setOpen] = useState(false);
    const matches = value.trim()
        ? options.filter((o) => o.toLowerCase().includes(value.toLowerCase()))
        : options;
    const isNew =
        value.trim().length > 0 &&
        !options.some((o) => o.toLowerCase() === value.trim().toLowerCase());

    return (
        <div className="relative">
            <Input
                placeholder="e.g. BELLA + CANVAS"
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 120)}
                className="border-slate-200"
            />
            {open && (matches.length > 0 || isNew) && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-60 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
                    {matches.map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onChange(opt);
                                setOpen(false);
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                        >
                            <span className="text-slate-700">{opt}</span>
                            {value === opt && <CheckIcon />}
                        </button>
                    ))}
                    {isNew && (
                        <button
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                setOpen(false);
                            }}
                            className="flex w-full items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100"
                        >
                            <span>
                                Add new brand:{" "}
                                <span className="font-semibold text-slate-900">{value.trim()}</span>
                            </span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function CheckIcon() {
    return <Check className="h-3.5 w-3.5 text-slate-900" />;
}
