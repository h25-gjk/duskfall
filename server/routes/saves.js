import express from 'express';
import { dbApi } from '../db.js';
import { authMiddleware } from './auth.js';

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const save = dbApi.get('SELECT data FROM saves WHERE user_id = ?', [req.user.id]);
  res.json({ save: save ? JSON.parse(save.data) : null });
});

router.post('/', authMiddleware, (req, res) => {
  const { save } = req.body;
  if (!save) return res.status(400).json({ error: '存档数据为空' });
  // 简单 upsert: 先尝试删再插
  dbApi.run('DELETE FROM saves WHERE user_id = ?', [req.user.id]);
  dbApi.run('INSERT INTO saves (user_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [req.user.id, JSON.stringify(save)]);
  res.json({ ok: true });
});

router.delete('/', authMiddleware, (req, res) => {
  dbApi.run('DELETE FROM saves WHERE user_id = ?', [req.user.id]);
  res.json({ ok: true });
});

export default router;
