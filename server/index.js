import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './db.js';
import authRoutes from './routes/auth.js';
import saveRoutes from './routes/saves.js';
import leaderboardRoutes from './routes/leaderboard.js';
import { setupSocket } from './socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件
app.use(express.static(path.join(__dirname, '..', 'public')));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/saves', saveRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Socket.io 联机
setupSocket(io);

// 启动
const PORT = process.env.PORT || 3000;
initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`暮色求生服务器运行中: http://localhost:${PORT}`);
  });
});
