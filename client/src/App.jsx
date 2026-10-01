import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { api } from './api.js';

const COLS = [['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done']];
const upsert = (list, item) => list.some(x => x._id === item._id) ? list.map(x => x._id === item._id ? item : x) : [...list, item];

function Nav() {
  const { user, logout } = useAuth();
  return <header className="nav"><Link to="/" className="brand">Crew<b>Board</b></Link>
    {user && <div className="who"><span>{user.name}</span><button className="btn ghost" onClick={logout}>Sign out</button></div>}</header>;
}

function Login() {
  const { login, register } = useAuth(); const nav = useNavigate();
  const [reg, setReg] = useState(false); const [f, setF] = useState({ name: '', email: '', password: '' }); const [err, setErr] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => { e.preventDefault(); setErr(''); try { await (reg ? register(f) : login(f)); nav('/'); } catch (x) { setErr(x.message); } };
  return <main className="wrap narrow"><form className="panel" onSubmit={submit}>
    <h2>{reg ? 'Create your account' : 'Sign in to your team'}</h2>
    {reg && <label>Full name<input value={f.name} onChange={set('name')} required /></label>}
    <label>Email<input type="email" value={f.email} onChange={set('email')} required /></label>
    <label>Password<input type="password" minLength={6} value={f.password} onChange={set('password')} required /></label>
    {err && <p className="err" role="alert">{err}</p>}
    <button className="btn full">{reg ? 'Create account' : 'Sign in'}</button>
    <button type="button" className="link" onClick={() => setReg(!reg)}>{reg ? 'Have an account? Sign in' : 'New intern? Create an account'}</button>
  </form></main>;
}

function Projects() {
  const [list, setList] = useState(null); const [name, setName] = useState(''); const [err, setErr] = useState('');
  const load = () => api('/projects').then(setList);
  useEffect(() => { load(); }, []);
  const add = async e => { e.preventDefault(); try { await api('/projects', { method: 'POST', body: { name } }); setName(''); load(); } catch (x) { setErr(x.message); } };
  return <main className="wrap">
    <h1>Your projects</h1>
    <form className="inline" onSubmit={add}><input placeholder="New project name" value={name} onChange={e => setName(e.target.value)} /><button className="btn">Create project</button></form>
    {err && <p className="err">{err}</p>}
    <div className="grid">{list?.length === 0 && <p className="muted">No projects yet. Create one to start your first board.</p>}
      {list?.map(p => <Link key={p._id} to={`/p/${p._id}`} className="card"><h3>{p.name}</h3><p className="muted">{p.members.length} member{p.members.length > 1 ? 's' : ''}</p></Link>)}</div>
  </main>;
}

