"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Upload, FileIcon, Trash2, Download, Loader2, ImageIcon, FolderOpen, Eye, Pencil } from "lucide-react";
import Image from "next/image";
import { cn, formatBytes } from "@/lib/utils";
import { format } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Types
type MediaItem = {
    id: string;
    file_name: string;
    file_path: string;
    file_type: string;
    size: number;
    category: 'Brand Assets' | 'Mockups' | 'Final Designs';
    created_at: string;
    uploader_id: string;
};

type ClientFile = {
    id: string;
    title: string;
    status: string;
    file_url: string;
    type: 'Contract' | 'Invoice' | 'Tax Document';
    created_at: string;
    organization_id: string;
};

interface MediaGalleryProps {
    organizationId: string;
    isAdmin?: boolean;
}

export function MediaGallery({ organizationId, isAdmin = false }: MediaGalleryProps) {
    const supabase = createClient();
    const [activeTab, setActiveTab] = useState<string>("Brand Assets");
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [fileItems, setFileItems] = useState<ClientFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editingFile, setEditingFile] = useState<ClientFile | null>(null);

    const isFileTab = activeTab === "Files" || activeTab === "Taxes";

    // Fetch Items
    const fetchItems = async () => {
        setLoading(true);

        if (isFileTab) {
            // Fetch Contracts/Invoices/Taxes
            let query = supabase
                .from('contracts')
                .select('*')
                .eq('organization_id', organizationId)
                .order('created_at', { ascending: false });

            if (activeTab === "Taxes") {
                query = query.eq('type', 'Tax Document');
            } else {
                // For "Files" tab, show everything NOT Tax Document (Contracts, Invoices, etc)
                query = query.neq('type', 'Tax Document');
            }

            const { data, error } = await query;

            if (error) {
                toast.error("Failed to load files");
                console.error(error);
            } else {
                setFileItems(data as ClientFile[]);
            }

        } else {
            // Fetch Media
            const { data, error } = await supabase
                .from('media_items')
                .select('*')
                .eq('organization_id', organizationId)
                .eq('category', activeTab)
                .order('created_at', { ascending: false });

            if (error) {
                toast.error("Failed to load media");
                console.error(error);
            } else {
                setMediaItems(data as MediaItem[]);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        setMediaItems([]);
        setFileItems([]);
        fetchItems();

        const channel = supabase
            .channel(`media-gallery-${organizationId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                filter: `organization_id=eq.${organizationId}`
            }, () => {
                fetchItems();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [organizationId, activeTab, supabase]);

    // Handle File Upload (Switch based on tab)
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setUploading(true);

        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // Define path and bucket based on tab
            let bucket = 'organization-assets';
            let filePath = '';

            if (isFileTab) {
                // Files go to 'contracts' bucket or similar? 
                // Using 'organization-assets' for simplicity as they are files for org
                filePath = `${organizationId}/documents/${fileName}`;
            } else {
                filePath = `${organizationId}/${activeTab}/${fileName}`;
            }

            // 1. Upload to Storage
            const { error: uploadError, data: uploadData } = await supabase.storage
                .from(bucket)
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Insert Record
            if (isFileTab) {
                // Insert into contracts
                const { error: dbError } = await supabase.from('contracts').insert({
                    organization_id: organizationId,
                    title: file.name,
                    file_url: filePath,
                    type: activeTab === 'Taxes' ? 'Tax Document' : 'Contract', // Default type
                    status: 'pending',
                    metadata: {
                        uploaded_by: user.id,
                        size: file.size,
                        original_name: file.name
                    }
                });
                if (dbError) throw dbError;
            } else {
                // Insert into media_items
                const { error: dbError } = await supabase.from('media_items').insert({
                    organization_id: organizationId,
                    uploader_id: user.id,
                    file_path: filePath,
                    file_name: file.name,
                    file_type: file.type,
                    size: file.size,
                    category: activeTab,
                });
                if (dbError) throw dbError;
            }

            toast.success("File uploaded successfully");
            fetchItems();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Upload failed");
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    // Generic Download
    const handleDownload = async (path: string, fileName: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('organization-assets')
                .download(path);

            if (error) throw error;

            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error(error);
            toast.error("Download failed");
        }
    };

    // Delete Item
    const handleDelete = async (id: string, path: string, isFile: boolean) => {
        if (!confirm("Are you sure you want to delete this file?")) return;

        try {
            // 1. Delete from Storage
            await supabase.storage.from('organization-assets').remove([path]);

            // 2. Delete from DB
            const table = isFile ? 'contracts' : 'media_items';
            const { error } = await supabase.from(table).delete().eq('id', id);

            if (error) throw error;

            toast.success("File deleted");
            fetchItems();
        } catch (error) {
            console.error(error);
            toast.error("Deletion failed");
        }
    };

    const handleUpdateFile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingFile) return;

        try {
            const { error } = await supabase
                .from('contracts')
                .update({
                    type: editingFile.type,
                    status: editingFile.status,
                    title: editingFile.title // allow renaming
                })
                .eq('id', editingFile.id);

            if (error) throw error;
            toast.success("File updated");
            setEditingFile(null);
            fetchItems();
        } catch (error) {
            toast.error("Update failed");
        }
    }


    return (
        <div className="flex flex-col h-full bg-slate-50/50 p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Media & Files</h1>
                <div className="relative">
                    <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploading}
                    />
                    <label htmlFor="file-upload">
                        <Button
                            asChild
                            disabled={uploading}
                            className="curso-pointer bg-slate-900 hover:bg-slate-800 text-white"
                        >
                            <span className="cursor-pointer flex items-center gap-2">
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                Upload {isFileTab ? 'Document' : 'Image'}
                            </span>
                        </Button>
                    </label>
                </div>
            </div>

            <div className="flex flex-wrap gap-1 bg-white border border-slate-200 p-1 w-fit rounded-lg mb-8 shadow-sm">
                {["Brand Assets", "Mockups", "Final Designs", "Files", "Taxes"].map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setActiveTab(cat)}
                        className={cn(
                            "px-4 py-2 text-sm font-bold transition-all rounded-md",
                            activeTab === cat
                                ? "bg-slate-900 text-white shadow-sm"
                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                        )}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className="flex-1">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <>
                        {isFileTab ? (
                            // TABLE VIEW FOR FILES/TAXES
                            <Card className="bg-white border-slate-200">
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent border-slate-100 italic">
                                                <TableHead>Type</TableHead>
                                                <TableHead>Title</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {fileItems.map((file) => (
                                                <TableRow key={file.id} className="hover:bg-slate-50 transition-colors border-slate-100">
                                                    <TableCell>
                                                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[10px] uppercase">
                                                            {file.type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-semibold text-slate-900">{file.title}</TableCell>
                                                    <TableCell className="text-slate-600 text-xs">
                                                        {format(new Date(file.created_at), 'MMM d, yyyy')}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={cn(
                                                            "font-bold uppercase text-[10px] px-3",
                                                            (file.status === 'signed' || file.status === 'paid') && 'border-green-200 bg-green-50 text-green-700',
                                                            file.status === 'pending' && 'border-amber-200 bg-amber-50 text-amber-700',
                                                            (file.status === 'rejected' || file.status === 'overdue') && 'border-red-200 bg-red-50 text-red-700'
                                                        )}>
                                                            {file.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {file.file_url && (
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 text-slate-600" onClick={() => handleDownload(file.file_url, file.title)}>
                                                                    <Download className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            {isAdmin && (
                                                                <>
                                                                    <Dialog>
                                                                        <DialogTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 text-slate-600" onClick={() => setEditingFile(file)}>
                                                                                <Pencil className="h-4 w-4" />
                                                                            </Button>
                                                                        </DialogTrigger>
                                                                        <DialogContent>
                                                                            <DialogHeader>
                                                                                <DialogTitle>Edit File</DialogTitle>
                                                                                <DialogDescription>Update file details</DialogDescription>
                                                                            </DialogHeader>
                                                                            {editingFile && (
                                                                                <div className="grid gap-4 py-4">
                                                                                    <div className="grid gap-2">
                                                                                        <Label>Title</Label>
                                                                                        <Input value={editingFile.title} onChange={(e) => setEditingFile({ ...editingFile, title: e.target.value })} />
                                                                                    </div>
                                                                                    <div className="grid gap-2">
                                                                                        <Label>Type</Label>
                                                                                        <Select value={editingFile.type} onValueChange={(v: any) => setEditingFile({ ...editingFile, type: v })}>
                                                                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                                                                            <SelectContent>
                                                                                                <SelectItem value="Contract">Contract</SelectItem>
                                                                                                <SelectItem value="Invoice">Invoice</SelectItem>
                                                                                                <SelectItem value="Tax Document">Tax Document</SelectItem>
                                                                                            </SelectContent>
                                                                                        </Select>
                                                                                    </div>
                                                                                    <div className="grid gap-2">
                                                                                        <Label>Status</Label>
                                                                                        <Select value={editingFile.status} onValueChange={(v) => setEditingFile({ ...editingFile, status: v })}>
                                                                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                                                                            <SelectContent>
                                                                                                <SelectItem value="pending">Pending</SelectItem>
                                                                                                <SelectItem value="signed">Signed</SelectItem>
                                                                                                <SelectItem value="paid">Paid</SelectItem>
                                                                                                <SelectItem value="rejected">Rejected</SelectItem>
                                                                                                <SelectItem value="overdue">Overdue</SelectItem>
                                                                                            </SelectContent>
                                                                                        </Select>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            <DialogFooter>
                                                                                <Button onClick={handleUpdateFile}>Save Changes</Button>
                                                                            </DialogFooter>
                                                                        </DialogContent>
                                                                    </Dialog>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 text-red-600" onClick={() => handleDelete(file.id, file.file_url, true)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {fileItems.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="p-12 text-center text-slate-500 italic">
                                                        No {activeTab} found for this organization.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        ) : (
                            // GRID VIEW FOR IMAGES
                            <>
                                {mediaItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-80 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 group hover:border-slate-900/20 transition-colors">
                                        <div className="p-5 bg-white rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                            <FolderOpen className="h-8 w-8 text-slate-400" />
                                        </div>
                                        <p className="font-bold text-slate-900">No files in {activeTab}</p>
                                        <p className="text-sm text-slate-500 mt-1 text-center max-w-[200px]">Upload your first file to this category to get started.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                        {mediaItems.map((item) => (
                                            <Card key={item.id} className="group relative bg-white border-slate-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-2xl border-none shadow-sm ring-1 ring-slate-200/50">
                                                <div className="aspect-square bg-slate-50 flex items-center justify-center relative overflow-hidden">
                                                    {item.file_type.startsWith('image/') ? (
                                                        <StorageImage path={item.file_path} alt={item.file_name} />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <FileIcon className="h-12 w-12 text-slate-300" />
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.file_type.split('/')[1] || 'FILE'}</span>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                                                        <Button size="icon" variant="secondary" className="h-10 w-10 bg-white hover:bg-white rounded-full shadow-lg" onClick={() => handleDownload(item.file_path, item.file_name)}>
                                                            <Download className="h-5 w-5 text-slate-900" />
                                                        </Button>
                                                        <Button size="icon" variant="destructive" className="h-10 w-10 rounded-full shadow-lg" onClick={() => handleDelete(item.id, item.file_path, false)}>
                                                            <Trash2 className="h-5 w-5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-white">
                                                    <p className="font-bold text-xs text-slate-900 truncate mb-1" title={item.file_name}>{item.file_name}</p>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] text-slate-400 font-medium">{formatBytes(item.size)}</span>
                                                        <span className="text-[10px] text-slate-400 font-medium">{new Date(item.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// Helper to load authenticated images
function StorageImage({ path, alt }: { path: string, alt: string }) {
    const supabase = createClient();
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        const getUrl = async () => {
            const { data } = await supabase.storage.from('organization-assets').createSignedUrl(path, 3600);
            if (data?.signedUrl) setUrl(data.signedUrl);
        };
        getUrl();
    }, [path, supabase]);

    if (!url) return <div className="h-full w-full flex items-center justify-center bg-slate-100"><Loader2 className="h-4 w-4 animate-spin text-slate-300" /></div>;

    return (
        <img
            src={url}
            alt={alt}
            className="h-full w-full object-cover"
        />
    );
}
