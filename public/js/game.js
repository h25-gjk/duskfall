// ═══════════════════════════════════════════════════════════
//  游戏核心 - 状态/更新/输入/合成/战斗/联机
// ═══════════════════════════════════════════════════════════
import { TILE, MAP_W, MAP_H, T, generateMap, isSolidTile } from './mapgen.js';
import { CHARACTERS, getCharacter } from './characters.js';
import { render } from './render.js';
import { api } from './api.js';
import { setupMultiplayer, getSocket, multiplayer } from './multiplayer.js';

// 时间常量
const DAY_LEN = 45, DUSK_LEN = 8, NIGHT_LEN = 22;
const DAY_TOTAL = DAY_LEN + DUSK_LEN + NIGHT_LEN;

const CRAFT_RECIPES = [
  { id:'campfire', name:'篝火', icon:'🔥', wood:2, stone:2, desc:'提供光源, 赶走暗影' },
  { id:'axe',      name:'斧头', icon:'🪓', wood:1, stone:1, desc:'采集树木更快' },
  { id:'torch',    name:'火把', icon:'🔦', wood:1, stone:0, desc:'随身光源(60秒)' },
  { id:'spear',    name:'长矛', icon:'⚔️', wood:2, stone:1, desc:'攻击力+200%' },
];

// 全局游戏状态
const game = {
  map: [], resData: [], mapW: MAP_W, mapH: MAP_H,
  home: null,
  entities: [],
  particles: [],
  player: null,
  otherPlayers: null,
  cam: { x:0, y:0 },
  dayCount: 1,
  timeOfDay: 0,
  phase: 'day',
  kills: 0,
  gameRunning: false,
  craftOpen: false,
  placeMode: null,
  torchTimer: 0,
  attackCD: 0,
  gatherCD: 0,
  damageFlash: 0,
  mouseWorldX: 0, mouseWorldY: 0,
  DAY_LEN, DUSK_LEN, NIGHT_LEN,
  selectedCharacter: null,
  isMultiplayer: false,
  isTouch: false, // 触屏设备
  joystick: { active:false, id:null, cx:0, cy:0, dx:0, dy:0, radius:50 },

  getCharacterColors(characterId) {
    const c = getCharacter(characterId);
    return c ? c.colors : CHARACTERS[0].colors;
  },
};

const keys = {};
const mouse = { x:0, y:0, down:false };
let canvas, ctx, DPR = 1, VW = 0, VH = 0;
let audioCtx = null;

// ── 音频 ──
function initAudio() {
  if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function sfx(type) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  switch(type) {
    case 'chop': o.type='square'; o.frequency.setValueAtTime(120,t); o.frequency.exponentialRampToValueAtTime(60,t+0.1); g.gain.setValueAtTime(.12,t); g.gain.exponentialRampToValueAtTime(.001,t+.12); o.start(t); o.stop(t+.13); break;
    case 'mine': o.type='square'; o.frequency.setValueAtTime(200,t); o.frequency.exponentialRampToValueAtTime(80,t+0.08); g.gain.setValueAtTime(.1,t); g.gain.exponentialRampToValueAtTime(.001,t+.1); o.start(t); o.stop(t+.11); break;
    case 'pickup': o.type='sine'; o.frequency.setValueAtTime(440,t); o.frequency.exponentialRampToValueAtTime(660,t+0.08); g.gain.setValueAtTime(.08,t); g.gain.exponentialRampToValueAtTime(.001,t+.1); o.start(t); o.stop(t+.11); break;
    case 'hit': o.type='sawtooth'; o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(50,t+0.15); g.gain.setValueAtTime(.15,t); g.gain.exponentialRampToValueAtTime(.001,t+.16); o.start(t); o.stop(t+.17); break;
    case 'craft': o.type='triangle'; o.frequency.setValueAtTime(330,t); o.frequency.exponentialRampToValueAtTime(550,t+0.15); g.gain.setValueAtTime(.1,t); g.gain.exponentialRampToValueAtTime(.001,t+.18); o.start(t); o.stop(t+.2); break;
    case 'howl': o.type='sawtooth'; o.frequency.setValueAtTime(80,t); o.frequency.linearRampToValueAtTime(120,t+0.3); o.frequency.linearRampToValueAtTime(60,t+0.6); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.06,t+0.1); g.gain.linearRampToValueAtTime(0,t+0.6); o.start(t); o.stop(t+0.65); break;
  }
}

