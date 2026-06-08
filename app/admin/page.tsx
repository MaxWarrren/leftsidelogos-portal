'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Gauge,
  Inbox,
  ShoppingBag,
  Users,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';
import {
  RANGES,
  type RangeKey,
  type OrderRow,
  type OrgRow,
  type LeadRow,
  computeKpis,
  rangeFilteredOrders,
  monthlySeries,
  clientGrowthSeries,
  topClients,
  byPayment,
  bySource,
  leadFunnel,
  trendPct,
  fmtMoney,
  fmtMoney2,
} from '@/lib/dashboard';
import {
  RevenueAreaChart,
  OrdersBarChart,
  ClientGrowthLine,
  TopClientsBar,
  PaymentDonut,
  SourceDonut,
  LeadFunnelBar,
} from './_components/dashboard-charts';

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const up = pct >= 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', up ? 'text-emerald-600' : 'text-red-600')}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
  trend,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  accent: string;
  sub?: string;
  trend?: number | null;
}) {
  return (
    <Card className="border-slate-200 bg-white">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
          <Icon className={cn('h-4 w-4', accent)} />
        </div>
        <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
        <div className="mt-1 flex items-center gap-2">
          {trend !== undefined && <TrendBadge pct={trend} />}
          {sub && <span className="text-xs text-slate-500">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline">—</Badge>;
  const map: Record<string, string> = {
    PAID: 'bg-emerald-100 text-emerald-700',
    UNPAID: 'bg-red-100 text-red-700',
    PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  };
  const label = status === 'PARTIALLY_PAID' ? 'Partial' : status.charAt(0) + status.slice(1).toLowerCase();
  return <Badge className={cn('border-0', map[status] || 'bg-slate-100 text-slate-700')}>{label}</Badge>;
}

function SectionCard({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn('border-slate-200 bg-white', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

export default function AdminDashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [range, setRange] = useState<RangeKey>('ytd');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [activity, setActivity] = useState<any[]>([]);

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [ord, org, lead, msg] = await Promise.all([
      supabase.from('orders').select('id, name, price, created_at, source, status, payment_status, timeline_step, organization_id, organizations(name)'),
      supabase.from('organizations').select('id, name, created_at'),
      supabase.from('leads').select('id, name, email, status, created_at'),
      supabase.from('messages').select('id, content, created_at, organizations(name), profiles(full_name)').order('created_at', { ascending: false }).limit(6),
    ]);
    setOrders((ord.data as unknown as OrderRow[]) || []);
    setOrgs((org.data as OrgRow[]) || []);
    setLeads((lead.data as LeadRow[]) || []);
    setActivity(msg.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchAll)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchAll]);

  const kpis = useMemo(() => computeKpis(orders, orgs, leads, range), [orders, orgs, leads, range]);
  const rangeOrders = useMemo(() => rangeFilteredOrders(orders, range), [orders, range]);
  const revenueSeries = useMemo(() => monthlySeries(orders, range), [orders, range]);
  const growthSeries = useMemo(() => clientGrowthSeries(orgs, range), [orgs, range]);
  const clients = useMemo(() => topClients(rangeOrders), [rangeOrders]);
  const payment = useMemo(() => byPayment(rangeOrders), [rangeOrders]);
  const sources = useMemo(() => bySource(rangeOrders), [rangeOrders]);
  const funnel = useMemo(() => leadFunnel(leads), [leads]);

  const unpaid = useMemo(
    () =>
      orders
        .filter((o) => o.payment_status === 'UNPAID' || o.payment_status === 'PARTIALLY_PAID')
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [orders],
  );
  const recentLeads = useMemo(
    () => [...leads].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5),
    [leads],
  );
  const activeOrders = useMemo(() => orders.filter((o) => o.status !== 'completed').slice(0, 5), [orders]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Control Center</h1>
          <p className="text-sm text-slate-500">Revenue, orders, clients, and submissions at a glance.</p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <TabsList>
            {RANGES.map((r) => (
              <TabsTrigger key={r.key} value={r.key}>{r.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Revenue" value={fmtMoney(kpis.revenue)} icon={DollarSign} accent="text-emerald-600" trend={trendPct(kpis.revenue, kpis.revenuePrev)} sub="in range" />
        <KpiCard label="Orders" value={String(kpis.orders)} icon={ShoppingBag} accent="text-blue-600" trend={trendPct(kpis.orders, kpis.ordersPrev)} sub="in range" />
        <KpiCard label="Outstanding" value={fmtMoney(kpis.outstanding)} icon={AlertCircle} accent="text-red-600" sub={`${kpis.outstandingCount} unpaid`} />
        <KpiCard label="Clients" value={String(kpis.totalClients)} icon={Users} accent="text-violet-600" sub={`+${kpis.newClients} new`} />
        <KpiCard label="Submissions" value={String(kpis.submissions)} icon={Inbox} accent="text-orange-600" trend={trendPct(kpis.submissions, kpis.submissionsPrev)} sub="new leads" />
        <KpiCard label="Avg Order" value={fmtMoney(kpis.aov)} icon={Gauge} accent="text-slate-600" sub="per order" />
      </div>

      {/* Revenue + payment */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Revenue over time" description="Monthly revenue across the selected range" className="lg:col-span-2">
          <RevenueAreaChart data={revenueSeries} />
        </SectionCard>
        <SectionCard title="Paid vs Unpaid" description="By dollar value">
          {payment.length ? <PaymentDonut data={payment} /> : <Empty>No orders in range</Empty>}
        </SectionCard>
      </div>

      {/* Orders + growth + source */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Orders per month">
          <OrdersBarChart data={revenueSeries} />
        </SectionCard>
        <SectionCard title="Client growth" description="Cumulative organizations">
          <ClientGrowthLine data={growthSeries} />
        </SectionCard>
        <SectionCard title="Orders by source">
          {sources.length ? <SourceDonut data={sources} /> : <Empty>No orders in range</Empty>}
        </SectionCard>
      </div>

      {/* Top clients + leads */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Top clients by revenue" className="lg:col-span-2">
          {clients.length ? <TopClientsBar data={clients} /> : <Empty>No revenue in range</Empty>}
        </SectionCard>
        <SectionCard title="Lead pipeline" description="All submissions by status">
          <LeadFunnelBar data={funnel} />
        </SectionCard>
      </div>

      {/* Unpaid + submissions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Unpaid invoices" description={`${unpaid.length} awaiting payment`} className="lg:col-span-2">
          {unpaid.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unpaid.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.organizations?.name || '—'}</TableCell>
                    <TableCell>
                      <Link href={`/admin/orders/${o.id}`} className="text-slate-600 hover:text-slate-900 hover:underline">
                        {o.name || 'Untitled'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney2(o.price || 0)}</TableCell>
                    <TableCell className="text-slate-500">{fmtDate(o.created_at)}</TableCell>
                    <TableCell><PaymentBadge status={o.payment_status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>All invoices are paid 🎉</Empty>
          )}
        </SectionCard>

        <SectionCard title="Recent submissions" description="Latest website leads">
          <div className="space-y-3">
            {recentLeads.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{l.name || l.email || 'Unknown'}</p>
                  <p className="truncate text-xs text-slate-500">{fmtDate(l.created_at)}</p>
                </div>
                <Badge variant="outline" className="capitalize">{l.status || 'new'}</Badge>
              </div>
            ))}
            {recentLeads.length === 0 && <Empty>No submissions yet</Empty>}
          </div>
        </SectionCard>
      </div>

      {/* Activity + production */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Recent client activity">
          <div className="space-y-4">
            {activity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {(a.profiles?.full_name || '??').substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {a.profiles?.full_name} {a.organizations?.name ? `(${a.organizations.name})` : ''}
                  </p>
                  <p className="truncate text-xs text-slate-500">{a.content}</p>
                </div>
                <span className="whitespace-nowrap text-[10px] text-slate-400">
                  {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {activity.length === 0 && <Empty>No recent activity</Empty>}
          </div>
        </SectionCard>

        <SectionCard title="Production status" description="Active orders in progress">
          <div className="space-y-4">
            {activeOrders.map((o) => (
              <div key={o.id} className="space-y-2 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{o.name}</p>
                    <p className="truncate text-xs text-slate-500">{o.organizations?.name}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{o.status}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-slate-900 transition-all" style={{ width: `${((o.timeline_step || 0) / 4) * 100}%` }} />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500">Step {o.timeline_step || 0}/4</span>
                </div>
              </div>
            ))}
            {activeOrders.length === 0 && <Empty>All production lines are clear</Empty>}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border-2 border-dashed border-slate-100 py-8 text-center text-sm italic text-slate-500">
      {children}
    </p>
  );
}
