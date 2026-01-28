"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Save, Package, Truck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type OrderDetail = {
    item: string;
    qty: number;
};

type Order = {
    id: string;
    organization_id: string;
    status: string;
    name: string;
    timeline_step: number;
    details: OrderDetail[];
    created_at: string;
    organizations: {
        name: string;
    };
};

export default function AdminOrderDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const supabase = createClient();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [orderName, setOrderName] = useState("");
    const [details, setDetails] = useState<OrderDetail[]>([]);

    useEffect(() => {
        const fetchOrder = async () => {
            const { data, error } = await supabase
                .from('orders')
                .select('*, organizations(name)')
                .eq('id', id)
                .single();

            if (error) {
                toast.error("Error loading order");
                router.push('/admin/orders');
                return;
            }

            const orderData = data as any;
            setOrder(orderData);
            setOrderName(orderData.name || "");
            setDetails(orderData.details || []);
            setLoading(false);
        };
        fetchOrder();
    }, [id, supabase, router]);

    const handleSave = async () => {
        if (!order || !orderName.trim()) {
            toast.error("Order name is required");
            return;
        }
        setSaving(true);
        const { error } = await supabase
            .from('orders')
            .update({
                name: orderName,
                details,
                status: order.status,
                timeline_step: order.timeline_step
            })
            .eq('id', order.id);

        if (error) {
            toast.error("Failed to update order: " + error.message);
        } else {
            toast.success("Order updated successfully");
            setOrder({ ...order, name: orderName, details });
        }
        setSaving(false);
    };

    const statusToStep: Record<string, number> = {
        'pending': 1,
        'design': 1,
        'production': 2,
        'shipped': 3,
        'completed': 4
    };

    const updateStatus = (status: string) => {
        if (order) setOrder({ ...order, status, timeline_step: statusToStep[status] || order.timeline_step });
    };

    const updateTimeline = (step: number) => {
        if (order) setOrder({ ...order, timeline_step: step });
    };

    const updateItem = (index: number, field: keyof OrderDetail, value: string | number) => {
        const newDetails = [...details];
        newDetails[index] = { ...newDetails[index], [field]: value };
        setDetails(newDetails);
    };

    const removeItem = (index: number) => {
        setDetails(details.filter((_, i) => i !== index));
    };

    const addItem = () => {
        setDetails([...details, { item: "", qty: 1 }]);
    };

    if (loading) return <div>Loading...</div>;
    if (!order) return <div>Order not found</div>;

    const timelineSteps = [
        { label: "Design", icon: CheckCircle2, value: 1 },
        { label: "Approval", icon: CheckCircle2, value: 2 },
        { label: "Production", icon: Package, value: 3 },
        { label: "Shipped", icon: Truck, value: 4 },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/admin/orders')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        {order.name}
                    </h1>
                    <p className="text-slate-500">Client: {order.organizations?.name}</p>
                </div>
                <div className="ml-auto flex gap-2">
                    <Button onClick={handleSave} disabled={saving} className="bg-slate-900 text-white">
                        <Save className="mr-2 h-4 w-4" />
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    {/* General Information Card */}
                    <Card className="bg-white border-slate-200">
                        <CardHeader>
                            <CardTitle className="text-lg">Order Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="orderName">Order Name</Label>
                                    <Input
                                        id="orderName"
                                        value={orderName}
                                        onChange={(e) => setOrderName(e.target.value)}
                                        className="border-slate-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Order ID</Label>
                                    <Input
                                        value={order.id}
                                        disabled
                                        className="bg-slate-50 border-slate-200 text-slate-500 font-mono text-xs uppercase"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Timeline Card */}
                    <Card className="bg-white border-slate-200">
                        <CardHeader>
                            <CardTitle className="text-lg">Production Timeline</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative flex justify-between items-center px-4 py-8">
                                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 z-0" />
                                <div
                                    className="absolute top-1/2 left-0 h-1 bg-slate-900 -translate-y-1/2 z-0 transition-all duration-500"
                                    style={{ width: `${((order.timeline_step - 1) / (timelineSteps.length - 1)) * 100}%` }}
                                />
                                {timelineSteps.map((step, idx) => {
                                    const isActive = step.value <= order.timeline_step;
                                    return (
                                        <div
                                            key={step.value}
                                            className="relative z-10 flex flex-col items-center gap-2 cursor-pointer group"
                                            onClick={() => updateTimeline(step.value)}
                                        >
                                            <div className={cn(
                                                "h-10 w-10 rounded-full flex items-center justify-center border-4 transition-all duration-300",
                                                isActive ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-300 group-hover:border-slate-400"
                                            )}>
                                                <step.icon className="h-5 w-5" />
                                            </div>
                                            <span className={cn(
                                                "text-xs font-bold uppercase",
                                                isActive ? "text-slate-900" : "text-slate-400"
                                            )}>{step.label}</span>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-4">
                                <Label>Current Status:</Label>
                                <Select value={order.status} onValueChange={updateStatus}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="design">Design</SelectItem>
                                        <SelectItem value="production">Production</SelectItem>
                                        <SelectItem value="shipped">Shipped</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Order Details (Line Items) */}
                    <Card className="bg-white border-slate-200">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">Line Items</CardTitle>
                            <Button variant="outline" size="sm" onClick={addItem}>
                                <Plus className="h-4 w-4 mr-2" /> Add Item
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {details.map((item, index) => (
                                <div key={index} className="flex gap-4 items-end">
                                    <div className="flex-1 space-y-1">
                                        <Label className="text-xs text-slate-500">Item Name</Label>
                                        <Input
                                            value={item.item}
                                            onChange={(e) => updateItem(index, 'item', e.target.value)}
                                        />
                                    </div>
                                    <div className="w-24 space-y-1">
                                        <Label className="text-xs text-slate-500">Qty</Label>
                                        <Input
                                            type="number"
                                            value={item.qty}
                                            onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => removeItem(index)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            {details.length === 0 && <p className="text-center text-slate-500 italic py-4">No items added.</p>}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