// ── 新游戏 ──
function newGame(characterId, multiplayer = false) {
  const char = getCharacter(characterId);
  const { map, resData, home, landmarks, biomeMap } = generateMap();
  game.map = map; game.resData = resData; game.home = home;
  game.landmarks = landmarks || [];
  game.biomeMap = biomeMap || [];
  game.mapW = MAP_W; game.mapH = MAP_H;
  game.player = {
    x: home.x, y: home.y + 20,
    hp: char.stats.hp, maxHp: char.stats.hp,
    hunger: char.stats.hunger, maxHunger: char.stats.hunger,
    sanity: char.stats.sanity, maxSanity: char.stats.sanity,
    inv: { wood:0, stone:0, berry:0, torch:0 },
    hasAxe: false, hasSpear: false,
    facing: 0, animT: 0, isMoving: false,
    colors: char.colors,
    characterId,
    character: char,
  };
  game.cam = { x: game.player.x, y: game.player.y };
  game.entities = [];
  game.particles = [];
  game.dayCount = 1;
  game.timeOfDay = 0;
  game.phase = 'day';
  game.kills = 0;
  game.torchTimer = 0;
  game.damageFlash = 0;
  game.craftOpen = false;
  game.placeMode = null;
  game.selectedCharacter = char;
  game.gameRunning = true;
  game.isMultiplayer = multiplayer;

  if (multiplayer) {
    game.otherPlayers = new Map();
    setupMultiplayer(game, getSocket());
  }

  updateHUD();
  showToast(`第 1 天 · 白天 · ${char.name}`, 2500);
  return game;
}

