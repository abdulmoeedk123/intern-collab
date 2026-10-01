import { Router } from 'express';
import { Project, Task, Milestone, User } from '../models.js';
import { protect } from '../middleware/auth.js';
const r = Router(); r.use(protect);
const emit = (req, pid, ev, data) => req.app.get('io').to(String(pid)).emit(ev, data);

r.get('/', async (req, res) => res.json(await Project.find({ members: req.user._id }).sort('-createdAt')));
r.post('/', async (req, res) => {
  if (!req.body.name?.trim()) return res.status(400).json({ message: 'Give the project a name.' });
  res.status(201).json(await Project.create({ name: req.body.name.trim(), owner: req.user._id, members: [req.user._id] }));
});

// Every route below requires the caller to be a project member.
r.use('/:pid', async (req, res, next) => {
  try { req.project = await Project.findOne({ _id: req.params.pid, members: req.user._id }); } catch {}
  req.project ? next() : res.status(404).json({ message: 'Project not found.' });
});
r.get('/:pid', async (req, res) => {
  const [project, tasks, milestones] = await Promise.all([
    Project.findById(req.params.pid).populate('members', 'name email'),
    Task.find({ project: req.params.pid }).sort('createdAt'), Milestone.find({ project: req.params.pid }).sort('due')]);
  res.json({ project, tasks, milestones });
});
r.post('/:pid/members', async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase().trim() });
  if (!u) return res.status(404).json({ message: 'No intern with that email has signed up yet.' });
  await Project.updateOne({ _id: req.params.pid }, { $addToSet: { members: u._id } });
  const project = await Project.findById(req.params.pid).populate('members', 'name email');
  emit(req, req.params.pid, 'project:updated', project); res.json(project);
});
const fields = b => Object.fromEntries(['title', 'description', 'status', 'assignee', 'milestone'].filter(k => k in b).map(k => [k, b[k] || (k === 'title' ? b[k] : null)]));
r.post('/:pid/tasks', async (req, res) => {
  if (!req.body.title?.trim()) return res.status(400).json({ message: 'Give the task a title.' });
  const t = await Task.create({ ...fields(req.body), project: req.params.pid });
  emit(req, req.params.pid, 'task:upsert', t); res.status(201).json(t);
});
r.patch('/:pid/tasks/:tid', async (req, res) => {
  const t = await Task.findOneAndUpdate({ _id: req.params.tid, project: req.params.pid }, fields(req.body), { new: true, runValidators: true });
  if (!t) return res.status(404).json({ message: 'Task not found.' });
  emit(req, req.params.pid, 'task:upsert', t); res.json(t);
});
r.delete('/:pid/tasks/:tid', async (req, res) => {
  await Task.deleteOne({ _id: req.params.tid, project: req.params.pid });
  emit(req, req.params.pid, 'task:removed', req.params.tid); res.json({ ok: true });
});
r.post('/:pid/milestones', async (req, res) => {
  if (!req.body.title?.trim()) return res.status(400).json({ message: 'Give the milestone a title.' });
  const m = await Milestone.create({ project: req.params.pid, title: req.body.title.trim(), due: req.body.due || null });
  emit(req, req.params.pid, 'milestone:upsert', m); res.status(201).json(m);
});
r.delete('/:pid/milestones/:mid', async (req, res) => {
  await Milestone.deleteOne({ _id: req.params.mid, project: req.params.pid });
  await Task.updateMany({ milestone: req.params.mid }, { milestone: null });
  emit(req, req.params.pid, 'milestone:removed', req.params.mid); res.json({ ok: true });
});
export default r;
