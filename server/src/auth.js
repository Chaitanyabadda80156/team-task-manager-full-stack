import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Project, User, publicUser } from './db.js';

const jwtSecret = process.env.JWT_SECRET || 'development-secret-change-me';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' });
}

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: 'Invalid session.' });
    req.user = publicUser(user);
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  return next();
}

export function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

export async function canAccessProject(userId, role, projectId) {
  if (!isObjectId(projectId) || !isObjectId(userId)) return false;
  const query =
    role === 'Admin'
      ? { _id: projectId, $or: [{ owner: userId }, { members: userId }] }
      : { _id: projectId, members: userId };
  return Boolean(await Project.exists(query));
}

export async function canManageProject(userId, projectId) {
  if (!isObjectId(projectId) || !isObjectId(userId)) return false;
  return Boolean(await Project.exists({ _id: projectId, owner: userId }));
}