// ── 采集 ──
function tryGather() {
  if (!game.gameRunning || game.craftOpen) return;
  if (game.gatherCD > 0) return;
  const p = game.player;
  const char = p.character;
  const gatherMult = char.passives.gatherMult || 1;
  const tx = Math.floor(p.x / TILE);
  const ty = Math.floor(p.y / TILE);

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
      const t = game.map[ny][nx];
      const rd = game.resData[ny] ? game.resData[ny][nx] : null;

      if (t === T.TREE && rd) {
        rd.hp -= (p.hasAxe ? 2 : 1) * gatherMult;
        sfx('chop');
        spawnParticles(nx*TILE+TILE/2, ny*TILE+TILE/2, '#4a6a3a', 4);
        game.gatherCD = 0.25;
        if (rd.hp <= 0) {
          p.inv.wood += 2 + Math.floor(Math.random()*3);
          game.map[ny][nx] = T.STUMP; game.resData[ny][nx] = null;
          sfx('pickup'); updateHUD();
        }
        return;
      }
      if (t === T.ROCK && rd) {
        rd.hp -= gatherMult;
        sfx('mine');
        spawnParticles(nx*TILE+TILE/2, ny*TILE+TILE/2, '#888', 4);
        game.gatherCD = 0.3;
        if (rd.hp <= 0) {
          p.inv.stone += 1 + Math.floor(Math.random()*2);
          game.map[ny][nx] = T.DEADROCK; game.resData[ny][nx] = null;
          sfx('pickup'); updateHUD();
        }
        return;
      }
      if (t === T.BUSH && rd) {
        const got = Math.min(rd.berries, 3);
        p.inv.berry += got;
        rd.berries -= got; rd.hp -= 1;
        sfx('pickup');
        spawnParticles(nx*TILE+TILE/2, ny*TILE+TILE/2, '#c44', 3);
        game.gatherCD = 0.2;
        if (rd.hp <= 0 || rd.berries <= 0) { game.map[ny][nx] = T.GRASS; game.resData[ny][nx] = null; }
        updateHUD();
        return;
      }
      if (t === T.MUSHROOM && rd) {
        p.hunger = Math.min(p.maxHunger, p.hunger + 10);
        p.sanity = Math.min(p.maxSanity, p.sanity + 5);
        sfx('pickup');
        spawnParticles(nx*TILE+TILE/2, ny*TILE+TILE/2, '#B89292', 3);
        game.map[ny][nx] = T.GRASS; game.resData[ny][nx] = null;
        game.gatherCD = 0.2; updateHUD();
        return;
      }
      // 枯树: 给少量木材
      if (t === T.DEADTREE && rd) {
        rd.hp -= gatherMult;
        sfx('chop');
        spawnParticles(nx*TILE+TILE/2, ny*TILE+TILE/2, '#3a3028', 3);
        game.gatherCD = 0.25;
        if (rd.hp <= 0) {
          p.inv.wood += 1;
          game.map[ny][nx] = T.SAND; game.resData[ny][nx] = null;
          sfx('pickup'); updateHUD();
        }
        return;
      }
      // 铁矿: 需要斧头才能挖
      if (t === T.IRON && rd) {
        if (!p.hasAxe) {
          showToast('需要斧头才能开采铁矿', 1200);
          game.gatherCD = 0.3;
          return;
        }
        rd.hp -= gatherMult;
        sfx('mine');
        spawnParticles(nx*TILE+TILE/2, ny*TILE+TILE/2, '#7a8a9a', 4);
        game.gatherCD = 0.4;
        if (rd.hp <= 0) {
          p.inv.stone += 2 + Math.floor(Math.random()*2);
          game.map[ny][nx] = T.DEADROCK; game.resData[ny][nx] = null;
          sfx('pickup');
          showToast('获得石头 (含铁矿石)', 1500);
          updateHUD();
        }
        return;
      }
      // 高草: 给浆果概率 + 草纤维(用wood计数)
      if (t === T.TALLGRASS && rd) {
        rd.hp -= 1;
        sfx('pickup');
        spawnParticles(nx*TILE+TILE/2, ny*TILE+TILE/2, '#4a6a2a', 2);
        game.gatherCD = 0.15;
        if (Math.random() < 0.3) {
          p.inv.berry += 1;
          showToast('在草丛中找到浆果!', 1000);
        }
        game.map[ny][nx] = T.GRASS; game.resData[ny][nx] = null;
        updateHUD();
        return;
      }
    }
  }

  // 检查地标交互 (宝箱/石碑/篝火残迹)
  for (const lm of game.landmarks) {
    const dx = lm.x - p.x, dy = lm.y - p.y;
    if (dx*dx + dy*dy > 40*40) continue;

    if (lm.type === 'camp' && !lm.opened) {
      lm.opened = true;
      const loot = lm.loot;
      p.inv.wood += loot.wood;
      p.inv.stone += loot.stone;
      p.inv.berry += loot.berry;
      sfx('pickup');
      spawnParticles(lm.x, lm.y, '#E8D5B0', 8);
      showToast(`发现宝箱! 获得 🪵${loot.wood} 🪨${loot.stone} 🍓${loot.berry}`, 2500);
      updateHUD();
      game.gatherCD = 0.3;
      return;
    }
    if (lm.type === 'shrine' && (lm.cooldown || 0) <= 0) {
      p.sanity = Math.min(p.maxSanity, p.sanity + 30);
      lm.cooldown = 30;
      sfx('pickup');
      spawnParticles(lm.x, lm.y, '#a4c', 6);
      showToast('古老石碑的力量恢复了你的理智 +30', 2000);
      updateHUD();
      game.gatherCD = 0.3;
      return;
    }
    if (lm.type === 'remnant' && !lm.lit && p.inv.wood >= 1) {
      lm.lit = true;
      p.inv.wood -= 1;
      // 添加为篝火实体 (光源)
      game.entities.push({ type:'campfire', x: lm.x, y: lm.y, radius: 70, fuel: 999, flicker: 0 });
      sfx('craft');
      spawnParticles(lm.x, lm.y, '#e84', 5);
      showToast('点燃了篝火残迹!', 1500);
      updateHUD();
      game.gatherCD = 0.3;
      return;
    }
  }
}

