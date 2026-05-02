import bcrypt from 'bcryptjs';
import express from 'express';
import { authenticate, canAccessProject, canManageProject, isObjectId, requireAdmin, signToken } from './auth.js';
import { Project, Task, User, publicUser, shapeProject, shapeTask } from './db.js';
import {
  loginSchema,
  memberSchema,
  projectSchema,
  signupSchema,
  taskSchema,
  taskUpdateSchema,
  validate
} from './validation.js';

const router = express.Router();

const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

async function loadProjectMembers(projectId) {
  const project = await Project.findById(projectId).populate('members', 'name email role').lean();
  return (project?.members || [])
    .map(publicUser)
    .sort((first, second) => first.name.localeCompare(second.name));
}

async function ensureProjectAccess(req, res, next) {
  const projectId = req.params.id;
  if (!isObjectId(projectId)) return res.status(400).json({ message: 'Invalid project id.' });
  if (!(await canAccessProject(req.user.id, req.user.role, projectId))) {
    return res.status(403).json({ message: 'You do not have access to this project.' });
  }
  req.projectId = projectId;
  return next();
}

async function ensureProjectManager(req, res, next) {
  const projectId = req.params.id;
  if (!isObjectId(projectId)) return res.status(400).json({ message: 'Invalid project id.' });
  if (!(await canManageProject(req.user.id, projectId))) {
    return res.status(403).json({ message: 'Only the project admin can manage this project.' });
  }
  req.projectId = projectId;
  return next();
}

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

router.post(
  '/auth/signup',
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.validated;
    const exists = await User.exists({ email });
    if (exists) return res.status(409).json({ message: 'Email is already registered.' });

    const passwordHash = bcrypt.hashSync(password, 12);
    const userDoc = await User.create({ name, email, passwordHash, role });
    const user = publicUser(userDoc);

    res.status(201).json({ user, token: signToken(user) });
  })
);

router.post(
  '/auth/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.validated;
    const userDoc = await User.findOne({ email });
    if (!userDoc || !bcrypt.compareSync(password, userDoc.passwordHash)) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = publicUser(userDoc);
    res.json({ user, token: signToken(user) });
  })
);

router.use(authenticate);

router.get('/me', (req, res) => {
  res.json({ user: req.user });
});

router.get(
  '/users',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ name: 1 }).lean();
    res.json({ users: users.map(publicUser) });
  })
);

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const projectFilter = req.user.role === 'Admin' ? { owner: req.user.id } : { members: req.user.id };
    const taskFilter = req.user.role === 'Admin' ? {} : { assignee: req.user.id };

    const projects = await Project.find(projectFilter).select('_id').lean();
    const projectIds = projects.map((project) => project._id);
    const scopedTaskFilter = req.user.role === 'Admin' ? { project: { $in: projectIds } } : taskFilter;

    const tasks = await Task.find(scopedTaskFilter)
      .populate('project', 'name')
      .populate('assignee', 'name email')
      .sort({ dueDate: 1, priority: -1 })
      .limit(8)
      .lean();

    const allTasks = await Task.find(scopedTaskFilter).select('status dueDate').lean();
    const stats = {
      total: allTasks.length,
      todo: allTasks.filter((task) => task.status === 'Todo').length,
      inProgress: allTasks.filter((task) => task.status === 'In Progress').length,
      done: allTasks.filter((task) => task.status === 'Done').length,
      overdue: allTasks.filter((task) => task.status !== 'Done' && task.dueDate < today).length
    };

    res.json({ projectCount: projects.length, stats, tasks: tasks.map(shapeTask) });
  })
);

router.get(
  '/projects',
  asyncHandler(async (req, res) => {
    const filter = req.user.role === 'Admin' ? { owner: req.user.id } : { members: req.user.id };
    const projects = await Project.find(filter)
      .populate('owner', 'name')
      .populate('members', '_id')
      .sort({ createdAt: -1 })
      .lean();
    const taskCounts = await Task.aggregate([
      { $match: { project: { $in: projects.map((project) => project._id) } } },
      { $group: { _id: '$project', count: { $sum: 1 } } }
    ]);
    const countMap = new Map(taskCounts.map((item) => [item._id.toString(), item.count]));

    res.json({ projects: projects.map((project) => shapeProject(project, countMap.get(project._id.toString()) || 0)) });
  })
);

