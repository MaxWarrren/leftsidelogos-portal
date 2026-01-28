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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, FileText, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ClientFile = {
    id: string;
    organization_id: string;
    title: string;
    status: string;
    type: 'Contract' | 'Invoice';
    file_url: string;
    created_at: string;
    organizations: {
        name: string;
    };
};

type Organization = {
    id: string;
    name: string;
};

export default function AdminFilesPage() {
    const supabase = createClient();
    const [files, setFiles] = useState<ClientFile[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // New File Form
    const [newOrgId, setNewOrgId] = useState("");
    const [newTitle, setNewTitle] = useState("");
    const [newType, setNewType] = useState<'Contract' | 'Invoice'>('Contract');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const fetchData = async () => {
        const { data: filesData } = await supabase
            .from('contracts')
            .select('*, organizations(name)')
            .order('created_at', { ascending: false });

        const { data: orgsData } = await supabase
            .from('organizations')
            .select('id, name')
            .order('name');

        if (filesData) setFiles(filesData as any);
        if (orgsData) setOrganizations(orgsData);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = async () => {
        if (!newOrgId || !newTitle || !selectedFile) {
            toast.error("Please fill in all fields and select a file.");
            return;
        }
        setIsLoading(true);

        try {
            // 1. Upload File
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${newOrgId}/${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('contracts')
                .upload(fileName, selectedFile);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('contracts')
                .getPublicUrl(fileName);

            // 3. Create DB Record
            const { error: dbError } = await supabase.from('contracts').insert({
                organization_id: newOrgId,
                title: newTitle,
                type: newType,
                status: newType === 'Contract' ? 'pending' : 'unpaid',
                file_url: publicUrl
            });

            if (dbError) throw dbError;

            toast.success("File uploaded and created successfully!");
            setIsCreateOpen(false);
            setNewOrgId("");
            setNewTitle("");
            setNewType('Contract');
            setSelectedFile(null);
            fetchData();
        } catch (error: any) {
            toast.error("Error: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const updateStatus = async (id: string, status: string) => {
        await supabase.from('contracts').update({ status }).eq('id', id);
        fetchData();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        await supabase.from('contracts').delete().eq('id', id);
        fetchData();
    };

    const filteredFiles = files.filter(file =>
        file.organizations?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Files</h1>
                    <p className="text-slate-500">Manage client contracts and invoices.</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-slate-900 text-white hover:bg-slate-800">
                            <Plus className="mr-2 h-4 w-4" />
                            New File
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] bg-white border-slate-200">
                        <DialogHeader>
                            <DialogTitle>Add New File</DialogTitle>
                            <DialogDescription>
                                Upload a contract or invoice PDF.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>File Type</Label>
                                <Select onValueChange={(val: any) => setNewType(val)} value={newType}>
                                    <SelectTrigger className="bg-white border-slate-200 text-slate-900">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="Contract">Contract</SelectItem>
                                        <SelectItem value="Invoice">Invoice</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Client Organization</Label>
                                <Select onValueChange={setNewOrgId} value={newOrgId}>
                                    <SelectTrigger className="bg-white border-slate-200 text-slate-900">
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
                                <Label>Title</Label>
                                <Input
                                    placeholder="e.g. Service Agreement"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    className="border-slate-200 text-slate-900"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Upload File (PDF)</Label>
                                <Input
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                    className="border-slate-200 text-slate-900 cursor-pointer"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button className="bg-slate-900 text-white" onClick={handleCreate} disabled={isLoading}>
                                {isLoading ? "Creating..." : "Create File"}
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
                            placeholder="Search by client or title..."
                            className="pl-9 bg-white border-slate-200 text-slate-900"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredFiles.map((file) => (
                            <TableRow key={file.id}>
                                <TableCell>
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[10px] uppercase">
                                        {file.type || 'Contract'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-medium text-slate-900">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-slate-400" />
                                        {file.title}
                                    </div>
                                </TableCell>
                                <TableCell className="text-slate-600">
                                    {file.organizations?.name}
                                </TableCell>
                                <TableCell>
                                    <Select
                                        defaultValue={file.status}
                                        onValueChange={(val: string) => updateStatus(file.id, val)}
                                    >
                                        <SelectTrigger className={cn(
                                            "h-7 w-[120px] text-[10px] font-bold uppercase py-0",
                                            file.status === 'signed' || file.status === 'paid' ? "bg-green-100 text-green-700" :
                                                file.status === 'rejected' || file.status === 'overdue' ? "bg-red-100 text-red-700" :
                                                    "bg-amber-100 text-amber-700"
                                        )}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white">
                                            {file.type === 'Invoice' ? (
                                                <>
                                                    <SelectItem value="unpaid">Unpaid</SelectItem>
                                                    <SelectItem value="paid">Paid</SelectItem>
                                                    <SelectItem value="overdue">Overdue</SelectItem>
                                                </>
                                            ) : (
                                                <>
                                                    <SelectItem value="pending">Pending</SelectItem>
                                                    <SelectItem value="signed">Signed</SelectItem>
                                                    <SelectItem value="rejected">Rejected</SelectItem>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="text-slate-500 text-xs">
                                    {format(new Date(file.created_at), 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(file.id)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {filteredFiles.length === 0 && (
                    <div className="p-12 text-center text-slate-500 text-sm">
                        No files found.
                    </div>
                )}
            </div>
        </div>
    );
}
