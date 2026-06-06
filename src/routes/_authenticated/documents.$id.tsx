import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Download, Plus, Trash2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents/$id")({
  component: ReviewPage,
});

type Conf = "high" | "medium" | "low" | null | undefined;

function ConfDot({ level }: { level: Conf }) {
  if (!level) return null;
  const cls = level === "high" ? "bg-success" : level === "medium" ? "bg-warning" : "bg-destructive";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} title={`Confidence: ${level}`} />;
}

function ReviewPage() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle();
      return data;
    },
  });
  const isPro = profile?.plan === "pro" || profile?.plan === "team";

  const { data, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const [docRes, exRes, liRes, dupRes] = await Promise.all([
        supabase.from("documents").select("*").eq("id", id).maybeSingle(),
        supabase.from("extracted_data").select("*").eq("document_id", id).maybeSingle(),
        supabase.from("line_items").select("*").eq("document_id", id).order("position"),
        supabase.from("duplicate_flags").select("*, matched:matched_document_id(file_name)").eq("document_id", id).eq("dismissed", false),
      ]);
      return {
        document: docRes.data,
        extracted: exRes.data,
        line_items: liRes.data ?? [],
        duplicates: (dupRes.data ?? []) as any[],
      };
    },
    refetchInterval: (q) => (q.state.data?.document?.status === "processing" ? 2000 : false),
  });

  useEffect(() => {
    if (!data?.document) return;
    supabase.storage.from("documents").createSignedUrl(data.document.file_path, 3600).then(({ data: url }) => {
      if (url) setFileUrl(url.signedUrl);
    });
  }, [data?.document]);

  const [edits, setEdits] = useState<Record<string, any>>({});
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    if (data?.line_items && items === null) setItems(data.line_items);
  }, [data?.line_items, items]);

  const merged = useMemo(() => ({ ...(data?.extracted ?? {}), ...edits }), [data?.extracted, edits]);

  const lowConfFields = useMemo(() => {
    const c = data?.extracted?.confidence_fields as Record<string, string> | undefined;
    if (!c) return [];
    return Object.entries(c).filter(([, v]) => v === "low").map(([k]) => k);
  }, [data?.extracted]);

  async function save() {
    if (!data?.extracted) return;
    const payload: any = { user_edited: true };
    for (const k of ["vendor_name", "invoice_number", "invoice_date", "due_date", "currency", "subtotal", "tax_amount", "total_amount"]) {
      if (k in edits) payload[k] = edits[k] === "" ? null : edits[k];
    }
    const { error } = await supabase.from("extracted_data").update(payload).eq("document_id", id);
    if (error) return toast.error(error.message);

    // Replace line items
    if (items) {
      await supabase.from("line_items").delete().eq("document_id", id);
      const rows = items.map((li, i) => ({
        document_id: id,
        position: i,
        description: li.description ?? null,
        quantity: li.quantity ?? null,
        unit_price: li.unit_price ?? null,
        line_total: li.line_total ?? null,
        confidence: li.confidence ?? null,
      }));
      if (rows.length) await supabase.from("line_items").insert(rows);
    }
    setEdits({});
    queryClient.invalidateQueries({ queryKey: ["document", id] });
    toast.success("Saved");
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ ...merged, line_items: items }, null, 2)], { type: "application/json" });
    download(blob, `${data?.document?.file_name ?? "document"}.json`);
  }

  function exportCSV() {
    const headers = ["description", "quantity", "unit_price", "line_total"];
    const rows = (items ?? []).map((li) => headers.map((h) => csvCell(li[h])).join(","));
    const meta = `Vendor,${csvCell(merged.vendor_name)}\nInvoice #,${csvCell(merged.invoice_number)}\nDate,${csvCell(merged.invoice_date)}\nTotal,${csvCell(merged.total_amount)}\n\n`;
    const csv = meta + headers.join(",") + "\n" + rows.join("\n");
    download(new Blob([csv], { type: "text/csv" }), `${data?.document?.file_name ?? "document"}.csv`);
    supabase.from("documents").update({ status: "exported" }).eq("id", id).then(() => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
    });
  }

  async function dismissDup(dupId: string) {
    await supabase.from("duplicate_flags").update({ dismissed: true }).eq("id", dupId);
    queryClient.invalidateQueries({ queryKey: ["document", id] });
  }

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (!data?.document) return <p className="text-muted-foreground">Document not found.</p>;

  const doc = data.document;
  const processing = doc.status === "processing";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="rounded-md p-2 hover:bg-surface"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="font-display text-2xl font-bold">{doc.file_name}</h1>
            <p className="font-mono text-xs uppercase text-muted-foreground">
              <span className={`status-dot ${doc.status} mr-2`} />{doc.status}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={!Object.keys(edits).length} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-30">
            Save edits
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">
            <Download className="h-4 w-4" /> CSV
          </button>
          <button onClick={exportJSON} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">
            <Download className="h-4 w-4" /> JSON
          </button>
          {isPro ? (
            <button
              onClick={() => toast.info("QuickBooks integration coming soon")}
              className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-surface"
            >
              Push to QuickBooks
            </button>
          ) : (
            <button
              onClick={() => toast.info("Upgrade to Pro to unlock QuickBooks sync")}
              className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground opacity-50"
              title="Pro plan required"
            >
              Push to QuickBooks 🔒
            </button>
          )}
        </div>
      </div>

      {/* Mobile banner */}
      <div className="mb-4 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground md:hidden">
        Review works best on a larger screen.
      </div>

      {data.duplicates.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-warning bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
          <div className="flex-1">
            <strong className="text-warning">Possible duplicate.</strong>{" "}
            {data.duplicates[0].match_reason}. Matched: {data.duplicates[0].matched?.file_name ?? "another document"}.
          </div>
          <button onClick={() => dismissDup(data.duplicates[0].id)} className="text-xs uppercase text-muted-foreground hover:text-foreground">
            Dismiss
          </button>
        </div>
      )}

      {lowConfFields.length > 0 && !processing && (
        <div className="mb-4 rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <strong className="text-warning">{lowConfFields.length}</strong> field(s) extracted with low confidence — please review.
        </div>
      )}

      {doc.status === "error" && (
        <div className="mb-4 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Extraction failed: {doc.error_message ?? "unknown error"}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Viewer */}
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="font-mono text-xs uppercase text-muted-foreground">Source</div>
          <div className="mt-2 flex min-h-[400px] items-center justify-center overflow-auto rounded bg-background">
            {fileUrl ? (
              doc.mime_type?.startsWith("image/") ? (
                <img src={fileUrl} alt={doc.file_name} className="max-h-[80vh] w-full object-contain" />
              ) : (
                <iframe src={fileUrl} className="h-[80vh] w-full" title={doc.file_name} />
              )
            ) : (
              <p className="text-muted-foreground">Loading preview...</p>
            )}
          </div>
        </div>

        {/* Extracted */}
        <div className="rounded-md border border-border bg-surface p-4">
          <div className="font-mono text-xs uppercase text-muted-foreground">Extracted data</div>
          {processing ? (
            <div className="mt-4 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-surface-elevated" />
              ))}
              <p className="text-center text-xs text-muted-foreground">Extracting...</p>
            </div>
          ) : (() => {
            const cf = (data.extracted?.confidence_fields ?? {}) as Record<string, Conf>;
            return (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <EditField label="Vendor" field="vendor_name" merged={merged} edits={edits} setEdits={setEdits} conf={cf.vendor_name} />
                <EditField label="Invoice #" field="invoice_number" merged={merged} edits={edits} setEdits={setEdits} mono conf={cf.invoice_number} />
                <EditField label="Invoice date" field="invoice_date" merged={merged} edits={edits} setEdits={setEdits} mono conf={cf.invoice_date} />
                <EditField label="Due date" field="due_date" merged={merged} edits={edits} setEdits={setEdits} mono />
                <EditField label="Currency" field="currency" merged={merged} edits={edits} setEdits={setEdits} mono />
                <EditField label="Subtotal" field="subtotal" merged={merged} edits={edits} setEdits={setEdits} mono number />
                <EditField label="Tax" field="tax_amount" merged={merged} edits={edits} setEdits={setEdits} mono number />
                <EditField label="Total" field="total_amount" merged={merged} edits={edits} setEdits={setEdits} mono number conf={cf.total_amount} />
              </div>
            );
          })()}
        </div>
      </div>

      {/* Line items */}
      {!processing && (
        <div className="mt-4 rounded-md border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="font-mono text-xs uppercase text-muted-foreground">Line items</div>
            <button
              onClick={() => setItems([...(items ?? []), { description: "", quantity: null, unit_price: null, line_total: null }])}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" /> Add row
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="text-right w-24">Qty</th>
                <th className="text-right w-32">Unit price</th>
                <th className="text-right w-32">Total</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((li, i) => (
                <tr key={i}>
                  <td>
                    <input
                      value={li.description ?? ""}
                      onChange={(e) => updateItem(setItems, items!, i, "description", e.target.value)}
                      className="w-full bg-transparent text-sm focus:outline-none"
                    />
                  </td>
                  <td>
                    <NumCell value={li.quantity} onChange={(v) => updateItem(setItems, items!, i, "quantity", v)} />
                  </td>
                  <td>
                    <NumCell value={li.unit_price} onChange={(v) => updateItem(setItems, items!, i, "unit_price", v)} />
                  </td>
                  <td>
                    <NumCell value={li.line_total} onChange={(v) => updateItem(setItems, items!, i, "line_total", v)} />
                  </td>
                  <td>
                    <button onClick={() => setItems((items ?? []).filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {(items ?? []).length === 0 && (
                <tr><td colSpan={5} className="text-center text-sm text-muted-foreground">No line items extracted.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EditField({ label, field, merged, edits, setEdits, mono, number, conf }: {
  label: string; field: string; merged: any; edits: any; setEdits: (v: any) => void;
  mono?: boolean; number?: boolean; conf?: Conf;
}) {
  const value = merged[field] ?? "";
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label} <ConfDot level={conf} />
      </span>
      <input
        type={number ? "number" : "text"}
        value={value}
        onChange={(e) => setEdits({ ...edits, [field]: number ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value })}
        className={`w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none ${mono ? "font-mono" : ""}`}
      />
    </label>
  );
}

function NumCell({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className="w-full bg-transparent text-right font-mono text-sm focus:outline-none"
    />
  );
}

function updateItem(setItems: any, items: any[], i: number, key: string, val: any) {
  const next = [...items];
  next[i] = { ...next[i], [key]: val };
  setItems(next);
}

function csvCell(v: any) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
