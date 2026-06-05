import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { extractDocument } from "@/lib/documents.functions";
import { toast } from "sonner";
import { Upload, FileText, AlertCircle } from "lucide-react";

const PLAN_LIMITS = { free: 30, pro: 500, team: 2000 } as const;
const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const extractFn = useServerFn(extractDocument);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: documents, refetch } = useQuery({
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

  const handleFile = useCallback(async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, or WEBP image. PDF support coming soon.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10MB)");
      return;
    }
    setUploading(true);
    const tId = toast.loading(`Uploading ${file.name}...`);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("documents").upload(path, file, {
        contentType: file.type,
      });
      if (up.error) throw up.error;

      const { data: doc, error: insErr } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: path,
          mime_type: file.type,
          status: "processing",
        })
        .select()
        .single();
      if (insErr) throw insErr;

      toast.success("Extracting data...", { id: tId });
      refetch();

      // Kick off extraction (don't block UI)
      extractFn({ data: { documentId: doc.id } })
        .then(() => {
          toast.success(`${file.name} ready for review`);
          queryClient.invalidateQueries({ queryKey: ["documents", user.id] });
          queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
        })
        .catch((e) => {
          toast.error(e instanceof Error ? e.message : "Extraction failed");
          queryClient.invalidateQueries({ queryKey: ["documents", user.id] });
        });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed", { id: tId });
    } finally {
      setUploading(false);
    }
  }, [user.id, extractFn, queryClient, refetch]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(handleFile);
  };

  const plan = (profile?.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const limit = PLAN_LIMITS[plan];
  const used = profile?.documents_used_this_month ?? 0;
  const pct = Math.min(100, (used / limit) * 100);

  return (
    <div className="space-y-8">
      {/* Header + usage */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload invoices and receipts. Get structured data back instantly.
          </p>
        </div>
        <div className="min-w-[240px] rounded-md border border-border bg-surface p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono uppercase text-muted-foreground">Usage this month</span>
            <span className="font-mono">{used} / {limit}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className={`h-full ${pct > 80 ? "bg-warning" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct > 80 && (
            <p className="mt-2 text-xs text-warning">Approaching limit — consider upgrading.</p>
          )}
        </div>
      </div>

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
          id="file-input"
          accept={ACCEPTED.join(",")}
          multiple
          onChange={(e) => Array.from(e.target.files ?? []).forEach(handleFile)}
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={uploading}
        />
        <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-4 font-display text-xl font-bold">
          {documents && documents.length === 0 ? "Drop your first invoice here" : "Drop documents to upload"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          PNG, JPG, WEBP up to 10MB · or <span className="text-primary">browse files</span>
        </p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          PDF support coming soon
        </p>
      </div>

      {/* Recent documents */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Recent documents</h2>
        {documents && documents.length > 0 ? (
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
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No documents yet. Upload one above to get started.</p>
        )}
      </section>
    </div>
  );
}
