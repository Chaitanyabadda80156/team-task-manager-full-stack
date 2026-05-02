# Team Task Manager

A full-stack assignment project for managing teams, projects, assigned tasks, and progress with Admin/Member role-based access.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB
- Auth: JWT + bcrypt password hashing
- Validation: Zod

## Quick Start

```bash
npm install
copy server\.env.example server\.env
npm run seed
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:4000/api

For a production-style local run:

```bash
npm run build
npm start
```

Then open http://localhost:4000.

Seeded users:

- Admin: `admin@example.com` / `Admin123!`
- Member: `member@example.com` / `Member123!`

Set your Mongo connection string in `server/.env`:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/team-task-manager
JWT_SECRET=replace-with-a-long-random-secret
```

## Roles

- Admins can create projects, manage team members, create/update/delete any task in their projects, and view all project activity.
- Members can view projects they belong to, see assigned tasks, and update task status for tasks assigned to them.

## API Overview

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/dashboard`
- `GET /api/users`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects/:id/members`
- `DELETE /api/projects/:id/members/:userId`
- `POST /api/projects/:id/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

## Railway Deployment

This repo is configured for a single Railway service. The Express server serves both the REST API and the built React app.

1. Push this project to GitHub.
2. In Railway, create a new project and choose **Deploy from GitHub repo**.
3. Select this repository.
4. Add these Railway variables:

```env
MONGODB_URI=your-mongodb-atlas-url
JWT_SECRET=use-a-long-random-secret
NODE_ENV=production
```

Do not commit `server/.env` to GitHub. Add real credentials only in Railway's **Variables** tab.

5. Deploy and generate a public Railway domain.
6. Open the Railway domain and login with the seeded admin account after running the seed command locally or through Railway CLI.

Railway uses:

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Health check: `/api/health`
