// ═══════════════════════════════════════════════════════════
//  数据库 - 用 sql.js (纯WASM SQLite, 无需原生编译)
// ═══════════════════════════════════════════════════════════
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;
let dbPath = null;

export async function initDB() {
  const SQL = await initSqlJs();
  // 云端用 /tmp 或项目 data 目录, 本地用项目 data 目录
  const dir = process.env.DB_DIR || path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch(e) {}
  }
  dbPath = path.join(dir, 'duskfall.db');
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(new Uint8Array(buffer));
  } else {
    db = new SQL.Database();
  }

  // 建表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS saves (
      user_id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      character TEXT NOT NULL,
      days_survived INTEGER NOT NULL,
      kills INTEGER NOT NULL,
      score INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  console.log('数据库初始化完成');
}

// 保存数据库到文件
function persist() {
  if (!db || !dbPath) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// 封装查询: 返回对象数组
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// 封装: 返回单行
function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

// 封装: 执行写操作并持久化
function run(sql, params = []) {
  db.run(sql, params);
  persist();
  return { lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0]?.values?.[0]?.[0] };
}

export const dbApi = { all, get, run, persist };