// ── 合成 ──
function toggleCraft() {
  if (!game.gameRunning) return;
  game.craftOpen = !game.craftOpen;
  game.placeMode = null;
  updateCraftMenu();
}
function updateCraftMenu() {
  const menu = document.getElementById('craft-menu');
  const list = document.getElementById('craft-list');
  menu.classList.toggle('show', game.craftOpen);
  if (!game.craftOpen) return;
  const p = game.player;
  list.innerHTML = '';

  // 顶部显示当前资源
  const resBar = document.createElement('div');
  resBar.className = 'craft-res-bar';
  resBar.innerHTML = `当前资源: 🪵<b>${p.inv.wood}</b> 🪨<b>${p.inv.stone}</b> 🍓<b>${p.inv.berry}</b>`;
  list.appendChild(resBar);

  // 可合成数量统计
  let craftable = 0;
  for (const r of CRAFT_RECIPES) {
    const can = p.inv.wood >= r.wood && p.inv.stone >= r.stone;
    if (can) craftable++;
  }

  if (craftable === 0) {
    const tip = document.createElement('div');
    tip.className = 'craft-tip';
    tip.innerHTML = '💡 资源不足。用<b>E</b>键采集树木(🪵木材)和岩石(🪨石头)，天黑前至少合成一个篝火(🔥)';
    list.appendChild(tip);
  }

  for (const r of CRAFT_RECIPES) {
    const can = p.inv.wood >= r.wood && p.inv.stone >= r.stone;
    const woodEnough = p.inv.wood >= r.wood;
    const stoneEnough = p.inv.stone >= r.stone;
    const div = document.createElement('div');
    div.className = 'craft-item' + (can ? ' craftable' : ' disabled');
    div.innerHTML = `<div class="craft-info">
      <span class="craft-icon">${r.icon}</span>
      <div>
        <div class="craft-name">${r.name}</div>
        <div class="craft-cost">
          <span class="${woodEnough ? 'res-ok' : 'res-miss'}">🪵${r.wood}</span>
          ${r.stone > 0 ? `<span class="${stoneEnough ? 'res-ok' : 'res-miss'}">🪨${r.stone}</span>` : ''}
          · ${r.desc}
        </div>
      </div>
    </div>
    <span class="craft-btn ${can ? '' : 'btn-disabled'}">${can ? '合成' : '不足'}</span>`;
    if (can) div.addEventListener('click', () => craftItem(r));
    list.appendChild(div);
  }
}
function craftItem(recipe) {
  const p = game.player;
  if (p.inv.wood < recipe.wood || p.inv.stone < recipe.stone) return;
  p.inv.wood -= recipe.wood; p.inv.stone -= recipe.stone;
  sfx('craft');
  switch(recipe.id) {
    case 'campfire': game.placeMode = 'campfire'; showToast('点击地面放置篝火', 2000); break;
    case 'axe': p.hasAxe = true; showToast('获得斧头! 采树更快', 1500); break;
    case 'torch': p.inv.torch++; showToast('获得火把! 自动点亮(60秒)', 2000); break;
    case 'spear': p.hasSpear = true; showToast('获得长矛! 攻击力大增', 1500); break;
  }
  game.craftOpen = false; updateCraftMenu(); updateHUD();
}

function placeItem(screenX, screenY) {
  const wx = screenX + game.cam.x - VW/2;
  const wy = screenY + game.cam.y - VH/2;
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  if (game.placeMode === 'campfire') {
    if (tx<0||tx>=MAP_W||ty<0||ty>=MAP_H) return;
    const t = game.map[ty][tx];
    if (t !== T.GRASS && t !== T.STUMP && t !== T.GRAVEL && t !== T.PATH && t !== T.SAND) {
      showToast('需要在空地上放置', 1200); return;
    }
    game.entities.push({ type:'campfire', x: tx*TILE+TILE/2, y: ty*TILE+TILE/2, radius: 90, fuel: 999, flicker: 0 });
    game.placeMode = null;
    showToast('篝火已放置! 天黑时靠近它', 2000);
  }
}

// ── 攻击 ──
function tryAttack() {
  if (game.attackCD > 0) return;
  game.attackCD = 0.35;
  const p = game.player;
  const char = p.character;
  const atkMult = char.passives.attackMult || 1;
  const dmg = (p.hasSpear ? 60 : 25) * atkMult;
  const range = 48;
  for (const e of game.entities) {
    if (e.type !== 'shadow' || e.dead) continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    const d = Math.sqrt(dx*dx+dy*dy);
    if (d < range) {
      e.hp -= dmg;
      e.knockback = { x: dx/d*8, y: dy/d*8 };
      sfx('hit');
      spawnParticles(e.x, e.y, '#a4c', 5);
      if (e.hp <= 0) { e.dead = true; game.kills++; spawnParticles(e.x, e.y, '#644', 8); }
    }
  }
  game.particles.push({ x: p.x+Math.cos(p.facing)*30, y: p.y+Math.sin(p.facing)*30, vx:0,vy:0, life:0.2,maxLife:0.2, color:'#E8D5B0', size:8, type:'slash' });
}

