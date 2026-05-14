import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Resume } from "@/lib/mock-api";
import { Button } from "@/components/ui-kit/Button";

export const Route = createFileRoute("/dashboard/resumes")({
  component: ResumesTab,
});

function ResumesTab() {
  const [resumes, setResumes] = useState<Resume[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const next = await api.getResumes();
      setResumes(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load resumes");
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll every 3s while any resume is pending/analyzing
  useEffect(() => {
    if (!resumes) return;
    const pending = resumes.some((r) => r.status !== "ready");
    if (!pending) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [resumes, refresh]);

  async function handleFiles(files: FileList | null) {
    if (!files || !files[0]) return;
    const file = files[0];
    setUploading({ name: file.name, progress: 0 });
    // simulate progress
    for (let p = 10; p <= 60; p += 20) {
      await new Promise((r) => setTimeout(r, 100));
      setUploading({ name: file.name, progress: p });
    }
    try {
      const r = await api.uploadResume(file);
      setUploading({ name: file.name, progress: 100 });
      setTimeout(() => setUploading(null), 300);
      await refresh();
      api
        .analyzeResume(r.id)
        .then(refresh)
        .catch((err: unknown) =>
          setError(err instanceof Error ? err.message : "Resume analysis failed"),
        );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Resume manager
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Optimize your resume for ATS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop a PDF — we'll score it and surface what to fix.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`group surface-card relative flex cursor-pointer flex-col items-center justify-center gap-3 px-6 py-14 text-center transition-all ${
          dragOver ? "border-primary/60 bg-primary/5 shadow-glow" : "hover:border-border-strong"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
          ↑
        </div>
        <div>
          <div className="text-base font-medium">Drop your resume here</div>
          <div className="mt-1 text-xs text-muted-foreground">PDF only — up to 10MB</div>
        </div>
        <Button size="sm" variant="secondary" type="button">
          Browse files
        </Button>

        {uploading && (
          <div className="absolute inset-x-6 bottom-5 rounded-lg border border-border bg-popover/90 p-3 backdrop-blur">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate">Uploading {uploading.name}</span>
              <span className="font-mono text-muted-foreground">{uploading.progress}%</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full bg-gradient-primary transition-all"
                style={{ width: `${uploading.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {error && (
          <div className="surface-card col-span-full border border-warning/30 bg-warning/10 p-4 text-sm text-foreground/90">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">Resume updates are delayed</div>
                <div className="mt-1 text-xs text-muted-foreground">{error}</div>
              </div>
              <Button size="sm" variant="outline" onClick={refresh}>
                Retry
              </Button>
            </div>
          </div>
        )}

        {!resumes ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="surface-card h-44 animate-pulse" />
          ))
        ) : resumes.length === 0 ? (
          <div className="surface-card col-span-full grid place-items-center p-12 text-center text-sm text-muted-foreground">
            No resumes yet. Drop a file above to get started.
          </div>
        ) : (
          resumes.map((r) => <ResumeCard key={r.id} r={r} onChange={refresh} />)
        )}
      </div>
    </div>
  );
}

function ResumeCard({ r, onChange }: { r: Resume; onChange: () => void }) {
  async function del() {
    await api.deleteResume(r.id);
    onChange();
  }
  async function reanalyze() {
    await api.analyzeResume(r.id);
    onChange();
  }
  const sizeKb = Math.round(r.size / 1024);

  return (
    <div className="surface-card relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-elevated border border-border text-xs font-mono text-muted-foreground">
            PDF
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{r.filename}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {sizeKb} KB · uploaded {new Date(r.uploadedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        <ATSBadge status={r.status} score={r.atsScore} />
      </div>

      {r.status === "ready" && r.insights && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              Strengths
            </div>
            <ul className="space-y-1.5">
              {r.insights.strengths.map((s) => (
                <li key={s} className="flex items-start gap-2 text-xs text-foreground/85">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              Improve
            </div>
            <ul className="space-y-1.5">
              {r.insights.gaps.map((s) => (
                <li key={s} className="flex items-start gap-2 text-xs text-foreground/85">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {r.status !== "ready" && (
        <div className="mt-5 flex items-center gap-3 rounded-md border border-border bg-elevated/40 px-3 py-2.5 text-xs">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {r.status === "pending"
            ? "Queued for analysis…"
            : "Analyzing resume — this takes a few seconds."}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        {r.status === "ready" && (
          <Button size="sm" variant="ghost" onClick={reanalyze}>
            Re-analyze
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={del}>
          Delete
        </Button>
      </div>
    </div>
  );
}

function ATSBadge({ status, score }: { status: Resume["status"]; score: number | null }) {
  if (status !== "ready" || score == null)
    return (
      <span className="rounded-full border border-border bg-elevated/60 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        Pending
      </span>
    );
  const tone =
    score >= 85
      ? "text-success border-success/30 bg-success/10"
      : score >= 70
        ? "text-accent border-accent/30 bg-accent/10"
        : "text-warning border-warning/30 bg-warning/10";
  return (
    <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${tone}`}>
      <span className="font-semibold tabular-nums">{score}</span>
      <span className="text-[10px] uppercase tracking-wider opacity-80">ATS</span>
    </div>
  );
}
