"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
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
import {
    ArrowLeft,
    Plus,
    X,
    Upload,
    GripVertical,
    Trash2,
    Image as ImageIcon,
    Save,
    Loader2,
    ExternalLink,
    Check,
    Star,
    AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    TouchSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    rectSortingStrategy,
    sortableKeyboardCoordinates,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Lowercased, hyphenated color key. Must match Website MockupStudio's
// normalizeColorKey() so per-color image lookups line up across the boundary.
function colorSlug(color: string): string {
    return color
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

// Parse the storage object path back out of a Supabase getPublicUrl URL.
// Returns null for non-Supabase URLs so we don't try to delete external assets.
function storagePathFromPublicUrl(url: string, bucket: string): string | null {
    if (!url) return null;
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length));
}

const VIEW_ANGLES = ["front", "side", "back"] as const;
type ViewAngle = (typeof VIEW_ANGLES)[number];
type ImagesByColor = Record<string, string[]>;
type ImageVariants = Partial<Record<ViewAngle, Record<string, string>>>;

type CatalogCategory = {
    id: string;
    name: string;
    slug: string;
};

type ProductFormProps = {
    productId?: string; // If provided, we're editing; otherwise creating
};

export function ProductForm({ productId }: ProductFormProps) {
    const supabase = createClient();
    const router = useRouter();

    const [categories, setCategories] = useState<CatalogCategory[]>([]);
    const [existingBrands, setExistingBrands] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!productId);

    // Form state
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
    const [featured, setFeatured] = useState(false);
    const [published, setPublished] = useState(false);
    const [colors, setColors] = useState<string[]>([]);
    const [sizes, setSizes] = useState<string[]>([]);
    // Per-color image galleries. Shape: { [color]: string[] } where the first
    // entry is the hero. Replaces the flat `images` array as the source of truth.
    const [imagesByColor, setImagesByColor] = useState<ImagesByColor>({});
    // Per-(angle, color) image assignments for MockupStudio.
    // Shape: { front: { [colorSlug]: url }, side: {...}, back: {...} }
    const [imageVariants, setImageVariants] = useState<ImageVariants>({});
    const [activeColorTab, setActiveColorTab] = useState<string>("");
    const [addonRules, setAddonRules] = useState("");
    const [newColor, setNewColor] = useState("");
    const [newSize, setNewSize] = useState("");
    const [uploading, setUploading] = useState(false);

    // Auto-generate slug from name
    useEffect(() => {
        if (!slugManual && name) {
            setSlug(
                name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)/g, "")
            );
        }
    }, [name, slugManual]);

    // Fetch categories
    useEffect(() => {
        const fetchCategories = async () => {
            const { data } = await supabase
                .from("catalog_categories")
                .select("id, name, slug")
                .order("sort_order");
            if (data) setCategories(data);
        };
        fetchCategories();
    }, [supabase]);

    // Fetch distinct brands already in the catalog (for the brand combobox)
    useEffect(() => {
        const fetchBrands = async () => {
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
        };
        fetchBrands();
    }, [supabase]);

    // Fetch existing product if editing
    useEffect(() => {
        if (!productId) return;
        const fetchProduct = async () => {
            const { data, error } = await supabase
                .from("catalog_products")
                .select("*")
                .eq("id", productId)
                .single();
            if (error || !data) {
                toast.error("Product not found");
                router.push("/admin/catalog");
                return;
            }
            setBrand(data.brand || "");
            setName(data.name);
            setSlug(data.slug);
            setSlugManual(true);
            setCategoryId(data.category_id);
            setItemNumber(data.item_number || data.sku || "");
            setStyleNumber(data.style_number || "");
            setSourceUrl(data.source_url || "");
            setDescription(data.description || "");
            setBasePrice(String(data.base_price));
            setFeatured(data.featured);
            setPublished(data.published);
            setColors(data.colors || []);
            setSizes(data.sizes || []);
            // Prefer the new per-color shape; fall back to flat `images` for
            // products created before the migration.
            const loadedColors: string[] = data.colors || [];
            const loadedByColor: ImagesByColor = data.images_by_color || {};
            if (Object.keys(loadedByColor).length === 0 && (data.images || []).length > 0) {
                const fallbackKey =
                    (data.base_color && loadedColors.includes(data.base_color)
                        ? data.base_color
                        : loadedColors[0]) || "default";
                loadedByColor[fallbackKey] = data.images;
            }
            setImagesByColor(loadedByColor);
            setImageVariants((data.image_variants as ImageVariants) || {});
            setAddonRules(data.addon_rules || "");
            setActiveColorTab(loadedColors[0] || "");
            setLoading(false);
        };
        fetchProduct();
    }, [productId, supabase, router]);

    // Keep activeColorTab in sync when colors change (e.g. all colors removed,
    // or active color was deleted).
    useEffect(() => {
        if (colors.length === 0) {
            setActiveColorTab("");
            return;
        }
        if (!colors.includes(activeColorTab)) {
            setActiveColorTab(colors[0]);
        }
    }, [colors, activeColorTab]);

    // ─── Tag Management ───
    const addColor = () => {
        const val = newColor.trim();
        if (val && !colors.includes(val)) {
            setColors([...colors, val]);
            // Seed an empty gallery so the new color tab renders immediately.
            setImagesByColor((prev) => ({ ...prev, [val]: prev[val] || [] }));
            setActiveColorTab(val);
            setNewColor("");
        }
    };

    const removeColor = (c: string) => {
        setColors(colors.filter((x) => x !== c));
        // Also drop the color's gallery and any view assignments referencing it.
        setImagesByColor((prev) => {
            const next = { ...prev };
            delete next[c];
            return next;
        });
        const slug = colorSlug(c);
        setImageVariants((prev) => {
            const next: ImageVariants = {};
            for (const angle of VIEW_ANGLES) {
                const map = { ...(prev[angle] || {}) };
                delete map[slug];
                if (Object.keys(map).length > 0) next[angle] = map;
            }
            return next;
        });
    };

    const addSize = () => {
        const val = newSize.trim();
        if (val && !sizes.includes(val)) {
            setSizes([...sizes, val]);
            setNewSize("");
        }
    };

    const removeSize = (s: string) => setSizes(sizes.filter((x) => x !== s));

    // ─── Image Upload (per-color) ───
    const handleColorImageUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
        color: string
    ) => {
        // Snapshot to an array BEFORE clearing the input — FileList is a live
        // reference on many browsers, so resetting e.target.value empties it.
        const files = Array.from(e.target.files || []);
        // Reset the input so re-selecting the same file fires onChange again.
        e.target.value = "";
        if (files.length === 0) return;

        setUploading(true);
        const uploaded: string[] = [];

        for (const file of files) {
            const ext = file.name.split(".").pop() || "jpg";
            const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            // Scope path per product slug + color so deletes are predictable.
            const filePath = `products/${slug || "product"}/${colorSlug(color)}/${fileName}`;

            const { error } = await supabase.storage
                .from("product-images")
                .upload(filePath, file, {
                    cacheControl: "3600",
                    upsert: false,
                });

            if (error) {
                toast.error(`Failed to upload ${file.name}: ${error.message}`);
                continue;
            }

            const { data: urlData } = supabase.storage
                .from("product-images")
                .getPublicUrl(filePath);

            uploaded.push(urlData.publicUrl);
        }

        if (uploaded.length > 0) {
            setImagesByColor((prev) => ({
                ...prev,
                [color]: [...(prev[color] || []), ...uploaded],
            }));
            toast.success(`${uploaded.length} image(s) uploaded to ${color}`);
        }
        setUploading(false);
    };

    const removeColorImage = async (color: string, url: string) => {
        // Optimistic UI update + best-effort Storage cleanup.
        setImagesByColor((prev) => ({
            ...prev,
            [color]: (prev[color] || []).filter((u) => u !== url),
        }));
        // Clear any view assignments that pointed at this image.
        setImageVariants((prev) => {
            const next: ImageVariants = { ...prev };
            const slugKey = colorSlug(color);
            for (const angle of VIEW_ANGLES) {
                if (next[angle]?.[slugKey] === url) {
                    const map = { ...next[angle]! };
                    delete map[slugKey];
                    if (Object.keys(map).length > 0) next[angle] = map;
                    else delete next[angle];
                }
            }
            return next;
        });
        const path = storagePathFromPublicUrl(url, "product-images");
        if (path) {
            const { error } = await supabase.storage.from("product-images").remove([path]);
            if (error) console.warn("Failed to delete from Storage:", error.message);
        }
    };

    const reorderColorImages = (color: string, fromIdx: number, toIdx: number) => {
        setImagesByColor((prev) => {
            const list = prev[color] || [];
            return { ...prev, [color]: arrayMove(list, fromIdx, toIdx) };
        });
    };

    const setViewAssignment = (angle: ViewAngle, color: string, url: string | null) => {
        const slugKey = colorSlug(color);
        setImageVariants((prev) => {
            const next: ImageVariants = { ...prev };
            const map = { ...(next[angle] || {}) };
            if (url) map[slugKey] = url;
            else delete map[slugKey];
            if (Object.keys(map).length > 0) next[angle] = map;
            else delete next[angle];
            return next;
        });
    };

    // ─── Save ───
    const handleSave = async () => {
        if (!name.trim()) {
            toast.error("Product name is required");
            return;
        }
        if (!categoryId) {
            toast.error("Please select a category");
            return;
        }
        if (!basePrice || parseFloat(basePrice) < 0) {
            toast.error("Price must be a positive number");
            return;
        }
        if (sourceUrl.trim() && !/^https?:\/\//i.test(sourceUrl.trim())) {
            toast.error("Source URL must start with http:// or https://");
            return;
        }

        setSaving(true);

        // Derive a flat `images` array for back-compat: prefer the base_color's
        // gallery if a color matches, otherwise concat in color order.
        const baseColorKey =
            colors.find((c) => imagesByColor[c]?.length) || colors[0] || "default";
        const derivedImages: string[] =
            imagesByColor[baseColorKey]?.length
                ? imagesByColor[baseColorKey]
                : Object.values(imagesByColor).flat();

        const payload = {
            brand: brand.trim() || null,
            name: name.trim(),
            slug: slug.trim(),
            category_id: categoryId,
            // Keep legacy `sku` populated from item_number so existing rows
            // and any code still reading sku continues to work.
            sku: itemNumber.trim() || styleNumber.trim() || null,
            item_number: itemNumber.trim() || null,
            style_number: styleNumber.trim() || null,
            source_url: sourceUrl.trim() || null,
            description: description.trim() || null,
            base_price: parseFloat(basePrice),
            featured,
            published,
            colors,
            sizes,
            images: derivedImages,
            images_by_color: imagesByColor,
            image_variants: imageVariants,
            base_color: baseColorKey === "default" ? null : baseColorKey,
            addon_rules: addonRules.trim() || null,
        };

        let error;

        if (productId) {
            ({ error } = await supabase
                .from("catalog_products")
                .update(payload)
                .eq("id", productId));
        } else {
            ({ error } = await supabase.from("catalog_products").insert(payload));
        }

        if (error) {
            toast.error("Failed to save: " + error.message);
        } else {
            toast.success(productId ? "Product updated!" : "Product created!");
            router.push("/admin/catalog");
        }

        setSaving(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push("/admin/catalog")}
                        className="text-slate-500 hover:text-slate-700"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">
                            {productId ? "Edit Product" : "New Product"}
                        </h1>
                        <p className="text-slate-500">
                            {productId ? "Update product details" : "Add a new product to the website catalog"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 mr-4">
                        <Label className="text-sm text-slate-500">Published</Label>
                        <Switch checked={published} onCheckedChange={setPublished} />
                    </div>
                    <Button
                        className="bg-slate-900 text-white hover:bg-slate-800"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        {saving ? "Saving..." : "Save Product"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ═══ LEFT COLUMN: Main Details ═══ */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
                        <h2 className="text-lg font-bold text-slate-900">Product Details</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Brand</Label>
                                <BrandCombobox
                                    value={brand}
                                    onChange={setBrand}
                                    options={existingBrands}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Product Name *</Label>
                                <Input
                                    placeholder="e.g. Unisex 6 oz. Heavyweight Tee"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="border-slate-200"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>
                                    Style #
                                    <span className="text-xs text-slate-400 ml-2">(optional)</span>
                                </Label>
                                <Input
                                    placeholder="e.g. 3001"
                                    value={styleNumber}
                                    onChange={(e) => setStyleNumber(e.target.value)}
                                    className="border-slate-200 font-mono text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>
                                    Item #
                                    <span className="text-xs text-slate-400 ml-2">(optional)</span>
                                </Label>
                                <Input
                                    placeholder="e.g. B00345002"
                                    value={itemNumber}
                                    onChange={(e) => setItemNumber(e.target.value)}
                                    className="border-slate-200 font-mono text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>
                                    Slug
                                    <span className="text-xs text-slate-400 ml-2">(auto)</span>
                                </Label>
                                <Input
                                    value={slug}
                                    onChange={(e) => {
                                        setSlugManual(true);
                                        setSlug(e.target.value);
                                    }}
                                    className="border-slate-200 font-mono text-sm"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>
                                Source URL
                                <span className="text-xs text-slate-400 ml-2">
                                    (link customers click on the item page — e.g. ssactivewear.com listing)
                                </span>
                            </Label>
                            <div className="relative">
                                <Input
                                    placeholder="https://www.ssactivewear.com/p/bella_+_canvas/3001"
                                    value={sourceUrl}
                                    onChange={(e) => setSourceUrl(e.target.value)}
                                    className="border-slate-200 pr-9"
                                />
                                {sourceUrl.trim() && /^https?:\/\//i.test(sourceUrl.trim()) && (
                                    <a
                                        href={sourceUrl.trim()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-700"
                                        title="Open URL"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <textarea
                                placeholder="Product description..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
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
                                        placeholder="0.00"
                                        value={basePrice}
                                        onChange={(e) => setBasePrice(e.target.value)}
                                        className="pl-7 border-slate-200"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Images — per-color tabs + drag reorder + Mockup Studio view assignment */}
                    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Images</h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Drag to reorder. The first image in each color is the catalog hero.
                                </p>
                            </div>
                        </div>

                        {colors.length === 0 ? (
                            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                <div className="text-sm text-amber-800">
                                    Add at least one color (in the panel on the right) before uploading images.
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Color tab bar */}
                                <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3 -mx-1 px-1">
                                    {colors.map((color) => {
                                        const count = imagesByColor[color]?.length ?? 0;
                                        const active = activeColorTab === color;
                                        return (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setActiveColorTab(color)}
                                                className={`group flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${active
                                                        ? "bg-slate-900 text-white"
                                                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                                                    }`}
                                            >
                                                <span className="font-medium">{color}</span>
                                                <span
                                                    className={`text-[10px] font-mono tabular-nums rounded px-1 ${active
                                                            ? "bg-white/15 text-white"
                                                            : "bg-slate-200 text-slate-500"
                                                        }`}
                                                >
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {activeColorTab && (
                                    <ColorImageGallery
                                        color={activeColorTab}
                                        images={imagesByColor[activeColorTab] || []}
                                        uploading={uploading}
                                        onUpload={(e) => handleColorImageUpload(e, activeColorTab)}
                                        onRemove={(url) => removeColorImage(activeColorTab, url)}
                                        onReorder={(from, to) => reorderColorImages(activeColorTab, from, to)}
                                    />
                                )}

                                {activeColorTab && (
                                    <MockupViewsPicker
                                        color={activeColorTab}
                                        gallery={imagesByColor[activeColorTab] || []}
                                        imageVariants={imageVariants}
                                        onAssign={setViewAssignment}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* ═══ RIGHT COLUMN: Variants & Toggles ═══ */}
                <div className="space-y-6">
                    {/* Status */}
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

                    {/* Colors */}
                    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
                        <h2 className="text-lg font-bold text-slate-900">Colors</h2>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Add color..."
                                value={newColor}
                                onChange={(e) => setNewColor(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addColor())}
                                className="border-slate-200 flex-1"
                            />
                            <Button variant="outline" size="sm" onClick={addColor} className="border-slate-200">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {colors.map((c) => (
                                <Badge
                                    key={c}
                                    variant="secondary"
                                    className="text-xs pr-1 flex items-center gap-1"
                                >
                                    {c}
                                    <button
                                        onClick={() => removeColor(c)}
                                        className="ml-0.5 hover:text-red-500"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                            {colors.length === 0 && (
                                <p className="text-xs text-slate-400">No colors added</p>
                            )}
                        </div>
                    </div>

                    {/* Sizes */}
                    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
                        <h2 className="text-lg font-bold text-slate-900">Sizes</h2>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Add size..."
                                value={newSize}
                                onChange={(e) => setNewSize(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSize())}
                                className="border-slate-200 flex-1"
                            />
                            <Button variant="outline" size="sm" onClick={addSize} className="border-slate-200">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {sizes.map((s) => (
                                <Badge
                                    key={s}
                                    variant="secondary"
                                    className="text-xs pr-1 flex items-center gap-1"
                                >
                                    {s}
                                    <button
                                        onClick={() => removeSize(s)}
                                        className="ml-0.5 hover:text-red-500"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                            {sizes.length === 0 && (
                                <p className="text-xs text-slate-400">No sizes added</p>
                            )}
                        </div>
                    </div>

                    {/* Add-on Rules */}
                    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Add-on rules</h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                One rule per line. Displayed on the website item page as a bullet list.
                            </p>
                        </div>
                        <textarea
                            placeholder={"XL and up: extra $2\nSleeve logo: extra $5\nRush order (< 2 weeks): extra $3 per piece"}
                            value={addonRules}
                            onChange={(e) => setAddonRules(e.target.value)}
                            rows={6}
                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none font-mono"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ColorImageGallery — uploader + sortable grid for the active color.
// ─────────────────────────────────────────────────────────────────────────────
function ColorImageGallery({
    color,
    images,
    uploading,
    onUpload,
    onRemove,
    onReorder,
}: {
    color: string;
    images: string[];
    uploading: boolean;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemove: (url: string) => void;
    onReorder: (from: number, to: number) => void;
}) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const ids = useMemo(() => images.map((url, i) => `${i}::${url}`), [images]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const from = ids.indexOf(active.id as string);
        const to = ids.indexOf(over.id as string);
        if (from === -1 || to === -1) return;
        onReorder(from, to);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                    {images.length} image{images.length === 1 ? "" : "s"} in <span className="font-semibold text-slate-800">{color}</span>
                </span>
                <label className="cursor-pointer">
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={onUpload}
                        className="hidden"
                    />
                    <span className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium hover:bg-slate-50">
                        {uploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Upload className="h-4 w-4 mr-2" />
                        )}
                        {uploading ? "Uploading..." : `Upload to ${color}`}
                    </span>
                </label>
            </div>

            {images.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
                    <ImageIcon className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">
                        No images for {color} yet. Upload to add the first one.
                    </p>
                </div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={ids} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {images.map((url, idx) => (
                                <SortableImageThumb
                                    key={ids[idx]}
                                    id={ids[idx]}
                                    url={url}
                                    isHero={idx === 0}
                                    onRemove={() => onRemove(url)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
}

function SortableImageThumb({
    id,
    url,
    isHero,
    onRemove,
}: {
    id: string;
    url: string;
    isHero: boolean;
    onRemove: () => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 10 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="relative group aspect-square rounded-lg border border-slate-200 overflow-hidden bg-slate-50"
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover pointer-events-none" />
            <button
                type="button"
                {...attributes}
                {...listeners}
                className="absolute top-1.5 left-1.5 h-7 w-7 rounded-full bg-white/80 backdrop-blur text-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                title="Drag to reorder"
            >
                <GripVertical className="h-3.5 w-3.5" />
            </button>
            <button
                type="button"
                onClick={onRemove}
                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove"
            >
                <X className="h-3 w-3" />
            </button>
            {isHero && (
                <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900/85 text-white text-[10px] font-bold uppercase rounded">
                    <Star className="h-2.5 w-2.5 fill-white" />
                    Main
                </span>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MockupViewsPicker — for the active color, lets the admin pick which gallery
// image represents Front / Side / Back in MockupStudio. One image per view.
// ─────────────────────────────────────────────────────────────────────────────
function MockupViewsPicker({
    color,
    gallery,
    imageVariants,
    onAssign,
}: {
    color: string;
    gallery: string[];
    imageVariants: ImageVariants;
    onAssign: (angle: ViewAngle, color: string, url: string | null) => void;
}) {
    const slug = colorSlug(color);
    return (
        <div className="border-t border-slate-100 pt-4 space-y-3">
            <div>
                <h3 className="text-sm font-bold text-slate-900">Mockup Studio views</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                    Pick which {color} image represents each angle in the customer Mockup Studio.
                </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {VIEW_ANGLES.map((angle) => (
                    <ViewSlot
                        key={angle}
                        angle={angle}
                        currentUrl={imageVariants[angle]?.[slug] || null}
                        gallery={gallery}
                        onAssign={(url) => onAssign(angle, color, url)}
                    />
                ))}
            </div>
        </div>
    );
}

function ViewSlot({
    angle,
    currentUrl,
    gallery,
    onAssign,
}: {
    angle: ViewAngle;
    currentUrl: string | null;
    gallery: string[];
    onAssign: (url: string | null) => void;
}) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const label = angle === "front" ? "Front" : angle === "side" ? "Side" : "Back";

    return (
        <div className="rounded-md border border-slate-200 bg-slate-50/40 p-3 space-y-2 relative">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {label}
                </span>
                {currentUrl && (
                    <button
                        type="button"
                        onClick={() => onAssign(null)}
                        className="text-[10px] text-slate-400 hover:text-red-500 uppercase tracking-wider font-medium"
                    >
                        Clear
                    </button>
                )}
            </div>
            <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                disabled={gallery.length === 0}
                className="block w-full aspect-square rounded-md border border-dashed border-slate-300 bg-white overflow-hidden hover:border-slate-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
                {currentUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="h-full w-full grid place-items-center text-[11px] text-slate-400">
                        {gallery.length === 0 ? "Upload images first" : "Pick image"}
                    </div>
                )}
            </button>

            {pickerOpen && gallery.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-md border border-slate-200 bg-white shadow-lg p-2 max-h-72 overflow-auto">
                    <div className="grid grid-cols-3 gap-1.5">
                        {gallery.map((url) => {
                            const selected = url === currentUrl;
                            return (
                                <button
                                    key={url}
                                    type="button"
                                    onClick={() => {
                                        onAssign(url);
                                        setPickerOpen(false);
                                    }}
                                    className={`relative aspect-square rounded overflow-hidden border ${selected ? "border-slate-900 ring-2 ring-slate-900/20" : "border-slate-200 hover:border-slate-400"
                                        }`}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={url} alt="" className="h-full w-full object-cover" />
                                    {selected && (
                                        <div className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-slate-900 text-white grid place-items-center">
                                            <Check className="h-2.5 w-2.5" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// BrandCombobox — pick from existing brands or type a new one. Suggestions
// filter as the admin types; clicking one fills the input.
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
                            {value === opt && <Check className="h-3.5 w-3.5 text-slate-900" />}
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
                            <Plus className="h-3.5 w-3.5" />
                            <span>
                                Add new brand: <span className="font-semibold text-slate-900">{value.trim()}</span>
                            </span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
