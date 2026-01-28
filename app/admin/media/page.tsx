"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { MediaGallery } from "@/components/media/media-gallery";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Image as ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Organization = {
    id: string;
    name: string;
};

export default function AdminMediaPage() {
    const supabase = createClient();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchOrgs = async () => {
            const { data } = await supabase.from('organizations').select('id, name').order('name');
            if (data) setOrganizations(data);
        };
        fetchOrgs();
    }, [supabase]);

    const filteredOrgs = organizations.filter(org =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-[calc(100vh-8rem)] rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
            {/* Left Sidebar: Organization List */}
            <div className="w-80 border-r border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-200">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search clients..."
                            className="pl-9 bg-slate-50 border-slate-200"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    {filteredOrgs.map((org) => (
                        <button
                            key={org.id}
                            onClick={() => setSelectedOrgId(org.id)}
                            className={cn(
                                "w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50",
                                selectedOrgId === org.id ? "bg-slate-100 ring-inset ring-2 ring-indigo-500" : ""
                            )}
                        >
                            <Avatar className="h-10 w-10 border border-slate-200">
                                <AvatarFallback className="bg-slate-900 text-white font-bold text-xs uppercase">
                                    {org.name.substring(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 overflow-hidden relative">
                                <span className="block font-medium text-sm text-slate-900 truncate">{org.name}</span>
                                <span className="block text-xs text-slate-500 truncate">View media library</span>
                            </div>
                        </button>
                    ))}
                    {filteredOrgs.length === 0 && (
                        <div className="p-8 text-center text-sm text-slate-500">
                            No clients found.
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Right Side: Media Gallery */}
            <div className="flex-1 flex flex-col bg-slate-50/50 overflow-y-auto">
                {selectedOrgId ? (
                    <MediaGallery organizationId={selectedOrgId} isAdmin={true} />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <ImageIcon className="h-12 w-12 mb-4 opacity-20" />
                        <p className="font-medium">Select a client to view their media library</p>
                    </div>
                )}
            </div>
        </div>
    );
}
