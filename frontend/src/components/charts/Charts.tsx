import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  RadialBarChart, RadialBar, PolarAngleAxis, BarChart, Bar,
} from "recharts";

export function MiniSparkline({ data }: { data: { label: string; score: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.72 0.18 255)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="oklch(0.72 0.18 255)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "oklch(0.66 0.022 260)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "oklch(0.66 0.022 260)", fontSize: 11 }} axisLine={false} tickLine={false} domain={[40, 100]} />
        <Tooltip
          cursor={{ stroke: "oklch(1 0 0 / 0.1)" }}
          contentStyle={{ background: "oklch(0.205 0.018 265)", border: "1px solid oklch(1 0 0 / 0.08)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "oklch(0.66 0.022 260)" }}
          itemStyle={{ color: "oklch(0.975 0.005 260)" }}
        />
        <Area type="monotone" dataKey="score" stroke="oklch(0.72 0.18 255)" strokeWidth={2} fill="url(#grad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ScoreRing({ value, size = 56 }: { value: number; size?: number }) {
  return (
    <div style={{ width: size, height: size }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value }]} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: "oklch(1 0 0 / 0.08)" }} dataKey="value" cornerRadius={8} fill="oklch(0.72 0.18 255)" />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

export function CompetencyBars({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="bgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.2 290)" />
            <stop offset="100%" stopColor="oklch(0.72 0.18 255)" />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "oklch(0.66 0.022 260)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "oklch(0.66 0.022 260)", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
        <Tooltip
          cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
          contentStyle={{ background: "oklch(0.205 0.018 265)", border: "1px solid oklch(1 0 0 / 0.08)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "oklch(0.66 0.022 260)" }}
          itemStyle={{ color: "oklch(0.975 0.005 260)" }}
        />
        <Bar dataKey="value" fill="url(#bgrad)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
