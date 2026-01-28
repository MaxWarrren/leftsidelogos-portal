"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function MessagesPage() {
    const supabase = createClient();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
    const [orgName, setOrgName] = useState<string>("Axion Digital");
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Get Active Org ID from cookie or fetch
    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setCurrentUserId(user.id);

            // Simple cookie parse for client-side
            const match = document.cookie.match(new RegExp('(^| )active_org_id=([^;]+)'));
            const orgId = match ? match[2] : null;

            if (orgId) {
                setActiveOrgId(orgId);
                const { data: orgData } = await supabase
                    .from('organizations')
                    .select('name')
                    .eq('id', orgId)
                    .single();
                if (orgData) setOrgName(orgData.name);
            } else {
                if (!user) return;
                const { data } = await supabase
                    .from('organization_members')
                    .select('organization_id, organizations(name)')
                    .eq('user_id', user.id)
                    .limit(1)
                    .single();

                if (data) {
                    setActiveOrgId(data.organization_id);
                    if ((data as any).organizations?.name) {
                        setOrgName((data as any).organizations.name);
                    }
                }
            }
        };
        init();
    }, [supabase]);

    // Fetch Messages & Subscribe
    useEffect(() => {
        if (!activeOrgId) return;

        const fetchMessages = async () => {
            const { data } = await supabase
                .from('messages')
                .select('*, profiles(full_name, role)')
                .eq('organization_id', activeOrgId)
                .order('created_at', { ascending: true });

            if (data) setMessages(data as any);
        };

        const markAsRead = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !activeOrgId) return;

            await supabase
                .from('message_reads')
                .upsert({
                    organization_id: activeOrgId,
                    user_id: user.id,
                    last_read_at: new Date().toISOString()
                }, {
                    onConflict: 'organization_id, user_id'
                });
        };

        fetchMessages();
        markAsRead();

        const channel = supabase
            .channel(`customer-messages-${activeOrgId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `organization_id=eq.${activeOrgId}` }, (payload) => {
                fetchMessages();
                markAsRead();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [activeOrgId, supabase]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !activeOrgId) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('messages').insert({
            organization_id: activeOrgId,
            sender_id: user.id,
            content: input
        });

        setInput("");
    };

    if (!activeOrgId) return <div className="p-8 text-center text-slate-500">Loading chat...</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
                        <MessageSquare className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900 text-lg leading-tight"># team-chat</h2>
                        <span className="text-xs text-slate-500 font-medium tracking-wide">Messaging {orgName}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Support Online</span>
                </div>
            </div>

            {/* Chat Area */}
            <ScrollArea className="flex-1 bg-white">
                <div className="py-6">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
                            <MessageSquare className="h-12 w-12 mb-4 opacity-10" />
                            <p className="text-sm font-medium">Start the conversation below</p>
                        </div>
                    ) : (
                        messages.map((msg, index) => {
                            const isAdmin = msg.profiles?.role === 'admin';
                            const isMe = msg.sender_id === currentUserId;

                            // Check if we should show the profile (if it's a new sender or more than 5 mins passed)
                            const prevMsg = messages[index - 1];
                            const showProfile = !prevMsg || prevMsg.sender_id !== msg.sender_id ||
                                (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 300000);

                            return (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "group flex gap-4 px-6 hover:bg-gray-50/50 transition-colors py-1",
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
                        })
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-slate-100">
                <div className="relative flex items-end gap-3 bg-gray-50 rounded-2xl border border-slate-200 p-2 focus-within:border-slate-400 transition-all focus-within:shadow-md">
                    <textarea
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-3 resize-none min-h-[44px] max-h-48 text-slate-700 placeholder:text-slate-400"
                        placeholder={`Message # team-chat`}
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
                    <div className="flex gap-4">
                        {/* Future attachments can go here */}
                    </div>
                </div>
            </div>
        </div>
    );
}
