import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { dbApi } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'duskfall-dev-secret-change-in-production';
const JWT_EXPIRES = '7d';

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: '登录已过期' });
  }
}

import express from 'express';
const router = express.Router();

// 注册
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: '用户名2-20字符' });
  if (password.length < 4) return res.status(400).json({ error: '密码至少4位' });

  const existing = await dbApi.get('SELECT id FROM users WHERE username = $1', [username]);
  if (existing) return res.status(409).json({ error: '用户名已存在' });

  const hashed = bcrypt.hashSync(password, 10);
  const result = await dbApi.run(
    'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
    [username, hashed]
  );
  const token = jwt.sign({ id: result.lastInsertRowid, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: { id: result.lastInsertRowid, username } });
});

// 登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

  const user = await dbApi.get('SELECT * FROM users WHERE username = $1', [username]);
  if (!user) return res.status(401).json({ error: '用户不存在' });
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: '密码错误' });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: { id: user.id, username: user.username } });
});

export default router;
