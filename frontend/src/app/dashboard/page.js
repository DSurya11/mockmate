'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/store/authStore';
import api from '@/lib/api';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, initialize, logout } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/analytics/candidate').then(setStats).catch(console.error);
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="loading-page">
        <div className="spinner"></div>
        <p className="text-muted">Loading dashboard...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  const navItems = [
    { key: 'overview', icon: '📊', label: 'Overview' },
    { key: 'interviews', icon: '🎯', label: 'Interviews' },
    { key: 'resume', icon: '📄', label: 'Resume' },
    { key: 'practice', icon: '🎙️', label: 'Practice' },
    { key: 'analytics', icon: '📈', label: 'Analytics' },
    { key: 'settings', icon: '⚙️', label: 'Settings' },
  ];

  return (
    <div className="page-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>InterviewAI</h1>
          <span>AI Interview Platform</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, width: '100%' }}>
            <div className="avatar">{user.name?.charAt(0).toUpperCase()}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={user.name}>{user.name}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{user.role}</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout} style={{ width: '100%', justifyContent: 'center' }}>Logout</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === 'overview' && <OverviewTab stats={stats} user={user} router={router} />}
        {activeTab === 'interviews' && <InterviewsTab router={router} />}
        {activeTab === 'resume' && <ResumeTab />}
        {activeTab === 'practice' && <PracticeTab router={router} />}
        {activeTab === 'analytics' && <AnalyticsTab stats={stats} />}
        {activeTab === 'settings' && <SettingsTab user={user} />}
      </main>
    </div>
  );
}

