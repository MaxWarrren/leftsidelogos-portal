"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { FileText, Loader2, Plus, UserPlus, UserCheck, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

interface Customer {
    id: string;
    created_at: string;
    name: string;
    email: string;
    phone?: string;
    organization_id?: string;
    converted_profile_id?: string | null;
    company: string | null;
    status: string;
    summary: string | null;
    details: any;
    file_paths: string[] | null;
    organizations?: { name: string } | null;
}

interface Organization {
    id: string;
    name: string;
}

const PIPELINE_STAGES = [
    { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700' },
    { value: 'contacted', label: 'Contacted', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'proposal', label: 'Proposal Sent', color: 'bg-purple-100 text-purple-700' },
    { value: 'negotiation', label: 'Negotiation', color: 'bg-orange-100 text-orange-700' },
    { value: 'closed', label: 'Closed Won', color: 'bg-green-100 text-green-700' },
    { value: 'lost', label: 'Closed Lost', color: 'bg-gray-100 text-gray-700' },
];

export function ContactsTable({ initialCustomers }: { initialCustomers: Customer[] }) {
    const [customers, setCustomers] = useState<Customer[]>(initialCustomers);

    useEffect(() => {
        setCustomers(initialCustomers);
    }, [initialCustomers]);

    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        organization_id: 'none',
        company: '',
        status: 'new' // Keeping status in DB but not exposing in UI heavily
    });
    const router = useRouter();
    const supabase = createClient();

    const fetchData = async () => {
        const { data: orgs } = await supabase.from('organizations').select('id, name').order('name');
        if (orgs) setOrganizations(orgs);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getStatusColor = (status: string) => {
        const stage = PIPELINE_STAGES.find(s => s.value === status);
        return stage ? stage.color : 'bg-gray-100 text-gray-700';
    };

    const updateStatus = async (id: string, newStatus: string) => {
        setUpdating(id);
        const { error } = await supabase
            .from('leads') // Using 'leads' table as the store for customers
            .update({ status: newStatus })
            .eq('id', id);

        if (!error) {
            setCustomers((prev: Customer[]) => prev.map((c: Customer) => c.id === id ? { ...c, status: newStatus } : c));
            if (selectedCustomer && selectedCustomer.id === id) {
                setSelectedCustomer({ ...selectedCustomer, status: newStatus });
            }
            toast.success("Status updated");
            router.refresh();
        } else {
            toast.error("Failed to update status");
        }
        setUpdating(null);
    };

    const handleOpenForm = (customer?: Customer) => {
        if (customer) {
            setEditingCustomer(customer);
            setFormData({
                name: customer.name,
                email: customer.email,
                phone: customer.phone || '',
                organization_id: customer.organization_id || 'none',
                company: customer.company || '',
                status: customer.status
            });
        } else {
            setEditingCustomer(null);
            setFormData({
                name: '',
                email: '',
                phone: '',
                organization_id: 'none',
                company: '',
                status: 'new'
            });
        }
        setIsFormOpen(true);
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.email) {
            toast.error("Name and Email are required");
            return;
        }
        setIsLoading(true);

        const payload = {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            organization_id: formData.organization_id === 'none' ? null : formData.organization_id,
            company: formData.organization_id === 'none' ? formData.company : null,
        };

        let result;
        if (editingCustomer) {
            result = await supabase
                .from('leads')
                .update(payload)
                .eq('id', editingCustomer.id)
                .select('*, organizations(name)')
                .single();
        } else {
            result = await supabase
                .from('leads')
                .insert({
                    ...payload,
                    status: 'new',
                    details: { source: 'manual' }
                })
                .select('*, organizations(name)')
                .single();
        }

        const { data, error } = result;

        if (error) {
            toast.error(`Error ${editingCustomer ? 'updating' : 'adding'} contact: ` + error.message);
        } else {
            toast.success(`Contact ${editingCustomer ? 'updated' : 'added'} successfully!`);
            if (editingCustomer) {
                setCustomers(customers.map(c => c.id === editingCustomer.id ? { ...c, ...data } : c));
            } else {
                setCustomers([data, ...customers]);
            }
            setIsFormOpen(false);
            router.refresh();
        }
        setIsLoading(false);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this contact?")) return;

        setUpdating(id);
        const { error } = await supabase.from('leads').delete().eq('id', id);

        if (error) {
            toast.error("Failed to delete contact");
        } else {
            toast.success("Contact deleted");
            setCustomers(customers.filter(c => c.id !== id));
            router.refresh();
        }
        setUpdating(null);
    };

    const handleConvert = async (customer: Customer) => {
        if (!confirm(`Are you sure you want to invite ${customer.email} to the portal?`)) return;

        setUpdating(customer.id);
        const toastId = toast.loading("Sending invitation...");

        try {
            const res = await fetch('/api/admin/convert-lead', {
                method: 'POST',
                body: JSON.stringify({
                    leadId: customer.id,
                    email: customer.email,
                    name: customer.name,
                    organizationId: customer.organization_id
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to convert");
            }

            const { userId } = await res.json();

            // Update local state
            setCustomers(prev => prev.map(c => c.id === customer.id ? {
                ...c,
                converted_profile_id: userId,
                status: 'closed'
            } : c));

            toast.success("User invited successfully!", { id: toastId });
            router.refresh();

        } catch (error: any) {
            console.error(error);
            toast.error(error.message, { id: toastId });
        } finally {
            setUpdating(null);
        }
    };

    return (
        <>
            <div className="flex justify-end mb-4">
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <Button onClick={() => handleOpenForm()} className="bg-slate-900 text-white hover:bg-slate-800">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Contact
                    </Button>
                    <DialogContent className="sm:max-w-[500px] bg-white text-slate-900 border-slate-200">
                        <DialogHeader>
                            <DialogTitle>{editingCustomer ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="form-name">Name</Label>
                                <Input
                                    id="form-name"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="border-slate-200"
                                    placeholder="John Doe"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="form-email">Email</Label>
                                <Input
                                    id="form-email"
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="border-slate-200"
                                    placeholder="john@example.com"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="form-phone">Phone</Label>
                                <Input
                                    id="form-phone"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="border-slate-200"
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Organization / Company</Label>
                                <Select
                                    value={formData.organization_id}
                                    onValueChange={val => setFormData({ ...formData, organization_id: val })}
                                >
                                    <SelectTrigger className="bg-white border-slate-200">
                                        <SelectValue placeholder="Select Organization" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="none">New Lead (No Portal Access)</SelectItem>
                                        {organizations.map(org => (
                                            <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.organization_id === 'none' && (
                                <div className="grid gap-2">
                                    <Label htmlFor="form-company">Company Name</Label>
                                    <Input
                                        id="form-company"
                                        value={formData.company}
                                        onChange={e => setFormData({ ...formData, company: e.target.value })}
                                        className="border-slate-200"
                                        placeholder="Acme Corp"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                            <Button onClick={handleSubmit} className="bg-slate-900 text-white" disabled={isLoading}>
                                {isLoading ? "Saving..." : (editingCustomer ? "Save Changes" : "Add Contact")}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Organization</TableHead>
                            <TableHead>Summary</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {customers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No contacts found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            customers.map((customer) => (
                                <TableRow key={customer.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => setSelectedCustomer(customer)}>
                                    <TableCell className="whitespace-nowrap font-medium">
                                        {format(new Date(customer.created_at), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{customer.name}</span>
                                                {customer.converted_profile_id && (
                                                    <Badge variant="outline" className="text-[10px] h-5 px-1 bg-green-50 text-green-700 border-green-200">
                                                        <UserCheck size={10} className="mr-1" />
                                                        User
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="text-xs text-slate-500">{customer.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-900">{customer.company || customer.organizations?.name || '-'}</span>
                                            {customer.phone && <span className="text-[10px] text-slate-400">{customer.phone}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-[300px] truncate text-slate-500">
                                        {customer.summary || 'No summary available.'}
                                    </TableCell>
                                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                                        {!customer.converted_profile_id && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => { e.stopPropagation(); handleConvert(customer); }}
                                                disabled={updating === customer.id}
                                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                title="Convert to User"
                                            >
                                                {updating === customer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); handleOpenForm(customer); }}
                                            className="text-slate-500 hover:text-slate-900"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => handleDelete(customer.id, e)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span>Contact Details</span>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedCustomer && (
                        <ScrollArea className="flex-1 pr-4">
                            <div className="grid grid-cols-2 gap-8 mb-8">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Contact Info</h3>
                                    <div className="space-y-3 text-sm">
                                        <div>
                                            <span className="block text-slate-400 text-xs">Name</span>
                                            <span className="font-medium">{selectedCustomer.name}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 text-xs">Email</span>
                                            <span className="font-medium">{selectedCustomer.email}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 text-xs">Phone</span>
                                            <span className="font-medium">{selectedCustomer.phone || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 text-xs">Organization</span>
                                            <span className="font-medium">{selectedCustomer.organizations?.name || selectedCustomer.company || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Internal Notes</h3>
                                    <p className="text-sm text-slate-500 italic">
                                        Pipeline management is now handled via the Orders/Organizations view.
                                    </p>
                                </div>
                            </div>

                            <div className="mb-8">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Summary</h3>
                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg">
                                    {selectedCustomer.summary || "No summary available."}
                                </p>
                            </div>

                            {selectedCustomer.file_paths && selectedCustomer.file_paths.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Attachments</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedCustomer.file_paths.map((path, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-600"
                                            >
                                                <FileText size={14} />
                                                <span>Attachment {idx + 1}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Order Specifications</h3>
                                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                                    <pre className="text-xs font-mono text-slate-600 whitespace-pre-wrap">
                                        {JSON.stringify(selectedCustomer.details, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </ScrollArea>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
