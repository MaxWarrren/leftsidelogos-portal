"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { MediaGallery } from "@/components/media/media-gallery";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Image as ImageIcon, ChevronsUpDown, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Organization = {
    id: string;
    name: string;
};

export default function AdminMediaPage() {
    const supabase = createClient();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [recentOrgIds, setRecentOrgIds] = useState<string[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const load = async () => {
            const [{ data: orgs }, { data: recent }] = await Promise.all([
                supabase.from('organizations').select('id, name').order('name'),
                supabase
                    .from('orders')
                    .select('organization_id, created_at')
                    .not('organization_id', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(400),
            ]);
            if (orgs) setOrganizations(orgs);
            if (recent) {
                // Unique org ids in most-recent-order order.
                const seen: string[] = [];
                for (const r of recent) {
                    if (r.organization_id && !seen.includes(r.organization_id)) seen.push(r.organization_id);
                }
                setRecentOrgIds(seen);
            }
        };
        load();
    }, [supabase]);

    const orgById = useMemo(() => new Map(organizations.map(o => [o.id, o])), [organizations]);
    const recentOrgs = useMemo(
        () => recentOrgIds.map(id => orgById.get(id)).filter(Boolean) as Organization[],
        [recentOrgIds, orgById],
    );
    const otherOrgs = useMemo(
        () => organizations.filter(o => !recentOrgIds.includes(o.id)),
        [organizations, recentOrgIds],
    );
    const selectedOrg = selectedOrgId ? orgById.get(selectedOrgId) ?? null : null;

    const select = (id: string) => {
        setSelectedOrgId(id);
        setOpen(false);
    };

    const OrgItem = ({ org }: { org: Organization }) => (
        <CommandItem key={org.id} value={`${org.name} ${org.id}`} onSelect={() => select(org.id)} className="gap-2">
            <Avatar className="h-6 w-6 border border-slate-200">
                <AvatarFallback className="bg-slate-900 text-white text-[10px] font-bold uppercase">
                    {org.name.substring(0, 2)}
                </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate">{org.name}</span>
            {selectedOrgId === org.id && <Check className="h-4 w-4" />}
        </CommandItem>
    );

    return (
        <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
            {/* Header: org selector */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Media Library</h1>
                    <p className="text-sm text-slate-500">Select a client to view their media and files.</p>
                </div>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="w-full justify-between border-slate-200 bg-white sm:w-[320px]"
                        >
                            {selectedOrg ? (
                                <span className="flex items-center gap-2 truncate">
                                    <Avatar className="h-5 w-5 border border-slate-200">
                                        <AvatarFallback className="bg-slate-900 text-white text-[9px] font-bold uppercase">
                                            {selectedOrg.name.substring(0, 2)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="truncate">{selectedOrg.name}</span>
                                </span>
                            ) : (
                                <span className="text-slate-500">Select a client…</span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="end">
                        <Command>
                            <CommandInput placeholder="Search clients…" />
                            <CommandList>
                                <CommandEmpty>No clients found.</CommandEmpty>
                                {recentOrgs.length > 0 && (
                                    <CommandGroup heading="Recent orders">
                                        {recentOrgs.map(org => <OrgItem key={org.id} org={org} />)}
                                    </CommandGroup>
                                )}
                                {otherOrgs.length > 0 && (
                                    <CommandGroup heading="All clients">
                                        {otherOrgs.map(org => <OrgItem key={org.id} org={org} />)}
                                    </CommandGroup>
                                )}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                {selectedOrgId ? (
                    <div className="h-full overflow-y-auto bg-slate-50/50">
                        <MediaGallery organizationId={selectedOrgId} isAdmin={true} />
                    </div>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
                        <div className="flex flex-col items-center text-slate-400">
                            <ImageIcon className="mb-3 h-12 w-12 opacity-20" />
                            <p className="font-medium text-slate-500">Select a client to view their media library</p>
                        </div>
                        {recentOrgs.length > 0 && (
                            <div className="w-full max-w-2xl">
                                <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
                                    <Clock className="h-3.5 w-3.5" /> Recent clients
                                </div>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {recentOrgs.slice(0, 8).map(org => (
                                        <button
                                            key={org.id}
                                            onClick={() => select(org.id)}
                                            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                                        >
                                            <Avatar className="h-5 w-5 border border-slate-200">
                                                <AvatarFallback className="bg-slate-900 text-white text-[9px] font-bold uppercase">
                                                    {org.name.substring(0, 2)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="max-w-[160px] truncate">{org.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
