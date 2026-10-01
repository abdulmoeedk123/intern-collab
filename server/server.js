import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { Project } from './models.js';
import auth from './routes/auth.js';
import projects from './routes/projects.js';

const app = express(); const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_URL } });
app.set('io', io);
app.use(cors({ origin: process.env.CLIENT_URL })); app.use(express.json());
app.use('/api/auth', auth); app.use('/api/projects', projects);

// Socket auth: same JWT as the REST API
io.use((s, next) => { try { s.userId = jwt.verify(s.handshake.auth.token, process.env.JWT_SECRET).id; next(); } catch { next(new Error('unauthorized')); } });
const online = room => io.sockets.adapter.rooms.get(room)?.size || 0;
io.on('connection', socket => {
  socket.on('project:join', async pid => {
    const ok = await Project.exists({ _id: pid, members: socket.userId }).catch(() => null);
    if (!ok) return;
    socket.join(String(pid)); io.to(String(pid)).emit('presence', online(String(pid)));
  });
  socket.on('disconnecting', () => socket.rooms.forEach(r => r !== socket.id && io.to(r).emit('presence', online(r) - 1)));
});
mongoose.connect(process.env.MONGO_URI).then(() => server.listen(process.env.PORT || 5000, () => console.log('API + sockets running')));
