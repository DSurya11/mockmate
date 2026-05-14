'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import styles from './new.module.css';

export default function NewInterviewPage() {
  const router = useRouter();
  const [form, setForm] = useState({ jobRole: '', type: 'MIXED' });
  const [creating, setCreating] = useState(false);

  const roles = [
    { name: 'Software Engineer', icon: '💻' },
    { name: 'Frontend Developer', icon: '🎨' },
    { name: 'Backend Developer', icon: '⚙️' },
    { name: 'Full Stack Developer', icon: '🔗' },
    { name: 'Data Scientist', icon: '📊' },
    { name: 'DevOps Engineer', icon: '🚀' },
    { name: 'Product Manager', icon: '📋' },
    { name: 'AI/ML Engineer', icon: '🧠' },
  ];

  const types = [
    { value: 'MIXED', label: 'Mixed', desc: 'Technical + Behavioral', icon: '🎯' },
    { value: 'TECHNICAL', label: 'Technical', desc: 'Coding & Architecture', icon: '💻' },
    { value: 'HR', label: 'Behavioral', desc: 'Soft skills & Culture', icon: '🤝' },
    { value: 'DSA', label: 'DSA', desc: 'Data Structures & Algorithms', icon: '🧩' },
    { value: 'SYSTEM_DESIGN', label: 'System Design', desc: 'Architecture & Scalability', icon: '🏗️' },
  ];

  const handleStart = async () => {
    if (!form.jobRole.trim()) return;
    setCreating(true);
    try {
      const interview = await api.post('/interviews', form);
      router.push(`/interview/${interview.id}`);
    } catch {
      alert('Failed to create interview');
      setCreating(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.backBtn}>
        <button className="btn btn-ghost" onClick={() => router.push('/dashboard')}>← Back to Dashboard</button>
      </div>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1>New Mock Interview</h1>
          <p>Choose your target role and interview type to begin</p>
        </div>

        {/* Role Selection */}
        <div className={styles.section}>
          <h2 className={styles.sectionLabel}>Select Target Role</h2>
          <div className={styles.roleGrid}>
            {roles.map((r) => (
              <button
                key={r.name}
                className={`${styles.roleCard} ${form.jobRole === r.name ? styles.roleActive : ''}`}
                onClick={() => setForm({ ...form, jobRole: r.name })}
              >
                <span className={styles.roleIcon}>{r.icon}</span>
                <span>{r.name}</span>
              </button>
            ))}
          </div>
          <div className="form-group mt-16">
            <input
              type="text"
              className="form-input"
              placeholder="Or type a custom role..."
              value={form.jobRole}
              onChange={(e) => setForm({ ...form, jobRole: e.target.value })}
            />
          </div>
        </div>

        {/* Type Selection */}
        <div className={styles.section}>
          <h2 className={styles.sectionLabel}>Interview Type</h2>
          <div className={styles.typeGrid}>
            {types.map((t) => (
              <button
                key={t.value}
                className={`${styles.typeCard} ${form.type === t.value ? styles.typeActive : ''}`}
                onClick={() => setForm({ ...form, type: t.value })}
              >
                <span className={styles.typeIcon}>{t.icon}</span>
                <h3>{t.label}</h3>
                <p>{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <button
          className={`btn btn-primary btn-lg w-full ${styles.startBtn}`}
          onClick={handleStart}
          disabled={!form.jobRole.trim() || creating}
        >
          {creating ? 'Setting up your interview...' : '🎙️ Start Interview Session'}
        </button>
      </div>
    </div>
  );
}
