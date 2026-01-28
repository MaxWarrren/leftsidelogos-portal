"use client";

import {
    LayoutDashboard,
    MessageSquare,
    FileText,
    Clock,
    Image as ImageIcon,
    Settings,
} from "lucide-react";
import Image from "next/image";
import { OrgSwitcher } from "@/components/org-switcher";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { usePathname } from "next/navigation";

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
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

// Menu items.
const items = [
    {
        title: "Dashboard",
        url: "/",
        icon: LayoutDashboard,
    },
    {
        title: "Messages",
        url: "/messages",
        icon: MessageSquare,
    },
    {
        title: "Order Status",
        url: "/orders",
        icon: Clock,
    },
    {
        title: "Media",
        url: "/media",
        icon: ImageIcon,
    },
];

type Organization = {
    id: string;
    name: string;
};

interface AppSidebarProps {
    organizations: Organization[];
    currentOrgId?: string;
}

export function AppSidebar({ organizations = [], currentOrgId }: AppSidebarProps) {
    const supabase = createClient();
    const pathname = usePathname();
    const [hasUnread, setHasUnread] = useState(false);
    const [hasUnreadMedia, setHasUnreadMedia] = useState(false);

    const checkUnread = async () => {
        if (!currentOrgId) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Messages check
        const { data: receipt } = await supabase.from('message_reads').select('last_read_at').eq('organization_id', currentOrgId).eq('user_id', user.id).maybeSingle();
        const msgQuery = supabase.from('messages').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrgId).neq('sender_id', user.id);
        if (receipt) msgQuery.gt('created_at', receipt.last_read_at);
        const { count: msgCount } = await msgQuery;
        setHasUnread((msgCount || 0) > 0);

        // Media check (simple for now: any admin uploads in this org)
        const { count: mediaCount } = await supabase.from('media_items').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrgId).neq('uploader_id', user.id);
        setHasUnreadMedia((mediaCount || 0) > 0);
    };

    useEffect(() => {
        checkUnread();

        if (!currentOrgId) return;

        const channel = supabase
            .channel(`customer-notifications-${currentOrgId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `organization_id=eq.${currentOrgId}`
            }, async (payload: any) => {
                const { data: msgInfo } = await supabase
                    .from('messages')
                    .select('content, profiles(role)')
                    .eq('id', payload.new.id)
                    .single();

                if (msgInfo && (msgInfo as any).profiles?.role === 'admin' && pathname !== '/messages') {
                    toast.message("New message from support", {
                        description: (msgInfo as any).content,
                        action: {
                            label: "Read",
                            onClick: () => window.location.href = "/messages"
                        }
                    });
                    setHasUnread(true);
                }
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'media_items',
                filter: `organization_id=eq.${currentOrgId}`
            }, async (payload: any) => {
                const { data: mediaInfo } = await supabase
                    .from('media_items')
                    .select('file_name, profiles(role)')
                    .eq('id', payload.new.id)
                    .single();

                if (mediaInfo && (mediaInfo as any).profiles?.role === 'admin' && pathname !== '/media') {
                    toast.message("New file available", {
                        description: `Support uploaded: ${(mediaInfo as any).file_name}`,
                        action: {
                            label: "View Media",
                            onClick: () => window.location.href = "/media"
                        }
                    });
                    setHasUnreadMedia(true);
                }
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'message_reads',
                filter: `organization_id=eq.${currentOrgId}`
            }, checkUnread)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentOrgId, supabase, pathname]);

    return (
        <Sidebar className="border-r border-slate-200 bg-white">
            <SidebarContent className="flex flex-col h-full">
                <div className="flex flex-col items-center justify-center pt-8 pb-8 shrink-0 border-b border-slate-200 px-4">
                    <Image
                        src="/images/LSL_Text_Logo.png"
                        alt="Left Side Logos"
                        width={120}
                        height={40}
                        className="h-auto w-32 object-contain mb-6"
                        priority
                    />
                    <OrgSwitcher organizations={organizations} currentOrgId={currentOrgId} />
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
                                                {item.title === "Messages" && hasUnread && (
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
                                    <DialogTitle className="text-xl font-bold">User Settings</DialogTitle>
                                    <DialogDescription className="text-slate-500">
                                        Manage your account preferences and notification settings.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-8 py-6">
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900">Notifications</h4>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="orders" className="flex flex-col gap-1">
                                                <span className="font-semibold">Order Updates</span>
                                                <span className="text-xs font-normal text-slate-500">Get notified about status changes.</span>
                                            </Label>
                                            <Switch id="orders" defaultChecked />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="marketing" className="flex flex-col gap-1">
                                                <span className="font-semibold">Marketing Emails</span>
                                                <span className="text-xs font-normal text-slate-500">Receive news about new apparel.</span>
                                            </Label>
                                            <Switch id="marketing" />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900">Account Details</h4>
                                        <div className="grid gap-2">
                                            <Label htmlFor="name" className="font-semibold">Display Name</Label>
                                            <Input id="name" defaultValue="Maxwell" className="border-slate-200 focus:ring-slate-900" />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="email" className="font-semibold">Email Address</Label>
                                            <Input id="email" defaultValue="maxwell@example.com" disabled className="border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <Button variant="outline" className="border-slate-200 hover:bg-slate-50">Cancel</Button>
                                    <Button className="bg-slate-900 text-white hover:bg-slate-800 px-6">Save Changes</Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </SidebarMenuItem>
                </SidebarMenu>
                <div className="mt-6 px-3 text-center">
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                        This software was built by the team at{" "}
                        <a
                            href="https://axiondigital.io"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-slate-900 transition-colors font-bold underline decoration-slate-200 underline-offset-2"
                        >
                            Axion Digital
                        </a>
                    </p>
                </div>
            </SidebarFooter>
        </Sidebar >
    );
}
