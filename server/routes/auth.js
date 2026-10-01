import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models.js';
import { protect } from '../middleware/auth.js';
const r = Router();
const out = u => ({ token: jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' }), user: { id: u._id, name: u.name, email: u.email } });
r.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || (password || '').length < 6) return res.status(400).json({ message: 'Enter a name, email and a password of 6+ characters.' });
  if (await User.findOne({ email })) return res.status(409).json({ message: 'That email is already registered.' });
  res.status(201).json(out(await User.create({ name, email, password: await bcrypt.hash(password, 10) })));
});
r.post('/login', async (req, res) => {
  const u = await User.findOne({ email: req.body.email });
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password))) return res.status(401).json({ message: 'Email or password is incorrect.' });
  res.json(out(u));
});
r.get('/me', protect, (req, res) => res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email } }));
export default r;
