import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '@/stores/auth'
import { Button } from '@/components/ui-kit/Button'
import { Field } from '@/components/ui-kit/Field'
import { Logo } from '@/components/ui-kit/Logo'
import { ThemeToggle } from '@/components/ui-kit/ThemeToggle'

export default function LoginPage() {
  const { login, status, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('demo@mockmate.com')
  const [password, setPassword] = useState('demo1234')
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (status === 'authenticated' && user) navigate('/dashboard')
  }, [status, user, navigate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email'
    if (password.length < 8) next.password = 'Password must be at least 8 characters'
    setErrors(next)
    if (Object.keys(next).length) return
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (e: any) {
      setErrors({ form: e.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={new URLSearchParams(window.location.search).has('expired')
        ? 'Your session ended. Sign in again (or create an account if yours is new).'
        : 'Sign in to continue your prep.'}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" error={errors.email} autoComplete="email" />
        <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" error={errors.password} autoComplete="current-password" />
        {errors.form && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{errors.form}</div>
        )}
        <Button type="submit" loading={submitting} className="mt-1">Sign in</Button>
        <div className="mt-1 text-center text-xs text-muted-foreground">
          New here? <Link to="/register" className="text-foreground hover:text-primary transition-colors">Create an account</Link>
        </div>
        <div className="mt-2 rounded-md border border-border bg-elevated/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Demo account pre-filled · <span className="text-foreground/80">demo@mockmate.com</span> / <span className="text-foreground/80">demo1234</span>
        </div>
      </form>
    </AuthShell>
  )
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/"><Logo /></Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Back to home</Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 px-6 pb-16 pt-6 md:grid-cols-[1fr_26rem] md:gap-20 md:pt-14">
        <div className="hidden md:block">
          <h2 className="max-w-md text-balance text-[2.6rem] font-medium leading-[1.06]">
            Twenty minutes, one interviewer, <span className="marker">honest feedback.</span>
          </h2>
          <dl className="mt-10 max-w-md divide-y divide-border border-y border-border text-sm">
            {[
              ['Voice', 'You speak, she listens, follows up, or repeats.'],
              ['Scoring', 'Each score quotes your own words.'],
              ['History', 'Every interview and transcript, kept.'],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[6rem_1fr] gap-4 py-3.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-foreground/85">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="w-full rounded-md border border-border bg-card p-7 shadow-sheet md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-medium">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
