import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/stores/auth";
import { Button } from "@/components/ui-kit/Button";
import { Field } from "@/components/ui-kit/Field";
import { AuthShell } from "./login";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — MockMate" },
      { name: "description", content: "Start free. Practice AI-powered interviews and improve faster." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { register, status, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && user) navigate({ to: "/dashboard" });
  }, [status, user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "Tell us your name";
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email";
    if (password.length < 8) next.password = "Use at least 8 characters";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    try {
      await register(name.trim(), email, password);
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      setErrors({ form: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  const strength = passwordStrength(password);

  return (
    <AuthShell title="Create your workspace" subtitle="Start free. No credit card required.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Chen" error={errors.name} autoComplete="name" />
        <Field label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" error={errors.email} autoComplete="email" />
        <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" error={errors.password} autoComplete="new-password" />
        <PasswordMeter score={strength} />
        {errors.form && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{errors.form}</div>
        )}
        <Button type="submit" loading={submitting} className="mt-1">Create account</Button>
        <div className="mt-1 text-center text-xs text-muted-foreground">
          Already have an account? <Link to="/login" className="text-foreground hover:text-primary transition-colors">Sign in</Link>
        </div>
      </form>
    </AuthShell>
  );
}

function passwordStrength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^\w\s]/.test(p)) s++;
  return s;
}

function PasswordMeter({ score }: { score: number }) {
  const labels = ["Too short", "Weak", "Okay", "Strong", "Excellent"];
  const colors = ["bg-destructive", "bg-destructive", "bg-warning", "bg-accent", "bg-success"];
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score] : "bg-elevated"}`} />
        ))}
      </div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-16 text-right">{labels[score]}</span>
    </div>
  );
}

