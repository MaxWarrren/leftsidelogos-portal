// Pure helpers for the admin dashboard. All aggregation happens client-side on
// lightweight rows (orders/orgs/leads), so the date-range switcher is instant
// and realtime updates just re-derive from state.
import {
  startOfYear,
  subDays,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  format,
} from 'date-fns';

// ─── row shapes (subset of columns we actually fetch) ───
export type OrderRow = {
  id: string;
  name: string | null;
  price: number | null;
  created_at: string;
  source: string | null;
  status: string | null;
  payment_status: string | null;
  timeline_step: number | null;
  organization_id: string | null;
  organizations?: { name: string } | null;
};
export type OrgRow = { id: string; name: string; created_at: string };
export type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  status: string | null;
  created_at: string;
  details?: any;
};

// ─── ranges ───
export type RangeKey = '30d' | '90d' | 'ytd' | '12m' | 'all';
export const RANGES: { key: RangeKey; label: string }[] = [
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'ytd', label: 'YTD' },
  { key: '12m', label: '12M' },
  { key: 'all', label: 'All' },
];

export function rangeWindow(key: RangeKey, now = new Date()): { start: Date | null; end: Date } {
  switch (key) {
    case '30d': return { start: subDays(now, 30), end: now };
    case '90d': return { start: subDays(now, 90), end: now };
    case 'ytd': return { start: startOfYear(now), end: now };
    case '12m': return { start: subMonths(now, 12), end: now };
    default: return { start: null, end: now };
  }
}

function prevWindow(key: RangeKey, now = new Date()): { start: Date; end: Date } | null {
  const { start, end } = rangeWindow(key, now);
  if (!start) return null;
  const span = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - span), end: start };
}

const within = (iso: string, start: Date | null, end: Date) => {
  const t = new Date(iso).getTime();
  return (start ? t >= start.getTime() : true) && t <= end.getTime();
};

// ─── tiny math + formatting ───
const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
export const fmtMoney2 = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
export const fmtCompactMoney = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);

export function trendPct(cur: number, prev: number | null): number | null {
  if (prev == null) return null;
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

// ─── KPIs ───
export function computeKpis(orders: OrderRow[], orgs: OrgRow[], leads: LeadRow[], key: RangeKey, now = new Date()) {
  const { start, end } = rangeWindow(key, now);
  const prev = prevWindow(key, now);
  const inR = (d: string) => within(d, start, end);
  const inPrev = (d: string) => (prev ? within(d, prev.start, prev.end) : false);

  const rangeOrders = orders.filter((o) => inR(o.created_at));
  const prevOrders = prev ? orders.filter((o) => inPrev(o.created_at)) : [];
  const outstanding = orders.filter((o) => o.payment_status === 'UNPAID' || o.payment_status === 'PARTIALLY_PAID');

  const revenue = round2(sum(rangeOrders.map((o) => o.price || 0)));
  const ordCount = rangeOrders.length;

  return {
    revenue,
    revenuePrev: prev ? round2(sum(prevOrders.map((o) => o.price || 0))) : null,
    orders: ordCount,
    ordersPrev: prev ? prevOrders.length : null,
    outstanding: round2(sum(outstanding.map((o) => o.price || 0))),
    outstandingCount: outstanding.length,
    totalClients: orgs.length,
    newClients: orgs.filter((o) => inR(o.created_at)).length,
    submissions: leads.filter((l) => inR(l.created_at)).length,
    submissionsPrev: prev ? leads.filter((l) => inPrev(l.created_at)).length : null,
    aov: ordCount ? round2(revenue / ordCount) : 0,
  };
}

export function rangeFilteredOrders(orders: OrderRow[], key: RangeKey, now = new Date()) {
  const { start, end } = rangeWindow(key, now);
  return orders.filter((o) => within(o.created_at, start, end));
}

// ─── time series ───
function spanStart(key: RangeKey, fallbackDates: string[], now: Date): Date {
  const { start } = rangeWindow(key, now);
  if (start) return start;
  const ts = fallbackDates.map((d) => new Date(d).getTime());
  return ts.length ? new Date(Math.min(...ts)) : startOfYear(now);
}

export function monthlySeries(orders: OrderRow[], key: RangeKey, now = new Date()) {
  const start = spanStart(key, orders.map((o) => o.created_at), now);
  const months = eachMonthOfInterval({ start: startOfMonth(start), end: now });
  return months.map((m) => {
    const k = format(m, 'yyyy-MM');
    const mo = orders.filter((o) => format(new Date(o.created_at), 'yyyy-MM') === k);
    return { label: format(m, 'MMM'), revenue: round2(sum(mo.map((o) => o.price || 0))), orders: mo.length };
  });
}

export function clientGrowthSeries(orgs: OrgRow[], key: RangeKey, now = new Date()) {
  const start = spanStart(key, orgs.map((o) => o.created_at), now);
  const months = eachMonthOfInterval({ start: startOfMonth(start), end: now });
  return months.map((m) => ({
    label: format(m, 'MMM'),
    total: orgs.filter((o) => new Date(o.created_at) <= endOfMonth(m)).length,
  }));
}

// ─── distributions ───
export function topClients(orders: OrderRow[], n = 8) {
  const map = new Map<string, number>();
  for (const o of orders) {
    const name = o.organizations?.name || 'Unknown';
    map.set(name, (map.get(name) || 0) + (o.price || 0));
  }
  return [...map.entries()]
    .map(([name, revenue]) => ({ name, revenue: round2(revenue) }))
    .filter((d) => d.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, n);
}

export function byPayment(orders: OrderRow[]) {
  const b: Record<string, number> = { PAID: 0, UNPAID: 0, PARTIALLY_PAID: 0 };
  for (const o of orders) if (o.payment_status && o.payment_status in b) b[o.payment_status] += o.price || 0;
  return [
    { name: 'Paid', value: round2(b.PAID), fill: 'var(--chart-2)' },
    { name: 'Partial', value: round2(b.PARTIALLY_PAID), fill: 'var(--chart-3)' },
    { name: 'Unpaid', value: round2(b.UNPAID), fill: 'var(--chart-4)' },
  ].filter((d) => d.value > 0);
}

export function bySource(orders: OrderRow[]) {
  const colors: Record<string, string> = {
    square: 'var(--chart-1)',
    portal: 'var(--chart-2)',
    website: 'var(--chart-3)',
    other: 'var(--chart-5)',
  };
  const map = new Map<string, number>();
  for (const o of orders) {
    const s = o.source || 'other';
    map.set(s, (map.get(s) || 0) + 1);
  }
  return [...map.entries()].map(([k, value]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1),
    value,
    fill: colors[k] || 'var(--chart-5)',
  }));
}

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
export function leadFunnel(leads: LeadRow[]) {
  return LEAD_STATUSES.map((s) => ({
    status: s.charAt(0).toUpperCase() + s.slice(1),
    count: leads.filter((l) => (l.status || 'new') === s).length,
  }));
}
