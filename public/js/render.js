// ═══════════════════════════════════════════════════════════
//  渲染模块 - 地形/实体/角色/光照
// ═══════════════════════════════════════════════════════════
import { TILE, T } from './mapgen.js';
import { drawHumanoid } from './playerDraw.js';

export function render(ctx, game, cam, VW, VH) {
  const w = VW, h = VH;
  ctx.clearRect(0, 0, w, h);

  if (!game.map || game.map.length === 0) {
    ctx.fillStyle = '#060814';
    ctx.fillRect(0, 0, w, h);
    return;
  }

  ctx.save();
  ctx.translate(w / 2 - cam.x, h / 2 - cam.y);

  // 可见范围
  const x0 = Math.max(0, Math.floor((cam.x - w / 2) / TILE) - 1);
  const x1 = Math.min(game.mapW, Math.ceil((cam.x + w / 2) / TILE) + 1);
  const y0 = Math.max(0, Math.floor((cam.y - h / 2) / TILE) - 1);
  const y1 = Math.min(game.mapH, Math.ceil((cam.y + h / 2) / TILE) + 1);

  // ── 地面 ──
  for (let y = y0; y < y1; y++) {
    if (!game.map[y]) continue;
    for (let x = x0; x < x1; x++) {
      drawTile(ctx, game.map, game.resData, x, y);
    }
  }

  // ── 家建筑 ──
  if (game.home) drawHome(ctx, game.home);

  // 地标建筑
  if (game.landmarks) for (const lm of game.landmarks) drawLandmark(ctx, lm);

  // 实体 (篝火/暗影)
  for (const e of game.entities) drawEntity(ctx, e);

  // ── 其他玩家 (联机) ──
  if (game.otherPlayers) {
    for (const p of game.otherPlayers.values()) {
      if (p.characterId && p.x != null) {
        const colors = game.getCharacterColors(p.characterId);
        drawHumanoid(ctx, p.x, p.y, p.facing || 0, p.animT || 0, colors, p.moving);
        // 名字
        ctx.fillStyle = 'rgba(232,213,176,.6)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.username, p.x, p.y - 20);
      }
    }
  }

  // ── 玩家 ──
  if (game.player) {
    drawHumanoid(ctx, game.player.x, game.player.y,
      game.player.facing, game.player.animT,
      game.player.colors, game.player.isMoving);
  }

  // ── 粒子 ──
  for (const p of game.particles) drawParticle(ctx, p);

  // ── 放置预览 ──
  if (game.placeMode) drawPlacementPreview(ctx, game, cam, w, h);

  ctx.restore();

  // ── 光照覆盖 ──
  renderLighting(ctx, game, cam, w, h);

  // ── 受伤红屏 ──
  if (game.damageFlash > 0) {
    ctx.fillStyle = `rgba(180,40,40,${game.damageFlash * 0.4})`;
    ctx.fillRect(0, 0, w, h);
  }

  // ── 触屏 UI (最上层, 不被光照遮挡) ──
  drawTouchUIAfterLighting(ctx, game, w, h);
}

