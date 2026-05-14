import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { api, type Interview } from "@/lib/mock-api";
import { Button } from "@/components/ui-kit/Button";
import { useAuth } from "@/stores/auth";
import { ScoreRing, MiniSparkline } from "@/components/charts/Charts";

type DashboardStats = {
  totalInterviews: number;
  completedInterviews: number;
  averageScore: number;
  scoreBreakdown: { label: string; value: number }[];
  trend: { label: string; score: number }[];
  weakAreas: string[];
};

export const Route = createFileRoute("/dashboard/")({
  component: OverviewTab,
});

function OverviewTab() {
  const user = useAuth((s) => s.user);
  const [data, setData] = useState<DashboardStats | null>(null);
  const [interviews, setInterviews] = useState<Interview[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [analyticsResult, interviewsResult] = await Promise.allSettled([
      api.candidateAnalytics(),
      api.getInterviews(),
    ]);

    if (analyticsResult.status === "fulfilled") setData(analyticsResult.value);
    if (interviewsResult.status === "fulfilled") setInterviews(interviewsResult.value);

    const failures = [analyticsResult, interviewsResult]
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason?.message || "Unknown dashboard error");

    if (failures.length > 0) {
      setError(failures.join(" · "));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !data && !interviews) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="surface-card border border-warning/30 bg-warning/10 p-4 text-sm text-foreground/90">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium">Some dashboard data failed to load</div>
              <div className="mt-1 text-xs text-muted-foreground">{error}</div>
            </div>
            <Button size="sm" variant="outline" onClick={loadData}>
              Retry
            </Button>
          </div>
        </div>
      )}

      <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Overview</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Welcome back, {user?.name.split(" ")[0]} <span className="text-gradient">·</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Here's how your interview prep is trending this week.
          </p>
        </div>
        <Link to="/interview/new">
          <Button>Start a new interview →</Button>
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Total interviews"
          value={data?.totalInterviews ?? "—"}
          delta={data?.totalInterviews > 0 ? "+1 this week" : "New account"}
        />
        <StatCard
          label="Completed"
          value={data?.completedInterviews ?? "—"}
          delta={data?.completedInterviews ? "Great progress" : "No interviews yet"}
          tone="accent"
        />
        <StatCard
          label="Average score"
          value={data?.averageScore ? `${data.averageScore}` : "—"}
          suffix="/100"
          delta={data?.averageScore ? "Keep it up!" : ""}
          tone="primary"
        />
        <StatCard
          label="Streak"
          value={data?.totalInterviews > 0 ? 1 : 0}
          suffix=" days"
          delta={`Best: ${data?.totalInterviews > 0 ? 1 : 0}`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Performance trend
              </div>
              <h3 className="mt-1 text-lg font-medium tracking-tight">
                Score over the last 8 weeks
              </h3>
            </div>
            <div className="hidden items-center gap-3 text-xs text-muted-foreground md:flex">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> Score
              </span>
            </div>
          </div>
          <div className="mt-6 h-56">{data && <MiniSparkline data={data.trend} />}</div>
        </div>
        <div className="surface-card p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Score breakdown
          </div>
          <h3 className="mt-1 text-lg font-medium tracking-tight">Avg by competency</h3>
          <div className="mt-5 space-y-3.5">
            {data?.scoreBreakdown.map((s) => (
              <div key={s.label}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-foreground/80">{s.label}</span>
                  <span className="font-mono text-muted-foreground">{s.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full bg-gradient-primary transition-all"
                    style={{ width: `${s.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-medium tracking-tight">Recent interviews</h3>
            <Link
              to="/dashboard/interviews"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View all →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {(interviews ?? []).slice(0, 5).map((i) => (
              <Link
                key={i.id}
                to="/interview/$id"
                params={{ id: i.id }}
                className="-mx-2 flex items-center justify-between gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-elevated/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusDot status={i.status} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{i.jobRole}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.interviewType} · {new Date(i.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {i.score != null && <ScoreRing value={i.score} size={36} />}
                  <span className="text-xs text-muted-foreground capitalize">
                    {i.status.replace("_", " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="surface-card p-6">
          <h3 className="text-lg font-medium tracking-tight">What to focus on</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Personalized coaching from your last sessions.
          </p>
          <div className="mt-5 space-y-3">
            {(data?.weakAreas ?? []).map((w: string) => (
              <div
                key={w}
                className="flex items-start gap-3 rounded-lg border border-border bg-elevated/40 p-3"
              >
                <span className="mt-0.5 grid h-6 w-6 place-items-center rounded-md bg-warning/15 text-warning text-xs">
                  !
                </span>
                <div className="text-sm text-foreground/90">{w}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  delta,
  tone,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  delta?: string;
  tone?: "primary" | "accent";
}) {
  return (
    <div className="surface-card relative overflow-hidden p-5">
      {tone && (
        <div
          className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-25 ${tone === "primary" ? "bg-primary" : "bg-accent"}`}
        />
      )}
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {delta && <div className="mt-2 text-xs text-muted-foreground">{delta}</div>}
    </div>
  );
}

export function StatusDot({ status }: { status: Interview["status"] }) {
  const map: Record<string, string> = {
    completed: "bg-success",
    in_progress: "bg-warning recording-pulse",
    scheduled: "bg-muted-foreground",
    cancelled: "bg-destructive/50",
  };
  return <span className={`h-2 w-2 rounded-full ${map[status]}`} />;
}

function LoadingState() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading dashboard…
      </div>
    </div>
  );
}
