import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/mock-api";
import { Button } from "@/components/ui-kit/Button";
import { Field } from "@/components/ui-kit/Field";

export const Route = createFileRoute("/dashboard/practice")({
  component: PracticeTab,
});

const ROLES = [
  "Senior Frontend Engineer", "Staff Software Engineer", "Backend Engineer",
  "Full-Stack Engineer", "Engineering Manager", "Product Designer", "Product Manager",
  "DevOps Engineer", "Data Scientist", "Machine Learning Engineer",
  "iOS Developer", "Android Developer", "QA Engineer", "Site Reliability Engineer"
];
const TYPES = [
  { id: "Technical", desc: "Coding patterns, architecture, debugging" },
  { id: "Behavioral", desc: "Leadership, conflict, ownership stories" },
  { id: "System Design", desc: "Distributed systems, scaling, trade-offs" },
  { id: "HR", desc: "Culture fit, expectations, career goals" },
  { id: "DSA", desc: "Data structures, algorithms, complexity" },
  { id: "MIXED", desc: "Blend of technical, behavioral, and design" },
];

function PracticeTab() {
  const navigate = useNavigate();
  const [role, setRole] = useState(ROLES[0]);
  const [customRole, setCustomRole] = useState("");
  const [type, setType] = useState<string>(TYPES[0].id);
  const [submitting, setSubmitting] = useState(false);
  const [saveVideo, setSaveVideo] = useState(false);

  async function start() {
    let dirHandle = null;
    if (saveVideo) {
      try {
        dirHandle = await (window as any).showDirectoryPicker({
          mode: "readwrite"
        });
      } catch (e) {
        return; // user cancelled
      }
    }
    setSubmitting(true);
    try {
      const finalRole = customRole.trim() || role;
      const { id } = await api.createInterview({ jobRole: finalRole, interviewType: type });
      if (dirHandle) {
        (window as any).__videoDirHandle = dirHandle;
      }
      navigate({ to: "/interview/$id", params: { id } });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Practice</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Design your interview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick a role and format. We'll generate a tailored set of questions.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="surface-card space-y-6 p-6 lg:col-span-2">
          <section>
            <h3 className="text-sm font-medium tracking-tight">1 · Choose a role</h3>
            <p className="mt-1 text-xs text-muted-foreground">Pick from common roles or type your own.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => { setRole(r); setCustomRole(""); }}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                    role === r && !customRole
                      ? "border-primary/60 bg-primary/15 text-foreground shadow-[0_0_0_3px_oklch(0.72_0.18_255_/_0.12)]"
                      : "border-border bg-elevated/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Field label="Or type a custom role" placeholder="e.g. Founding ML Engineer" value={customRole} onChange={(e) => setCustomRole(e.target.value)} />
            </div>
          </section>

          <div className="h-px bg-border" />

          <section>
            <h3 className="text-sm font-medium tracking-tight">2 · Pick a format</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {TYPES.map((t) => {
                const active = type === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className={`group relative overflow-hidden rounded-xl border p-4 text-left transition-all ${
                      active
                        ? "border-primary/60 bg-primary/10 shadow-[0_0_0_3px_oklch(0.72_0.18_255_/_0.12)]"
                        : "border-border bg-elevated/40 hover:border-border-strong"
                    }`}
                  >
                    {active && <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-gradient-primary text-[10px] text-primary-foreground">✓</span>}
                    <div className="text-sm font-medium">{t.id}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="h-px bg-border" />

          <section className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">5 questions · ~ 20 min · webcam + microphone</div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={saveVideo} onChange={e => setSaveVideo(e.target.checked)} className="rounded border-border/50 bg-elevated/40" />
                <span>Save video locally (asks for path)</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/dashboard"><Button variant="ghost" size="md">Cancel</Button></Link>
              <Button onClick={start} loading={submitting} size="lg">Start interview →</Button>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="surface-card p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Selected</div>
            <div className="mt-3 space-y-2 text-sm">
              <Row k="Role" v={customRole.trim() || role} />
              <Row k="Format" v={type} />
              <Row k="Length" v="≈ 20 min" />
            </div>
          </div>
          <div className="surface-card p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">What to expect</div>
            <ul className="mt-3 space-y-2.5 text-xs text-foreground/85">
              <li className="flex gap-2"><span className="text-primary">·</span>Questions delivered one at a time, with time to think</li>
              <li className="flex gap-2"><span className="text-primary">·</span>Live transcription as you speak</li>
              <li className="flex gap-2"><span className="text-primary">·</span>Per-question scoring with strengths and gaps</li>
              <li className="flex gap-2"><span className="text-primary">·</span>Replay your answers any time</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
