'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/store/authStore';
import api from '@/lib/api';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, initialize, logout } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState({ users: [], total: 0, page: 1, totalPages: 1 });
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { initialize(); }, [initialize]);
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/analytics/admin').then(setStats).catch(console.error);
      api.get('/admin/users?limit=20').then(setUsers).catch(console.error);
    }
  }, [isAuthenticated]);

  if (isLoading) return <div className="loading-page"><div className="spinner"></div></div>;
  if (!isAuthenticated || user?.role !== 'ADMIN') return null;

  const navItems = [
    { key: 'overview', icon: '📊', label: 'Overview' },
    { key: 'users', icon: '👥', label: 'Users' },
    { key: 'interviews', icon: '🎯', label: 'Interviews' },
    { key: 'logs', icon: '📋', label: 'Audit Logs' },
    { key: 'settings', icon: '⚙️', label: 'Settings' },
  ];

  const toggleUser = async (userId) => {
    await api.patch(`/admin/users/${userId}/toggle`);
    const data = await api.get('/admin/users?limit=20');
    setUsers(data);
  };

  const changeRole = async (userId, role) => {
    await api.patch(`/admin/users/${userId}/role`, { role });
    const data = await api.get('/admin/users?limit=20');
    setUsers(data);
  };

  return (
    <div className="page-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>InterviewAI</h1>
          <span>Admin Panel</span>
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
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ADMIN</p>
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
                <h1 className="page-title">Admin Dashboard</h1>
                <p className="page-subtitle">Platform overview and management</p>
              </div>
            </div>

            <div className="grid-4">
              <div className="stat-card">
                <div className="stat-value">{stats?.totalUsers || 0}</div>
                <div className="stat-label">Total Users</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.totalInterviews || 0}</div>
                <div className="stat-label">Total Interviews</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.totalResumes || 0}</div>
                <div className="stat-label">Resumes Uploaded</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.averageScore || 0}%</div>
                <div className="stat-label">Avg Score</div>
              </div>
            </div>

            {/* Users by Role */}
            {stats?.usersByRole && (
              <div className="card" style={{ marginTop: 20 }}>
                <div className="card-header"><h3 className="card-title">Users by Role</h3></div>
                <div style={{ display: 'flex', gap: 20 }}>
                  {stats.usersByRole.map((r) => (
                    <div key={r.role} className="stat-card" style={{ flex: 1, textAlign: 'center' }}>
                      <div className="stat-value">{r.count}</div>
                      <div className="stat-label">{r.role}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interviews by Status */}
            {stats?.interviewsByStatus && (
              <div className="card" style={{ marginTop: 20 }}>
                <div className="card-header"><h3 className="card-title">Interviews by Status</h3></div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {stats.interviewsByStatus.map((s) => (
                    <span key={s.status} className={`badge ${s.status === 'COMPLETED' ? 'badge-success' : s.status === 'IN_PROGRESS' ? 'badge-warning' : 'badge-info'}`}>
                      {s.status}: {s.count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Users */}
            {stats?.recentUsers?.length > 0 && (
              <div className="card" style={{ marginTop: 20 }}>
                <div className="card-header"><h3 className="card-title">Recent Signups</h3></div>
                <div className="table-container">
                  <table className="table">
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
                    <tbody>
                      {stats.recentUsers.map((u) => (
                        <tr key={u.id}>
                          <td><strong>{u.name}</strong></td>
                          <td>{u.email}</td>
                          <td><span className="badge badge-accent">{u.role}</span></td>
                          <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'users' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">User Management</h1>
                <p className="page-subtitle">{users.total} total users</p>
              </div>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.users?.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.email}</td>
                      <td>
                        <select className="form-input form-select" value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} style={{ padding: '4px 28px 4px 8px', fontSize: '0.8rem', width: 'auto' }}>
                          <option value="CANDIDATE">CANDIDATE</option>
                          <option value="RECRUITER">RECRUITER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td>
                        <span className={`badge ${u.isActive ? 'badge-success' : 'badge-error'}`}>
                          {u.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleUser(u.id)}>
                          {u.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'interviews' && (
          <>
            <div className="page-header"><div><h1 className="page-title">All Interviews</h1><p className="page-subtitle">Monitor platform-wide interview sessions</p></div></div>
            <p className="text-muted">Interview data loads from the admin API endpoint.</p>
          </>
        )}

        {activeTab === 'logs' && (
          <>
            <div className="page-header"><div><h1 className="page-title">Audit Logs</h1><p className="page-subtitle">System activity and security events</p></div></div>
            <div className="card">
              <p className="text-muted">Audit logs track user actions, API calls, and security events. Connect to view real-time system activity.</p>
            </div>
          </>
        )}

        {activeTab === 'settings' && (
          <>
            <div className="page-header"><div><h1 className="page-title">Platform Settings</h1></div></div>
            <div className="card" style={{ maxWidth: 500 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <div className="avatar avatar-lg">{user?.name?.charAt(0)}</div>
                <div>
                  <h3>{user?.name}</h3>
                  <p className="text-sm text-muted">{user?.email}</p>
                  <span className="badge badge-error mt-8">ADMIN</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
