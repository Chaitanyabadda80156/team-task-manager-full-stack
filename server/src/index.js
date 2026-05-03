import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDb } from './db.js';
import router from './routes.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const host = '0.0.0.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.resolve(__dirname, '../../client/dist');

app.use(
  cors({
    origin(origin, callback) {
      const configured = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
      const localDev = /^http:\/\/(localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3}):\d+$/.test(origin || '');
      if (!origin || origin === configured || localDev) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    }
  })
);
app.use(express.json());
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'connecting'
  });
});
app.use('/api', router);
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  return res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong.' });
});

app.listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});

connectDb().catch((error) => {
  console.error('Failed to connect to MongoDB:', error.message);
});
