import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Project, Task, User, connectDb } from './db.js';

await connectDb();

const hash = (password) => bcrypt.hashSync(password, 12);

await Promise.all([Task.deleteMany({}), Project.deleteMany({}), User.deleteMany({})]);

const [admin, member, secondMember] = await User.create([
  { name: 'Avery Admin', email: 'admin@example.com', passwordHash: hash('Admin123!'), role: 'Admin' },
  { name: 'Mina Member', email: 'member@example.com', passwordHash: hash('Member123!'), role: 'Member' },
  { name: 'Dev Patel', email: 'dev@example.com', passwordHash: hash('Member123!'), role: 'Member' }
]);

const [project, mobileProject] = await Project.create([
  {
    name: 'Website Launch',
    description: 'Coordinate design, content, QA, and release tasks for the new marketing site.',
    owner: admin._id,
    members: [admin._id, member._id, secondMember._id]
  },
  {
    name: 'Mobile Sprint',
    description: 'Ship the first version of the mobile task flow.',
    owner: admin._id,
    members: [admin._id, member._id]
  }
]);

await Task.create([
  {
    project: project._id,
    title: 'Finalize landing page copy',
    description: 'Review headlines, CTA text, and legal footer copy.',
    assignee: member._id,
    status: 'In Progress',
    priority: 'High',
    dueDate: '2026-05-05',
    createdBy: admin._id
  },
  {
    project: project._id,
    title: 'QA responsive layouts',
    description: 'Check dashboard, auth screens, and project detail flows on mobile.',
    assignee: secondMember._id,
    status: 'Todo',
    priority: 'Medium',
    dueDate: '2026-05-08',
    createdBy: admin._id
  },
  {
    project: project._id,
    title: 'Publish release checklist',
    description: 'Confirm analytics, backups, DNS, and rollback notes.',
    assignee: admin._id,
    status: 'Todo',
    priority: 'High',
    dueDate: '2026-05-01',
    createdBy: admin._id
  },
  {
    project: mobileProject._id,
    title: 'Implement task status control',
    description: 'Allow members to move assigned work from todo to done.',
    assignee: member._id,
    status: 'Done',
    priority: 'Medium',
    dueDate: '2026-04-28',
    createdBy: admin._id
  }
]);

console.log('MongoDB database seeded.');
await mongoose.disconnect();
