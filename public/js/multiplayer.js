// ═══════════════════════════════════════════════════════════
//  联机模块 - Socket.io 客户端
//  io 由 /socket.io/socket.io.js 全局提供
// ═══════════════════════════════════════════════════════════
import { api } from './api.js';
import { getCharacter } from './characters.js';

// io 是全局的 (由 <script src="/socket.io/socket.io.js"> 提供)
const ioClient = window.io;

export const multiplayer = {
  socket: null,
  roomId: null,
  isHost: false,
};

export function getSocket() {
  return multiplayer.socket;
}

export function setupMultiplayer(game, socket) {
  if (!socket) return;
  multiplayer.socket = socket;

  // 接收其他玩家移动
  socket.on('player:moved', ({ id, x, y, facing, animT }) => {
    if (!game.otherPlayers) game.otherPlayers = new Map();
    let p = game.otherPlayers.get(id);
    if (!p) {
      p = { id, x, y, facing, animT, moving: true };
      game.otherPlayers.set(id, p);
    } else {
      p.x = x; p.y = y; p.facing = facing; p.animT = animT; p.moving = true;
    }
  });

  // 状态更新
  socket.on('player:stateUpdate', ({ id, hp, hunger, sanity }) => {
    if (!game.otherPlayers) return;
    const p = game.otherPlayers.get(id);
    if (p) { p.hp = hp; p.hunger = hunger; p.sanity = sanity; }
  });

  // 聊天
  socket.on('chat:msg', ({ username, msg }) => {
    addChatMessage(username, msg);
  });

  // 玩家加入/离开
  socket.on('room:updated', ({ room }) => {
    updateRoomDisplay(room);
  });

  // 游戏开始
  socket.on('game:start', ({ players, map }) => {
    // 初始化其他玩家
    if (!game.otherPlayers) game.otherPlayers = new Map();
    for (const p of players) {
      if (p.id !== socket.id) {
        game.otherPlayers.set(p.id, {
          id: p.id, username: p.username, characterId: p.characterId,
          x: p.x, y: p.y, facing: 0, animT: 0, moving: false, hp: p.hp,
        });
      }
    }
  });
}

export function connectMultiplayer() {
  const token = api.getToken() || '';
  const socket = ioClient({ auth: { token } });
  multiplayer.socket = socket;
  return socket;
}

export function createRoom(characterId) {
  const socket = multiplayer.socket || connectMultiplayer();
  multiplayer.socket = socket;
  return new Promise(resolve => {
    socket.on('room:created', ({ roomId }) => {
      multiplayer.roomId = roomId;
      multiplayer.isHost = true;
      resolve(roomId);
    });
    socket.emit('room:create', { characterId });
  });
}

export function joinRoom(roomId, characterId) {
  const socket = multiplayer.socket || connectMultiplayer();
  multiplayer.socket = socket;
  return new Promise(resolve => {
    socket.on('room:error', ({ msg }) => {
      resolve({ error: msg });
    });
    socket.on('room:updated', ({ room }) => {
      multiplayer.roomId = roomId;
      resolve({ room });
    });
    socket.emit('room:join', { roomId, characterId });
  });
}

export function emitMove(x, y, facing, animT) {
  if (!multiplayer.socket || !multiplayer.roomId) return;
  multiplayer.socket.emit('player:move', { x, y, facing, animT });
}

export function sendChat(msg) {
  if (!multiplayer.socket || !multiplayer.roomId) return;
  multiplayer.socket.emit('chat:msg', { msg });
}

function addChatMessage(username, msg) {
  const el = document.getElementById('mp-chat-log');
  if (!el) return;
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.textContent = `${username}: ${msg}`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function updateRoomDisplay(room) {
  const el = document.getElementById('mp-room-info');
  if (!el) return;
  el.innerHTML = room.players.map(p =>
    `<div class="room-player">${p.username} (${p.characterId}) ${p.ready ? '✓' : '...'}${p.id === room.host ? ' [房主]' : ''}</div>`
  ).join('');
}

export function setReady(ready) {
  if (!multiplayer.socket) return;
  multiplayer.socket.emit('room:ready', { ready });
}

export function startGame() {
  if (!multiplayer.socket || !multiplayer.isHost) return;
  multiplayer.socket.emit('room:start');
}
