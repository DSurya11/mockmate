'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/store/authStore';
import api from '@/lib/api';

export default function RecruiterDashboard() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, initialize, logout } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { initialize(); }, [initialize]);
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role !== 'RECRUITER' && user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/analytics/recruiter').then(setStats).catch(console.error);
    }
  }, [isAuthenticated]);

  if (isLoading) return <div className="loading-page"><div className="spinner"></div></div>;
  if (!isAuthenticated || (user?.role !== 'RECRUITER' && user?.role !== 'ADMIN')) return null;

  const navItems = [
    { key: 'overview', icon: '📊', label: 'Overview' },
    { key: 'candidates', icon: '👥', label: 'Candidates' },
    { key: 'interviews', icon: '🎯', label: 'Interviews' },
    { key: 'settings', icon: '⚙️', label: 'Settings' },
  ];

  return (
    <div className="page-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>InterviewAI</h1>
          <span>Recruiter Portal</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button key={item.key} className={`nav-item ${activeTab === item.key ? 'active' : ''}`} onClick={() => setActiveTab(item.key)}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="avatar">{user?.name?.charAt(0)}</div>
            <div>
              <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.name}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>RECRUITER</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
        </div>
      </aside>

      <main className="main-content">
        {activeTab === 'overview' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Recruiter Dashboard</h1>
                <p className="page-subtitle">Manage candidates and track hiring pipeline</p>
              </div>
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
                <div className="stat-label">Avg Score</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.funnel?.hired || 0}</div>
                <div className="stat-label">Hired (75%+)</div>
              </div>
            </div>

            {/* Hiring Funnel */}
            {stats?.funnel && (
              <div className="card" style={{ marginTop: 20 }}>
                <div className="card-header"><h3 className="card-title">Hiring Funnel</h3></div>
                {['total', 'inProgress', 'completed', 'hired'].map((key) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                      <span>{key === 'inProgress' ? 'In Progress' : key.charAt(0).toUpperCase() + key.slice(1)}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{stats.funnel[key]}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${stats.funnel.total > 0 ? (stats.funnel[key] / stats.funnel.total) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Top Candidates */}
            {stats?.topCandidates?.length > 0 && (
              <div className="card" style={{ marginTop: 20 }}>
                <div className="card-header"><h3 className="card-title">Top Candidates</h3></div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr><th>Name</th><th>Email</th><th>Role</th><th>Score</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                      {stats.topCandidates.map((c, i) => (
                        <tr key={i}>
                          <td><strong>{c.name}</strong></td>
                          <td>{c.email}</td>
                          <td>{c.jobRole}</td>
                          <td><span className={`badge ${c.score >= 75 ? 'badge-success' : c.score >= 50 ? 'badge-warning' : 'badge-error'}`}>{Math.round(c.score)}%</span></td>
                          <td>{c.date ? new Date(c.date).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'candidates' && (
          <>
            <div className="page-header"><div><h1 className="page-title">Candidates</h1><p className="page-subtitle">Browse evaluated candidates</p></div></div>
            {!stats?.topCandidates?.length ? (
              <div style={{ textAlign: 'center', padding: '80px 40px', background: 'var(--bg-card)', border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-xl)', maxWidth: 500, margin: '40px auto' }}>
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: 16 }}>👥</span>
                <h3>No candidates yet</h3>
                <p className="text-muted">Candidates will appear here after completing interviews.</p>
              </div>
            ) : (
              <div className="grid-2">
                {stats.topCandidates.map((c, i) => (
                  <div key={i} className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div className="avatar">{c.name?.charAt(0)}</div>
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{c.name}</h3>
                        <p className="text-sm text-muted">{c.email}</p>
                      </div>
                      <span className={`badge ${c.score >= 75 ? 'badge-success' : 'badge-warning'}`} style={{ marginLeft: 'auto' }}>{Math.round(c.score)}%</span>
                    </div>
                    <p className="text-sm text-muted">Role: {c.jobRole}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'interviews' && (
          <>
            <div className="page-header"><div><h1 className="page-title">Interviews</h1><p className="page-subtitle">All interview sessions</p></div></div>
            <p className="text-muted">Interview listing loads from the API when candidates complete sessions.</p>
          </>
        )}

        {activeTab === 'settings' && (
          <>
            <div className="page-header"><div><h1 className="page-title">Settings</h1></div></div>
            <div className="card" style={{ maxWidth: 500 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <div className="avatar avatar-lg">{user?.name?.charAt(0)}</div>
                <div>
                  <h3>{user?.name}</h3>
                  <p className="text-sm text-muted">{user?.email}</p>
                  <span className="badge badge-accent mt-8">RECRUITER</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