// ── 粒子 ──
function spawnParticles(x, y, color, n) {
  for (let i=0; i<n; i++) {
    const a = Math.random()*Math.PI*2, s = Math.random()*3+1;
    game.particles.push({ x,y, vx:Math.cos(a)*s,vy:Math.sin(a)*s, life:0.5+Math.random()*0.3, maxLife:0.8, color, size:2+Math.random()*2, type:'puff' });
  }
}

// ── 光源检查 ──
function isInLight(x, y) {
  if (game.torchTimer > 0) return true;
  if (game.home) {
    const dx = game.home.x - x, dy = game.home.y - y;
    if (dx*dx+dy*dy < game.home.radius*game.home.radius) return true;
  }
  for (const e of game.entities) {
    if (e.type !== 'campfire') continue;
    const dx = e.x - x, dy = e.y - y;
    const r = e.radius + Math.sin(e.flicker||0)*5;
    if (dx*dx+dy*dy < r*r) return true;
  }
  return false;
}

function spawnShadows(n) {
  for (let i=0; i<n; i++) {
    const a = Math.random()*Math.PI*2;
    const d = 250 + Math.random()*100;
    game.entities.push({
      type:'shadow', x: game.player.x+Math.cos(a)*d, y: game.player.y+Math.sin(a)*d,
      hp: 40+game.dayCount*10, speed: 35+Math.random()*15, attackCD: 1.0,
      burning: 0, flicker: Math.random()*Math.PI*2,
    });
  }
}

// ── 碰撞 ──
function isSolid(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx<0||tx>=MAP_W||ty<0||ty>=MAP_H) return true;
  return isSolidTile(game.map[ty][tx]);
}

