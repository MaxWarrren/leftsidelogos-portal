"use client";

import { useParams } from "next/navigation";
import { ProductForm } from "@/components/catalog/product-form";

export default function EditProductPage() {
    const params = useParams();
    const productId = params.id as string;

    return <ProductForm productId={productId} />;
}
