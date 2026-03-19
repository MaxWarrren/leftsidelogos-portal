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
import { FileText, Loader2, Plus, UserPlus, UserCheck, Pencil, Trash2, Mail } from "lucide-react";
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
    contact_type?: string;
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

export function ContactsTable({ initialCustomers, isLeadsView = false }: { initialCustomers: Customer[], isLeadsView?: boolean }) {
    const [customers, setCustomers] = useState<Customer[]>(initialCustomers);

    useEffect(() => {
        setCustomers(initialCustomers);
    }, [initialCustomers]);

    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]); // For linking existing users
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Invite State
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteData, setInviteData] = useState({
        leadId: '',
        organizationId: ''
    });

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        organization_id: 'none',
        company: '',
        status: 'contacted', // Default to contacted for new contacts
        linked_profile_id: 'none',
        contact_type: 'general'
    });
    const router = useRouter();
    const supabase = createClient();

    const fetchData = async () => {
        const { data: orgs } = await supabase.from('organizations').select('id, name').order('name');
        if (orgs) setOrganizations(orgs);

        if (!isLeadsView) {
            console.log("Fetching profiles...");
            const { data: profs, error } = await supabase.from('profiles').select('id, full_name, email, organization_id').order('full_name');
            if (error) {
                console.error("Error fetching profiles:", error);
                toast.error("Failed to load user profiles");
            }
            if (profs) {
                console.log("Profiles loaded:", profs.length);
                setProfiles(profs);
            }
        }
    };

    useEffect(() => {
        fetchData();
    }, [isLeadsView]);

    const getStatusColor = (status: string) => {
        const stage = PIPELINE_STAGES.find(s => s.value === status);
        return stage ? stage.color : 'bg-gray-100 text-gray-700';
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
                status: customer.status,
                linked_profile_id: customer.converted_profile_id || 'none',
                contact_type: customer.contact_type || 'general'
            });
        } else {
            setEditingCustomer(null);
            setFormData({
                name: '',
                email: '',
                phone: '',
                organization_id: 'none',
                company: '',
                status: 'contacted', // Ensure not 'new'
                linked_profile_id: 'none',
                contact_type: 'general'
            });
        }
        setIsFormOpen(true);
    };

    const handleProfileSelect = (profileId: string) => {
        setFormData(prev => ({ ...prev, linked_profile_id: profileId }));
        if (profileId === 'none') return;

        const profile = profiles.find(p => p.id === profileId);
        if (profile) {
            setFormData(prev => ({
                ...prev,
                name: profile.full_name || prev.name,
                email: profile.email || prev.email,
                organization_id: profile.organization_id || prev.organization_id
            }));
        }
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
            converted_profile_id: formData.linked_profile_id === 'none' ? null : formData.linked_profile_id,
            status: editingCustomer ? formData.status : (formData.status === 'new' ? 'contacted' : formData.status), // Force non-new
            contact_type: formData.contact_type
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

        const entityLabel = isLeadsView ? 'lead' : 'contact';
        if (!confirm(`Are you sure you want to delete this ${entityLabel}?`)) return;

        setUpdating(id);

        const customerToDelete = customers.find(c => c.id === id);

        if (customerToDelete?.file_paths && customerToDelete.file_paths.length > 0) {
            const { error: storageError } = await supabase.storage
                .from('leads-attachments')
                .remove(customerToDelete.file_paths);

            if (storageError) {
                console.error("Error deleting files:", storageError);
                toast.error("Failed to delete attachments");
            }
        }

        const { error } = await supabase.from('leads').delete().eq('id', id);

        if (error) {
            toast.error(`Failed to delete ${entityLabel}`);
        } else {
            toast.success(`${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} deleted`);
            setCustomers(customers.filter(c => c.id !== id));
            router.refresh();
        }
        setUpdating(null);
    };

    // New Invite Logic for Leads
    const openInviteDialog = (leadId: string, currentOrgId?: string) => {
        setInviteData({
            leadId,
            organizationId: currentOrgId || ''
        });
        setIsInviteOpen(true);
    };

    const handleInviteSubmit = async () => {
        if (!inviteData.organizationId) {
            toast.error("Please select an organization first.");
            return;
        }
        setUpdating(inviteData.leadId);
        const toastId = toast.loading("Sending invitation...");

        try {
            const lead = customers.find(c => c.id === inviteData.leadId);
            if (!lead) throw new Error("Lead not found");

            const res = await fetch('/api/admin/invite-user', {
                method: 'POST',
                body: JSON.stringify({
                    email: lead.email,
                    name: lead.name,
                    organizationId: inviteData.organizationId
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to invite user");
            }
            const { user } = await res.json();

            // API handles the leads update, but we update local state for immediate feedback
            setCustomers(prev => prev.map(c =>
                c.id === inviteData.leadId
                    ? { ...c, contact_type: 'invited', status: 'contacted', organization_id: inviteData.organizationId, converted_profile_id: user?.id }
                    : c
            ));

            toast.success("Invitation sent successfully!", { id: toastId });
            setIsInviteOpen(false);
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
                {!isLeadsView ? (
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
                                    <Label>Link Existing Portal User</Label>
                                    <Select
                                        value={formData.linked_profile_id}
                                        onValueChange={handleProfileSelect}
                                    >
                                        <SelectTrigger className="bg-white border-slate-200">
                                            <SelectValue placeholder="Select User (Optional)" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white">
                                            <SelectItem value="none">None (Manual Entry)</SelectItem>
                                            {profiles.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.email})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

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

                                <div className="grid gap-2">
                                    <Label>Contact Type</Label>
                                    <Select
                                        value={formData.contact_type}
                                        onValueChange={val => setFormData({ ...formData, contact_type: val })}
                                    >
                                        <SelectTrigger className="bg-white border-slate-200">
                                            <SelectValue placeholder="Select Type" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white">
                                            <SelectItem value="general">General Contact</SelectItem>
                                            <SelectItem value="invited">Invited</SelectItem>
                                            <SelectItem value="user">Portal User</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                                <Button onClick={handleSubmit} className="bg-slate-900 text-white" disabled={isLoading}>
                                    {isLoading ? "Saving..." : (editingCustomer ? "Save Changes" : "Add Contact")}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                ) : null}

                {/* Invite Dialog for New Leads */}
                <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Invite Lead to Portal</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Select Organization</Label>
                                <Select
                                    value={inviteData.organizationId}
                                    onValueChange={(val) => setInviteData(prev => ({ ...prev, organizationId: val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Organization" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {organizations.map(org => (
                                            <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-slate-500">
                                    Note: You must create an organization first in the Portal Users tab if it doesn't exist.
                                </p>
                            </div>
                            <div className="p-3 bg-blue-50 text-blue-800 rounded-md text-sm border border-blue-100">
                                This will send an invitation email with the access code to the lead and mark them as <strong>Invited</strong>.
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleInviteSubmit} disabled={!!updating} className="bg-slate-900 text-white">
                                {updating ? "Sending..." : "Send Invitation"}
                            </Button>
                        </DialogFooter>
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
                            {isLeadsView && <TableHead>Media</TableHead>}
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {customers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={isLeadsView ? 6 : 5} className="h-24 text-center">
                                    No {isLeadsView ? 'leads' : 'contacts'} found.
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
                                                {customer.contact_type === 'user' ? (
                                                    <Badge variant="outline" className="text-[10px] h-5 px-1 bg-green-50 text-green-700 border-green-200">
                                                        <UserCheck size={10} className="mr-1" />
                                                        User
                                                    </Badge>
                                                ) : customer.contact_type === 'invited' ? (
                                                    <Badge variant="outline" className="text-[10px] h-5 px-1 bg-purple-50 text-purple-700 border-purple-200">
                                                        <Mail size={10} className="mr-1" />
                                                        Invited
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] h-5 px-1 bg-blue-50 text-blue-700 border-blue-200">
                                                        <FileText size={10} className="mr-1" />
                                                        General
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
                                    <TableCell className="max-w-[100px]">
                                        {/* Summary Icon Logic */}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customer); }}
                                        >
                                            <FileText className="h-4 w-4 text-slate-500" />
                                        </Button>
                                    </TableCell>
                                    {isLeadsView && (
                                        <TableCell>
                                            <div className="flex -space-x-2 overflow-hidden">
                                                {customer.file_paths && customer.file_paths.length > 0 ? (
                                                    customer.file_paths.map((path, idx) => {
                                                        const publicUrl = path.startsWith('https://') ? path : supabase.storage.from('leads-attachments').getPublicUrl(path).data.publicUrl;
                                                        return (
                                                            <a
                                                                key={idx}
                                                                href={publicUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                onClick={e => e.stopPropagation()}
                                                                className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-100 flex items-center justify-center transition-transform hover:scale-110"
                                                                title={`Attachment ${idx + 1}`}
                                                            >
                                                                <FileText size={10} className="text-slate-600" />
                                                            </a>
                                                        );
                                                    })
                                                ) : (
                                                    <span className="text-xs text-slate-300">-</span>
                                                )}
                                            </div>
                                        </TableCell>
                                    )}
                                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                                        {isLeadsView ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => { e.stopPropagation(); openInviteDialog(customer.id, customer.organization_id); }}
                                            >
                                                <Mail className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <>
                                                {/* Invite icon for existing general contacts */}
                                                {(customer.contact_type !== 'user' && customer.contact_type !== 'invited' && !customer.converted_profile_id) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => { e.stopPropagation(); openInviteDialog(customer.id, customer.organization_id); }}
                                                        className="text-slate-500 hover:text-slate-900"
                                                        title="Invite to Portal"
                                                    >
                                                        <Mail className="h-4 w-4" />
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
                                            </>
                                        )}
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
                            <span>{isLeadsView ? 'Order Details' : 'Contact Details'}</span>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedCustomer && (
                        <div className="flex-1 overflow-y-auto pr-4">
                            {selectedCustomer.file_paths && selectedCustomer.file_paths.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Attachments</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedCustomer.file_paths.map((path, idx) => {
                                            const publicUrl = path.startsWith('https://') ? path : supabase.storage.from('leads-attachments').getPublicUrl(path).data.publicUrl;
                                            return (
                                                <a
                                                    key={idx}
                                                    href={publicUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-600 hover:bg-slate-200 transition-colors"
                                                >
                                                    <FileText size={14} />
                                                    <span>Attachment {idx + 1}</span>
                                                </a>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
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
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Project Info</h3>
                                    <div>
                                        <span className="block text-slate-400 text-xs">Description/Summary</span>
                                        <p className="text-sm text-slate-600 mt-1">
                                            {selectedCustomer.summary || "No summary available."}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Order Details Render */}
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Formatted Order Details</h3>
                                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 overflow-x-auto">
                                    {/* Simple formatted list based on details JSON */}
                                    {selectedCustomer.details && typeof selectedCustomer.details === 'object' ? (
                                        <div className="space-y-2 text-sm">
                                            {Object.entries(selectedCustomer.details).map(([key, value]) => (
                                                <div key={key} className="grid grid-cols-3 gap-4 border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                                                    <span className="font-medium text-slate-700 capitalize col-span-1 truncate" title={key.replace(/_/g, ' ')}>{key.replace(/_/g, ' ')}</span>
                                                    <span className="text-slate-600 col-span-2 break-words">{String(value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <pre className="text-xs font-mono text-slate-600 whitespace-pre-wrap break-all">
                                            {JSON.stringify(selectedCustomer.details, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
