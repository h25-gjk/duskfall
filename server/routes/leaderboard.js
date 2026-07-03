import express from 'express';
import { dbApi } from '../db.js';
import { authMiddleware } from './auth.js';

const router = express.Router();

router.post('/submit', authMiddleware, (req, res) => {
  const { character, daysSurvived, kills } = req.body;
  if (!character || daysSurvived == null || kills == null) {
    return res.status(400).json({ error: '参数不完整' });
  }
  const score = daysSurvived * 100 + kills * 10;
  dbApi.run(
    'INSERT INTO leaderboard (user_id, username, character, days_survived, kills, score) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, req.user.username, character, daysSurvived, kills, score]
  );
  res.json({ ok: true, score });
});

router.get('/', (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const rows = dbApi.all(
    'SELECT username, character, days_survived, kills, score, created_at FROM leaderboard ORDER BY score DESC LIMIT ?',
    [limit]
  );
  res.json({ leaderboard: rows });
});

router.get('/best', authMiddleware, (req, res) => {
  const best = dbApi.get(
    'SELECT * FROM leaderboard WHERE user_id = ? ORDER BY score DESC LIMIT 1',
    [req.user.id]
  );
  res.json({ best: best || null });
});

export default router;
