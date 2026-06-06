import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
});

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe"];

function fmt(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function AnalyticsPage() {
  const { user } = Route.useRouteContext();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["analytics", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("created_at, document_type, status, extracted_data(vendor_name, total_amount, currency, invoice_date)")
        .eq("status", "review")
        .order("created_at", { ascending: true });
      return (data ?? []).map((d: any) => {
        const ed = Array.isArray(d.extracted_data) ? d.extracted_data[0] : d.extracted_data;
        return {
          date: d.created_at,
          document_type: d.document_type ?? "other",
          vendor: ed?.vendor_name ?? "Unknown",
          amount: Number(ed?.total_amount ?? 0),
          currency: ed?.currency ?? "",
          invoice_date: ed?.invoice_date ?? d.created_at,
        };
      });
    },
  });

  if (isLoading) return <AnalyticsSkeleton />;

  const docs = rows ?? [];
  const totalSpend = docs.reduce((s, d) => s + d.amount, 0);
  const avgInvoice = docs.length ? totalSpend / docs.length : 0;
  const topVendor = (() => {
    const map: Record<string, number> = {};
    docs.forEach((d) => { map[d.vendor] = (map[d.vendor] ?? 0) + d.amount; });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? "—";
  })();

  // Spend by month
  const byMonth: Record<string, number> = {};
  docs.forEach((d) => {
    const month = d.invoice_date.slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + d.amount;
  });
  const monthData = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, total]) => ({ month, total }));

  // Spend by vendor (top 8)
  const byVendor: Record<string, number> = {};
  docs.forEach((d) => { byVendor[d.vendor] = (byVendor[d.vendor] ?? 0) + d.amount; });
  const vendorData = Object.entries(byVendor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, total]) => ({ name, total }));

  // By document type
  const byType: Record<string, number> = {};
  docs.forEach((d) => { byType[d.document_type] = (byType[d.document_type] ?? 0) + 1; });
  const typeData = Object.entries(byType).map(([name, value]) => ({ name: name.replace("_", " "), value }));

  if (docs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Spend Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visual breakdown of your extracted invoice data.</p>
        </div>
        <div className="rounded-lg border border-dashed border-border py-20 text-center">
          <p className="text-sm text-muted-foreground">No extracted documents yet. Upload and process invoices to see analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Spend Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visual breakdown of your extracted invoice data.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Total spend" value={fmt(totalSpend)} />
        <SummaryCard label="Documents" value={String(docs.length)} />
        <SummaryCard label="Avg invoice" value={fmt(avgInvoice)} />
        <SummaryCard label="Top vendor" value={topVendor} />
      </div>

      {/* Spend by month */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <p className="mb-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">Spend by month</p>
        {monthData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthData} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "oklch(var(--surface))", border: "1px solid oklch(var(--border))", borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground">Not enough data yet.</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top vendors */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="mb-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">Top vendors by spend</p>
          {vendorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={vendorData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "oklch(var(--surface))", border: "1px solid oklch(var(--border))", borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="total" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Not enough data yet.</p>
          )}
        </div>

        {/* By document type */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="mb-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">By document type</p>
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false} fontSize={11}>
                  {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(var(--surface))", border: "1px solid oklch(var(--border))", borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Not enough data yet.</p>
          )}
        </div>
      </div>

      {/* Spend over time (line) */}
      {monthData.length > 1 && (
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="mb-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">Spend trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthData} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "oklch(var(--surface))", border: "1px solid oklch(var(--border))", borderRadius: 6, fontSize: 12 }} />
              <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={{ r: 4, fill: "#6366f1" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold truncate">{value}</p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded bg-border animate-pulse" />
        <div className="h-4 w-64 rounded bg-border animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-lg bg-surface border border-border animate-pulse" />)}
      </div>
      <div className="h-72 rounded-lg bg-surface border border-border animate-pulse" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-lg bg-surface border border-border animate-pulse" />
        <div className="h-72 rounded-lg bg-surface border border-border animate-pulse" />
      </div>
    </div>
  );
}
