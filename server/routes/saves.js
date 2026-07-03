import express from 'express';
import { dbApi } from '../db.js';
import { authMiddleware } from './auth.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const save = await dbApi.get('SELECT data FROM saves WHERE user_id = $1', [req.user.id]);
  res.json({ save: save ? JSON.parse(save.data) : null });
});

router.post('/', authMiddleware, async (req, res) => {
  const { save } = req.body;
  if (!save) return res.status(400).json({ error: '存档数据为空' });
  // upsert: INSERT ... ON CONFLICT
  await dbApi.run(
    `INSERT INTO saves (user_id, data, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
    [req.user.id, JSON.stringify(save)]
  );
  res.json({ ok: true });
});

router.delete('/', authMiddleware, async (req, res) => {
  await dbApi.run('DELETE FROM saves WHERE user_id = $1', [req.user.id]);
  res.json({ ok: true });
});

export default router;
