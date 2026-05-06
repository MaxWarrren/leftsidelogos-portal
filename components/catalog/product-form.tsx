"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!productId);

    // Form state
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugManual, setSlugManual] = useState(false);
    const [categoryId, setCategoryId] = useState("");
    const [sku, setSku] = useState("");
    const [description, setDescription] = useState("");
    const [basePrice, setBasePrice] = useState("");
    const [featured, setFeatured] = useState(false);
    const [published, setPublished] = useState(false);
    const [colors, setColors] = useState<string[]>([]);
    const [sizes, setSizes] = useState<string[]>([]);
    const [images, setImages] = useState<string[]>([]);
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
            setName(data.name);
            setSlug(data.slug);
            setSlugManual(true);
            setCategoryId(data.category_id);
            setSku(data.sku);
            setDescription(data.description || "");
            setBasePrice(String(data.base_price));
            setFeatured(data.featured);
            setPublished(data.published);
            setColors(data.colors || []);
            setSizes(data.sizes || []);
            setImages(data.images || []);
            setLoading(false);
        };
        fetchProduct();
    }, [productId, supabase, router]);

    // ─── Tag Management ───
    const addColor = () => {
        const val = newColor.trim();
        if (val && !colors.includes(val)) {
            setColors([...colors, val]);
            setNewColor("");
        }
    };

    const removeColor = (c: string) => setColors(colors.filter((x) => x !== c));

    const addSize = () => {
        const val = newSize.trim();
        if (val && !sizes.includes(val)) {
            setSizes([...sizes, val]);
            setNewSize("");
        }
    };

    const removeSize = (s: string) => setSizes(sizes.filter((x) => x !== s));

    // ─── Image Upload ───
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        const newImages: string[] = [];

        for (const file of Array.from(files)) {
            const ext = file.name.split(".").pop();
            const fileName = `${slug || "product"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const filePath = `products/${fileName}`;

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

            newImages.push(urlData.publicUrl);
        }

        setImages([...images, ...newImages]);
        setUploading(false);
        if (newImages.length > 0) {
            toast.success(`${newImages.length} image(s) uploaded`);
        }
    };

    const removeImage = (idx: number) => {
        setImages(images.filter((_, i) => i !== idx));
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
        if (!sku.trim()) {
            toast.error("SKU is required");
            return;
        }
        if (!basePrice || parseFloat(basePrice) < 0) {
            toast.error("Price must be a positive number");
            return;
        }

        setSaving(true);

        const payload = {
            name: name.trim(),
            slug: slug.trim(),
            category_id: categoryId,
            sku: sku.trim(),
            description: description.trim() || null,
            base_price: parseFloat(basePrice),
            featured,
            published,
            colors,
            sizes,
            images,
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
                                <Label>Product Name *</Label>
                                <Input
                                    placeholder="e.g. Richardson 112 Trucker Hat"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="border-slate-200"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>SKU *</Label>
                                <Input
                                    placeholder="e.g. 112"
                                    value={sku}
                                    onChange={(e) => setSku(e.target.value)}
                                    className="border-slate-200"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>
                                Slug
                                <span className="text-xs text-slate-400 ml-2">
                                    (auto-generated from name)
                                </span>
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

                    {/* Images */}
                    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-900">Images</h2>
                            <label className="cursor-pointer">
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                                <Button variant="outline" className="border-slate-200" asChild>
                                    <span>
                                        {uploading ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Upload className="h-4 w-4 mr-2" />
                                        )}
                                        {uploading ? "Uploading..." : "Upload Images"}
                                    </span>
                                </Button>
                            </label>
                        </div>
                        {images.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {images.map((img, idx) => (
                                    <div
                                        key={idx}
                                        className="relative group aspect-square rounded-lg border border-slate-200 overflow-hidden bg-slate-50"
                                    >
                                        <img
                                            src={img}
                                            alt={`Product image ${idx + 1}`}
                                            className="h-full w-full object-cover"
                                        />
                                        <button
                                            onClick={() => removeImage(idx)}
                                            className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                        {idx === 0 && (
                                            <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-slate-900/80 text-white text-[10px] font-bold uppercase rounded">
                                                Primary
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
                                <ImageIcon className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                                <p className="text-sm text-slate-400">
                                    No images yet. Upload images to showcase this product.
                                </p>
                            </div>
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
                </div>
            </div>
        </div>
    );
}
