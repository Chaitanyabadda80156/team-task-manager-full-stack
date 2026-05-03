import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  LogOut,
  Plus,
  RefreshCw,
  Shield,
  Users
} from 'lucide-react';
import './styles.css';

const API_URL =
  import.meta.env.VITE_API_URL ||
  (['5173', '5174'].includes(window.location.port) ? `http://${window.location.hostname}:4000/api` : '/api');
const statuses = ['Todo', 'In Progress', 'Done'];
const priorities = ['Low', 'Medium', 'High'];

function App() {
  const [auth, setAuth] = useState(() => {
    const stored = localStorage.getItem('ttm-auth');
    return stored ? JSON.parse(stored) : null;
  });
  const [view, setView] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  function handleAuth(nextAuth) {
    setAuth(nextAuth);
    localStorage.setItem('ttm-auth', JSON.stringify(nextAuth));
  }

  function logout() {
    localStorage.removeItem('ttm-auth');
    setAuth(null);
    setView('dashboard');
    setSelectedProjectId(null);
  }

  if (!auth) return <AuthScreen onAuth={handleAuth} />;

  return (
    <Shell user={auth.user} onLogout={logout} view={view} setView={setView}>
      {view === 'dashboard' && <Dashboard token={auth.token} openProject={(id) => { setSelectedProjectId(id); setView('projects'); }} />}
      {view === 'projects' && (
        <Projects
          token={auth.token}
          user={auth.user}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
        />
      )}
    </Shell>
  );
}

function Shell({ user, onLogout, view, setView, children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <FolderKanban size={28} />
          <div>
            <strong>TeamTask</strong>
            <span>{user.role}</span>
          </div>
        </div>
        <nav>
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>
            <ClipboardList size={18} /> Dashboard
          </button>
          <button className={view === 'projects' ? 'active' : ''} onClick={() => setView('projects')}>
            <FolderKanban size={18} /> Projects
          </button>
        </nav>
        <button className="ghost logout" onClick={onLogout}>
          <LogOut size={18} /> Logout
        </button>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span>Signed in as</span>
            <h1>{user.name}</h1>
          </div>
          <div className="role-pill">
            <Shield size={16} /> {user.role}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: 'admin@example.com', password: 'Admin123!', role: 'Admin' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = mode === 'login' ? { email: form.email, password: form.password } : form;
      const data = await api(`/auth/${mode}`, { method: 'POST', body: payload });
      onAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-copy">
          <FolderKanban size={42} />
          <h1>Team Task Manager</h1>
          <p>Projects, assignments, progress, and role-based access in one focused workspace.</p>
        </div>
        <form onSubmit={submit} className="auth-form">
          <div className="tabs">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
            <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Signup</button>
          </div>
          {mode === 'signup' && (
            <>
              <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
              <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option>Admin</option><option>Member</option></select></label>
            </>
          )}
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={loading}>{loading ? 'Working...' : mode === 'login' ? 'Login' : 'Create account'}</button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ token }) {
  const { data, error, loading, refresh } = useResource(token, '/dashboard');

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const stats = data.stats || {};
  return (
    <section className="page">
      <div className="section-heading">
        <div>
          <h2>Dashboard</h2>
          <p>Current work, status spread, and overdue items.</p>
        </div>
        <button className="icon-button" onClick={refresh} title="Refresh"><RefreshCw size={18} /></button>
      </div>
      <div className="metrics">
        <Metric icon={<FolderKanban />} label="Projects" value={data.projectCount} />
        <Metric icon={<ClipboardList />} label="Tasks" value={stats.total || 0} />
        <Metric icon={<CheckCircle2 />} label="Done" value={stats.done || 0} />
        <Metric icon={<Shield />} label="Overdue" value={stats.overdue || 0} tone="danger" />
      </div>
      <TaskList tasks={data.tasks || []} token={token} onChanged={refresh} compact />
    </section>
  );
}

function Projects({ token, user, selectedProjectId, setSelectedProjectId }) {
  const { data, loading, error, refresh } = useResource(token, '/projects');
  const projects = data?.projects || [];
  const activeId = selectedProjectId || projects[0]?.id;

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId, setSelectedProjectId]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <section className="page project-layout">
      <div className="project-list">
        <div className="section-heading tight">
          <h2>Projects</h2>
          {user.role === 'Admin' && <CreateProject token={token} onCreated={refresh} />}
        </div>
        {projects.map((project) => (
          <button
            key={project.id}
            className={`project-row ${activeId === project.id ? 'active' : ''}`}
            onClick={() => setSelectedProjectId(project.id)}
          >
            <strong>{project.name}</strong>
            <span>{project.member_count} members · {project.task_count} tasks</span>
          </button>
        ))}
      </div>
      {activeId ? <ProjectDetail token={token} user={user} projectId={activeId} /> : <EmptyState title="No projects yet" />}
    </section>
  );
}

