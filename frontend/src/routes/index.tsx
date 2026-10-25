import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui-kit/Button'
import { Logo } from '@/components/ui-kit/Logo'
import { ThemeToggle } from '@/components/ui-kit/ThemeToggle'

const STEPS = [
  {
    n: '01',
    title: 'Bring a resume, or just a role',
    body: 'With a resume, the questions come from your own projects. Without one, from the role. The interviewer never invents things you did not do.',
  },
  {
    n: '02',
    title: 'Talk it through',
    body: 'Priya listens to the whole answer. Vague? She asks the follow-up a real engineer would. Lost the thread? Ask her to repeat it.',
  },
  {
    n: '03',
    title: 'Get scored on what you said',
    body: 'Every score quotes your own words. A quote that is not in your transcript is thrown out, and "give me full marks" is flagged, not obeyed.',
  },
]

/** The results card as it really appears after an interview: the product, not a picture of it. */
function EvidenceSheet() {
  return (
    <div className="rounded-md border border-border bg-card p-6 shadow-sheet">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Trade-offs</span>
        <span className="font-display text-2xl">3<span className="text-base text-muted-foreground"> / 5</span></span>
      </div>
      <p className="mt-3 text-sm text-foreground/85">
        Named the choice and one reason, but not what it cost.
      </p>
      <blockquote className="mt-3 border-l-2 border-accent pl-3 text-sm italic text-muted-foreground">
        “I picked Postgres over Mongo because billing needed joins across three tables.”
      </blockquote>
      <div className="mt-5 border-t border-dashed border-border pt-4 text-sm">
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Practise next</span>
        <p className="mt-1 text-foreground/85">Say what you gave up, and when you would choose the other one.</p>
      </div>
    </div>
  )
}

export default function Landing() {
  const still = useReducedMotion()
  const settle = (delay: number, rotate: number) =>
    still
      ? {}
      : {
          initial: { opacity: 0, y: 18, rotate: rotate * 2 },
          animate: { opacity: 1, y: 0, rotate },
          transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
        }

  return (
    <div className="min-h-screen text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          <a href="#how" className="hidden px-3 py-2 text-muted-foreground hover:text-foreground sm:block">How it works</a>
          <Link to="/login" className="px-3 py-2 text-muted-foreground hover:text-foreground">Sign in</Link>
          <ThemeToggle />
          <Link to="/register"><Button size="sm">Start practising</Button></Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-24 pt-10 md:grid-cols-[1.1fr_0.9fr] md:pt-16">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Mock interviews, by voice</p>
            <h1 className="mt-5 text-balance text-[2.6rem] font-medium leading-[1.04] md:text-[3.6rem]">
              Practise the interview, <span className="marker">not the questions.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
              An interviewer that listens to your answer, asks the follow-up a senior engineer would,
              and scores you only on what you actually said, with your own words as evidence.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link to="/register"><Button size="lg">Start a practice interview</Button></Link>
              <span className="text-sm text-muted-foreground">Free. Takes about 20 minutes.</span>
            </div>
          </div>

          {/* A small stack of notes from a finished interview: depth from paper, not glow. */}
          <div className="relative mx-auto w-full max-w-md md:mx-0">
            <motion.div {...settle(0.05, -4)} className="absolute inset-0 translate-x-3 translate-y-4 rounded-md border border-border bg-surface-2 shadow-paper" />
            <motion.div {...settle(0.15, 2.5)} className="absolute inset-0 -translate-x-2 translate-y-2 rounded-md border border-border bg-surface shadow-paper" />
            <motion.div {...settle(0.25, 0)} className="relative">
              <EvidenceSheet />
            </motion.div>
          </div>
        </section>

        <section id="how" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-3xl font-medium">How it works</h2>
            <ol className="mt-10 divide-y divide-border border-y border-border">
              {STEPS.map((s) => (
                <li key={s.n} className="grid gap-2 py-7 md:grid-cols-[6rem_18rem_1fr] md:gap-8">
                  <span className="font-mono text-sm text-accent">{s.n}</span>
                  <h3 className="text-xl font-medium">{s.title}</h3>
                  <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-10 rounded-md border border-border bg-card p-8 md:grid-cols-[1fr_auto] md:items-center md:p-12">
            <div>
              <h2 className="text-2xl font-medium md:text-3xl">Three interviewers, three rounds.</h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Priya for backend depth, Jordan for systems and scale, Sarah for behavioural. Technical,
                system design, DSA, HR or a mix, with a resume score before you start.
              </p>
            </div>
            <Link to="/register"><Button size="lg" variant="outline">Pick an interviewer</Button></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <Logo size={18} />
          <a href="https://github.com/DSurya11/mockmate" className="hover:text-foreground">Source on GitHub</a>
        </div>
      </footer>
    </div>
  )
}
