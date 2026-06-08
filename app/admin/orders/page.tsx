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
import { Plus, Search, Pencil, Trash2, Globe, Monitor, Inbox, Zap, CheckCircle, ReceiptText, Store, Users, DollarSign, ShoppingBag, Gauge } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Order = {
    id: string;
    organization_id: string | null;
    status: string;
    name: string;
    timeline_step: number;
    last_status_update: string;
    created_at: string;
    details: any;
    price: number | null;
    description: string | null;
    source: string | null;
    payment_status: string | null;
    customer_name: string | null;
    customer_email: string | null;
    attachments: string[] | null;
    organizations: {
        name: string;
    } | null;
};

type Organization = {
    id: string;
    name: string;
};

type Tab = 'new' | 'active' | 'finished';

const TAB_CONFIG: { key: Tab; label: string; icon: React.ElementType; statuses: string[] }[] = [
    { key: 'new', label: 'New', icon: Inbox, statuses: ['pending'] },
    { key: 'active', label: 'Active', icon: Zap, statuses: ['design', 'production', 'shipped'] },
    { key: 'finished', label: 'Finished', icon: CheckCircle, statuses: ['completed'] },
];

// Display metadata for each order source.
const SOURCE_META: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
    square: { label: 'Square Invoices', icon: ReceiptText, cls: 'bg-emerald-100 text-emerald-700' },
    'square-pos': { label: 'Square POS', icon: Store, cls: 'bg-amber-100 text-amber-700' },
    website: { label: 'Website', icon: Globe, cls: 'bg-indigo-100 text-indigo-700' },
    portal: { label: 'Portal', icon: Monitor, cls: 'bg-slate-100 text-slate-600' },
};
const sourceMeta = (s: string | null) => SOURCE_META[s ?? 'portal'] ?? SOURCE_META.portal;

const fmtMoney = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

// Unique clients: distinct orgs (for orders with an org) + distinct customer
// emails (for org-less analytics orders). POS is anonymous retail, so excluded.
function uniqueClientCount(list: Order[]): number {
    const ids = new Set<string>();
    for (const o of list) {
        if (o.source === 'square-pos') continue;
        if (o.organization_id) ids.add('org:' + o.organization_id);
        else if (o.customer_email) ids.add('em:' + o.customer_email.toLowerCase());
    }
    return ids.size;
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent: string }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
                <Icon className={cn("h-4 w-4", accent)} />
            </div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900">{value}</div>
        </div>
    );
}

