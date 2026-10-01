import mongoose from 'mongoose';
const { Schema, model } = mongoose; const ref = n => ({ type: Schema.Types.ObjectId, ref: n });
export const User = model('User', new Schema({ name: String, email: { type: String, unique: true }, password: String }, { timestamps: true }));
export const Project = model('Project', new Schema({ name: String, owner: ref('User'), members: [ref('User')] }, { timestamps: true }));
export const Milestone = model('Milestone', new Schema({ project: ref('Project'), title: String, due: Date }, { timestamps: true }));
export const Task = model('Task', new Schema({
  project: ref('Project'), title: String, description: String,
  status: { type: String, enum: ['todo', 'doing', 'done'], default: 'todo' },
  assignee: ref('User'), milestone: { ...ref('Milestone'), default: null },
}, { timestamps: true }));
