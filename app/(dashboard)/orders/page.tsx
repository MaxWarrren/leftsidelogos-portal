"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, Truck, Package, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

type OrderDetail = {
    item: string;
    qty: number;
};

type Order = {
    id: string;
    status: string;
    name: string;
    timeline_step: number;
    details: OrderDetail[];
    created_at: string;
};

export default function OrderStatusPage() {
    const supabase = createClient();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let channel: any;

        const fetchOrders = async () => {
            // Get Active Org ID from cookie
            const match = document.cookie.match(new RegExp('(^| )active_org_id=([^;]+)'));
            const activeOrgId = match ? match[2] : null;

            if (!activeOrgId) {
                setLoading(false);
                return;
            }

            const { data } = await supabase
                .from('orders')
                .select('*')
                .eq('organization_id', activeOrgId)
                .order('created_at', { ascending: false });

            if (data) setOrders(data as any);
            setLoading(false);

            // Subscribe to changes for this org
            channel = supabase
                .channel(`customer-orders-${activeOrgId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `organization_id=eq.${activeOrgId}`
                }, () => {
                    // Refetch data on change
                    supabase
                        .from('orders')
                        .select('*')
                        .eq('organization_id', activeOrgId)
                        .order('created_at', { ascending: false })
                        .then(({ data }) => {
                            if (data) setOrders(data as any);
                        });
                })
                .subscribe();
        };

        fetchOrders();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [supabase]);

    if (loading) return <div className="p-8 text-center text-slate-500">Loading orders...</div>;
    if (orders.length === 0) return (
        <div className="p-12 text-center bg-white rounded-lg border border-dashed border-slate-200">
            <Package className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No Orders Yet</h3>
            <p className="text-slate-500 max-w-xs mx-auto mt-2">When you start a new project with us, it will appear here with live tracking.</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900">Order Status</h2>

            <div className="grid gap-6">
                {orders.map((order) => {
                    const totalQty = (order.details || []).reduce((sum, d) => sum + (d.qty || 0), 0);
                    return (
                        <Card key={order.id} className="bg-white border-slate-200 overflow-hidden">
                            <div className="h-1 bg-slate-100 w-full overflow-hidden">
                                <div
                                    className="h-full bg-slate-900 transition-all duration-1000"
                                    style={{ width: `${(order.timeline_step / 4) * 100}%` }}
                                />
                            </div>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="space-y-1">
                                    <p className="text-xs font-mono text-slate-500 uppercase">ORD-{order.id.substring(0, 8)}</p>
                                    <CardTitle className="text-xl">{order.name}</CardTitle>
                                    <p className="text-sm text-slate-500 font-medium">Total Quantity: {totalQty} units</p>
                                </div>
                                <Badge variant="outline" className={cn(
                                    "border-slate-900 text-slate-900 font-bold px-4 py-1 uppercase text-[10px]",
                                    order.status === 'completed' ? "bg-slate-900 text-white" : ""
                                )}>
                                    {order.status}
                                </Badge>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="mb-8 flex items-center justify-between relative px-4">
                                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />

                                    {[
                                        { label: "Approval", icon: CheckCircle2 },
                                        { label: "Production", icon: Package },
                                        { label: "Transit", icon: Truck },
                                        { label: "Delivered", icon: CheckCircle2 }
                                    ].map((s, i) => {
                                        const stepNum = i + 1;
                                        const isActive = stepNum <= order.timeline_step;
                                        const isCurrent = stepNum === order.timeline_step;

                                        return (
                                            <div key={i} className="relative z-10 flex flex-col items-center gap-2">
                                                <div className={cn(
                                                    "h-10 w-10 rounded-full flex items-center justify-center border-4 transition-all duration-500",
                                                    isActive ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-300',
                                                    isCurrent && 'ring-2 ring-slate-900 ring-offset-2'
                                                )}>
                                                    <s.icon className="h-5 w-5" />
                                                </div>
                                                <span className={cn(
                                                    "text-[10px] uppercase font-bold tracking-wider",
                                                    isActive ? 'text-slate-900' : 'text-slate-300'
                                                )}>
                                                    {s.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Line Items Display */}
                                <div className="mt-6 border-t border-slate-50 pt-4">
                                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Line Items</h4>
                                    <div className="space-y-2">
                                        {(order.details || []).map((detail, idx) => (
                                            <div key={idx} className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-lg">
                                                <span className="text-sm font-medium text-slate-700">{detail.item}</span>
                                                <span className="text-xs font-bold text-slate-900 whitespace-nowrap bg-white px-2 py-1 rounded border border-slate-100 shadow-sm">x {detail.qty}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
