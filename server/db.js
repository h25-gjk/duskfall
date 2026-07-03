// ═══════════════════════════════════════════════════════════
//  数据库 - PostgreSQL (Render 持久化)
// ═══════════════════════════════════════════════════════════
import pg from 'pg';

const { Pool } = pg;
let pool = null;

export async function initDB() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    throw new Error('DATABASE_URL 环境变量未设置');
  }

  pool = new Pool({
    connectionString: connStr,
    // Render 的 PostgreSQL 可能需要 SSL
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  // 测试连接
  const client = await pool.connect();
  console.log('PostgreSQL 连接成功');

  // 建表
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS saves (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      character TEXT NOT NULL,
      days_survived INTEGER NOT NULL,
      kills INTEGER NOT NULL,
      score INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  client.release();
  console.log('数据库初始化完成 (PostgreSQL)');
  return Promise.resolve();
}

// 查询: 返回行数组
async function all(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}

// 查询: 返回单行
async function get(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows[0] || null;
}

// 执行写操作
async function run(sql, params = []) {
  const res = await pool.query(sql, params);
  return { lastInsertRowid: res.rows[0]?.id || res.insertId || null };
}

export const dbApi = { all, get, run };