export default function AdminOrdersPage() {
    const supabase = createClient();
    const [orders, setOrders] = useState<Order[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<Tab>('new');
    const [finishedYear, setFinishedYear] = useState<string>(String(new Date().getFullYear()));
    const [sourceFilter, setSourceFilter] = useState<string>('all');
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

        // Realtime updates for orders
        const channel = supabase
            .channel('admin-orders-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
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
            details: newOrderDetails,
            source: 'portal',
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
        if (!confirm("Are you sure you want to delete this order?")) return;
        await supabase.from('orders').delete().eq('id', id);
        fetchData();
    };

    // Tab filtering
    const currentStatuses = TAB_CONFIG.find(t => t.key === activeTab)?.statuses || [];

    // Years present in the Finished tab (descending), plus an "All time" option.
    const finishedYears = Array.from(
        new Set(orders.filter(o => o.status === 'completed').map(o => new Date(o.created_at).getFullYear()))
    ).sort((a, b) => b - a);
    const yearTabs: string[] = [...finishedYears.map(String), 'all'];

    // Year + source scoping (Finished tab only), applied before the text search.
    const scopedOrders = orders
        .filter(o => currentStatuses.includes(o.status))
        .filter(o => {
            if (activeTab !== 'finished') return true;
            const yearOk = finishedYear === 'all' || new Date(o.created_at).getFullYear() === Number(finishedYear);
            const sourceOk = sourceFilter === 'all' || (o.source ?? 'portal') === sourceFilter;
            return yearOk && sourceOk;
        });

    const searchLc = searchQuery.toLowerCase();
    const filteredOrders = scopedOrders.filter(o =>
        (o.organizations?.name ?? '').toLowerCase().includes(searchLc) ||
        (o.customer_name ?? '').toLowerCase().includes(searchLc) ||
        (o.name ?? '').toLowerCase().includes(searchLc) ||
        o.id.includes(searchQuery)
    );

    // Yearly analytics for the Finished tab (reflect the year + source scope, not the search box).
    const yearRevenue = scopedOrders.reduce((s, o) => s + (o.price || 0), 0);
    const yearStats = {
        revenue: yearRevenue,
        orders: scopedOrders.length,
        clients: uniqueClientCount(scopedOrders),
        aov: scopedOrders.length ? yearRevenue / scopedOrders.length : 0,
    };

    // Tab counts
    const tabCounts: Record<Tab, number> = {
        new: orders.filter(o => ['pending'].includes(o.status)).length,
        active: orders.filter(o => ['design', 'production', 'shipped'].includes(o.status)).length,
        finished: orders.filter(o => ['completed'].includes(o.status)).length,
    };

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

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                {TAB_CONFIG.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all",
                            activeTab === tab.key
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                        {tabCounts[tab.key] > 0 && (
                            <span className={cn(
                                "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                                activeTab === tab.key
                                    ? tab.key === 'new' ? "bg-amber-100 text-amber-700" : tab.key === 'active' ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                                    : "bg-slate-200 text-slate-600"
                            )}>
                                {tabCounts[tab.key]}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Finished-tab year sub-tabs, source filter, and yearly analytics */}
            {activeTab === 'finished' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        {yearTabs.map(y => (
                            <button
                                key={y}
                                onClick={() => setFinishedYear(y)}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-sm font-semibold transition-all",
                                    finishedYear === y ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                )}
                            >
                                {y === 'all' ? 'All time' : y}
                            </button>
                        ))}
                        <div className="ml-auto">
                            <Select value={sourceFilter} onValueChange={setSourceFilter}>
                                <SelectTrigger className="h-9 w-[180px] bg-white border-slate-200 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    <SelectItem value="all">All sources</SelectItem>
                                    <SelectItem value="square">Square Invoices</SelectItem>
                                    <SelectItem value="square-pos">Square POS</SelectItem>
                                    <SelectItem value="portal">Portal</SelectItem>
                                    <SelectItem value="website">Website</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard icon={DollarSign} label="Revenue" value={fmtMoney(yearStats.revenue)} accent="text-emerald-600" />
                        <StatCard icon={ShoppingBag} label="Orders" value={String(yearStats.orders)} accent="text-blue-600" />
                        <StatCard icon={Users} label="Unique Clients" value={String(yearStats.clients)} accent="text-violet-600" />
                        <StatCard icon={Gauge} label="Avg Order" value={fmtMoney(yearStats.aov)} accent="text-slate-600" />
                    </div>
                </div>
            )}

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
                            <TableHead>Source</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Timeline</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredOrders.map((order) => {
                            const m = sourceMeta(order.source);
                            const SourceIcon = m.icon;
                            return (
                            <TableRow key={order.id}>
                                <TableCell>
                                    <div className="max-w-[220px]">
                                        <p className="font-semibold text-slate-900 truncate" title={order.name}>{order.name}</p>
                                        {order.description && (
                                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{order.description}</p>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-slate-600">
                                    {order.organizations?.name ?? order.customer_name ?? <span className="text-slate-400">—</span>}
                                </TableCell>
                                <TableCell>
                                    <span className={cn(
                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                        m.cls
                                    )}>
                                        <SourceIcon className="h-3 w-3" /> {m.label}
                                    </span>
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
                            );
                        })}
                    </TableBody>
                </Table>
                {filteredOrders.length === 0 && (
                    <div className="p-12 text-center text-slate-500 text-sm">
                        {activeTab === 'new' ? 'No new orders waiting for review.' :
                         activeTab === 'active' ? 'No orders in production.' :
                         'No completed orders found for this view.'}
                    </div>
                )}
            </div>
        </div>
    );
}
