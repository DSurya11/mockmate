import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { api, type Interview } from "@/lib/mock-api";
import { Button } from "@/components/ui-kit/Button";
import { ScoreRing } from "@/components/charts/Charts";
import { StatusDot } from "./dashboard.index";

export const Route = createFileRoute("/dashboard/interviews")({
  component: InterviewsTab,
});

function InterviewsTab() {
  const [items, setItems] = useState<Interview[] | null>(null);
  const [filter, setFilter] = useState<"all" | "completed" | "in_progress" | "scheduled" | "cancelled">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getInterviews();
      setItems(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load interviews");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filtered = (items ?? []).filter((i) => filter === "all" || i.status === filter);

  if (loading && !items) {
    return <SkeletonList />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Interviews
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">All sessions</h1>
        </div>
        <Link to="/interview/new">
          <Button>+ New interview</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "completed", "in_progress", "scheduled", "cancelled"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
              filter === f
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border bg-elevated/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.replace("_", " ")}
          </button>
        ))}
      </div>

      {error && (
        <div className="surface-card border border-warning/30 bg-warning/10 p-4 text-sm text-foreground/90">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium">Could not load interview sessions</div>
              <div className="mt-1 text-xs text-muted-foreground">{error}</div>
            </div>
            <Button size="sm" variant="outline" onClick={loadItems}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr_120px_120px] gap-4 border-b border-border px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground md:grid">
            <div>Role</div>
            <div>Type</div>
            <div>Date</div>
            <div>Status</div>
            <div className="text-right">Score</div>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((i) => (
              <Link
                key={i.id}
                to="/interview/$id"
                params={{ id: i.id }}
                className="grid grid-cols-2 items-center gap-4 px-5 py-4 transition-colors hover:bg-elevated/50 md:grid-cols-[1.5fr_1fr_1fr_120px_120px]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{i.jobRole}</div>
                  <div className="text-xs text-muted-foreground md:hidden">{i.interviewType}</div>
                </div>
                <div className="hidden text-sm text-foreground/80 md:block">{i.interviewType}</div>
                <div className="hidden text-sm text-muted-foreground md:block">
                  {new Date(i.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <StatusDot status={i.status} />{" "}
                  <span className="capitalize">{i.status.replace("_", " ")}</span>
                </div>
                <div className="flex items-center justify-end">
                  {i.score != null ? (
                    <ScoreRing value={i.score} size={38} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="surface-card divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-md bg-elevated" />
            <div className="space-y-2">
              <div className="h-3 w-44 animate-pulse rounded bg-elevated" />
              <div className="h-2 w-28 animate-pulse rounded bg-elevated" />
            </div>
          </div>
          <div className="h-6 w-16 animate-pulse rounded bg-elevated" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="surface-card grid place-items-center px-6 py-20 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
        ＋
      </div>
      <h3 className="mt-4 text-lg font-medium">No interviews yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Run your first mock interview and we'll start tracking your performance over time.
      </p>
      <div className="mt-5">
        <Link to="/interview/new">
          <Button>Start an interview</Button>
        </Link>
      </div>
    </div>
  );
}
