import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/team-task-manager';

export async function connectDb() {
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 15000
  });
  console.log('MongoDB connected');
}

function toId(value) {
  return value?._id?.toString() || value?.toString() || null;
}

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['Admin', 'Member'], required: true, default: 'Member' }
  },
  { timestamps: true }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

const taskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['Todo', 'In Progress', 'Done'], default: 'Todo' },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    dueDate: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
export const Project = mongoose.model('Project', projectSchema);
export const Task = mongoose.model('Task', taskSchema);

export function publicUser(user) {
  if (!user) return null;
  return {
    id: toId(user),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

export function shapeProject(project, taskCount = 0) {
  return {
    id: toId(project),
    _id: toId(project),
    name: project.name,
    description: project.description,
    owner_id: toId(project.owner?._id || project.owner),
    owner_name: project.owner?.name,
    member_count: project.members?.length || 0,
    task_count: taskCount,
    created_at: project.createdAt
  };
}

export function shapeTask(task) {
  return {
    id: toId(task),
    projectId: toId(task.project?._id || task.project),
    projectName: task.project?.name,
    title: task.title,
    description: task.description,
    assigneeId: toId(task.assignee?._id || task.assignee),
    assigneeName: task.assignee?.name,
    assigneeEmail: task.assignee?.email,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    createdBy: toId(task.createdBy?._id || task.createdBy),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}