function drawTile(ctx, map, resData, x, y) {
  const t = map[y][x];
  const rd = resData[y] ? resData[y][x] : null;
  const px = x * TILE, py = y * TILE;

  // 底色
  switch (t) {
    case T.GRASS: case T.STUMP: case T.DEADROCK: case T.FLOWER: case T.MUSHROOM: {
      const shade = ((x * 7 + y * 13) % 5) * 2;
      ctx.fillStyle = `rgb(${28 + shade},${32 + shade},${24 + shade})`;
      ctx.fillRect(px, py, TILE, TILE);
      // 草点
      ctx.fillStyle = 'rgba(60,68,40,.12)';
      ctx.fillRect(px + 4, py + 6, 2, 2);
      ctx.fillRect(px + 18, py + 14, 2, 2);
      ctx.fillRect(px + 10, py + 22, 2, 2);
      break;
    }
    case T.PATH: {
      ctx.fillStyle = '#3a3630';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(80,70,50,.15)';
      ctx.fillRect(px + 6, py + 8, 3, 2);
      ctx.fillRect(px + 16, py + 18, 3, 2);
      break;
    }
    case T.GRAVEL: {
      ctx.fillStyle = '#383840';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#48484e';
      ctx.fillRect(px + 4, py + 6, 3, 3);
      ctx.fillRect(px + 18, py + 10, 4, 3);
      ctx.fillRect(px + 10, py + 20, 3, 2);
      ctx.fillStyle = '#2a2a30';
      ctx.fillRect(px + 14, py + 4, 2, 2);
      ctx.fillRect(px + 22, py + 22, 2, 2);
      break;
    }
    case T.SAND: {
      ctx.fillStyle = '#4a4030';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(100,88,60,.15)';
      ctx.fillRect(px + 6, py + 10, 2, 1);
      ctx.fillRect(px + 20, py + 18, 2, 1);
      break;
    }
    case T.WATER: {
      ctx.fillStyle = '#1a2a4a';
      ctx.fillRect(px, py, TILE, TILE);
      const t2 = performance.now() / 500;
      ctx.fillStyle = `rgba(80,120,180,${0.08 + 0.04 * Math.sin(t2 + x + y)})`;
      ctx.fillRect(px, py, TILE, TILE);
      break;
    }
    case T.STUMP: {
      ctx.fillStyle = '#3a3630';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#5a4a2a';
      ctx.beginPath();
      ctx.arc(px + TILE / 2, py + TILE / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath();
      ctx.arc(px + TILE / 2, py + TILE / 2, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case T.DEADROCK: {
      ctx.fillStyle = '#383840';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#3a3a40';
      ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
      break;
    }
    case T.DARKGRASS: {
      // 沼泽深草: 暗绿底+深色草丛
      ctx.fillStyle = '#1a2a18';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(30,50,20,.4)';
      ctx.fillRect(px + 4, py + 8, 3, 4);
      ctx.fillRect(px + 16, py + 12, 3, 5);
      ctx.fillRect(px + 22, py + 20, 2, 3);
      // 水渍
      if ((x * 3 + y * 5) % 7 === 0) {
        ctx.fillStyle = 'rgba(30,50,80,.15)';
        ctx.fillRect(px + 8, py + 18, 6, 3);
      }
      break;
    }
    case T.TALLGRASS: {
      // 草原高草: 亮绿底+高草丛
      const shade = ((x * 7 + y * 13) % 5) * 2;
      ctx.fillStyle = `rgb(${28 + shade},${36 + shade},${24 + shade})`;
      ctx.fillRect(px, py, TILE, TILE);
      const sway = Math.sin(performance.now() / 600 + x + y) * 1;
      ctx.strokeStyle = '#4a6a2a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + 8, py + TILE - 4);
      ctx.lineTo(px + 8 + sway, py + TILE - 14);
      ctx.moveTo(px + 16, py + TILE - 4);
      ctx.lineTo(px + 16 + sway, py + TILE - 16);
      ctx.moveTo(px + 22, py + TILE - 4);
      ctx.lineTo(px + 22 + sway, py + TILE - 12);
      ctx.stroke();
      break;
    }
    case T.IRON: {
      // 铁矿: 深灰底+金属色矿石
      ctx.fillStyle = '#2a2a30';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#4a4a50';
      ctx.beginPath();
      ctx.moveTo(px + 6, py + TILE - 6);
      ctx.lineTo(px + TILE/2 - 2, py + 4);
      ctx.lineTo(px + TILE - 6, py + TILE - 6);
      ctx.closePath();
      ctx.fill();
      // 金属高光
      ctx.fillStyle = '#7a8a9a';
      ctx.fillRect(px + 12, py + 12, 3, 3);
      ctx.fillRect(px + 18, py + 16, 2, 2);
      ctx.fillStyle = '#5a6a7a';
      ctx.fillRect(px + 10, py + 18, 4, 3);
      break;
    }
    case T.CRYSTAL: {
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(px, py, TILE, TILE);
      const t2 = performance.now() / 1000;
      ctx.fillStyle = `rgba(180,150,220,${0.3 + 0.1 * Math.sin(t2 + x)})`;
      ctx.beginPath();
      ctx.moveTo(px + TILE/2, py + 4);
      ctx.lineTo(px + TILE - 8, py + TILE/2);
      ctx.lineTo(px + TILE/2, py + TILE - 4);
      ctx.lineTo(px + 8, py + TILE/2);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  // 装饰物
  if (t === T.FLOWER && rd) {
    // 花茎
    ctx.strokeStyle = '#3a5a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + TILE / 2, py + TILE - 4);
    ctx.lineTo(px + TILE / 2, py + TILE / 2);
    ctx.stroke();
    // 花瓣
    ctx.fillStyle = rd.color;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(px + TILE / 2 + Math.cos(a) * 2, py + TILE / 2 + Math.sin(a) * 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#E8D5B0';
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (t === T.MUSHROOM && rd) {
    ctx.fillStyle = '#d8c8a8';
    ctx.fillRect(px + TILE / 2 - 1, py + TILE / 2, 2, 6);
    ctx.fillStyle = '#B89292';
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, 4, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.beginPath();
    ctx.arc(px + TILE / 2 - 1, py + TILE / 2 - 1, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  if (t === T.TREE && rd) {
    ctx.fillStyle = '#4a3a1a';
    ctx.fillRect(px + TILE / 2 - 3, py + TILE - 12, 6, 12);
    const sway = Math.sin(performance.now() / 800 + x + y) * 1.5;
    ctx.fillStyle = '#2a4a1a';
    ctx.beginPath();
    ctx.arc(px + TILE / 2 + sway, py + TILE - 18, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a5a2a';
    ctx.beginPath();
    ctx.arc(px + TILE / 2 - 4 + sway, py + TILE - 20, 8, 0, Math.PI * 2);
    ctx.fill();
    if (rd.hp < 3) {
      ctx.fillStyle = 'rgba(255,200,100,.25)';
      ctx.beginPath();
      ctx.arc(px + TILE / 2, py + TILE - 18, 13, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (t === T.DEADTREE && rd) {
    // 荒地枯树: 无叶, 灰褐色
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(px + TILE / 2 - 2, py + TILE - 12, 4, 12);
    // 枝杈
    ctx.strokeStyle = '#3a3028';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + TILE / 2, py + TILE - 14);
    ctx.lineTo(px + TILE / 2 - 6, py + TILE - 20);
    ctx.moveTo(px + TILE / 2, py + TILE - 12);
    ctx.lineTo(px + TILE / 2 + 5, py + TILE - 18);
    ctx.stroke();
    if (rd.hp < 2) {
      ctx.fillStyle = 'rgba(255,200,100,.2)';
      ctx.fillRect(px + TILE / 2 - 4, py + TILE - 18, 8, 8);
    }
  }

  if (t === T.ROCK && rd) {
    ctx.fillStyle = '#5a5a5e';
    ctx.beginPath();
    ctx.moveTo(px + 6, py + TILE - 6);
    ctx.lineTo(px + TILE / 2 - 2, py + 6);
    ctx.lineTo(px + TILE - 6, py + TILE - 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6a6a6e';
    ctx.beginPath();
    ctx.moveTo(px + 10, py + TILE - 8);
    ctx.lineTo(px + TILE / 2, py + 10);
    ctx.lineTo(px + TILE - 10, py + TILE - 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4a4a4e';
    ctx.fillRect(px + TILE / 2 - 3, py + TILE - 10, 6, 4);
  }

  if (t === T.BUSH && rd) {
    ctx.fillStyle = '#2a4a2a';
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2 + 4, 11, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < rd.berries; i++) {
      ctx.fillStyle = '#c44';
      ctx.beginPath();
      ctx.arc(px + TILE / 2 + Math.cos(i * 2) * 6, py + TILE / 2 + 4 + Math.sin(i * 2) * 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawHome(ctx, home) {
  // 家的基座 (碎石已经在tile层画了)
  // 画一个小屋
  const x = home.x, y = home.y;
  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(x - 18, y - 10, 36, 24);
  // 墙壁
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(x - 16, y - 8, 32, 20);
  // 屋顶
  ctx.fillStyle = '#5a3a1a';
  ctx.beginPath();
  ctx.moveTo(x - 20, y - 8);
  ctx.lineTo(x, y - 20);
  ctx.lineTo(x + 20, y - 8);
  ctx.closePath();
  ctx.fill();
  // 门
  ctx.fillStyle = '#2a1a0a';
  ctx.fillRect(x - 5, y - 2, 10, 14);
  // 窗户 (暖光)
  ctx.fillStyle = '#FC8';
  ctx.fillRect(x - 13, y - 4, 5, 5);
  ctx.fillRect(x + 8, y - 4, 5, 5);
  ctx.fillStyle = 'rgba(255,200,100,.2)';
  ctx.fillRect(x - 14, y - 5, 7, 7);
  ctx.fillRect(x + 7, y - 5, 7, 7);
  // 烟囱
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(x + 6, y - 18, 4, 6);
  // 烟
  const t = performance.now() / 1000;
  for (let i = 0; i < 3; i++) {
    const sy = y - 24 - i * 6 + Math.sin(t + i) * 2;
    const sx = x + 8 + Math.sin(t * 0.7 + i) * 3;
    ctx.fillStyle = `rgba(120,120,130,${0.3 - i * 0.08})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 2 + i, 0, Math.PI * 2);
    ctx.fill();
  }
  // 家的光晕 (安全区)
  const grad = ctx.createRadialGradient(x, y, 0, x, y, home.radius);
  grad.addColorStop(0, 'rgba(255,200,100,.08)');
  grad.addColorStop(0.7, 'rgba(255,180,80,.03)');
  grad.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, home.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawEntity(ctx, e) {
  if (e.type === 'campfire') {
    ctx.fillStyle = '#4a4a4e';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(e.x + Math.cos(a) * 12, e.y + Math.sin(a) * 12, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const fl = 1 + Math.sin(e.flicker) * 0.2 + Math.random() * 0.1;
    ctx.fillStyle = '#c44';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 8 * fl, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e84';
    ctx.beginPath();
    ctx.arc(e.x, e.y - 2, 5 * fl, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fc8';
    ctx.beginPath();
    ctx.arc(e.x, e.y - 3, 2.5 * fl, 0, Math.PI * 2);
    ctx.fill();
    // 光晕
    const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius);
    grad.addColorStop(0, 'rgba(255,160,60,.15)');
    grad.addColorStop(0.5, 'rgba(255,120,40,.05)');
    grad.addColorStop(1, 'rgba(255,100,30,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (e.type === 'shadow') {
    e.flicker += 0.1;
    const fl = 1 + Math.sin(e.flicker) * 0.1;
    ctx.fillStyle = e.burning > 0 ? `rgba(120,40,120,${0.6 + e.burning})` : 'rgba(20,10,30,.85)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + 8, 10 * fl, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(e.x, e.y - 2, 10 * fl, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = e.burning > 0 ? '#fa4' : '#f44';
    ctx.beginPath();
    ctx.arc(e.x - 3, e.y - 3, 1.5, 0, Math.PI * 2);
    ctx.arc(e.x + 3, e.y - 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLandmark(ctx, lm) {
  const t = performance.now() / 1000;
  if (lm.type === 'camp') {
    // 废弃营地: 破帐篷+宝箱
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(lm.x - 16, lm.y - 4, 32, 16);
    // 帐篷残架
    ctx.strokeStyle = '#4a3a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lm.x - 14, lm.y + 8);
    ctx.lineTo(lm.x - 8, lm.y - 12);
    ctx.lineTo(lm.x + 8, lm.y - 12);
    ctx.lineTo(lm.x + 14, lm.y + 8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(60,50,40,.3)';
    ctx.beginPath();
    ctx.moveTo(lm.x - 12, lm.y + 8);
    ctx.lineTo(lm.x - 8, lm.y - 12);
    ctx.lineTo(lm.x + 8, lm.y - 12);
    ctx.lineTo(lm.x + 12, lm.y + 8);
    ctx.closePath();
    ctx.fill();
    // 宝箱
    if (!lm.opened) {
      const bob = Math.sin(t * 2) * 1;
      ctx.fillStyle = '#5a4a2a';
      ctx.fillRect(lm.x - 7, lm.y - 4 + bob, 14, 10);
      ctx.fillStyle = '#E8D5B0';
      ctx.fillRect(lm.x - 7, lm.y - 4 + bob, 14, 2);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(lm.x - 1, lm.y - 1 + bob, 2, 4);
      // 闪光
      ctx.fillStyle = `rgba(232,213,176,${0.3 + 0.2 * Math.sin(t * 3)})`;
      ctx.beginPath();
      ctx.arc(lm.x, lm.y + bob, 12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 已开启的空箱
      ctx.strokeStyle = '#3a2a1a';
      ctx.lineWidth = 1;
      ctx.strokeRect(lm.x - 7, lm.y - 4, 14, 10);
    }
  }

  if (lm.type === 'shrine') {
    // 古老石碑: 发光石柱
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath();
    ctx.ellipse(lm.x, lm.y + 12, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // 石柱
    ctx.fillStyle = '#3a3a48';
    ctx.fillRect(lm.x - 6, lm.y - 16, 12, 28);
    ctx.fillStyle = '#4a4a58';
    ctx.fillRect(lm.x - 4, lm.y - 14, 8, 24);
    // 顶部
    ctx.fillStyle = '#2a2a38';
    ctx.fillRect(lm.x - 7, lm.y - 18, 14, 4);
    // 符文发光
    const glow = 0.4 + 0.2 * Math.sin(t * 1.5);
    ctx.fillStyle = `rgba(180,150,220,${glow})`;
    ctx.fillRect(lm.x - 2, lm.y - 8, 4, 2);
    ctx.fillRect(lm.x - 2, lm.y - 2, 4, 2);
    ctx.fillRect(lm.x - 2, lm.y + 4, 4, 2);
    // 光晕
    const grad = ctx.createRadialGradient(lm.x, lm.y, 0, lm.x, lm.y, 40);
    grad.addColorStop(0, `rgba(180,150,220,${glow * 0.2})`);
    grad.addColorStop(1, 'rgba(180,150,220,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lm.x, lm.y, 40, 0, Math.PI * 2);
    ctx.fill();
  }

  if (lm.type === 'remnant') {
    // 篝火残迹: 石圈+灰烬
    ctx.fillStyle = '#3a3a38';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(lm.x + Math.cos(a) * 10, lm.y + Math.sin(a) * 10, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (lm.lit) {
      // 已点燃: 小火
      const fl = 1 + Math.sin(t * 8) * 0.15;
      ctx.fillStyle = '#c44';
      ctx.beginPath();
      ctx.arc(lm.x, lm.y, 5 * fl, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fc8';
      ctx.beginPath();
      ctx.arc(lm.x, lm.y - 1, 2.5 * fl, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 灰烬
      ctx.fillStyle = '#2a2a28';
      ctx.beginPath();
      ctx.arc(lm.x, lm.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawParticle(ctx, p) {
   const a = p.life / p.maxLife;
  ctx.globalAlpha = a;
  if (p.type === 'slash') {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20 * (1 - a) + 5, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlacementPreview(ctx, game, cam, w, h) {
  if (!game.placeMode) return;
  const wx = game.mouseWorldX;
  const wy = game.mouseWorldY;
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#e84';
  ctx.beginPath();
  ctx.arc(wx, wy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function renderLighting(ctx, game, cam, w, h) {
  let darkness = 0;
  if (game.phase === 'day') darkness = 0;
  else if (game.phase === 'dusk') {
    const t = (game.timeOfDay - game.DAY_LEN) / game.DUSK_LEN;
    darkness = t * 0.75;
  } else {
    darkness = 0.82;
  }
  if (darkness <= 0) return;

  ctx.save();
  ctx.fillStyle = `rgba(2,4,12,${darkness})`;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'destination-out';
  const cx = w / 2, cy = h / 2;

  // 家的光
  if (game.home) {
    const sx = game.home.x - cam.x + cx;
    const sy = game.home.y - cam.y + cy;
    const r = game.home.radius;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, 'rgba(255,255,255,.8)');
    grad.addColorStop(0.5, 'rgba(255,255,255,.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 篝火
  for (const e of game.entities) {
    if (e.type !== 'campfire') continue;
    const sx = e.x - cam.x + cx;
    const sy = e.y - cam.y + cy;
    const r = e.radius + Math.sin(e.flicker || 0) * 5;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 火把
  if (game.torchTimer > 0 && game.player) {
    const sx = game.player.x - cam.x + cx;
    const sy = game.player.y - cam.y + cy;
    const r = 80 + Math.sin(performance.now() / 100) * 5;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, 'rgba(255,255,255,.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 玩家微弱视野
  if (game.player) {
    const sx = game.player.x - cam.x + cx;
    const sy = game.player.y - cam.y + cy;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 50);
    grad.addColorStop(0, 'rgba(255,255,255,.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, 50, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// 触屏 UI 必须在光照之后画, 确保永远在最上层可见
function drawTouchUIAfterLighting(ctx, game, w, h) {
  if (!game.isTouch || !game.gameRunning) return;
  // 虚拟摇杆
  const js = game.joystick;
  if (js.active || js.id === null) {
    const bx = js.active ? js.cx : 80;
    const by = js.active ? js.cy : h - 80;
    ctx.save();
    ctx.globalAlpha = js.active ? 0.6 : 0.35;
    ctx.fillStyle = 'rgba(10,12,24,.7)';
    ctx.beginPath();
    ctx.arc(bx, by, js.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,213,176,.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const hx = js.active ? bx + js.dx * js.radius : bx;
    const hy = js.active ? by + js.dy * js.radius : by;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#E8D5B0';
    ctx.beginPath();
    ctx.arc(hx, hy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 右侧按钮
  const btnY = h - 80;
  const btns = [
    { id:'gather', label:'采集', x: w - 160, y: btnY, color:'#4a6a3a' },
    { id:'attack', label:'攻击', x: w - 100, y: btnY - 40, color:'#8a3a3a' },
    { id:'craft',  label:'合成', x: w - 60,  y: btnY, color:'#3a4a6a' },
  ];
  for (const b of btns) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,213,176,.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#E8D5B0';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x, b.y);
    ctx.restore();
  }

  // 按钮按下高亮
  if (game.touchBtnPressed) {
    const btn = btns.find(b => b.id === game.touchBtnPressed);
    if (btn) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#E8D5B0';
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
