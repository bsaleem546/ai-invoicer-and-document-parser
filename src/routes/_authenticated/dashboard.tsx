import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { extractDocument } from "@/lib/documents.functions";
import { toast } from "sonner";
import { Upload, FileText, AlertCircle, RotateCcw, TrendingUp, CheckCircle, DollarSign, Hash, X, Loader2 } from "lucide-react";

const PLAN_LIMITS = { free: 5, pro: 50, team: 500 } as const;
const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];
const ACCEPTED_EXT = ".png,.jpg,.jpeg,.webp,.pdf";
const MAX_SIZE = { image: 2 * 1024 * 1024, pdf: 5 * 1024 * 1024 };

type QueueItem = {
  id: string;
  name: string;
  status: "pending" | "uploading" | "extracting" | "done" | "error";
  error?: string;
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4 flex items-start gap-3">
      <div className="rounded-md bg-primary/10 p-2 text-primary shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-display text-2xl font-bold truncate">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-md border border-border bg-surface p-4 flex items-start gap-3">
      <div className="h-9 w-9 rounded-md bg-border animate-pulse shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-2.5 w-24 rounded bg-border animate-pulse" />
        <div className="h-7 w-16 rounded bg-border animate-pulse" />
        <div className="h-2 w-32 rounded bg-border animate-pulse" />
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="data-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Vendor</th>
            <th className="text-right">Total</th>
            <th>Uploaded</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, i) => (
            <tr key={i}>
              <td><div className="h-4 w-48 rounded bg-border animate-pulse" /></td>
              <td><div className="h-4 w-28 rounded bg-border animate-pulse" /></td>
              <td><div className="h-4 w-20 rounded bg-border animate-pulse ml-auto" /></td>
              <td><div className="h-4 w-24 rounded bg-border animate-pulse" /></td>
              <td><div className="h-4 w-16 rounded bg-border animate-pulse" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueueItemRow({ item, onRemove }: { item: QueueItem; onRemove: (id: string) => void }) {
  const isDone = item.status === "done" || item.status === "error";
  return (
    <div className="flex items-center gap-3 py-2 px-3">
      <div className="shrink-0">
        {item.status === "pending" && <div className="h-4 w-4 rounded-full border-2 border-border" />}
        {(item.status === "uploading" || item.status === "extracting") && (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
        {item.status === "done" && <CheckCircle className="h-4 w-4 text-success" />}
        {item.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground font-mono">
          {item.status === "uploading" && "Uploading..."}
          {item.status === "extracting" && "Extracting data..."}
          {item.status === "done" && "Complete"}
          {item.status === "pending" && "Queued"}
          {item.status === "error" && (item.error ?? "Failed")}
        </p>
      </div>
      {isDone && (
        <button onClick={() => onRemove(item.id)} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const extractFn = useServerFn(extractDocument);
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);
  const processingRef = useRef(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: documents, isLoading: docsLoading, refetch } = useQuery({
    queryKey: ["documents", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*, extracted_data(vendor_name, total_amount, currency)")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    refetchInterval: (q) => {
      const data = q.state.data as any[] | undefined;
      return data?.some((d) => d.status === "processing") ? 2000 : false;
    },
  });

  const updateItem = (id: string, patch: Partial<QueueItem>) =>
    setQueue((q) => q.map((item) => item.id === id ? { ...item, ...patch } : item));

  const processFile = useCallback(async (file: File, itemId: string) => {
    const isPdf = file.type === "application/pdf";
    const maxSize = isPdf ? MAX_SIZE.pdf : MAX_SIZE.image;

    if (!ACCEPTED.includes(file.type)) {
      updateItem(itemId, { status: "error", error: "Unsupported file type" });
      return;
    }
    if (file.size > maxSize) {
      updateItem(itemId, { status: "error", error: `Too large (max ${isPdf ? "5MB" : "2MB"})` });
      return;
    }

    try {
      updateItem(itemId, { status: "uploading" });
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("documents").upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;

      const { data: doc, error: insErr } = await supabase
        .from("documents")
        .insert({ user_id: user.id, file_name: file.name, file_path: path, mime_type: file.type, status: "processing" })
        .select()
        .single();
      if (insErr) throw insErr;

      refetch();
      updateItem(itemId, { status: "extracting" });

      await extractFn({ data: { documentId: doc.id } });
      updateItem(itemId, { status: "done" });
      queryClient.invalidateQueries({ queryKey: ["documents", user.id] });
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (err) {
      updateItem(itemId, { status: "error", error: err instanceof Error ? err.message : "Failed" });
      queryClient.invalidateQueries({ queryKey: ["documents", user.id] });
    }
  }, [user.id, extractFn, queryClient, refetch]);

  const processQueue = useCallback(async (items: QueueItem[], files: File[]) => {
    if (processingRef.current) return;
    processingRef.current = true;
    for (let i = 0; i < files.length; i++) {
      await processFile(files[i], items[i].id);
    }
    processingRef.current = false;
  }, [processFile]);

  const handleFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const newItems: QueueItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      status: "pending",
    }));
    setQueue((q) => [...q, ...newItems]);
    processQueue(newItems, files);
  }, [processQueue]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  async function handleRetry(documentId: string) {
    setRetrying(documentId);
    try {
      await supabase.from("documents").update({ status: "processing", error_message: null }).eq("id", documentId);
      await extractFn({ data: { documentId } });
      await queryClient.invalidateQueries({ queryKey: ["documents", user.id] });
      toast.success("Document reprocessed successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
      await queryClient.invalidateQueries({ queryKey: ["documents", user.id] });
    } finally {
      setRetrying(null);
    }
  }

  const removeFromQueue = (id: string) => setQueue((q) => q.filter((item) => item.id !== id));
  const clearDone = () => setQueue((q) => q.filter((item) => item.status === "pending" || item.status === "uploading" || item.status === "extracting"));

  const plan = (profile?.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const limit = PLAN_LIMITS[plan];
  const used = profile?.documents_used_this_month ?? 0;
  const pct = Math.min(100, (used / limit) * 100);

  const total = documents?.length ?? 0;
  const successful = documents?.filter((d: any) => d.status !== "error").length ?? 0;
  const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;
  const totalValue = documents?.reduce((sum: number, d: any) => {
    const ed = Array.isArray(d.extracted_data) ? d.extracted_data[0] : d.extracted_data;
    return sum + (ed?.total_amount ?? 0);
  }, 0) ?? 0;

  const isLoading = profileLoading || docsLoading;
  const activeQueue = queue.filter((i) => i.status !== "done" || queue.some((j) => j.status === "pending" || j.status === "uploading" || j.status === "extracting"));
  const doneCount = queue.filter((i) => i.status === "done").length;
  const errorCount = queue.filter((i) => i.status === "error").length;
  const showQueue = queue.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload invoices and receipts. Get structured data back instantly.
        </p>
      </div>

      {/* Analytics cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading ? (
          <><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></>
        ) : (
          <>
            <StatCard label="Total documents" value={String(total)} sub="all time" icon={<Hash className="h-4 w-4" />} />
            <StatCard label="This month" value={`${used} / ${limit}`} sub={`${plan} plan · ${Math.round(pct)}% used`} icon={<TrendingUp className="h-4 w-4" />} />
            <StatCard label="Success rate" value={`${successRate}%`} sub={`${successful} of ${total} processed`} icon={<CheckCircle className="h-4 w-4" />} />
            <StatCard label="Total value extracted" value={totalValue > 0 ? `$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"} sub="sum of all invoices" icon={<DollarSign className="h-4 w-4" />} />
          </>
        )}
      </div>

      {/* Usage bar */}
      {!isLoading && (
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono uppercase text-muted-foreground">Usage this month</span>
            <span className="font-mono">{used} / {limit}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div className={`h-full transition-all ${pct > 80 ? "bg-warning" : "bg-primary"}`} style={{ width: `${pct}%` }} />
          </div>
          {pct > 80 && <p className="mt-2 text-xs text-warning">Approaching limit — consider upgrading.</p>}
        </div>
      )}

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
          dragOver ? "border-primary bg-accent" : "border-border bg-surface"
        }`}
      >
        <input
          type="file"
          accept={ACCEPTED_EXT}
          multiple
          onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-4 font-display text-xl font-bold">
          {documents && documents.length === 0 ? "Drop your first invoice here" : "Drop documents to upload"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          PNG, JPG, WEBP up to 2MB · PDF up to 5MB · or <span className="text-primary">browse files</span>
        </p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Multiple files supported — they'll be processed one by one
        </p>
      </div>

      {/* Upload queue */}
      {showQueue && (
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <p className="font-mono text-xs uppercase text-muted-foreground">Upload queue</p>
              <span className="font-mono text-xs text-muted-foreground">
                {doneCount}/{queue.length} done
                {errorCount > 0 && ` · ${errorCount} failed`}
              </span>
            </div>
            {(doneCount + errorCount) > 0 && (
              <button onClick={clearDone} className="text-xs text-muted-foreground hover:text-foreground">
                Clear finished
              </button>
            )}
          </div>
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {queue.map((item) => (
              <QueueItemRow key={item.id} item={item} onRemove={removeFromQueue} />
            ))}
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-border">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${queue.length ? ((doneCount + errorCount) / queue.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Recent documents */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Recent documents</h2>
          {!isLoading && total > 0 && (
            <Link to="/documents" className="text-sm text-primary hover:underline">View all →</Link>
          )}
        </div>

        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : documents && documents.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="data-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Vendor</th>
                  <th className="text-right">Total</th>
                  <th>Uploaded</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d: any) => {
                  const ed = Array.isArray(d.extracted_data) ? d.extracted_data[0] : d.extracted_data;
                  return (
                    <tr
                      key={d.id}
                      onClick={() => d.status !== "processing" && navigate({ to: "/documents/$id", params: { id: d.id } })}
                      className={d.status !== "processing" ? "cursor-pointer" : ""}
                    >
                      <td className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[280px]">{d.file_name}</span>
                      </td>
                      <td>{ed?.vendor_name ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="text-right font-mono">
                        {ed?.total_amount != null
                          ? `${ed.currency ?? ""} ${Number(ed.total_amount).toFixed(2)}`.trim()
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleString()}
                      </td>
                      <td onClick={(e) => d.status === "error" && e.stopPropagation()}>
                        <span className="inline-flex items-center gap-2 font-mono text-xs uppercase">
                          <span className={`status-dot ${d.status}`} />
                          {d.status}
                          {d.status === "error" && (
                            <>
                              <AlertCircle className="h-3 w-3 text-destructive" />
                              <button
                                onClick={() => handleRetry(d.id)}
                                disabled={retrying === d.id}
                                className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium normal-case bg-surface border border-border hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                              >
                                <RotateCcw className={`h-2.5 w-2.5 ${retrying === d.id ? "animate-spin" : ""}`} />
                                {retrying === d.id ? "Retrying…" : "Retry"}
                              </button>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No documents yet. Upload one above to get started.</p>
        )}
      </section>
    </div>
  );
}
