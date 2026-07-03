// ═══════════════════════════════════════════════════════════
//  入口模块 - 初始化游戏 + 角色/认证 UI
// ═══════════════════════════════════════════════════════════
import { initGame } from './game.js';
import { CHARACTERS } from './characters.js';
import { drawCharacterPreview } from './playerDraw.js';
import { api } from './api.js';

// ── 角色选择卡片 ──
function renderCharacterCards() {
  const container = document.getElementById('char-select');
  container.innerHTML = '';

  CHARACTERS.forEach((char, i) => {
    const card = document.createElement('div');
    card.className = 'char-card' + (i === 0 ? ' selected' : '');
    card.dataset.charId = char.id;
    card.innerHTML = `
      <canvas width="80" height="80"></canvas>
      <div class="char-name">${char.name}</div>
      <div class="char-title">${char.title}</div>
      <div class="char-desc">${char.desc}</div>
      <div class="char-stats">
        <span>❤${char.stats.hp}</span>
        <span>🍖${char.stats.hunger}</span>
        <span>🔮${char.stats.sanity}</span>
      </div>
    `;
    container.appendChild(card);

    // 绘制角色预览
    const cv = card.querySelector('canvas');
    const ctx = cv.getContext('2d');
    ctx.translate(40, 50);
    let t = 0;
    function animate() {
      ctx.clearRect(-40, -50, 80, 80);
      drawCharacterPreview(ctx, 0, 0, char.colors, t);
      t += 0.05;
      if (card.parentNode) requestAnimationFrame(animate);
    }
    animate();

    card.addEventListener('click', () => {
      document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
  });
}

// ── 认证 UI ──
function setupAuth() {
  const status = document.getElementById('auth-status');
  const form = document.getElementById('auth-form');
  const logoutBtn = document.getElementById('auth-logout-btn');

  function updateAuthUI() {
    if (api.isLoggedIn()) {
      status.textContent = `已登录: ${api.getUsername()}`;
      form.style.display = 'none';
      logoutBtn.style.display = 'inline-block';
    } else {
      status.textContent = '未登录';
      form.style.display = 'flex';
      logoutBtn.style.display = 'none';
    }
  }
  updateAuthUI();

  document.getElementById('auth-register-btn').addEventListener('click', async () => {
    const u = document.getElementById('auth-user').value.trim();
    const p = document.getElementById('auth-pass').value;
    if (!u || !p) return;
    try {
      await api.register(u, p);
      updateAuthUI();
    } catch (e) { document.getElementById('auth-status').textContent = e.message; }
  });

  document.getElementById('auth-login-btn').addEventListener('click', async () => {
    const u = document.getElementById('auth-user').value.trim();
    const p = document.getElementById('auth-pass').value;
    if (!u || !p) return;
    try {
      await api.login(u, p);
      updateAuthUI();
    } catch (e) { document.getElementById('auth-status').textContent = e.message; }
  });

  logoutBtn.addEventListener('click', () => {
    api.logout();
    updateAuthUI();
  });
}

// ── 排行榜 UI ──
function setupLeaderboard() {
  const panel = document.getElementById('leaderboard-panel');
  const toggleBtn = document.getElementById('lb-toggle-btn');
  const closeBtn = document.getElementById('lb-close');

  toggleBtn.addEventListener('click', async () => {
    if (panel.classList.contains('show')) {
      panel.classList.remove('show');
      return;
    }
    try {
      const data = await api.getLeaderboard(20);
      const list = document.getElementById('lb-list');
      list.innerHTML = '<div class="lb-row header"><span class="lb-rank">#</span><span class="lb-name">玩家</span><span class="lb-score">分数</span></div>';
      data.leaderboard.forEach((entry, i) => {
        const row = document.createElement('div');
        row.className = 'lb-row';
        row.innerHTML = `<span class="lb-rank">${i+1}</span><span class="lb-name">${entry.username} (${entry.character}) ${entry.days_survived}天/${entry.kills}杀</span><span class="lb-score">${entry.score}</span>`;
        list.appendChild(row);
      });
      panel.classList.add('show');
    } catch (e) {
      alert('获取排行榜失败: ' + e.message);
    }
  });

  closeBtn.addEventListener('click', () => panel.classList.remove('show'));
}

// ── 启动 ──
try { renderCharacterCards(); } catch(e) { console.error('[main] 角色卡片:', e.message); }
try { setupAuth(); } catch(e) { console.error('[main] 认证:', e.message); }
try { setupLeaderboard(); } catch(e) { console.error('[main] 排行榜:', e.message); }
try { initGame(); } catch(e) { console.error('[main] 游戏:', e.message); }
