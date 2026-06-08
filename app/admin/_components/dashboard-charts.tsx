'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { fmtCompactMoney, fmtMoney, fmtMoney2 } from '@/lib/dashboard';

const AXIS = { tickLine: false, axisLine: false, tickMargin: 8 } as const;

export function RevenueAreaChart({ data }: { data: { label: string; revenue: number }[] }) {
  const config = { revenue: { label: 'Revenue', color: 'var(--chart-1)' } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} width={48} tickFormatter={(v) => fmtCompactMoney(v as number)} />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(v) => fmtMoney2(Number(v))} />}
        />
        <defs>
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <Area
          dataKey="revenue"
          type="monotone"
          stroke="var(--color-revenue)"
          strokeWidth={2}
          fill="url(#fillRevenue)"
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function OrdersBarChart({ data }: { data: { label: string; orders: number }[] }) {
  const config = { orders: { label: 'Orders', color: 'var(--chart-2)' } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} width={32} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export function ClientGrowthLine({ data }: { data: { label: string; total: number }[] }) {
  const config = { total: { label: 'Clients', color: 'var(--chart-1)' } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <LineChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} width={32} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line dataKey="total" type="monotone" stroke="var(--color-total)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}

export function TopClientsBar({ data }: { data: { name: string; revenue: number }[] }) {
  const config = { revenue: { label: 'Revenue', color: 'var(--chart-1)' } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-[300px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40 }}>
        <XAxis type="number" dataKey="revenue" hide />
        <YAxis
          type="category"
          dataKey="name"
          {...AXIS}
          width={130}
          tickFormatter={(v) => (String(v).length > 18 ? `${String(v).slice(0, 18)}…` : String(v))}
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtMoney2(Number(v))} />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4}>
          <LabelList
            dataKey="revenue"
            position="right"
            className="fill-foreground"
            fontSize={11}
            formatter={(v) => fmtMoney(Number(v))}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function Donut({
  data,
  config,
  money,
  centerLabel,
  centerValue,
}: {
  data: { name: string; value: number; fill: string }[];
  config: ChartConfig;
  money?: boolean;
  centerLabel: string;
  centerValue: string;
}) {
  return (
    <div className="relative">
      <ChartContainer config={config} className="mx-auto aspect-square h-[220px]">
        <PieChart>
          <ChartTooltip
            content={<ChartTooltipContent nameKey="name" formatter={(v) => (money ? fmtMoney2(Number(v)) : String(v))} />}
          />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} strokeWidth={3} paddingAngle={2}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-slate-900">{centerValue}</span>
        <span className="text-xs text-slate-500">{centerLabel}</span>
      </div>
    </div>
  );
}

export function PaymentDonut({ data }: { data: { name: string; value: number; fill: string }[] }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  const config = {
    Paid: { label: 'Paid', color: 'var(--chart-2)' },
    Partial: { label: 'Partial', color: 'var(--chart-3)' },
    Unpaid: { label: 'Unpaid', color: 'var(--chart-4)' },
  } satisfies ChartConfig;
  return <Donut data={data} config={config} money centerLabel="collected + due" centerValue={fmtCompactMoney(total)} />;
}

export function SourceDonut({ data }: { data: { name: string; value: number; fill: string }[] }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  const config = {
    Square: { label: 'Square', color: 'var(--chart-1)' },
    Portal: { label: 'Portal', color: 'var(--chart-2)' },
    Website: { label: 'Website', color: 'var(--chart-3)' },
  } satisfies ChartConfig;
  return <Donut data={data} config={config} centerLabel="orders" centerValue={String(total)} />;
}

export function LeadFunnelBar({ data }: { data: { status: string; count: number }[] }) {
  const config = { count: { label: 'Leads', color: 'var(--chart-3)' } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-[240px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 32 }}>
        <XAxis type="number" dataKey="count" hide allowDecimals={false} />
        <YAxis type="category" dataKey="status" {...AXIS} width={84} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4}>
          <LabelList dataKey="count" position="right" className="fill-foreground" fontSize={11} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