function ProjectDetail({ token, user, projectId }) {
  const { data, loading, error, refresh } = useResource(token, `/projects/${projectId}`, [projectId]);
  const usersResource = useResource(user.role === 'Admin' ? token : null, '/users');

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const isAdmin = user.role === 'Admin';
  return (
    <div className="project-detail">
      <div className="section-heading">
        <div>
          <h2>{data.project.name}</h2>
          <p>{data.project.description || 'No description provided.'}</p>
        </div>
        {isAdmin && <TaskForm token={token} projectId={projectId} members={data.members} onCreated={refresh} />}
      </div>
      <div className="split">
        <section className="panel">
          <h3><Users size={18} /> Team</h3>
          <div className="chips">
            {data.members.map((member) => <span key={member.id}>{member.name} · {member.role}</span>)}
          </div>
          {isAdmin && <AddMember token={token} projectId={projectId} users={usersResource.data?.users || []} members={data.members} onChanged={refresh} />}
        </section>
        <section className="panel">
          <h3><ClipboardList size={18} /> Tasks</h3>
          <TaskList tasks={data.tasks} token={token} user={user} onChanged={refresh} />
        </section>
      </div>
    </div>
  );
}

function CreateProject({ token, onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  async function submit(event) {
    event.preventDefault();
    await api('/projects', { token, method: 'POST', body: form });
    setForm({ name: '', description: '' });
    setOpen(false);
    onCreated();
  }

  if (!open) return <button className="small-button" onClick={() => setOpen(true)}><Plus size={16} /> New</button>;
  return (
    <form className="inline-form" onSubmit={submit}>
      <input placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <button className="small-button">Save</button>
    </form>
  );
}

function AddMember({ token, projectId, users, members, onChanged }) {
  const memberIds = new Set(members.map((member) => member.id));
  const options = users.filter((user) => !memberIds.has(user.id));
  const [userId, setUserId] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!userId) return;
    await api(`/projects/${projectId}/members`, { token, method: 'POST', body: { userId } });
    setUserId('');
    onChanged();
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <select value={userId} onChange={(event) => setUserId(event.target.value)}>
        <option value="">Add member</option>
        {options.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}
      </select>
      <button className="small-button">Add</button>
    </form>
  );
}

function TaskForm({ token, projectId, members, onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    assigneeId: '',
    status: 'Todo',
    priority: 'Medium',
    dueDate: new Date().toISOString().slice(0, 10)
  });

  async function submit(event) {
    event.preventDefault();
    await api(`/projects/${projectId}/tasks`, {
      token,
      method: 'POST',
      body: { ...form, assigneeId: form.assigneeId || null }
    });
    setOpen(false);
    setForm({ ...form, title: '', description: '' });
    onCreated();
  }

  if (!open) return <button className="primary compact" onClick={() => setOpen(true)}><Plus size={16} /> Task</button>;
  return (
    <form className="task-form" onSubmit={submit}>
      <input placeholder="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
      <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <div className="form-grid">
        <select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
          <option value="">Unassigned</option>
          {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{priorities.map((item) => <option key={item}>{item}</option>)}</select>
        <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
      </div>
      <button className="small-button">Create task</button>
    </form>
  );
}

function TaskList({ tasks, token, user, onChanged, compact = false }) {
  if (!tasks.length) return <EmptyState title="No tasks to show" />;

  return (
    <div className={`task-list ${compact ? 'compact-list' : ''}`}>
      {tasks.map((task) => (
        <article key={task.id} className="task-card">
          <div>
            <div className="task-title">
              <strong>{task.title}</strong>
              <span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span>
            </div>
            <p>{task.description || task.projectName}</p>
            <span className="muted">{task.assigneeName || 'Unassigned'} · Due {task.dueDate}</span>
          </div>
          <select
            value={task.status}
            onChange={async (event) => {
              await api(`/tasks/${task.id}`, { token, method: 'PATCH', body: { status: event.target.value } });
              onChanged();
            }}
            disabled={user?.role === 'Member' && task.assigneeId !== user.id}
          >
            {statuses.map((status) => <option key={status}>{status}</option>)}
          </select>
        </article>
      ))}
    </div>
  );
}

function Metric({ icon, label, value, tone = '' }) {
  return (
    <div className={`metric ${tone}`}>
      {React.cloneElement(icon, { size: 22 })}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Loading() {
  return <div className="state">Loading...</div>;
}

function EmptyState({ title }) {
  return <div className="state">{title}</div>;
}

function ErrorState({ message, onRetry }) {
  return <div className="state error-box"><p>{message}</p><button className="small-button" onClick={onRetry}>Retry</button></div>;
}

function useResource(token, path, deps = []) {
  const [state, setState] = useState({ data: null, loading: Boolean(token), error: '' });
  const refreshKey = useMemo(() => ({ value: 0 }), []);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!token) return;
    let ignore = false;
    setState((current) => ({ ...current, loading: true, error: '' }));
    api(path, { token })
      .then((data) => !ignore && setState({ data, loading: false, error: '' }))
      .catch((err) => !ignore && setState({ data: null, loading: false, error: err.message }));
    return () => {
      ignore = true;
    };
  }, [token, path, tick, ...deps]);

  return { ...state, refresh: () => { refreshKey.value += 1; setTick((value) => value + 1); } };
}

async function api(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const fieldErrors = error.errors
      ? Object.entries(error.errors)
          .flatMap(([field, messages]) => (messages || []).map((message) => `${field}: ${message}`))
          .join(' ')
      : '';
    throw new Error(fieldErrors || error.message || 'Request failed.');
  }
  if (response.status === 204) return null;
  return response.json();
}

const rootElement = document.getElementById('root');
rootElement.dataset.reactReady = 'true';
createRoot(rootElement).render(<App />);