// ── 更新 ──
function update(dt) {
  if (!game.gameRunning) return;
  const p = game.player;
  const char = p.character;

  // 移动
  let mx=0, my=0;
  if (keys['w']||keys['arrowup']) my=-1;
  if (keys['s']||keys['arrowdown']) my=1;
  if (keys['a']||keys['arrowleft']) mx=-1;
  if (keys['d']||keys['arrowright']) mx=1;
  // 虚拟摇杆
  if (game.joystick.active) {
    mx = game.joystick.dx;
    my = game.joystick.dy;
  }
  if (mx&&my && !game.joystick.active) { mx*=0.707; my*=0.707; }
  const speed = 120;
  const nx = p.x + mx*speed*dt;
  const ny = p.y + my*speed*dt;
  if (!isSolid(nx, p.y)) p.x = nx;
  if (!isSolid(p.x, ny)) p.y = ny;
  p.isMoving = !!(mx||my);
  if (p.isMoving) { p.facing = Math.atan2(my, mx); p.animT += dt*8; }

  // 摄像机
  game.cam.x += (p.x - game.cam.x) * Math.min(1, dt*6);
  game.cam.y += (p.y - game.cam.y) * Math.min(1, dt*6);

  // 时间
  game.timeOfDay += dt;
  if (game.timeOfDay >= DAY_TOTAL) {
    game.timeOfDay -= DAY_TOTAL; game.dayCount++;
    showToast(`第 ${game.dayCount} 天 · 黎明`, 2500);
    // 自动存档
    if (api.isLoggedIn()) saveProgress();
  }
  const oldPhase = game.phase;
  if (game.timeOfDay < DAY_LEN) game.phase = 'day';
  else if (game.timeOfDay < DAY_LEN + DUSK_LEN) game.phase = 'dusk';
  else game.phase = 'night';
  if (game.phase === 'night' && oldPhase !== 'night') {
    sfx('howl'); showToast('夜幕降临! 暗影正在逼近...', 3000);
    spawnShadows(2 + game.dayCount);
  }

  // 饥饿
  const hungerRate = (char.passives.hungerRate || 1) * 1.2;
  p.hunger -= dt * hungerRate;
  if (p.hunger <= 0) { p.hunger = 0; p.hp -= dt*5; game.damageFlash = Math.max(game.damageFlash, 0.3); }
  if (p.hunger < 30 && p.inv.berry > 0) {
    p.inv.berry--; p.hunger = Math.min(p.maxHunger, p.hunger+25);
    spawnParticles(p.x, p.y, '#c44', 3); updateHUD();
  }

  // 光照/理智
  const inLight = isInLight(p.x, p.y);
  const nightSanityImmune = char.passives.nightSanityImmune;
  if (game.phase === 'night' && !inLight && !nightSanityImmune) {
    p.sanity -= dt * 8; p.hp -= dt * 2;
    game.damageFlash = Math.max(game.damageFlash, 0.15);
  } else if (inLight || game.phase === 'day') {
    const regen = char.passives.sanityRegen ? char.passives.sanityRegen * 5 : 5;
    p.sanity = Math.min(p.maxSanity, p.sanity + dt * regen);
  }

  // 家里回血
  if (game.home) {
    const dx = game.home.x - p.x, dy = game.home.y - p.y;
    if (dx*dx+dy*dy < 60*60) {
      p.hp = Math.min(p.maxHp, p.hp + dt * 3);
    }
  }

  // 火把
  if (game.torchTimer > 0) { game.torchTimer -= dt; if (game.torchTimer <= 0) showToast('火把熄灭了', 1500); }

  // 暗影
  for (const e of game.entities) {
    if (e.dead) continue;
    if (e.type === 'shadow') {
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.sqrt(dx*dx+dy*dy);
      const inFireLight = isInLight(e.x, e.y);
      if (inFireLight && d < 120) {
        e.x -= (dx/d)*40*dt; e.y -= (dy/d)*40*dt; e.burning = 0.5;
      } else if (d > 20) {
        e.x += (dx/d)*e.speed*dt; e.y += (dy/d)*e.speed*dt; e.burning = Math.max(0, e.burning-dt);
      } else {
        e.attackCD -= dt;
        if (e.attackCD <= 0) { e.attackCD = 1.0; p.hp -= 8; game.damageFlash = 0.4; sfx('hit'); spawnParticles(p.x, p.y, '#c44', 4); }
      }
      if (e.knockback) { e.x += e.knockback.x; e.y += e.knockback.y; e.knockback.x *= 0.8; e.knockback.y *= 0.8; if (Math.abs(e.knockback.x)<0.5) e.knockback = null; }
    }
    if (e.type === 'campfire') e.flicker += dt*10;
  }
  game.entities = game.entities.filter(e => !e.dead);

  // 粒子
  for (const p2 of game.particles) { p2.x += p2.vx; p2.y += p2.vy; p2.vx *= 0.92; p2.vy *= 0.92; p2.life -= dt; }
  game.particles = game.particles.filter(p => p.life > 0);

  // 冷却
  if (game.attackCD > 0) game.attackCD -= dt;
  if (game.gatherCD > 0) game.gatherCD -= dt;
  if (game.damageFlash > 0) game.damageFlash -= dt * 2;
  // 地标冷却递减
  if (game.landmarks) {
    for (const lm of game.landmarks) {
      if (lm.cooldown && lm.cooldown > 0) lm.cooldown -= dt;
    }
  }

  // 联机: 发送位置
  if (game.isMultiplayer && multiplayer.socket) {
    multiplayer.emitMove(p.x, p.y, p.facing, p.animT);
  }

  // 死亡
  if (p.hp <= 0) {
    p.hp = 0; game.gameRunning = false;
    onDeath();
  }

  updateHUD();
}

// ── HUD ──
function updateHUD() {
  if (!game.player) return;
  const p = game.player;
  setBar('hp', p.hp, p.maxHp, p.hp < p.maxHp*0.3 ? '#a22' : '#c44');
  setBar('hunger', p.hunger, p.maxHunger, '#c84');
  setBar('sanity', p.sanity, p.maxSanity, p.sanity < p.maxSanity*0.3 ? '#624' : '#84c');
  document.getElementById('day-num').textContent = `第 ${game.dayCount} 天`;
  const labels = { day:'白天 ☀', dusk:'黄昏 🌅', night:'黑夜 🌙' };
  document.getElementById('time-label').textContent = labels[game.phase];
  updateInv('wood', p.inv.wood);
  updateInv('stone', p.inv.stone);
  updateInv('berry', p.inv.berry);
  updateInv('torch', p.inv.torch);
}
function setBar(id, val, max, color) {
  const pct = Math.max(0, Math.min(100, (val/max)*100));
  document.getElementById(id+'-fill').style.width = pct+'%';
  document.getElementById(id+'-fill').style.background = color;
  document.getElementById(id+'-val').textContent = Math.round(val);
}
function updateInv(id, count) {
  const el = document.getElementById('inv-'+id);
  el.classList.toggle('has', count > 0);
  el.querySelector('.inv-count').textContent = count > 0 ? count : '';
}

