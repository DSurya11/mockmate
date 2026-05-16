import { Link } from 'react-router-dom'
import { Button } from '@/components/ui-kit/Button'
import { Logo } from '@/components/ui-kit/Logo'

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[1100px] -translate-x-1/2 rounded-full bg-gradient-primary opacity-[0.18] blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#metrics" className="hover:text-foreground transition-colors">Metrics</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link to="/register"><Button size="sm">Get started</Button></Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-28 text-center md:pt-24">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-elevated/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_currentColor]" />
          Now with realtime speech transcription
        </div>
        <h1 className="mx-auto max-w-4xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
          Interview prep that <span className="text-gradient">feels like the real thing</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
          Cinematic mock interviews, instant AI feedback, ATS-grade resume scoring, and analytics that
          show exactly where you'll win the next loop.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register"><Button size="lg">Start free practice →</Button></Link>
          <Link to="/login"><Button size="lg" variant="outline">Sign in</Button></Link>
        </div>

        <div className="mt-20 mx-auto max-w-6xl">
          <div className="surface-card relative overflow-hidden p-2 shadow-elegant">
            <div className="rounded-xl bg-background/80 p-6 md:p-10">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { k: "Interview types supported", v: "6", s: "Technical, Behavioral, DSA, System Design, HR, Mixed" },
                  { k: "AI interviewer personas", v: "3", s: "Alex · Marcus · Sarah" },
                  { k: "Avg questions per session", v: "8–12", s: "with adaptive follow-ups" },
                ].map((m) => (
                  <div key={m.k} className="rounded-xl border border-border bg-elevated/40 p-5 text-left">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.k}</div>
                    <div className="mt-2 text-3xl font-semibold tracking-tight">{m.v}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{m.s}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 pb-28">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { t: "Realtime mock interviews", d: "Camera, mic, transcription, and AI scoring — indistinguishable from a live loop." },
            { t: "Resume ATS scoring", d: "Drop a PDF and see exactly which keywords, sections, and metrics will pass real ATS systems." },
            { t: "Analytics that matter", d: "Track strengths, weak areas, and per-question performance over time." },
          ].map((f) => (
            <div key={f.t} className="surface-card p-6">
              <div className="mb-4 inline-grid h-9 w-9 place-items-center rounded-md bg-gradient-primary text-primary-foreground shadow-glow">●</div>
              <h3 className="text-base font-medium tracking-tight">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground md:flex-row">
          <Logo size={18} />
          <div>© {new Date().getFullYear()} MockMate. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}