function Board() {
  const { pid } = useParams();
  const [data, setData] = useState(null); const [online, setOnline] = useState(1); const [err, setErr] = useState('');
  const [t, setT] = useState({ title: '', milestone: '' }); const [m, setM] = useState({ title: '', due: '' }); const [email, setEmail] = useState('');
  const [over, setOver] = useState(null); const sock = useRef();
  const fail = x => setErr(x.message);

  useEffect(() => {
    api(`/projects/${pid}`).then(setData).catch(fail);
    const s = io({ auth: { token: localStorage.getItem('token') } }); sock.current = s;
    s.on('connect', () => s.emit('project:join', pid));
    s.on('presence', setOnline);
    s.on('task:upsert', x => setData(d => d && { ...d, tasks: upsert(d.tasks, x) }));
    s.on('task:removed', id => setData(d => d && { ...d, tasks: d.tasks.filter(x => x._id !== id) }));
    s.on('milestone:upsert', x => setData(d => d && { ...d, milestones: upsert(d.milestones, x) }));
    s.on('milestone:removed', id => setData(d => d && { ...d, milestones: d.milestones.filter(x => x._id !== id), tasks: d.tasks.map(k => k.milestone === id ? { ...k, milestone: null } : k) }));
    s.on('project:updated', p => setData(d => d && { ...d, project: p }));
    return () => s.disconnect();
  }, [pid]);

  if (!data) return <main className="wrap"><p className={err ? 'err' : ''}>{err || 'Loading board…'}</p></main>;
  const { project, tasks, milestones } = data;
  const call = (path, method, body) => api(`/projects/${pid}${path}`, { method, body }).then(() => setErr('')).catch(fail);
  const move = (id, status) => call(`/tasks/${id}`, 'PATCH', { status });
  const who = id => project.members.find(u => u._id === id)?.name;
  const pct = mid => { const k = tasks.filter(x => x.milestone === mid); return k.length ? Math.round(100 * k.filter(x => x.status === 'done').length / k.length) : 0; };
  const overall = tasks.length ? Math.round(100 * tasks.filter(x => x.status === 'done').length / tasks.length) : 0;

  return <main className="wrap board">
    <div className="bar"><div><Link to="/" className="muted">All projects</Link><h1>{project.name}</h1></div>
      <div className="live" title="People viewing this board now"><i />{online} online</div></div>
    {err && <p className="err" role="alert">{err}</p>}
    <div className="layout">
      <section>
        <form className="inline" onSubmit={e => { e.preventDefault(); call('/tasks', 'POST', { title: t.title, milestone: t.milestone }); setT({ title: '', milestone: '' }); }}>
          <input placeholder="Add a task" value={t.title} onChange={e => setT({ ...t, title: e.target.value })} required />
          <select value={t.milestone} onChange={e => setT({ ...t, milestone: e.target.value })}><option value="">No milestone</option>{milestones.map(x => <option key={x._id} value={x._id}>{x.title}</option>)}</select>
          <button className="btn">Add task</button></form>
        <div className="cols">{COLS.map(([key, label]) => (
          <div key={key} className={'col' + (over === key ? ' over' : '')} onDragOver={e => { e.preventDefault(); setOver(key); }} onDragLeave={() => setOver(null)}
            onDrop={e => { setOver(null); const id = e.dataTransfer.getData('id'); id && move(id, key); }}>
            <h3>{label} <span>{tasks.filter(x => x.status === key).length}</span></h3>
            {tasks.filter(x => x.status === key).map(k => (
              <article key={k._id} className="task" draggable onDragStart={e => e.dataTransfer.setData('id', k._id)}>
                <p>{k.title}</p>
                <div className="meta">{k.milestone && <span className="tag">{milestones.find(x => x._id === k.milestone)?.title}</span>}
                  <select aria-label="Assignee" value={k.assignee || ''} onChange={e => call(`/tasks/${k._id}`, 'PATCH', { assignee: e.target.value })}>
                    <option value="">Unassigned</option>{project.members.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}</select></div>
                <div className="meta"><select aria-label="Move task" value={k.status} onChange={e => move(k._id, e.target.value)}>{COLS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  <button className="x" aria-label="Delete task" onClick={() => call(`/tasks/${k._id}`, 'DELETE')}>Delete</button></div>
                {k.assignee && <small className="muted">Assigned to {who(k.assignee)}</small>}
              </article>))}
          </div>))}</div>
      </section>
      <aside>
        <div className="panel"><h3>Milestones</h3>
          <div className="prog"><span>Overall progress</span><b>{overall}%</b></div><div className="bar2"><i style={{ width: overall + '%' }} /></div>
          {milestones.map(x => <div key={x._id} className="ms"><div className="prog"><span>{x.title}</span><b>{pct(x._id)}%</b></div>
            <div className="bar2"><i style={{ width: pct(x._id) + '%' }} /></div>
            <small className="muted">{x.due ? 'Due ' + new Date(x.due).toLocaleDateString() : 'No due date'} · <button className="x" onClick={() => call(`/milestones/${x._id}`, 'DELETE')}>Remove</button></small></div>)}
          <form className="stack" onSubmit={e => { e.preventDefault(); call('/milestones', 'POST', m); setM({ title: '', due: '' }); }}>
            <input placeholder="New milestone" value={m.title} onChange={e => setM({ ...m, title: e.target.value })} required />
            <input type="date" aria-label="Due date" value={m.due} onChange={e => setM({ ...m, due: e.target.value })} />
            <button className="btn ghost">Add milestone</button></form></div>
        <div className="panel"><h3>Team</h3>{project.members.map(u => <p key={u._id} className="member">{u.name}<small className="muted"> {u.email}</small></p>)}
          <form className="stack" onSubmit={async e => { e.preventDefault(); await call('/members', 'POST', { email }); setEmail(''); }}>
            <input type="email" placeholder="Invite by email" value={email} onChange={e => setEmail(e.target.value)} required /><button className="btn ghost">Add intern</button></form></div>
      </aside>
    </div>
  </main>;
}

function Guard({ children }) { const { user, ready } = useAuth(); return !ready ? null : user ? children : <Navigate to="/login" replace />; }
export default function App() {
  return <AuthProvider><Nav /><Routes>
    <Route path="/login" element={<Login />} /><Route path="/" element={<Guard><Projects /></Guard>} /><Route path="/p/:pid" element={<Guard><Board /></Guard>} />
  </Routes></AuthProvider>;
}