router.post(
  '/projects',
  requireAdmin,
  validate(projectSchema),
  asyncHandler(async (req, res) => {
    const { name, description } = req.validated;
    const project = await Project.create({
      name,
      description,
      owner: req.user.id,
      members: [req.user.id]
    });
    res.status(201).json({ project: shapeProject(project) });
  })
);

router.get(
  '/projects/:id',
  asyncHandler(ensureProjectAccess),
  asyncHandler(async (req, res) => {
    const project = await Project.findById(req.projectId).populate('owner', 'name').populate('members', 'name email role').lean();
    const tasks = await Task.find({ project: req.projectId })
      .populate('project', 'name')
      .populate('assignee', 'name email')
      .sort({ dueDate: 1 })
      .lean();
    res.json({
      project: shapeProject(project),
      members: (project.members || []).map(publicUser),
      tasks: tasks.map(shapeTask)
    });
  })
);

router.post(
  '/projects/:id/members',
  asyncHandler(ensureProjectManager),
  validate(memberSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req.validated;
    const user = await User.exists({ _id: userId });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    await Project.updateOne({ _id: req.projectId }, { $addToSet: { members: userId } });
    res.status(201).json({ members: await loadProjectMembers(req.projectId) });
  })
);

router.delete(
  '/projects/:id/members/:userId',
  asyncHandler(ensureProjectManager),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!isObjectId(userId)) return res.status(400).json({ message: 'Invalid user id.' });
    if (userId === req.user.id) return res.status(400).json({ message: 'Project owner cannot be removed.' });

    await Project.updateOne({ _id: req.projectId }, { $pull: { members: userId } });
    await Task.updateMany({ project: req.projectId, assignee: userId }, { $set: { assignee: null } });
    res.json({ members: await loadProjectMembers(req.projectId) });
  })
);

router.post(
  '/projects/:id/tasks',
  asyncHandler(ensureProjectManager),
  validate(taskSchema),
  asyncHandler(async (req, res) => {
    const { title, description, assigneeId, status, priority, dueDate } = req.validated;
    if (assigneeId && !(await canAccessProject(assigneeId, 'Member', req.projectId))) {
      return res.status(400).json({ message: 'Assignee must be a project member.' });
    }

    const task = await Task.create({
      project: req.projectId,
      title,
      description,
      assignee: assigneeId || null,
      status,
      priority,
      dueDate,
      createdBy: req.user.id
    });
    const populated = await Task.findById(task._id).populate('project', 'name').populate('assignee', 'name email').lean();
    res.status(201).json({ task: shapeTask(populated) });
  })
);

router.patch(
  '/tasks/:id',
  validate(taskUpdateSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ message: 'Invalid task id.' });

    const existing = await Task.findById(id).lean();
    if (!existing) return res.status(404).json({ message: 'Task not found.' });

    const projectId = existing.project.toString();
    const isManager = await canManageProject(req.user.id, projectId);
    const isAssignee = existing.assignee?.toString() === req.user.id;
    if (!isManager && !isAssignee) {
      return res.status(403).json({ message: 'You can only update tasks assigned to you.' });
    }

    const allowed = isManager ? req.validated : { status: req.validated.status };
    if (!isManager && !allowed.status) {
      return res.status(403).json({ message: 'Members can only update task status.' });
    }
    if (allowed.assigneeId && !(await canAccessProject(allowed.assigneeId, 'Member', projectId))) {
      return res.status(400).json({ message: 'Assignee must be a project member.' });
    }

    const update = {};
    if (allowed.title !== undefined) update.title = allowed.title;
    if (allowed.description !== undefined) update.description = allowed.description;
    if (Object.prototype.hasOwnProperty.call(allowed, 'assigneeId')) update.assignee = allowed.assigneeId || null;
    if (allowed.status !== undefined) update.status = allowed.status;
    if (allowed.priority !== undefined) update.priority = allowed.priority;
    if (allowed.dueDate !== undefined) update.dueDate = allowed.dueDate;

    const task = await Task.findByIdAndUpdate(id, update, { new: true })
      .populate('project', 'name')
      .populate('assignee', 'name email')
      .lean();

    res.json({ task: shapeTask(task) });
  })
);

router.delete(
  '/tasks/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ message: 'Invalid task id.' });

    const task = await Task.findById(id).lean();
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!(await canManageProject(req.user.id, task.project.toString()))) {
      return res.status(403).json({ message: 'Only the project admin can delete tasks.' });
    }

    await Task.deleteOne({ _id: id });
    res.status(204).send();
  })
);

export default router;
