import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/mock-api'
import { CompetencyBars, MiniSparkline, ScoreRing } from '@/components/charts/Charts'
import { Button } from '@/components/ui-kit/Button'

type AnalyticsStats = {
  averageScore: number
  completedInterviews: number
  trend: { label: string; score: number }[]
  scoreBreakdown: { label: string; value: number }[]
  strengths: string[]
  weakAreas: string[]
}

export default function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.candidateAnalytics()
      setData(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading && !data) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="surface-card border border-warning/30 bg-warning/10 p-4 text-sm text-foreground/90">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium">Analytics are temporarily unavailable</div>
              <div className="mt-1 text-xs text-muted-foreground">{error}</div>
            </div>
            <Button size="sm" variant="outline" onClick={loadData}>
              Retry
            </Button>
          </div>
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Analytics</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Deep insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Patterns across your sessions and what to work on next.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface-card flex items-center gap-5 p-6">
          <ScoreRing value={data?.averageScore ?? 0} size={92} />
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Average score
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">
              {data?.averageScore ?? '—'}
              <span className="text-sm text-muted-foreground"> / 100</span>
            </div>
            <div className="mt-1 text-xs text-success">+6 from last 30d</div>
          </div>
        </div>
        <div className="surface-card p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Sessions</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            {data?.completedInterviews ?? '—'}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">completed</div>
        </div>
        <div className="surface-card p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Confidence</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">High</div>
          <div className="mt-1 text-xs text-muted-foreground">based on tone & pace analysis</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-6 lg:col-span-2">
          <h3 className="text-base font-medium tracking-tight">Score over time</h3>
          <div className="mt-5 h-64">{data && <MiniSparkline data={data.trend} />}</div>
        </div>
        <div className="surface-card p-6">
          <h3 className="text-base font-medium tracking-tight">By competency</h3>
          <div className="mt-5 h-64">{data && <CompetencyBars data={data.scoreBreakdown} />}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Strengths" tone="success" items={data?.strengths ?? []} />
        <Panel title="Weak areas" tone="warning" items={data?.weakAreas ?? []} />
      </div>
    </div>
  )
}

function Panel({
  title,
  tone,
  items,
}: {
  title: string
  tone: 'success' | 'warning'
  items: string[]
}) {
  const dot = tone === 'success' ? 'bg-success' : 'bg-warning'
  return (
    <div className="surface-card p-6">
      <h3 className="text-base font-medium tracking-tight">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {items.map((i) => (
          <li
            key={i}
            className="flex items-start gap-3 rounded-lg border border-border bg-elevated/40 p-3 text-sm text-foreground/90"
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
            {i}
          </li>
        ))}
      </ul>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading analytics…
      </div>
    </div>
  )
}
