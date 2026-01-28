"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Search, Copy, Pencil, Users as UsersIcon, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Order = {
    id: string;
    name: string;
    organization_id: string | null;
    price: number | null;
};

type Organization = {
    id: string;
    name: string;
    access_code: string;
    created_at: string;
    // member_count count from relation if needed
};

export default function AdminClientsPage() {
    const supabase = createClient();
    const router = useRouter();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
    const [newClientName, setNewClientName] = useState("");
    const [newClientCode, setNewClientCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const fetchData = async () => {
        const { data: orgs } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
        const { data: ordersData } = await supabase.from('orders').select('id, name, organization_id, price').order('name');

        if (orgs) setOrganizations(orgs);
        if (ordersData) setOrders(ordersData);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = async () => {
        if (!newClientName || !newClientCode) return;
        setIsLoading(true);

        const { data: newOrg, error } = await supabase.from('organizations').insert({
            name: newClientName,
            access_code: newClientCode
        }).select().single();

        if (error) {
            toast.error("Error creating client: " + error.message);
        } else {
            // Associate selected orders
            if (selectedOrderIds.length > 0) {
                await supabase.from('orders')
                    .update({ organization_id: newOrg.id })
                    .in('id', selectedOrderIds);
            }

            toast.success("Client created successfully!");
            setIsCreateOpen(false);
            setNewClientName("");
            setNewClientCode("");
            setSelectedOrderIds([]);
            fetchData();
        }
        setIsLoading(false);
    };

    const handleEdit = async () => {
        if (!editingOrgId || !newClientName || !newClientCode) return;
        setIsLoading(true);

        const { error } = await supabase.from('organizations')
            .update({
                name: newClientName,
                access_code: newClientCode
            })
            .eq('id', editingOrgId);

        if (error) {
            toast.error("Error updating client: " + error.message);
        } else {
            // Update order associations
            // 1. Unset old ones for this org
            await supabase.from('orders')
                .update({ organization_id: null })
                .eq('organization_id', editingOrgId);

            // 2. Set new ones
            if (selectedOrderIds.length > 0) {
                await supabase.from('orders')
                    .update({ organization_id: editingOrgId })
                    .in('id', selectedOrderIds);
            }

            toast.success("Client updated successfully!");
            setIsEditOpen(false);
            setEditingOrgId(null);
            setNewClientName("");
            setNewClientCode("");
            setSelectedOrderIds([]);
            fetchData();
        }
        setIsLoading(false);
    };

    const toggleOrderSelection = (orderId: string) => {
        setSelectedOrderIds(prev =>
            prev.includes(orderId)
                ? prev.filter(id => id !== orderId)
                : [...prev, orderId]
        );
    };

    const openEditDialog = (org: Organization) => {
        setEditingOrgId(org.id);
        setNewClientName(org.name);
        setNewClientCode(org.access_code);

        // Find orders currently associated with this org
        const associated = orders.filter(o => o.organization_id === org.id).map(o => o.id);
        setSelectedOrderIds(associated);

        setIsEditOpen(true);
    };

    const openCreateDialog = () => {
        setNewClientName("");
        setNewClientCode("");
        setSelectedOrderIds([]);
        setIsCreateOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This will delete all messages and data for this client.")) return;

        await supabase.from('organizations').delete().eq('id', id);
        fetchData();
    };

    const filteredOrgs = organizations.filter(org =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.access_code.includes(searchQuery)
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Clients</h1>
                    <p className="text-slate-500">Manage all client organizations and access codes.</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <Button onClick={openCreateDialog} className="bg-slate-900 text-white hover:bg-slate-800">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Client
                    </Button>
                    <DialogContent className="sm:max-w-[425px] bg-white text-slate-900 border-slate-200">
                        <DialogHeader>
                            <DialogTitle>Add New Client</DialogTitle>
                            <DialogDescription>
                                Create a new organization workspace.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={newClientName}
                                    onChange={e => setNewClientName(e.target.value)}
                                    className="border-slate-200"
                                    placeholder="Acme Corp"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="code">Access Code</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="code"
                                        value={newClientCode}
                                        onChange={e => setNewClientCode(e.target.value)}
                                        className="border-slate-200"
                                        placeholder="1234"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setNewClientCode(Math.floor(1000 + Math.random() * 9000).toString())}
                                    >
                                        Gen
                                    </Button>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label>Associate Orders</Label>
                                <div className="border border-slate-200 rounded-md p-2 bg-gray-50">
                                    <ScrollArea className="h-[120px]">
                                        <div className="space-y-1">
                                            {orders.map(order => (
                                                <div
                                                    key={order.id}
                                                    onClick={() => toggleOrderSelection(order.id)}
                                                    className={cn(
                                                        "flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-sm",
                                                        selectedOrderIds.includes(order.id)
                                                            ? "bg-slate-900 text-white"
                                                            : "hover:bg-slate-200 text-slate-700"
                                                    )}
                                                >
                                                    <span>{order.name}</span>
                                                    {selectedOrderIds.includes(order.id) && <Check className="h-4 w-4" />}
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {selectedOrderIds.map(id => {
                                        const order = orders.find(o => o.id === id);
                                        return order ? (
                                            <Badge key={id} variant="secondary" className="text-[10px]">
                                                {order.name}
                                            </Badge>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isLoading} onClick={handleCreate} className="bg-slate-900 text-white">
                                {isLoading ? "Creating..." : "Create Client"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogContent className="sm:max-w-[425px] bg-white text-slate-900 border-slate-200">
                        <DialogHeader>
                            <DialogTitle>Edit Client</DialogTitle>
                            <DialogDescription>
                                Update the organization workspace details.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-name">Name</Label>
                                <Input
                                    id="edit-name"
                                    value={newClientName}
                                    onChange={e => setNewClientName(e.target.value)}
                                    className="border-slate-200"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-code">Access Code</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="edit-code"
                                        value={newClientCode}
                                        onChange={e => setNewClientCode(e.target.value)}
                                        className="border-slate-200"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setNewClientCode(Math.floor(1000 + Math.random() * 9000).toString())}
                                    >
                                        Gen
                                    </Button>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label>Associate Orders</Label>
                                <div className="border border-slate-200 rounded-md p-2 bg-gray-50">
                                    <ScrollArea className="h-[120px]">
                                        <div className="space-y-1">
                                            {orders.map(order => (
                                                <div
                                                    key={order.id}
                                                    onClick={() => toggleOrderSelection(order.id)}
                                                    className={cn(
                                                        "flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-sm",
                                                        selectedOrderIds.includes(order.id)
                                                            ? "bg-slate-900 text-white"
                                                            : "hover:bg-slate-200 text-slate-700"
                                                    )}
                                                >
                                                    <span className="truncate pr-2">{order.name}</span>
                                                    {selectedOrderIds.includes(order.id) && <Check className="h-4 w-4 shrink-0" />}
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {selectedOrderIds.map(id => {
                                        const order = orders.find(o => o.id === id);
                                        return order ? (
                                            <Badge key={id} variant="secondary" className="text-[10px]">
                                                {order.name}
                                            </Badge>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isLoading} onClick={handleEdit} className="bg-slate-900 text-white">
                                {isLoading ? "Saving..." : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by name or code..."
                            className="pl-9 bg-gray-50 border-slate-200"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <Table>
                    <TableHeader className="bg-gray-50">
                        <TableRow>
                            <TableHead className="font-bold uppercase tracking-wider text-xs">Name</TableHead>
                            <TableHead className="font-bold uppercase tracking-wider text-xs">Access Code</TableHead>
                            <TableHead className="font-bold uppercase tracking-wider text-xs">LTV</TableHead>
                            <TableHead className="font-bold uppercase tracking-wider text-xs">Created At</TableHead>
                            <TableHead className="text-right font-bold uppercase tracking-wider text-xs">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredOrgs.map((org) => {
                            const accessCode = org.access_code; // Just using variable to match map
                            const ltv = orders
                                .filter(o => o.organization_id === org.id)
                                .reduce((sum, o) => sum + (o.price || 0), 0);

                            return (
                                <TableRow key={org.id}>
                                    <TableCell className="font-medium text-slate-900">{org.name}</TableCell>
                                    <TableCell>
                                        <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono border border-slate-200 text-slate-600">
                                            {org.access_code}
                                        </code>
                                    </TableCell>
                                    <TableCell className="font-medium text-slate-900">
                                        ${ltv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-slate-500 text-xs">
                                        {format(new Date(org.created_at), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => router.push(`/admin/clients/${org.id}/members`)}
                                            className="text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                            title="View Members"
                                        >
                                            <UsersIcon className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openEditDialog(org)}
                                            className="text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(org.id)}
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
                {filteredOrgs.length === 0 && (
                    <div className="p-12 text-center text-slate-500 text-sm">
                        No clients found matching your search.
                    </div>
                )}
            </div>
        </div>
    );
}
