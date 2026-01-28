"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Search, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type Organization = {
    id: string;
    name: string;
    hasUnread?: boolean;
};

type Message = {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    organization_id: string;
    profiles?: {
        full_name: string;
        role: string;
    };
};

export default function AdminMessagesPage() {
    const supabase = createClient();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchOrgs = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: orgs } = await supabase.from('organizations').select('id, name').order('name');
        const { data: receipts } = await supabase.from('message_reads').select('*').eq('user_id', user.id);

        if (orgs) {
            // Fetch all customer messages at once to avoid N+1 queries
            const { data: customerMessages } = await supabase
                .from('messages')
                .select('organization_id, created_at, profiles!inner(role)')
                .eq('profiles.role', 'customer');

            const orgsWithUnread = orgs.map((org) => {
                const receipt = receipts?.find(r => r.organization_id === org.id);
                const lastReadAt = receipt ? new Date(receipt.last_read_at).getTime() : 0;

                const hasUnread = customerMessages?.some(msg =>
                    msg.organization_id === org.id &&
                    new Date(msg.created_at).getTime() > lastReadAt
                );

                return { ...org, hasUnread: !!hasUnread };
            });
            setOrganizations(orgsWithUnread);
        }
    }, [supabase]);

    // Fetch Orgs Initial
    useEffect(() => {
        fetchOrgs();

        // Global unread listener for the list
        const channel = supabase
            .channel('admin-org-list-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchOrgs)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads' }, fetchOrgs)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [supabase, fetchOrgs]);

    const fetchMessages = useCallback(async () => {
        if (!selectedOrgId) return;
        const { data } = await supabase
            .from('messages')
            .select('*, profiles(full_name, role)')
            .eq('organization_id', selectedOrgId)
            .order('created_at', { ascending: true });

        if (data) setMessages(data as any);
    }, [selectedOrgId, supabase]);

    const markAsRead = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !selectedOrgId) return;

        // Update database
        await supabase
            .from('message_reads')
            .upsert({
                organization_id: selectedOrgId,
                user_id: user.id,
                last_read_at: new Date().toISOString()
            }, {
                onConflict: 'organization_id, user_id'
            });

        // Update local state for immediate feedback
        setOrganizations(prev => prev.map(org =>
            org.id === selectedOrgId ? { ...org, hasUnread: false } : org
        ));

        // Notify sidebar to refresh
        window.dispatchEvent(new Event('refresh-unread'));
    }, [selectedOrgId, supabase, setOrganizations]);

    // Fetch Messages when Org Selected
    useEffect(() => {
        if (!selectedOrgId) return;

        const initChat = async () => {
            await fetchMessages();
            await markAsRead();
            await fetchOrgs();
        };

        initChat();

        // Realtime Subscription for the active chat
        const channel = supabase
            .channel(`org-messages-${selectedOrgId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `organization_id=eq.${selectedOrgId}`
            }, async (payload) => {
                await fetchMessages();
                // If we are looking at this org, mark new message as read immediately
                await markAsRead();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [selectedOrgId, supabase, fetchOrgs, fetchMessages, markAsRead]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !selectedOrgId) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('messages').insert({
            organization_id: selectedOrgId,
            sender_id: user.id,
            content: input
        });

        setInput("");

        // After sending, we can assume we've read everything up to now
        markAsRead();
    };

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
                                <div className="flex items-center justify-between gap-2">
                                    <span className="block font-medium text-sm text-slate-900 truncate">{org.name}</span>
                                    {org.hasUnread && (
                                        <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" title="New messages" />
                                    )}
                                </div>
                                <span className="block text-xs text-slate-500 truncate">Tap to view chat</span>
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

            {/* Right Side: Chat Window */}
            <div className="flex-1 flex flex-col bg-white">
                {selectedOrgId ? (
                    <>
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 rounded-xl border border-slate-200 shadow-sm">
                                    <AvatarFallback className="bg-slate-900 text-white font-bold text-xs uppercase">
                                        {organizations.find(o => o.id === selectedOrgId)?.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="font-bold text-slate-900 leading-tight"># {organizations.find(o => o.id === selectedOrgId)?.name.toLowerCase().replace(/\s+/g, '-')}</h2>
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Client Online</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Chat Area */}
                        <ScrollArea className="flex-1 bg-white">
                            <div className="py-6">
                                {messages.map((msg, index) => {
                                    const isAdmin = msg.profiles?.role === 'admin';

                                    // Grouping logic
                                    const prevMsg = messages[index - 1];
                                    const showProfile = !prevMsg || prevMsg.sender_id !== msg.sender_id ||
                                        (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 300000);

                                    return (
                                        <div
                                            key={msg.id}
                                            className={cn(
                                                "group flex gap-4 px-6 hover:bg-slate-50/50 transition-colors py-1",
                                                showProfile ? "mt-4 pt-2" : ""
                                            )}
                                        >
                                            <div className="w-10 shrink-0">
                                                {showProfile ? (
                                                    <Avatar className="h-10 w-10 rounded-xl shadow-sm border border-slate-100">
                                                        <AvatarFallback className={cn(
                                                            "text-xs font-bold",
                                                            isAdmin ? "bg-indigo-600 text-white" : "bg-slate-900 text-white"
                                                        )}>
                                                            {msg.profiles?.full_name?.substring(0, 2).toUpperCase() || "??"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                ) : (
                                                    <div className="opacity-0 group-hover:opacity-100 text-[9px] text-slate-400 text-center font-medium mt-1">
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                {showProfile && (
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={cn(
                                                            "text-sm font-bold tracking-tight",
                                                            isAdmin ? "text-indigo-600" : "text-slate-900"
                                                        )}>
                                                            {msg.profiles?.full_name}
                                                        </span>
                                                        {isAdmin && (
                                                            <span className="bg-indigo-50 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Support</span>
                                                        )}
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                )}
                                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap selection:bg-slate-900 selection:text-white">
                                                    {msg.content}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>

                        {/* Input Area */}
                        <div className="p-6 bg-white border-t border-slate-100">
                            <div className="relative flex items-end gap-3 bg-slate-50 rounded-2xl border border-slate-200 p-2 focus-within:border-slate-400 transition-all focus-within:shadow-md">
                                <textarea
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-3 resize-none min-h-[44px] max-h-48 text-slate-700 placeholder:text-slate-400"
                                    placeholder={`Message # ${organizations.find(o => o.id === selectedOrgId)?.name.toLowerCase().replace(/\s+/g, '-')}`}
                                    value={input}
                                    rows={1}
                                    onChange={(e) => {
                                        setInput(e.target.value);
                                        e.target.style.height = 'inherit';
                                        e.target.style.height = `${e.target.scrollHeight}px`;
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                            (e.target as HTMLTextAreaElement).style.height = 'inherit';
                                        }
                                    }}
                                />
                                <Button
                                    size="icon"
                                    onClick={handleSend}
                                    disabled={!input.trim()}
                                    className={cn(
                                        "h-10 w-10 shrink-0 rounded-xl transition-all",
                                        input.trim() ? "bg-slate-900 text-white hover:bg-slate-800 scale-100" : "bg-slate-100 text-slate-400 scale-90"
                                    )}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex justify-between items-center mt-3 px-1">
                                <p className="text-[10px] text-slate-400 font-medium">
                                    <span className="font-bold">Enter</span> to send • <span className="font-bold">Shift + Enter</span> for new line
                                </p>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <div className="h-16 w-16 bg-slate-50 rounded-3xl flex items-center justify-center mb-4 shadow-sm">
                            <MessageSquare className="h-8 w-8 opacity-20" />
                        </div>
                        <p className="font-bold text-slate-900">Select a client chat</p>
                        <p className="text-xs text-slate-500 mt-1">Pick an organization from the list to start messaging.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
