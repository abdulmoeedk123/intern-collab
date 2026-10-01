import jwt from 'jsonwebtoken';
import { User } from '../models.js';
export async function protect(req, res, next) {
  try {
    const { id } = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET);
    req.user = await User.findById(id).select('-password'); if (!req.user) throw 0; next();
  } catch { res.status(401).json({ message: 'Please sign in to continue.' }); }
}
