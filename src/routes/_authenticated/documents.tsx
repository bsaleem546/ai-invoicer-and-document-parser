import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, AlertCircle, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsList,
});

const STATUS_OPTIONS = ["all", "processing", "review", "exported", "error"] as const;
const TYPE_OPTIONS = ["all", "invoice", "receipt", "purchase_order", "other"] as const;

function DocumentsList() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]>("all");

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents-list", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*, extracted_data(vendor_name, total_amount, currency, invoice_number, invoice_date)")
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
    refetchInterval: (q) => {
      const data = q.state.data as any[] | undefined;
      return data?.some((d) => d.status === "processing") ? 2000 : false;
    },
  });

  const filtered = (documents ?? []).filter((d: any) => {
    const ed = Array.isArray(d.extracted_data) ? d.extracted_data[0] : d.extracted_data;
    if (status !== "all" && d.status !== status) return false;
    if (type !== "all" && d.document_type !== type) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.file_name.toLowerCase().includes(q) ||
        (ed?.vendor_name ?? "").toLowerCase().includes(q) ||
        (ed?.invoice_number ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">Full history of all uploaded documents.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by file, vendor, invoice #..."
            className="w-full rounded-md border border-border bg-surface pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t === "all" ? "All types" : t.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-surface" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search || status !== "all" || type !== "all"
              ? "No documents match your filters."
              : "No documents yet."}
          </p>
          {!search && status === "all" && type === "all" && (
            <Link to="/dashboard" className="mt-3 inline-block text-sm text-primary hover:underline">
              Upload your first document →
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="data-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Type</th>
                <th>Vendor</th>
                <th>Invoice #</th>
                <th>Date</th>
                <th className="text-right">Total</th>
                <th>Uploaded</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d: any) => {
                const ed = Array.isArray(d.extracted_data) ? d.extracted_data[0] : d.extracted_data;
                return (
                  <tr
                    key={d.id}
                    onClick={() =>
                      d.status !== "processing" &&
                      navigate({ to: "/documents/$id", params: { id: d.id } })
                    }
                    className={d.status !== "processing" ? "cursor-pointer" : ""}
                  >
                    <td className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate max-w-[220px]">{d.file_name}</span>
                    </td>
                    <td className="font-mono text-xs uppercase text-muted-foreground">
                      {d.document_type?.replace("_", " ") ?? "—"}
                    </td>
                    <td>{ed?.vendor_name ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="font-mono text-xs">
                      {ed?.invoice_number ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">
                      {ed?.invoice_date ?? "—"}
                    </td>
                    <td className="text-right font-mono text-sm">
                      {ed?.total_amount != null
                        ? `${ed.currency ?? ""} ${Number(ed.total_amount).toFixed(2)}`.trim()
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-2 font-mono text-xs uppercase">
                        <span className={`status-dot ${d.status}`} />
                        {d.status}
                        {d.status === "error" && (
                          <AlertCircle className="h-3 w-3 text-destructive" />
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {filtered.length} document{filtered.length !== 1 ? "s" : ""}
            {(search || status !== "all" || type !== "all") &&
              ` (filtered from ${documents?.length ?? 0})`}
          </div>
        </div>
      )}
    </div>
  );
}
