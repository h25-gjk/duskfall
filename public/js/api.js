// ═══════════════════════════════════════════════════════════
//  API 客户端 - 与后端通信
// ═══════════════════════════════════════════════════════════

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('duskfall_token');
}
function setToken(token) {
  localStorage.setItem('duskfall_token', token);
}
function getUsername() {
  return localStorage.getItem('duskfall_username');
}
function setUsername(name) {
  localStorage.setItem('duskfall_username', name);
}

async function request(path, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : null,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

export const api = {
  // 认证
  async register(username, password) {
    const data = await request('/auth/register', 'POST', { username, password });
    setToken(data.token); setUsername(data.user.username);
    return data;
  },
  async login(username, password) {
    const data = await request('/auth/login', 'POST', { username, password });
    setToken(data.token); setUsername(data.user.username);
    return data;
  },
  logout() {
    localStorage.removeItem('duskfall_token');
    localStorage.removeItem('duskfall_username');
  },
  isLoggedIn() { return !!getToken(); },
  getUsername() { return getUsername(); },
  getToken() { return getToken(); },

  // 存档
  async getSave() { return request('/saves'); },
  async saveGame(save) { return request('/saves', 'POST', { save }); },
  async deleteSave() { return request('/saves', 'DELETE'); },

  // 排行榜
  async submitScore(character, daysSurvived, kills) {
    return request('/leaderboard/submit', 'POST', { character, daysSurvived, kills });
  },
  async getLeaderboard(limit = 20) {
    return request(`/leaderboard?limit=${limit}`);
  },
  async getBestScore() { return request('/leaderboard/best'); },
};
