"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, ShoppingBag, MessageSquare, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

export default function AdminDashboardPage() {
    const supabase = createClient();
    const [stats, setStats] = useState([
        { title: "Total Clients", value: "0", icon: Users, color: "text-blue-600" },
        { title: "Active Orders", value: "0", icon: ShoppingBag, color: "text-green-600" },
        { title: "New Messages", value: "0", icon: MessageSquare, color: "text-purple-600" },
        { title: "New Leads", value: "0", icon: Users, color: "text-orange-600" },
    ]);

    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [activeOrders, setActiveOrders] = useState<any[]>([]);

    const fetchStats = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Total Clients
        const { count: clientCount } = await supabase.from('organizations').select('*', { count: 'exact', head: true });

        // 2. Active Orders (Not Completed)
        const { count: orderCount } = await supabase.from('orders').select('*', { count: 'exact', head: true }).neq('status', 'completed');

        // 3. New Messages (Unread by current admin)
        const { data: messages } = await supabase
            .from('messages')
            .select('created_at, organization_id, sender_id, profiles!inner(role)')
            .eq('profiles.role', 'customer');

        const { data: readReceipts } = await supabase
            .from('message_reads')
            .select('*')
            .eq('user_id', user.id);

        let unreadCount = 0;
        if (messages) {
            messages.forEach(msg => {
                const receipt = readReceipts?.find(r => r.organization_id === msg.organization_id);
                if (!receipt || new Date(msg.created_at) > new Date(receipt.last_read_at)) {
                    unreadCount++;
                }
            });
        }

        // 4. New Leads
        const { count: leadsCount } = await supabase.from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'new');

        setStats([
            { title: "Total Clients", value: clientCount?.toString() || "0", icon: Users, color: "text-blue-600" },
            { title: "Active Orders", value: orderCount?.toString() || "0", icon: ShoppingBag, color: "text-green-600" },
            { title: "New Messages", value: unreadCount.toString(), icon: MessageSquare, color: "text-purple-600" },
            { title: "New Leads", value: leadsCount?.toString() || "0", icon: Users, color: "text-orange-600" },
        ]);

        // 5. Recent Activity
        const { data: recent } = await supabase
            .from('messages')
            .select('*, organizations(name), profiles(full_name)')
            .order('created_at', { ascending: false })
            .limit(5);

        if (recent) setRecentActivity(recent);

        // 6. Production Status (Active Orders)
        const { data: orders } = await supabase
            .from('orders')
            .select('*, organizations(name)')
            .neq('status', 'completed') // Show only active
            .order('created_at', { ascending: false })
            .limit(5);

        if (orders) setActiveOrders(orders);
    };

    useEffect(() => {
        fetchStats();

        // Realtime Subscription for automatic updates
        const channel = supabase
            .channel('admin-dashboard-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchStats)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchStats)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, fetchStats)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchStats)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    const handleClearActivity = () => {
        setRecentActivity([]);
        // Ideally save this preference or timestamp, but for now just clear local state for the session/view
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Admin Control Center</h1>
                <p className="text-slate-500">Manage your entire production flow and client communications from here.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.title} className="bg-white border-slate-200">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                                {stat.title}
                            </CardTitle>
                            <stat.icon className={`h-5 w-5 ${stat.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-white border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Recent Client Activity</CardTitle>
                        <button
                            onClick={handleClearActivity}
                            className="text-xs text-slate-400 hover:text-slate-600 font-medium px-2 py-1 rounded hover:bg-slate-50 transition-colors"
                        >
                            Clear
                        </button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentActivity.map((activity) => (
                                <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-slate-50 last:border-0">
                                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                        {(activity.profiles?.full_name || "??").substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">
                                            {activity.profiles?.full_name} ({activity.organizations?.name})
                                        </p>
                                        <p className="text-xs text-slate-500 truncate">{activity.content}</p>
                                    </div>
                                    <div className="text-[10px] text-slate-400 whitespace-nowrap">
                                        {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            ))}
                            {recentActivity.length === 0 && (
                                <p className="text-sm text-slate-500 py-4 italic text-center border-2 border-dashed border-slate-100 rounded-lg">
                                    No recent activity found.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Production Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {activeOrders.map((order) => (
                                <div key={order.id} className="space-y-2 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-900 truncate">
                                                {order.name}
                                            </p>
                                            <p className="text-xs text-slate-500 truncate">{order.organizations?.name}</p>
                                        </div>
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                            order.status === 'pending' ? "bg-amber-100 text-amber-700" :
                                                order.status === 'completed' ? "bg-green-100 text-green-700" :
                                                    "bg-blue-100 text-blue-700"
                                        )}>
                                            {order.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-slate-900 transition-all duration-500"
                                                style={{ width: `${(order.timeline_step / 4) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-medium text-slate-500">
                                            Step {order.timeline_step}/4
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {activeOrders.length === 0 && (
                                <p className="text-sm text-slate-500 py-4 italic text-center border-2 border-dashed border-slate-100 rounded-lg">
                                    All production lines are clear.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
