'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/store/authStore';
import styles from './auth.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(form.email, form.password);
      const role = data.user.role;
      if (role === 'ADMIN') router.push('/dashboard/admin');
      else if (role === 'RECRUITER') router.push('/dashboard/recruiter');
      else router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authOrb1}></div>
      <div className={styles.authOrb2}></div>

      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <div className={styles.authLogo} onClick={() => router.push('/')}>
            <span className={styles.logoIcon}>⬡</span>
            <span>InterviewAI</span>
          </div>
          <h1>Welcome back</h1>
          <p>Sign in to continue to your dashboard</p>
        </div>

        {error && <div className={styles.authError}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.authForm}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button type="submit" className={`btn btn-primary w-full ${styles.authBtn}`} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className={styles.authSwitch}>
          Don&apos;t have an account?{' '}
          <a href="/register">Create one</a>
        </p>
      </div>
    </div>
  );
}
