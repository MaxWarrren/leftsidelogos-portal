"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, FileIcon, Trash2, Download, Loader2, ImageIcon, FolderOpen } from "lucide-react";
import Image from "next/image";
import { cn, formatBytes } from "@/lib/utils";

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

interface MediaGalleryProps {
    organizationId: string;
    isAdmin?: boolean;
}

export function MediaGallery({ organizationId, isAdmin = false }: MediaGalleryProps) {
    const supabase = createClient();
    const [activeTab, setActiveTab] = useState<string>("Brand Assets");
    const [items, setItems] = useState<MediaItem[]>([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);

    // Fetch Items
    const fetchItems = async () => {
        setLoading(true);
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
            setItems(data as MediaItem[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        setItems([]); // Clear items immediately when switching org or tab
        fetchItems();

        // Subscribe to changes
        const channel = supabase
            .channel(`media-${organizationId}-${activeTab}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'media_items',
                filter: `organization_id=eq.${organizationId}` // Filter by Org
            }, (payload) => {
                // Refresh if the change is relevant to the current tab (or just refresh all)
                if ((payload.new as MediaItem)?.category === activeTab || (payload.old as MediaItem)?.category === activeTab) {
                    fetchItems();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [organizationId, activeTab, supabase]);

    // Handle Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setUploading(true);

        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `${organizationId}/${activeTab}/${fileName}`;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('organization-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Insert Record
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

            toast.success("File uploaded successfully");
            fetchItems();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Upload failed");
        } finally {
            setUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    // Handle Download
    const handleDownload = async (item: MediaItem) => {
        try {
            const { data, error } = await supabase.storage
                .from('organization-assets')
                .download(item.file_path);

            if (error) throw error;

            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = item.file_name;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error(error);
            toast.error("Download failed");
        }
    };

    // Handle Delete
    const handleDelete = async (item: MediaItem) => {
        if (!confirm("Are you sure you want to delete this file?")) return;

        try {
            // 1. Delete from Storage
            const { error: storageError } = await supabase.storage
                .from('organization-assets')
                .remove([item.file_path]);

            if (storageError) throw storageError;

            // 2. Delete from DB
            const { error: dbError } = await supabase
                .from('media_items')
                .delete()
                .eq('id', item.id);

            if (dbError) throw dbError;

            toast.success("File deleted");
            fetchItems();
        } catch (error) {
            console.error(error);
            toast.error("Deletion failed");
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Media Library</h1>
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
                                Upload File
                            </span>
                        </Button>
                    </label>
                </div>
            </div>

            <div className="flex gap-1 bg-white border border-slate-200 p-1 w-fit rounded-lg mb-8 shadow-sm">
                {["Brand Assets", "Mockups", "Final Designs"].map((cat) => (
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
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-80 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 group hover:border-slate-900/20 transition-colors">
                        <div className="p-5 bg-white rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                            <FolderOpen className="h-8 w-8 text-slate-400" />
                        </div>
                        <p className="font-bold text-slate-900">No files in {activeTab}</p>
                        <p className="text-sm text-slate-500 mt-1 text-center max-w-[200px]">Upload your first file to this category to get started.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {items.map((item) => (
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

                                    {/* Overlay Actions */}
                                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                                        <Button size="icon" variant="secondary" className="h-10 w-10 bg-white hover:bg-white rounded-full shadow-lg" onClick={() => handleDownload(item)}>
                                            <Download className="h-5 w-5 text-slate-900" />
                                        </Button>
                                        <Button size="icon" variant="destructive" className="h-10 w-10 rounded-full shadow-lg" onClick={() => handleDelete(item)}>
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
