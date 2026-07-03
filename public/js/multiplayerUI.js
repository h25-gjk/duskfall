// ═══════════════════════════════════════════════════════════
//  联机UI - 房间创建/加入/大厅
// ═══════════════════════════════════════════════════════════
import { connectMultiplayer, createRoom, joinRoom, setReady, startGame, multiplayer } from './multiplayer.js';
import { newGame } from './game.js';

export function showMultiplayerUI(characterId) {
  let panel = document.getElementById('mp-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'mp-panel';
    panel.className = 'mp-overlay';
    panel.innerHTML = `
      <div class="mp-box">
        <h2>联机大厅</h2>
        <div class="mp-section">
          <button id="mp-create-btn" class="mp-btn">创建房间</button>
        </div>
        <div class="mp-section">
          <input id="mp-room-input" placeholder="输入房间号" maxlength="6" />
          <button id="mp-join-btn" class="mp-btn">加入房间</button>
        </div>
        <div id="mp-room-info" class="mp-room-info" style="display:none">
        </div>
        <div id="mp-chat" class="mp-chat" style="display:none">
          <div id="mp-chat-log"></div>
          <div class="mp-chat-input">
            <input id="mp-chat-text" placeholder="说点什么..." maxlength="100" />
            <button id="mp-chat-send">发送</button>
          </div>
        </div>
        <div class="mp-section" id="mp-actions" style="display:none">
          <button id="mp-ready-btn" class="mp-btn">准备</button>
          <button id="mp-start-btn" class="mp-btn" style="display:none">开始游戏</button>
        </div>
        <button id="mp-back-btn" class="mp-btn-ghost">返回</button>
      </div>
    `;
    document.body.appendChild(panel);

    // 绑定事件
    document.getElementById('mp-create-btn').addEventListener('click', async () => {
      connectMultiplayer();
      const roomId = await createRoom(characterId);
      document.getElementById('mp-room-input').value = roomId;
      document.getElementById('mp-room-info').style.display = 'block';
      document.getElementById('mp-chat').style.display = 'block';
      document.getElementById('mp-actions').style.display = 'block';
      document.getElementById('mp-start-btn').style.display = multiplayer.isHost ? 'inline-block' : 'none';
      document.getElementById('mp-create-btn').disabled = true;
    });

    document.getElementById('mp-join-btn').addEventListener('click', async () => {
      const roomId = document.getElementById('mp-room-input').value.trim().toUpperCase();
      if (!roomId) return;
      connectMultiplayer();
      const result = await joinRoom(roomId, characterId);
      if (result.error) {
        alert(result.error);
      } else {
        document.getElementById('mp-room-info').style.display = 'block';
        document.getElementById('mp-chat').style.display = 'block';
        document.getElementById('mp-actions').style.display = 'block';
        document.getElementById('mp-start-btn').style.display = 'none';
      }
    });

    document.getElementById('mp-ready-btn').addEventListener('click', () => {
      setReady(true);
      document.getElementById('mp-ready-btn').textContent = '已准备 ✓';
      document.getElementById('mp-ready-btn').disabled = true;
    });

    document.getElementById('mp-start-btn').addEventListener('click', () => {
      startGame();
      panel.remove();
      newGame(characterId, true);
      document.getElementById('overlay').classList.add('hide');
    });

    // 监听游戏开始 (非房主)
    multiplayer.socket = multiplayer.socket || connectMultiplayer();
    multiplayer.socket.on('game:start', () => {
      panel.remove();
      newGame(characterId, true);
      document.getElementById('overlay').classList.add('hide');
    });

    document.getElementById('mp-chat-send').addEventListener('click', () => {
      const input = document.getElementById('mp-chat-text');
      if (input.value.trim()) {
        multiplayer.socket.emit('chat:msg', { msg: input.value.trim() });
        input.value = '';
      }
    });
    document.getElementById('mp-chat-text').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('mp-chat-send').click();
    });

    document.getElementById('mp-back-btn').addEventListener('click', () => {
      panel.remove();
    });
  }
  panel.style.display = 'flex';
}