// ── Toast ──
let toastTimer = null;
function showToast(msg, dur=2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), dur);
}

// ── 死亡 ──
async function onDeath() {
  const ov = document.getElementById('overlay');
  document.getElementById('ov-title').textContent = '你 倒 下 了';
  document.getElementById('ov-sub').textContent = '黑夜吞噬了你...';
  document.getElementById('ov-stats').style.display = 'flex';
  document.getElementById('ov-days').textContent = game.dayCount;
  document.getElementById('ov-kills').textContent = game.kills;
  document.getElementById('ov-btn').textContent = '重新开始';
  ov.classList.remove('hide');

  // 提交分数到排行榜
  if (api.isLoggedIn() && game.dayCount > 0) {
    try {
      await api.submitScore(game.player.characterId, game.dayCount, game.kills);
      showToast('成绩已提交到排行榜', 2000);
    } catch(e) { console.log('提交失败:', e.message); }
  }
}

// ── 存档 ──
async function saveProgress() {
  if (!api.isLoggedIn()) return;
  try {
    await api.saveGame({
      dayCount: game.dayCount,
      characterId: game.player.characterId,
      hp: game.player.hp, hunger: game.player.hunger, sanity: game.player.sanity,
      inv: game.player.inv,
      hasAxe: game.player.hasAxe, hasSpear: game.player.hasSpear,
      timeOfDay: game.timeOfDay, phase: game.phase,
    });
  } catch(e) { console.log('存档失败:', e.message); }
}

// ── 输入 ──
function setupInput() {
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'e' || e.key === 'E') tryGather();
    if (e.key === 'c' || e.key === 'C') toggleCraft();
    if (e.key === ' ' && game.gameRunning) { e.preventDefault(); tryAttack(); }
    if (e.key === 'Escape') { game.craftOpen=false; game.placeMode=null; updateCraftMenu(); }
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  canvas.addEventListener('pointerdown', e => {
    initAudio();
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width * canvas.width / DPR;
    mouse.y = (e.clientY - rect.top) / rect.height * canvas.height / DPR;
    mouse.down = true;
    if (game.placeMode) {
      // 转换为逻辑坐标
      const sx = (e.clientX - rect.left) / rect.width * VW;
      const sy = (e.clientY - rect.top) / rect.height * VH;
      placeItem(sx, sy);
    } else if (game.isTouch && game.gameRunning) {
      // 触屏: 右半屏按钮
      const sx = (e.clientX - rect.left) / rect.width * VW;
      const sy = (e.clientY - rect.top) / rect.height * VH;
      if (sx >= VW / 2) handleTouchButton(sx, sy);
      else if (!game.joystick.active) {
        // 左半屏: 激活摇杆
        game.joystick.active = true;
        game.joystick.cx = sx;
        game.joystick.cy = sy;
        game.joystick.dx = 0;
        game.joystick.dy = 0;
      }
    }
  });
  canvas.addEventListener('pointerup', () => { mouse.down = false; });
  canvas.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width * canvas.width / DPR;
    mouse.y = (e.clientY - rect.top) / rect.height * canvas.height / DPR;
    // 世界坐标 (用于放置预览)
    const sx = (e.clientX - rect.left) / rect.width * VW;
    const sy = (e.clientY - rect.top) / rect.height * VH;
    game.mouseWorldX = sx + game.cam.x - VW/2;
    game.mouseWorldY = sy + game.cam.y - VH/2;
    // 触屏摇杆拖动
    if (game.joystick.active && mouse.down) {
      let dx = sx - game.joystick.cx;
      let dy = sy - game.joystick.cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const r = game.joystick.radius;
      if (dist > r) { dx = dx/dist*r; dy = dy/dist*r; }
      game.joystick.dx = dx / r;
      game.joystick.dy = dy / r;
    }
  });
  canvas.addEventListener('pointerup', () => {
    mouse.down = false;
    if (game.joystick.active) {
      game.joystick.active = false;
      game.joystick.dx = 0;
      game.joystick.dy = 0;
    }
  });
  canvas.addEventListener('pointerleave', () => {
    mouse.down = false;
    if (game.joystick.active) {
      game.joystick.active = false;
      game.joystick.dx = 0;
      game.joystick.dy = 0;
    }
  });

  // ── 触屏操控 ──
  // 检测是否触屏设备 (多种方式, 宽松检测)
  game.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;

  // 虚拟摇杆: 屏幕左半区触摸激活
  canvas.addEventListener('touchstart', e => {
    if (!game.gameRunning) return;
    e.preventDefault();
    initAudio();
    const rect = canvas.getBoundingClientRect();
    for (const t of e.changedTouches) {
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      // 左半屏 = 摇杆
      if (x < VW / 2 && !game.joystick.active) {
        game.joystick.active = true;
        game.joystick.id = t.identifier;
        game.joystick.cx = x;
        game.joystick.cy = y;
        game.joystick.dx = 0;
        game.joystick.dy = 0;
      } else if (x >= VW / 2) {
        // 右半屏 = 按钮区
        handleTouchButton(x, y);
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    if (!game.gameRunning) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    for (const t of e.changedTouches) {
      if (t.identifier === game.joystick.id && game.joystick.active) {
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        let dx = x - game.joystick.cx;
        let dy = y - game.joystick.cy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const r = game.joystick.radius;
        if (dist > r) { dx = dx/dist*r; dy = dy/dist*r; }
        game.joystick.dx = dx / r;
        game.joystick.dy = dy / r;
      }
    }
  }, { passive: false });

  function endTouch(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === game.joystick.id) {
        game.joystick.active = false;
        game.joystick.id = null;
        game.joystick.dx = 0;
        game.joystick.dy = 0;
      }
    }
  }
  canvas.addEventListener('touchend', endTouch, { passive: false });
  canvas.addEventListener('touchcancel', endTouch, { passive: false });
}

