"use client";

import {
    LayoutDashboard,
    Users,
    MessageSquare,
    FileText,
    Clock,
    Settings,
    Image as ImageIcon,
} from "lucide-react";

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarFooter,
} from "@/components/ui/sidebar";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { usePathname, useRouter } from "next/navigation";

// Admin Menu items.
const items = [
    {
        title: "Overview",
        url: "/admin",
        icon: LayoutDashboard,
    },
    {
        title: "Organizations",
        url: "/admin/clients",
        icon: Users,
    },
    {
        title: "CRM",
        url: "/admin/crm",
        icon: Users,
    },
    {
        title: "All Orders",
        url: "/admin/orders",
        icon: Clock,
    },
    {
        title: "Media",
        url: "/admin/media",
        icon: ImageIcon,
    },
    {
        title: "Global Chat",
        url: "/admin/messages",
        icon: MessageSquare,
    },
    {
        title: "Files",
        url: "/admin/files",
        icon: FileText,
    },
];

export function AdminSidebar() {
    const supabase = createClient();
    const pathname = usePathname();
    const router = useRouter();
    const [hasUnread, setHasUnread] = useState(false);
    const [hasUnreadMedia, setHasUnreadMedia] = useState(false);

    const checkUnread = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch all organizations
        const { data: orgs } = await supabase.from('organizations').select('id');
        if (!orgs) return;

        // Fetch user's read receipts
        const { data: receipts } = await supabase.from('message_reads').select('*').eq('user_id', user.id);

        // We want to check if there are any unread messages from CUSTOMERS
        // To do this accurately and efficiently, we might need a more complex query, 
        // but for now let's improve the current approach.
        let unreadMessages = false;

        // Fetch recent messages from customers
        const { data: customerMessages } = await supabase
            .from('messages')
            .select('organization_id, created_at, profiles!inner(role)')
            .eq('profiles.role', 'customer')
            .order('created_at', { ascending: false })
            .limit(100);

        if (customerMessages) {
            for (const org of orgs) {
                const receipt = receipts?.find((r: any) => r.organization_id === org.id);
                const lastRead = receipt ? new Date(receipt.last_read_at).getTime() : 0;

                const hasNew = customerMessages.some(msg =>
                    msg.organization_id === org.id &&
                    new Date(msg.created_at).getTime() > lastRead
                );

                if (hasNew) {
                    unreadMessages = true;
                    break;
                }
            }
        }

        setHasUnread(unreadMessages);

        // Media unread check: Just check if any files were uploaded by customers recently
        const { count: mediaCount } = await supabase.from('media_items')
            .select('id', { count: 'exact', head: true })
            .not('uploader_id', 'eq', user.id);

        setHasUnreadMedia((mediaCount || 0) > 0);
    }, [supabase]);

    useEffect(() => {
        checkUnread();

        // Listen for internal refresh events
        const handleRefresh = () => checkUnread();
        window.addEventListener('refresh-unread', handleRefresh);

        const channel = supabase
            .channel('global-admin-notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, async (payload: any) => {
                // Fetch full info for the toast
                const { data: msgInfo } = await supabase
                    .from('messages')
                    .select('content, sender_id, organization_id, organizations(name), profiles(role, full_name)')
                    .eq('id', payload.new.id)
                    .single();

                if (msgInfo && (msgInfo as any).profiles?.role === 'customer') {
                    // Always show toast if not on the messages page
                    if (pathname !== '/admin/messages') {
                        toast.message(`New message from ${(msgInfo as any).organizations?.name}`, {
                            description: (msgInfo as any).content,
                            action: {
                                label: "View Chat",
                                onClick: () => router.push('/admin/messages')
                            }
                        });
                    }
                    // Refresh unread state
                    checkUnread();
                }
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'media_items'
            }, async (payload: any) => {
                const { data: mediaInfo } = await supabase
                    .from('media_items')
                    .select('file_name, organizations(name), uploader_id, profiles(role)')
                    .eq('id', payload.new.id)
                    .single();

                if (mediaInfo && (mediaInfo as any).profiles?.role === 'customer') {
                    toast.message(`New upload from ${(mediaInfo as any).organizations?.name}`, {
                        description: `Uploaded: ${(mediaInfo as any).file_name}`,
                        action: {
                            label: "View Media",
                            onClick: () => window.location.href = "/admin/media"
                        }
                    });
                    checkUnread();
                }
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'message_reads'
            }, () => {
                checkUnread();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('refresh-unread', handleRefresh);
        };
    }, [supabase, pathname, router, checkUnread]);

    return (
        <Sidebar className="border-r border-slate-200 bg-white">
            <SidebarContent className="flex flex-col h-full">
                <div className="flex flex-col items-center justify-center pt-8 pb-8 shrink-0 border-b border-slate-200">
                    <Image
                        src="/images/LSL_Text_Logo.png"
                        alt="Left Side Logos Admin"
                        width={120}
                        height={40}
                        className="h-auto w-32 object-contain"
                        priority
                    />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-2">Admin Portal</span>
                </div>
                <div className="flex flex-1 flex-col items-center justify-start pt-6">
                    <SidebarGroup className="w-full">
                        <SidebarGroupContent>
                            <SidebarMenu className="gap-8 px-3">
                                {items.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton
                                            asChild
                                            className="group/item h-16 w-full justify-center transition-all hover:bg-slate-100 active:scale-95"
                                        >
                                            <a href={item.url} className="flex flex-col items-center justify-center gap-2 h-full relative">
                                                <item.icon className="h-7 w-7 text-slate-500 group-hover/item:text-slate-900 transition-colors" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 group-hover/item:text-slate-900 transition-colors">{item.title}</span>
                                                {item.title === "Global Chat" && hasUnread && (
                                                    <span className="absolute top-2 right-4 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                                                )}
                                                {item.title === "Media" && hasUnreadMedia && (
                                                    <span className="absolute top-2 right-4 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                                                )}
                                            </a>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </div>
            </SidebarContent>

            <SidebarFooter className="py-6 border-t border-slate-200">
                <SidebarMenu className="px-3">
                    <SidebarMenuItem>
                        <Dialog>
                            <DialogTrigger asChild>
                                <SidebarMenuButton className="group/settings h-12 w-full justify-center transition-all hover:bg-slate-100 active:scale-95">
                                    <div className="flex flex-col items-center justify-center gap-1.5 h-full">
                                        <Settings className="h-5 w-5 text-slate-500 group-hover/settings:text-slate-900 transition-colors" />
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 group-hover/settings:text-slate-900 transition-colors">Settings</span>
                                    </div>
                                </SidebarMenuButton>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] bg-white border-slate-200">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold">Admin Settings</DialogTitle>
                                    <DialogDescription className="text-slate-500">
                                        Update your profile information.
                                    </DialogDescription>
                                </DialogHeader>
                                <SettingsForm supabase={supabase} />
                            </DialogContent>
                        </Dialog>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar >
    );
}

function SettingsForm({ supabase }: { supabase: any }) {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setEmail(user.email);
                const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
                if (data) setFullName(data.full_name || "");
            }
        };
        fetchProfile();
    }, [supabase]);

    const handleSave = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);
            if (error) toast.error("Failed to update profile");
            else toast.success("Profile updated successfully");
        }
        setLoading(false);
    };

    return (
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label>Email Address</Label>
                <Input value={email} disabled className="bg-slate-50" />
            </div>
            <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <Button onClick={handleSave} disabled={loading} className="w-full bg-slate-900 text-white">
                {loading ? "Saving..." : "Save Changes"}
            </Button>
        </div>
    );
}
