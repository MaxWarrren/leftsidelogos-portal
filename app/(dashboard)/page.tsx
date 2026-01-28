"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, ShoppingBag, MessageSquare, AlertCircle, FileText, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default function DashboardPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState("there");
    const [orgName, setOrgName] = useState("");

    // Stats State
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [activeFiles, setActiveFiles] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            // Get Active Org ID from cookie
            const match = document.cookie.match(new RegExp('(^| )active_org_id=([^;]+)'));
            const activeOrgId = match ? match[2] : null;

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Get User Profile for Name
                const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
                if (profile) setUserName(profile.full_name.split(' ')[0]);
            }

            if (!activeOrgId) {
                setLoading(false);
                return;
            }

            // Get Org Name
            const { data: org } = await supabase.from('organizations').select('name').eq('id', activeOrgId).single();
            if (org) setOrgName(org.name);

            // 1. Fetch Recent Orders
            const { data: orders } = await supabase
                .from('orders')
                .select('*')
                .eq('organization_id', activeOrgId)
                .order('created_at', { ascending: false })
                .limit(3);
            if (orders) setRecentOrders(orders);

            // 2. Fetch Unread Messages Count
            // Logic: Count messages from 'admin' in this org deeper than last read
            const { data: receipt } = await supabase
                .from('message_reads')
                .select('last_read_at')
                .eq('organization_id', activeOrgId)
                .eq('user_id', user?.id)
                .maybeSingle();

            const msgQuery = supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('organization_id', activeOrgId)
                .neq('sender_id', user?.id); // Assuming admin messages have a different sender_id (which they do)

            if (receipt) {
                msgQuery.gt('created_at', receipt.last_read_at);
            }

            const { count: msgCount } = await msgQuery;
            setUnreadMessages(msgCount || 0);

            // 3. Fetch Active Files (Pending Contracts/Unpaid Invoices)
            const { data: files } = await supabase
                .from('contracts')
                .select('*')
                .eq('organization_id', activeOrgId)
                .or('status.eq.pending,status.eq.unpaid')
                .order('created_at', { ascending: false })
                .limit(3);
            if (files) setActiveFiles(files);

            setLoading(false);
        };

        fetchData();

        // Real-time Subscriptions
        const activeOrgId = document.cookie.match(new RegExp('(^| )active_org_id=([^;]+)'))?.[2];
        if (!activeOrgId) return;

        const channel = supabase
            .channel('customer-dashboard')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: `organization_id=eq.${activeOrgId}`
            }, () => fetchData()) // Re-fetch on any order change
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `organization_id=eq.${activeOrgId}`
            }, () => fetchData()) // Re-fetch on new message
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'contracts',
                filter: `organization_id=eq.${activeOrgId}`
            }, () => fetchData()) // Re-fetch on file changes
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };

    }, [supabase]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Welcome, {userName}</h1>
                <p className="text-slate-500">
                    {orgName ? `Here's the latest for ${orgName}.` : "Select an organization to get started."}
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Orders Card */}
                <Card className="bg-white border-slate-200 flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-bold">Recent Orders</CardTitle>
                        <ShoppingBag className="h-5 w-5 text-slate-400" />
                    </CardHeader>
                    <CardContent className="flex-1">
                        {recentOrders.length > 0 ? (
                            <div className="space-y-4">
                                {recentOrders.map(order => (
                                    <div key={order.id} className="flex flex-col gap-1 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold text-slate-900 text-sm">
                                                {order.name}
                                            </span>
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                order.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-slate-500">
                                            <span>Total Qty: {(order.details || []).reduce((sum: number, d: any) => sum + (d.qty || 0), 0)}</span>
                                            <span>Step {order.timeline_step}/4</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 italic py-4 text-center">No active orders.</p>
                        )}
                    </CardContent>
                    <div className="p-4 pt-0 mt-auto">
                        <Button asChild variant="outline" className="w-full border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50">
                            <Link href="/orders">View All Orders <ArrowRight className="ml-2 h-3 w-3" /></Link>
                        </Button>
                    </div>
                </Card>

                {/* Messages Card */}
                <Card className="bg-white border-slate-200 flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-bold">Messages</CardTitle>
                        <MessageSquare className="h-5 w-5 text-slate-400" />
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-center items-center text-center py-6">
                        {unreadMessages > 0 ? (
                            <>
                                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center mb-3">
                                    <span className="text-indigo-700 font-bold text-lg">{unreadMessages}</span>
                                </div>
                                <p className="text-slate-900 font-medium">New Messages</p>
                                <p className="text-xs text-slate-500 mt-1">Check the chat for updates.</p>
                            </>
                        ) : (
                            <>
                                <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                                    <MessageSquare className="h-6 w-6 text-slate-300" />
                                </div>
                                <p className="text-slate-500 font-medium">All caught up!</p>
                            </>
                        )}
                    </CardContent>
                    <div className="p-4 pt-0 mt-auto">
                        <Button asChild className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                            <Link href="/messages">
                                {unreadMessages > 0 ? "Go to Chat" : "Start Conversation"}
                                <ArrowRight className="ml-2 h-3 w-3" />
                            </Link>
                        </Button>
                    </div>
                </Card>

                {/* Files Card */}
                <Card className="bg-white border-slate-200 flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-bold">Pending Files</CardTitle>
                        <FileText className="h-5 w-5 text-slate-400" />
                    </CardHeader>
                    <CardContent className="flex-1">
                        {activeFiles.length > 0 ? (
                            <div className="space-y-3">
                                {activeFiles.map(file => (
                                    <Link key={file.id} href="/files" className="block group">
                                        <div className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors">
                                            <AlertCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                                                    {file.title}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {file.type} • {formatDistanceToNow(new Date(file.created_at))} ago
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center py-4">
                                <p className="text-sm text-slate-500 italic">No pending contracts or invoices.</p>
                            </div>
                        )}
                    </CardContent>
                    <div className="p-4 pt-0 mt-auto">
                        <Button asChild variant="outline" className="w-full border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50">
                            <Link href="/files">View All Files <ArrowRight className="ml-2 h-3 w-3" /></Link>
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
