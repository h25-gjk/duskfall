// Socket.io 联机系统
// 房间机制: 每个房间最多4人, 共享一张地图, 实时同步位置/状态

const rooms = new Map(); // roomId -> { players: Map, map: null, started: false }

function genRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function setupSocket(io) {
  // 中间件: 从握手 token 提取用户名
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      socket.data.username = `游客${Math.floor(Math.random()*1000)}`;
    } else {
      try {
        // 简单解析 JWT payload (不验证签名, 联机不需要强安全)
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        socket.data.username = payload.username || '玩家';
        socket.data.userId = payload.id;
      } catch {
        socket.data.username = `游客${Math.floor(Math.random()*1000)}`;
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[联机] ${socket.data.username} 已连接`);

    // 创建房间
    socket.on('room:create', ({ characterId }) => {
      const roomId = genRoomId();
      const room = {
        id: roomId,
        host: socket.id,
        players: new Map(),
        map: null,
        started: false,
      };
      room.players.set(socket.id, {
        id: socket.id,
        username: socket.data.username,
        characterId,
        x: 32 * 32 + 16,
        y: 32 * 32 + 16,
        hp: 100,
        ready: false,
      });
      rooms.set(roomId, room);
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.emit('room:created', { roomId, room: serializeRoom(room) });
      console.log(`[联机] 房间 ${roomId} 已创建`);
    });

    // 加入房间
    socket.on('room:join', ({ roomId, characterId }) => {
      const room = rooms.get(roomId);
      if (!room) return socket.emit('room:error', { msg: '房间不存在' });
      if (room.players.size >= 4) return socket.emit('room:error', { msg: '房间已满(4人)' });
      if (room.started) return socket.emit('room:error', { msg: '游戏已开始' });

      room.players.set(socket.id, {
        id: socket.id,
        username: socket.data.username,
        characterId,
        x: 32 * 32 + 16 + room.players.size * 40,
        y: 32 * 32 + 16,
        hp: 100,
        ready: false,
      });
      socket.join(roomId);
      socket.data.roomId = roomId;
      io.to(roomId).emit('room:updated', { room: serializeRoom(room) });
      console.log(`[联机] ${socket.data.username} 加入房间 ${roomId}`);
    });

    // 准备
    socket.on('room:ready', ({ ready }) => {
      const room = rooms.get(socket.data.roomId);
      if (!room) return;
      const p = room.players.get(socket.id);
      if (p) p.ready = ready;
      io.to(roomId).emit('room:updated', { room: serializeRoom(room) });
    });

    // 开始游戏 (仅房主)
    socket.on('room:start', () => {
      const room = rooms.get(socket.data.roomId);
      if (!room || socket.id !== room.host) return;
      room.started = true;
      io.to(room.id).emit('game:start', {
        players: [...room.players.values()],
        map: room.map,
      });
      console.log(`[联机] 房间 ${room.id} 游戏开始`);
    });

    // 实时位置同步
    socket.on('player:move', ({ x, y, facing, animT }) => {
      const room = rooms.get(socket.data.roomId);
      if (!room) return;
      const p = room.players.get(socket.id);
      if (p) {
        p.x = x; p.y = y; p.facing = facing; p.animT = animT;
      }
      // 广播给房间内其他人 (高频, 不存全量)
      socket.to(room.id).emit('player:moved', {
        id: socket.id,
        x, y, facing, animT,
      });
    });

    // 状态更新 (血量/采集等, 低频)
    socket.on('player:state', ({ hp, hunger, sanity, inv }) => {
      const room = rooms.get(socket.data.roomId);
      if (!room) return;
      const p = room.players.get(socket.id);
      if (p) {
        p.hp = hp;
        if (inv) p.inv = inv;
      }
      socket.to(room.id).emit('player:stateUpdate', {
        id: socket.id, hp, hunger, sanity,
      });
    });

    // 聊天
    socket.on('chat:msg', ({ msg }) => {
      const room = rooms.get(socket.data.roomId);
      if (!room) return;
      io.to(room.id).emit('chat:msg', {
        username: socket.data.username,
        msg: String(msg).slice(0, 100),
      });
    });

    // 断开连接
    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (room) {
        room.players.delete(socket.id);
        if (room.players.size === 0) {
          rooms.delete(roomId);
          console.log(`[联机] 房间 ${roomId} 已销毁`);
        } else {
          // 房主转移
          if (socket.id === room.host) {
            room.host = [...room.players.keys()][0];
          }
          io.to(roomId).emit('room:updated', { room: serializeRoom(room) });
        }
      }
      console.log(`[联机] ${socket.data.username} 断开`);
    });
  });
}

function serializeRoom(room) {
  return {
    id: room.id,
    host: room.host,
    started: room.started,
    players: [...room.players.values()].map(p => ({
      id: p.id,
      username: p.username,
      characterId: p.characterId,
      ready: p.ready,
      hp: p.hp,
    })),
  };
}
