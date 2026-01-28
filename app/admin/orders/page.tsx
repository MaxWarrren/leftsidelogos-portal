"use client";

import { useState, useEffect } from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Filter, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Order = {
    id: string;
    organization_id: string;
    status: string;
    name: string;
    timeline_step: number;
    last_status_update: string;
    created_at: string;
    details: { item: string; qty: number }[];
    price: number | null;
    organizations: {
        name: string;
    };
};

type Organization = {
    id: string;
    name: string;
};

export default function AdminOrdersPage() {
    const supabase = createClient();
    const [orders, setOrders] = useState<Order[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // New Order Form
    const [newOrderName, setNewOrderName] = useState("");
    const [newOrderOrgId, setNewOrderOrgId] = useState("");
    const [newOrderPrice, setNewOrderPrice] = useState("");
    const [newOrderDetails, setNewOrderDetails] = useState<{ item: string; qty: number }[]>([{ item: "", qty: 1 }]);

    const fetchData = async () => {
        const { data: ordersData } = await supabase
            .from('orders')
            .select('*, organizations(name)')
            .order('created_at', { ascending: false });

        const { data: orgsData } = await supabase
            .from('organizations')
            .select('id, name')
            .order('name');

        if (ordersData) setOrders(ordersData as any);
        if (orgsData) setOrganizations(orgsData);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = async () => {
        if (!newOrderOrgId || !newOrderName || newOrderDetails.some(d => !d.item)) {
            toast.error("Please fill in the order name, client, and at least one item.");
            return;
        }
        setIsLoading(true);

        const { error } = await supabase.from('orders').insert({
            organization_id: newOrderOrgId,
            name: newOrderName,
            status: 'pending',
            timeline_step: 1,
            price: parseFloat(newOrderPrice) || 0,
            details: newOrderDetails
        });

        if (error) {
            toast.error("Error creating order: " + error.message);
        } else {
            toast.success("Order created successfully!");
            setIsCreateOpen(false);
            setNewOrderName("");
            setNewOrderOrgId("");
            setNewOrderPrice("");
            setNewOrderDetails([{ item: "", qty: 1 }]);
            fetchData();
        }
        setIsLoading(false);
    };

    const addOrderItem = () => {
        setNewOrderDetails([...newOrderDetails, { item: "", qty: 1 }]);
    };

    const updateOrderItem = (index: number, field: 'item' | 'qty', value: string | number) => {
        const updated = [...newOrderDetails];
        updated[index] = { ...updated[index], [field]: value };
        setNewOrderDetails(updated);
    };

    const removeOrderItem = (index: number) => {
        if (newOrderDetails.length > 1) {
            setNewOrderDetails(newOrderDetails.filter((_, i) => i !== index));
        }
    };

    const statusToStep: Record<string, number> = {
        'pending': 1,
        'design': 1,
        'production': 2,
        'shipped': 3,
        'completed': 4
    };

    const updateStatus = async (id: string, status: string, step?: number) => {
        const targetStep = step ?? statusToStep[status] ?? 1;
        await supabase.from('orders').update({ status, timeline_step: targetStep }).eq('id', id);
        fetchData();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        await supabase.from('orders').delete().eq('id', id);
        fetchData();
    };

    const filteredOrders = orders.filter(order =>
        order.organizations?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.id.includes(searchQuery)
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Orders</h1>
                    <p className="text-slate-500">Monitor and manage every production line.</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-slate-900 text-white hover:bg-slate-800">
                            <Plus className="mr-2 h-4 w-4" />
                            New Order
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] bg-white border-slate-200">
                        <DialogHeader>
                            <DialogTitle>Create New Order</DialogTitle>
                            <DialogDescription>
                                Start a new production process for a client.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>Order Name</Label>
                                <Input
                                    placeholder="e.g. Org 1 Summer Merch"
                                    value={newOrderName}
                                    onChange={e => setNewOrderName(e.target.value)}
                                    className="border-slate-200"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Client Organization</Label>
                                <Select onValueChange={setNewOrderOrgId} value={newOrderOrgId}>
                                    <SelectTrigger className="bg-white border-slate-200">
                                        <SelectValue placeholder="Select a client" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        {organizations.map(org => (
                                            <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Total Price</Label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={newOrderPrice}
                                    onChange={e => setNewOrderPrice(e.target.value)}
                                    className="border-slate-200"
                                />
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Order Items</Label>
                                    <Button variant="outline" size="sm" onClick={addOrderItem}>
                                        <Plus className="h-3 w-3 mr-1" /> Add
                                    </Button>
                                </div>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                                    {newOrderDetails.map((detail, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <Input
                                                placeholder="Item name"
                                                value={detail.item}
                                                onChange={e => updateOrderItem(idx, 'item', e.target.value)}
                                                className="flex-1 border-slate-200"
                                            />
                                            <Input
                                                type="number"
                                                placeholder="Qty"
                                                value={detail.qty}
                                                onChange={e => updateOrderItem(idx, 'qty', parseInt(e.target.value) || 0)}
                                                className="w-20 border-slate-200"
                                            />
                                            {newOrderDetails.length > 1 && (
                                                <Button variant="ghost" size="icon" onClick={() => removeOrderItem(idx)} className="text-red-500">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button className="bg-slate-900 text-white" onClick={handleCreate} disabled={isLoading}>
                                {isLoading ? "Creating..." : "Create Order"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search orders or clients..."
                            className="pl-9 bg-white border-slate-200"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>Order Name</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Timeline</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredOrders.map((order) => (
                            <TableRow key={order.id}>
                                <TableCell className="font-semibold text-slate-900">
                                    {order.name}
                                </TableCell>
                                <TableCell className="text-slate-600">
                                    {order.organizations?.name}
                                </TableCell>
                                <TableCell className="text-slate-600 font-medium">
                                    {order.details?.reduce((sum, d) => sum + (d.qty || 0), 0) || 0}
                                </TableCell>
                                <TableCell className="font-medium text-slate-900">
                                    ${(order.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell>
                                    <Select
                                        defaultValue={order.status}
                                        onValueChange={(val: string) => updateStatus(order.id, val)}
                                    >
                                        <SelectTrigger className={cn(
                                            "h-7 w-[120px] text-[10px] font-bold uppercase py-0",
                                            order.status === 'pending' ? "bg-amber-100 text-amber-700" :
                                                order.status === 'completed' ? "bg-green-100 text-green-700" :
                                                    "bg-blue-100 text-blue-700"
                                        )}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white">
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="design">Design</SelectItem>
                                            <SelectItem value="production">Production</SelectItem>
                                            <SelectItem value="shipped">Shipped</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-slate-900"
                                                style={{ width: `${(order.timeline_step / 4) * 100}%` }}
                                            />
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            max="4"
                                            value={order.timeline_step}
                                            onChange={(e) => updateStatus(order.id, order.status, parseInt(e.target.value))}
                                            className="w-8 text-[10px] text-center border-none bg-transparent font-bold outline-none"
                                        />
                                    </div>
                                </TableCell>
                                <TableCell className="text-slate-500 text-xs">
                                    {format(new Date(order.created_at), 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => window.location.href = `/admin/orders/${order.id}`}
                                        className="text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                        title="View Details"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(order.id)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {filteredOrders.length === 0 && (
                    <div className="p-12 text-center text-slate-500 text-sm">
                        No orders found.
                    </div>
                )}
            </div>
        </div>
    );
}