// 触屏按钮处理
function handleTouchButton(x, y) {
  const btnY = VH - 80;
  const btns = [
    { id:'gather', x: VW - 160, y: btnY },
    { id:'attack', x: VW - 100, y: btnY - 40 },
    { id:'craft',  x: VW - 60,  y: btnY },
  ];
  for (const b of btns) {
    const dx = x - b.x, dy = y - b.y;
    if (dx*dx + dy*dy < 32*32) {
      game.touchBtnPressed = b.id;
      setTimeout(() => { game.touchBtnPressed = null; }, 150);
      switch(b.id) {
        case 'gather': tryGather(); break;
        case 'attack': tryAttack(); break;
        case 'craft':  toggleCraft(); break;
      }
      return;
    }
  }
  // 没点中按钮 = 放置篝火模式时点击地图
  if (game.placeMode) {
    placeItem(x, y);
  }
}

// ── 尺寸 & 主循环 ──
function resize() {
  DPR = Math.min(window.devicePixelRatio||1, 2);
  const rect = canvas.getBoundingClientRect();
  VW = rect.width; VH = rect.height;
  canvas.width = Math.round(VW * DPR);
  canvas.height = Math.round(VH * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (game.gameRunning) update(dt);
  render(ctx, game, game.cam, VW, VH);
  requestAnimationFrame(loop);
}

// ── 初始化 ──
export function initGame() {
  canvas = document.getElementById('cv');
  ctx = canvas.getContext('2d');
  resize();
  setupInput();
  window.addEventListener('resize', resize);
  requestAnimationFrame(loop);

  // 开始按钮
  document.getElementById('ov-btn').addEventListener('click', () => {
    initAudio();
    const selected = document.querySelector('.char-card.selected');
    const charId = selected ? selected.dataset.charId : 'vesper';
    const mpCheck = document.getElementById('mp-check');
    const isMP = mpCheck && mpCheck.checked;
    if (isMP) {
      import('./multiplayerUI.js').then(m => m.showMultiplayerUI(charId));
    } else {
      try {
        newGame(charId, false);
        document.getElementById('overlay').classList.add('hide');
      } catch(e) {
        console.error('[game] newGame error:', e.message, e.stack);
      }
    }
  });

  // 自动登录恢复
  if (api.isLoggedIn()) {
    document.getElementById('auth-status').textContent = `已登录: ${api.getUsername()}`;
  }
}

// 暴露给外部调试
window.__game = game;

export { newGame, updateHUD, showToast, saveProgress };
