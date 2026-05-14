import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/stores/auth";
import { Button } from "@/components/ui-kit/Button";
import { Field } from "@/components/ui-kit/Field";
import { Logo } from "@/components/ui-kit/Logo";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — MockMate" },
      { name: "description", content: "Sign in to MockMate to continue your interview practice." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, status, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("demo@mockmate.com");
  const [password, setPassword] = useState("demo1234");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && user) navigate({ to: "/dashboard" });
  }, [status, user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email";
    if (password.length < 8) next.password = "Password must be at least 8 characters";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    try {
      await login(email, password);
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      setErrors({ form: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  return <AuthShell title="Welcome back" subtitle="Sign in to continue your prep.">
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
  </AuthShell>;
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[460px] w-[860px] -translate-x-1/2 rounded-full bg-gradient-primary opacity-20 blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link to="/"><Logo /></Link>
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Back to home</Link>
      </header>

      <main className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-12 pt-8 md:grid-cols-2 md:gap-20 md:pt-16">
        <div className="hidden md:block">
          <h2 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight">
            Practice that <span className="text-gradient">feels like the real loop.</span>
          </h2>
          <p className="mt-5 max-w-md text-sm text-muted-foreground">
            Realistic AI interviewers, ATS-grade resume insights, and cinematic analytics — all in one workspace.
          </p>
          <div className="mt-10 flex flex-col gap-3">
            {[
              "Voice + camera mock interviews",
              "Per-question scoring and transcripts",
              "Trends over weeks, not just sessions",
            ].map((t) => (
              <div key={t} className="flex items-center gap-3 text-sm text-foreground/80">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-elevated border border-border">✓</span>
                {t}
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card relative w-full p-7 shadow-elegant md:p-9">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}