/* ===== OVERVIEW TAB ===== */
function OverviewTab({ stats, user, router }) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Here&apos;s your interview preparation overview</p>
        </div>
        <button className="btn btn-primary" onClick={() => router.push('/interview/new')}>
          + New Interview
        </button>
      </div>

      <div className="grid-4">
        <div className="stat-card">
          <div className="stat-value">{stats?.totalInterviews || 0}</div>
          <div className="stat-label">Total Interviews</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.completedInterviews || 0}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.averageScore || 0}%</div>
          <div className="stat-label">Average Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.strengths?.length || 0}</div>
          <div className="stat-label">Strong Areas</div>
        </div>
      </div>

      {/* Score Breakdown */}
      {stats?.scoreBreakdown && (
        <div className={`card ${styles.breakdownCard}`}>
          <div className="card-header">
            <h3 className="card-title">Score Breakdown</h3>
          </div>
          <div className={styles.breakdownGrid}>
            {Object.entries(stats.scoreBreakdown).map(([key, val]) => (
              <div key={key} className={styles.breakdownItem}>
                <div className={styles.breakdownLabel}>
                  <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                  <span className={styles.breakdownVal}>{Math.round(val)}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${val}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Interviews */}
      {stats?.recentInterviews?.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <h3 className="card-title">Recent Interviews</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentInterviews.map((i) => (
                  <tr key={i.id}>
                    <td>{i.jobRole}</td>
                    <td>
                      <span className={`badge ${i.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                        {i.status}
                      </span>
                    </td>
                    <td>{i.score ? `${Math.round(i.score)}%` : '—'}</td>
                    <td>{new Date(i.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

/* ===== INTERVIEWS TAB ===== */
function InterviewsTab({ router }) {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/interviews').then((data) => {
      setInterviews(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Interviews</h1>
          <p className="page-subtitle">View and manage your interview sessions</p>
        </div>
        <button className="btn btn-primary" onClick={() => router.push('/interview/new')}>+ New Interview</button>
      </div>

      {loading ? (
        <div className="flex justify-center mt-24"><div className="spinner"></div></div>
      ) : interviews.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🎯</span>
          <h3>No interviews yet</h3>
          <p>Start your first AI-powered mock interview to get personalized feedback.</p>
          <button className="btn btn-primary" onClick={() => router.push('/interview/new')}>Start First Interview</button>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Type</th>
                <th>Status</th>
                <th>Score</th>
                <th>Questions</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {interviews.map((i) => (
                <tr key={i.id}>
                  <td><strong>{i.jobRole}</strong></td>
                  <td><span className="badge badge-accent">{i.type}</span></td>
                  <td><span className={`badge ${i.status === 'COMPLETED' ? 'badge-success' : i.status === 'IN_PROGRESS' ? 'badge-warning' : 'badge-info'}`}>{i.status}</span></td>
                  <td>{i.totalScore ? `${Math.round(i.totalScore)}%` : '—'}</td>
                  <td>{i.questions?.length || 0}</td>
                  <td>{new Date(i.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/interview/${i.id}`)}>View →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ===== RESUME TAB ===== */
function ResumeTab() {
  const [resumes, setResumes] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzingIds, setAnalyzingIds] = useState(new Set());

  const loadResumes = () => {
    api.get('/resumes').then(setResumes).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadResumes(); }, []);

  // Auto-poll when any resume is being analyzed
  useEffect(() => {
    if (analyzingIds.size === 0) return;
    const interval = setInterval(() => {
      api.get('/resumes').then((data) => {
        setResumes(data);
        // Check if any analyzing resume now has a real atsScore
        const stillAnalyzing = new Set();
        analyzingIds.forEach((id) => {
          const resume = data.find((r) => r.id === id);
          if (!resume) return; // Resume deleted, stop tracking
          // Parse parsedData if it's a string
          let pd = resume.parsedData;
          if (typeof pd === 'string') {
            try { pd = JSON.parse(pd); } catch { pd = null; }
          }
          // Analysis is done when atsScore > 0 and parsedData doesn't have pending status
          const isDone = resume.atsScore > 0 && pd && pd.status !== 'pending_ai_analysis';
          if (!isDone) {
            stillAnalyzing.add(id);
          }
        });
        setAnalyzingIds(stillAnalyzing);
      }).catch(console.error);
    }, 3000);
    return () => clearInterval(interval);
  }, [analyzingIds]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const newResume = await api.post('/resumes', formData);
      if (newResume?.id) {
        setAnalyzingIds((prev) => new Set(prev).add(newResume.id));
      }
      loadResumes();
    } catch (err) {
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleReanalyze = async (resumeId) => {
    setAnalyzingIds((prev) => new Set(prev).add(resumeId));
    try {
      await api.post(`/resumes/${resumeId}/analyze`);
      // The backend analyze endpoint is synchronous, so data is already saved
      // Reload immediately and clear analyzing state
      const updated = await api.get('/resumes');
      setResumes(updated);
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(resumeId);
        return next;
      });
    } catch (err) {
      console.error('Re-analyze failed:', err);
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(resumeId);
        return next;
      });
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Resume Manager</h1>
          <p className="page-subtitle">Upload, analyze, and optimize your resume with AI</p>
        </div>
        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
          {uploading ? 'Uploading...' : '📄 Upload Resume'}
          <input type="file" accept=".pdf" hidden onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center mt-24"><div className="spinner"></div></div>
      ) : resumes.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📄</span>
          <h3>No resumes uploaded</h3>
          <p>Upload your resume to get AI-powered analysis and ATS score.</p>
        </div>
      ) : (
        <div className="grid-2">
          {resumes.map((r) => {
            const parsedData = typeof r.parsedData === 'string'
              ? (() => { try { return JSON.parse(r.parsedData); } catch { return null; } })()
              : r.parsedData;
            const isAnalyzing = analyzingIds.has(r.id);
            const hasAnalysis = r.atsScore != null && parsedData && parsedData.status !== 'pending_ai_analysis';
            
            // Detect if this is a fallback error state
            const isError = hasAnalysis && (r.atsScore === 0 || r.atsScore === 50) && 
                            (r.aiFeedback?.includes('could not complete') || r.aiFeedback?.includes('quota exceeded'));

            return (
            <div key={r.id} className="card">
              <div className="card-header">
                <h3 className="card-title">{r.fileName}</h3>
                <span className={`badge ${isError ? 'badge-error' : hasAnalysis ? 'badge-accent' : 'badge-warning'}`}>
                  {isAnalyzing ? '⏳ Analyzing...' : isError ? 'Failed' : hasAnalysis ? `ATS: ${Math.round(r.atsScore)}%` : 'Pending'}
                </span>
              </div>
              <p className="text-sm text-muted mb-8">Uploaded: {new Date(r.uploadedAt).toLocaleDateString()}</p>
              <p className="text-sm text-muted mb-16">Size: {(r.fileSize / 1024).toFixed(1)} KB</p>

              {hasAnalysis && !isError && (
                <div className="mb-16">
                  <div className={styles.breakdownLabel}>
                    <span>ATS Score</span>
                    <span className={styles.breakdownVal}>{Math.round(r.atsScore)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${r.atsScore}%` }}></div>
                  </div>
                </div>
              )}

              {isAnalyzing && (
                <div className="mb-16 flex items-center gap-8">
                  <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div>
                  <span className="text-sm text-muted">AI is analyzing your resume...</span>
                </div>
              )}

              {hasAnalysis && !isError && parsedData?.skills?.length > 0 && (
                <div className={styles.skillTags}>
                  {parsedData.skills.slice(0, 8).map((s, i) => (
                    <span key={i} className="badge badge-accent">{s}</span>
                  ))}
                </div>
              )}

              {hasAnalysis && r.aiFeedback && (
                <div className="mt-8">
                  <p className="text-sm" style={{ color: isError ? 'var(--error)' : 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {typeof r.aiFeedback === 'string'
                      ? (() => { try { return JSON.parse(r.aiFeedback).summary; } catch { return r.aiFeedback; } })()
                      : r.aiFeedback?.summary || ''}
                  </p>
                </div>
              )}

              <div className="flex gap-8 mt-16">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleReanalyze(r.id)}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? '⏳ Analyzing...' : '🔄 Re-analyze'}
                </button>
                <button className="btn btn-ghost btn-sm" style={{color: 'var(--error)'}} onClick={async () => {
                  await api.del(`/resumes/${r.id}`);
                  loadResumes();
                }}>
                  🗑 Delete
                </button>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </>
  );
}

/* ===== PRACTICE TAB ===== */
function PracticeTab({ router }) {
  const [form, setForm] = useState({ jobRole: '', type: 'MIXED' });
  const [creating, setCreating] = useState(false);

  const startInterview = async () => {
    if (!form.jobRole.trim()) return alert('Please enter a job role');
    setCreating(true);
    try {
      const interview = await api.post('/interviews', form);
      router.push(`/interview/${interview.id}`);
    } catch (err) {
      alert('Failed to create interview');
    } finally {
      setCreating(false);
    }
  };

  const roles = ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Data Scientist', 'DevOps Engineer', 'Product Manager', 'UI/UX Designer'];
  const types = ['MIXED', 'TECHNICAL', 'HR', 'DSA', 'SYSTEM_DESIGN'];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Practice Interview</h1>
          <p className="page-subtitle">Start an AI-powered mock interview session</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        <div className="form-group">
          <label className="form-label">Target Job Role</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Backend Developer"
            value={form.jobRole}
            onChange={(e) => setForm({ ...form, jobRole: e.target.value })}
            list="roles"
          />
          <datalist id="roles">
            {roles.map((r) => <option key={r} value={r} />)}
          </datalist>
        </div>

        <div className="form-group">
          <label className="form-label">Interview Type</label>
          <select className="form-input form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <button className="btn btn-primary btn-lg w-full" onClick={startInterview} disabled={creating}>
          {creating ? 'Setting up interview...' : '🎙️ Start Mock Interview'}
        </button>
      </div>
    </>
  );
}

/* ===== ANALYTICS TAB ===== */
function AnalyticsTab({ stats }) {
  if (!stats) return <div className="flex justify-center mt-24"><div className="spinner"></div></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Track your interview performance over time</p>
        </div>
      </div>

      <div className="grid-3">
        <div className="stat-card">
          <div className="stat-value">{stats.averageScore}%</div>
          <div className="stat-label">Average Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.completedInterviews}</div>
          <div className="stat-label">Interviews Done</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalInterviews}</div>
          <div className="stat-label">Total Sessions</div>
        </div>
      </div>

      {stats.weakAreas?.length > 0 && (
        <div className="card mt-24">
          <div className="card-header"><h3 className="card-title">⚠️ Areas to Improve</h3></div>
          <div className="flex gap-8" style={{flexWrap: 'wrap'}}>
            {stats.weakAreas.map((w, i) => <span key={i} className="badge badge-warning">{w}</span>)}
          </div>
        </div>
      )}

      {stats.strengths?.length > 0 && (
        <div className="card mt-16">
          <div className="card-header"><h3 className="card-title">💪 Strengths</h3></div>
          <div className="flex gap-8" style={{flexWrap: 'wrap'}}>
            {stats.strengths.map((s, i) => <span key={i} className="badge badge-success">{s}</span>)}
          </div>
        </div>
      )}
    </>
  );
}

/* ===== SETTINGS TAB ===== */
function SettingsTab({ user }) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account preferences</p>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 500 }}>
        <div className="flex items-center gap-16 mb-24">
          <div className="avatar avatar-lg">{user?.name?.charAt(0).toUpperCase()}</div>
          <div>
            <h3>{user?.name}</h3>
            <p className="text-sm text-muted">{user?.email}</p>
            <span className="badge badge-accent mt-8">{user?.role}</span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Display Name</label>
          <input className="form-input" defaultValue={user?.name} />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" defaultValue={user?.email} disabled />
        </div>
        <button className="btn btn-primary">Save Changes</button>
      </div>
    </>
  );
}
