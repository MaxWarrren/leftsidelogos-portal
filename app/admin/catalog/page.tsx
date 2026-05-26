"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    Search,
    Pencil,
    Trash2,
    Package,
    Tag,
    GripVertical,
    ExternalLink,
    Image as ImageIcon,
    Download,
} from "lucide-react";
import { toast } from "sonner";

type CatalogProduct = {
    id: string;
    name: string;
    slug: string;
    category_id: string;
    sku: string;
    description: string | null;
    colors: string[];
    sizes: string[];
    base_price: number;
    featured: boolean;
    published: boolean;
    images: string[];
    created_at: string;
    updated_at: string;
    catalog_categories: { name: string } | null;
};

type CatalogCategory = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    sort_order: number;
};

export default function AdminCatalogPage() {
    const supabase = createClient();
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [categories, setCategories] = useState<CatalogCategory[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [activeTab, setActiveTab] = useState("products");

    // Category dialog state
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<CatalogCategory | null>(null);
    const [categoryName, setCategoryName] = useState("");
    const [categoryDescription, setCategoryDescription] = useState("");
    const [categoryLoading, setCategoryLoading] = useState(false);

    const fetchProducts = useCallback(async () => {
        const { data, error } = await supabase
            .from("catalog_products")
            .select("*, catalog_categories(name)")
            .order("name");
        if (data) setProducts(data as CatalogProduct[]);
        if (error) console.error("Error fetching products:", error);
    }, [supabase]);

    const fetchCategories = useCallback(async () => {
        const { data, error } = await supabase
            .from("catalog_categories")
            .select("*")
            .order("sort_order");
        if (data) setCategories(data);
        if (error) console.error("Error fetching categories:", error);
    }, [supabase]);

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, [fetchProducts, fetchCategories]);

    // ─── Product Actions ───
    const togglePublished = async (id: string, published: boolean) => {
        const { error } = await supabase
            .from("catalog_products")
            .update({ published: !published })
            .eq("id", id);
        if (error) {
            toast.error("Failed to update product");
        } else {
            toast.success(published ? "Product unpublished" : "Product published");
            fetchProducts();
        }
    };

    const toggleFeatured = async (id: string, featured: boolean) => {
        const { error } = await supabase
            .from("catalog_products")
            .update({ featured: !featured })
            .eq("id", id);
        if (error) {
            toast.error("Failed to update product");
        } else {
            toast.success(featured ? "Removed from featured" : "Marked as featured");
            fetchProducts();
        }
    };

    const deleteProduct = async (id: string) => {
        if (!confirm("Are you sure you want to delete this product?")) return;
        const { error } = await supabase.from("catalog_products").delete().eq("id", id);
        if (error) {
            toast.error("Failed to delete product: " + error.message);
        } else {
            toast.success("Product deleted");
            fetchProducts();
        }
    };

    // ─── Category Actions ───
    const openCategoryDialog = (category?: CatalogCategory) => {
        if (category) {
            setEditingCategory(category);
            setCategoryName(category.name);
            setCategoryDescription(category.description || "");
        } else {
            setEditingCategory(null);
            setCategoryName("");
            setCategoryDescription("");
        }
        setIsCategoryDialogOpen(true);
    };

    const handleSaveCategory = async () => {
        if (!categoryName.trim()) {
            toast.error("Category name is required");
            return;
        }
        setCategoryLoading(true);

        const slug = categoryName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");

        if (editingCategory) {
            const { error } = await supabase
                .from("catalog_categories")
                .update({ name: categoryName.trim(), slug, description: categoryDescription.trim() || null })
                .eq("id", editingCategory.id);
            if (error) toast.error("Failed to update category: " + error.message);
            else toast.success("Category updated");
        } else {
            const nextOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 1 : 0;
            const { error } = await supabase
                .from("catalog_categories")
                .insert({ name: categoryName.trim(), slug, description: categoryDescription.trim() || null, sort_order: nextOrder });
            if (error) toast.error("Failed to create category: " + error.message);
            else toast.success("Category created");
        }

        setCategoryLoading(false);
        setIsCategoryDialogOpen(false);
        fetchCategories();
    };

    const deleteCategory = async (id: string) => {
        // Check if any products use this category
        const { count } = await supabase
            .from("catalog_products")
            .select("id", { count: "exact", head: true })
            .eq("category_id", id);

        if ((count || 0) > 0) {
            toast.error("Cannot delete a category that has products. Move or delete the products first.");
            return;
        }

        if (!confirm("Are you sure you want to delete this category?")) return;
        const { error } = await supabase.from("catalog_categories").delete().eq("id", id);
        if (error) toast.error("Failed to delete category: " + error.message);
        else {
            toast.success("Category deleted");
            fetchCategories();
        }
    };

    // ─── Filtering ───
    const filteredProducts = products.filter((p) => {
        const matchesSearch =
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = filterCategory === "all" || p.category_id === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const getProductCount = (categoryId: string) => products.filter(p => p.category_id === categoryId).length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Catalog Manager</h1>
                    <p className="text-slate-500">
                        Manage products and categories for the website.
                    </p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-slate-100">
                    <TabsTrigger value="products" className="data-[state=active]:bg-white">
                        <Package className="h-4 w-4 mr-2" />
                        Products ({products.length})
                    </TabsTrigger>
                    <TabsTrigger value="categories" className="data-[state=active]:bg-white">
                        <Tag className="h-4 w-4 mr-2" />
                        Categories ({categories.length})
                    </TabsTrigger>
                </TabsList>

                {/* ═══ PRODUCTS TAB ═══ */}
                <TabsContent value="products" className="mt-6">
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1">
                                <div className="relative max-w-sm flex-1">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search products or SKU..."
                                        className="pl-9 bg-white border-slate-200"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <select
                                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600"
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                >
                                    <option value="all">All Categories</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    className="border-slate-200"
                                    onClick={() => (window.location.href = "/admin/catalog/import")}
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Import from SSA
                                </Button>
                                <Button
                                    className="bg-slate-900 text-white hover:bg-slate-800"
                                    onClick={() => (window.location.href = "/admin/catalog/new")}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Product
                                </Button>
                            </div>
                        </div>
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[60px]">Image</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead className="text-center">Published</TableHead>
                                    <TableHead className="text-center">Featured</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.map((product) => (
                                    <TableRow key={product.id} className="group">
                                        <TableCell>
                                            <div className="h-10 w-10 rounded border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                                                {product.images?.[0] ? (
                                                    <img
                                                        src={product.images[0]}
                                                        alt={product.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <ImageIcon className="h-4 w-4 text-slate-300" />
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-900">
                                                    {product.name}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    {product.colors.length} colors · {product.sizes.length} sizes
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-slate-600 font-mono text-xs">
                                            {product.sku}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs font-medium">
                                                {product.catalog_categories?.name || "—"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium text-slate-900">
                                            ${product.base_price.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={product.published}
                                                onCheckedChange={() => togglePublished(product.id, product.published)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={product.featured}
                                                onCheckedChange={() => toggleFeatured(product.id, product.featured)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => (window.location.href = `/admin/catalog/${product.id}`)}
                                                className="text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                                title="Edit"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteProduct(product.id)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {filteredProducts.length === 0 && (
                            <div className="p-12 text-center text-slate-500 text-sm">
                                {searchQuery || filterCategory !== "all"
                                    ? "No products match your filters."
                                    : "No products yet. Click \"New Product\" to add your first item."}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* ═══ CATEGORIES TAB ═══ */}
                <TabsContent value="categories" className="mt-6">
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                            <span className="text-sm text-slate-500 font-medium">
                                {categories.length} categories
                            </span>
                            <Button
                                className="bg-slate-900 text-white hover:bg-slate-800"
                                onClick={() => openCategoryDialog()}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                New Category
                            </Button>
                        </div>
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[40px]">#</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Slug</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-center">Products</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.map((cat) => (
                                    <TableRow key={cat.id}>
                                        <TableCell className="text-slate-400 font-mono text-xs">
                                            {cat.sort_order}
                                        </TableCell>
                                        <TableCell className="font-semibold text-slate-900">
                                            {cat.name}
                                        </TableCell>
                                        <TableCell className="text-slate-500 font-mono text-xs">
                                            {cat.slug}
                                        </TableCell>
                                        <TableCell className="text-slate-500 text-sm max-w-[300px] truncate">
                                            {cat.description || "—"}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary" className="text-xs">
                                                {getProductCount(cat.id)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openCategoryDialog(cat)}
                                                className="text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteCategory(cat.id)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {categories.length === 0 && (
                            <div className="p-12 text-center text-slate-500 text-sm">
                                No categories yet. Create one to start organizing products.
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* ═══ Category Create/Edit Dialog ═══ */}
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogContent className="sm:max-w-[425px] bg-white border-slate-200">
                    <DialogHeader>
                        <DialogTitle>
                            {editingCategory ? "Edit Category" : "New Category"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingCategory
                                ? "Update this category's details."
                                : "Create a new product category for the website catalog."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Category Name</Label>
                            <Input
                                placeholder="e.g. Hoodies"
                                value={categoryName}
                                onChange={(e) => setCategoryName(e.target.value)}
                                className="border-slate-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description (optional)</Label>
                            <Input
                                placeholder="e.g. Heavyweight and midweight hoodies"
                                value={categoryDescription}
                                onChange={(e) => setCategoryDescription(e.target.value)}
                                className="border-slate-200"
                            />
                        </div>
                        {categoryName && (
                            <p className="text-xs text-slate-400">
                                Slug: <span className="font-mono">{categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}</span>
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            className="bg-slate-900 text-white"
                            onClick={handleSaveCategory}
                            disabled={categoryLoading}
                        >
                            {categoryLoading ? "Saving..." : editingCategory ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
