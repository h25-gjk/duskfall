// ═══════════════════════════════════════════════════════════
//  地图生成 - 生物群系分区 + 地标建筑
// ═══════════════════════════════════════════════════════════

export const TILE = 32;
export const MAP_W = 80, MAP_H = 80;

// 地形类型
export const T = {
  GRASS: 0, TREE: 1, ROCK: 2, BUSH: 3, WATER: 4,
  STUMP: 5, DEADROCK: 6, FLOWER: 7, MUSHROOM: 8,
  PATH: 9, SAND: 10, GRAVEL: 11,
  // 新增地形
  DARKGRASS: 12,   // 沼泽深草
  DEADTREE: 13,     // 荒地枯树
  TALLGRASS: 14,    // 草原高草 (可采集得草纤维)
  IRON: 15,         // 铁矿 (需要斧头)
  CRYSTAL: 16,      // 水晶 (稀有, 近石碑)
};

// 生物群系
export const BIOME = {
  HOME: 0,      // 家区域 (中心)
  FOREST: 1,    // 森林 (树密集)
  PLAINS: 2,    // 草原 (浆果+高草)
  WASTELAND: 3, // 荒地 (沙地+枯树+铁矿)
  SWAMP: 4,     // 沼泽 (水+蘑菇+深草)
};

// 地标类型
export const LANDMARKS = [];

// 家建筑
export let homeBuilding = null;

// 简单噪声函数 (值噪声)
function noise2D(x, y, scale = 1) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (n - Math.floor(n));
}

// 平滑噪声 (多采样)
function smoothNoise(x, y, scale = 1) {
  const sx = x / scale, sy = y / scale;
  const ix = Math.floor(sx), iy = Math.floor(sy);
  const fx = sx - ix, fy = sy - iy;
  const a = noise2D(ix, iy);
  const b = noise2D(ix + 1, iy);
  const c = noise2D(ix, iy + 1);
  const d = noise2D(ix + 1, iy + 1);
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  return a * (1-u)*(1-v) + b * u*(1-v) + c * (1-u)*v + d * u*v;
}

export function generateMap() {
  const map = [];
  const resData = [];
  const biomeMap = [];

  for (let y = 0; y < MAP_H; y++) {
    map[y] = [];
    resData[y] = [];
    biomeMap[y] = [];
    for (let x = 0; x < MAP_W; x++) {
      map[y][x] = T.GRASS;
      resData[y][x] = null;
      biomeMap[y][x] = BIOME.PLAINS;
    }
  }

  const cx = Math.floor(MAP_W / 2);
  const cy = Math.floor(MAP_H / 2);

  // ── 1. 生成生物群系图 ──
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const dx = x - cx, dy = y - cy;
      const distC = Math.sqrt(dx * dx + dy * dy);

      // 家区域 (中心半径6)
      if (distC < 6) {
        biomeMap[y][x] = BIOME.HOME;
        continue;
      }

      // 用噪声分区, 4个方向不同群系
      const n1 = smoothNoise(x, y, 20);
      const n2 = smoothNoise(x + 100, y + 100, 15);
      const angle = Math.atan2(dy, dx);

      // 角度分区 + 噪声扰动
      if (distC < 12) {
        // 过渡区, 主要草原
        biomeMap[y][x] = BIOME.PLAINS;
      } else if (angle > -Math.PI/4 && angle < Math.PI/4 && n1 > 0.4) {
        biomeMap[y][x] = BIOME.FOREST;
      } else if (angle > Math.PI/4 && angle < 3*Math.PI/4 && n1 > 0.45) {
        biomeMap[y][x] = BIOME.SWAMP;
      } else if (angle > 3*Math.PI/4 || angle < -3*Math.PI/4) {
        biomeMap[y][x] = BIOME.WASTELAND;
      } else {
        biomeMap[y][x] = BIOME.PLAINS;
      }

      // 噪声扰动边界
      if (n2 > 0.7 && distC > 15) {
        if (biomeMap[y][x] === BIOME.PLAINS) biomeMap[y][x] = BIOME.FOREST;
      }
    }
  }

  // ── 2. 家区域: 碎石地 + 花坛 ──
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) continue;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist <= 3) {
        map[y][x] = T.GRAVEL;
      } else if (dist <= 4 && Math.random() < 0.4) {
        map[y][x] = T.FLOWER;
        resData[y][x] = { color: ['#E8D5B0', '#B89292', '#a4c', '#c4a8c4', '#FC8'][Math.floor(Math.random() * 5)] };
      }
    }
  }

  // ── 3. 从家向外延伸的小径 ──
  const paths = 4;
  for (let i = 0; i < paths; i++) {
    const angle = (i / paths) * Math.PI * 2 + Math.random() * 0.5;
    let px = cx, py = cy;
    const len = 10 + Math.floor(Math.random() * 12);
    for (let s = 0; s < len; s++) {
      px += Math.round(Math.cos(angle) + (Math.random() - 0.5) * 0.5);
      py += Math.round(Math.sin(angle) + (Math.random() - 0.5) * 0.5);
      if (px >= 0 && px < MAP_W && py >= 0 && py < MAP_H) {
        if (map[py][px] === T.GRASS || map[py][px] === T.DARKGRASS) map[py][px] = T.PATH;
      }
    }
  }

  // ── 4. 按群系生成地形 ──
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const biome = biomeMap[y][x];
      if (biome === BIOME.HOME) continue;
      if (map[y][x] !== T.GRASS) continue; // 跳过已设置的(路径等)

      const dx = x - cx, dy = y - cy;
      const distC = Math.sqrt(dx * dx + dy * dy);
      const r = Math.random();
      const n = smoothNoise(x, y, 8);

      switch (biome) {
        case BIOME.FOREST:
          // 森林: 树密集, 偶尔浆果
          if (r < 0.35) { map[y][x] = T.TREE; resData[y][x] = { hp: 3 }; }
          else if (r < 0.40) { map[y][x] = T.BUSH; resData[y][x] = { hp: 2, berries: 2 + Math.floor(Math.random()*2) }; }
          else if (r < 0.43 && n > 0.5) { map[y][x] = T.MUSHROOM; resData[y][x] = { hp: 1 }; }
          else if (r < 0.45) { map[y][x] = T.FLOWER; resData[y][x] = { color: ['#a4c', '#c4a8c4'][Math.floor(Math.random()*2)] }; }
          break;

        case BIOME.PLAINS:
          // 草原: 浆果+高草+花
          if (r < 0.10) { map[y][x] = T.BUSH; resData[y][x] = { hp: 2, berries: 2 + Math.floor(Math.random()*2) }; }
          else if (r < 0.20) { map[y][x] = T.TALLGRASS; resData[y][x] = { hp: 1 }; }
          else if (r < 0.30) { map[y][x] = T.FLOWER; resData[y][x] = { color: ['#E8D5B0', '#B89292', '#FC8'][Math.floor(Math.random()*3)] }; }
          else if (r < 0.33 && n > 0.6) { map[y][x] = T.TREE; resData[y][x] = { hp: 3 }; }
          break;

        case BIOME.WASTELAND:
          // 荒地: 沙地+枯树+铁矿+石头
          if (r < 0.20) { map[y][x] = T.SAND; }
          else if (r < 0.28) { map[y][x] = T.DEADTREE; resData[y][x] = { hp: 2 }; }
          else if (r < 0.35) { map[y][x] = T.ROCK; resData[y][x] = { hp: 4 }; }
          else if (r < 0.40 && n > 0.4) { map[y][x] = T.IRON; resData[y][x] = { hp: 5 }; }
          else if (r < 0.42) { map[y][x] = T.DEADROCK; }
          break;

        case BIOME.SWAMP:
          // 沼泽: 水+深草+蘑菇
          if (r < 0.20) { map[y][x] = T.WATER; }
          else if (r < 0.35) { map[y][x] = T.DARKGRASS; }
          else if (r < 0.45) { map[y][x] = T.MUSHROOM; resData[y][x] = { hp: 1 }; }
          else if (r < 0.50 && n > 0.5) { map[y][x] = T.TREE; resData[y][x] = { hp: 3 }; }
          else if (r < 0.55) { map[y][x] = T.BUSH; resData[y][x] = { hp: 1, berries: 1 }; }
          break;
      }
    }
  }

  // ── 5. 扩展森林簇 ──
  for (let i = 0; i < 100; i++) {
    const x = Math.floor(Math.random() * MAP_W);
    const y = Math.floor(Math.random() * MAP_H);
    if (map[y][x] === T.TREE && biomeMap[y][x] === BIOME.FOREST) {
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x+dx, ny = y+dy;
        if (nx>=0&&nx<MAP_W&&ny>=0&&ny<MAP_H && map[ny][nx]===T.GRASS && Math.random()<0.6) {
          map[ny][nx]=T.TREE; resData[ny][nx]={hp:3};
        }
      }
    }
  }

  // ── 6. 水域扩展 (沼泽里的水连成片) ──
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(Math.random() * MAP_W);
    const y = Math.floor(Math.random() * MAP_H);
    if (map[y][x] === T.WATER) {
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x+dx, ny = y+dy;
        if (nx>=0&&nx<MAP_W&&ny>=0&&ny<MAP_H && (map[ny][nx]===T.DARKGRASS || map[ny][nx]===T.GRASS) && Math.random()<0.5) {
          map[ny][nx]=T.WATER;
        }
      }
    }
  }

  // ── 7. 地标建筑 ──
  LANDMARKS.length = 0;

  // 废弃营地 (远处, 有宝箱)
  for (let i = 0; i < 3; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 15;
    const lx = Math.round(cx + Math.cos(angle) * dist);
    const ly = Math.round(cy + Math.sin(angle) * dist);
    if (lx > 2 && lx < MAP_W-2 && ly > 2 && ly < MAP_H-2) {
      // 清空周围
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const tx = lx+dx, ty = ly+dy;
          if (map[ty] && map[ty][tx] !== undefined) {
            map[ty][tx] = T.GRAVEL;
            resData[ty][tx] = null;
          }
        }
      }
      LANDMARKS.push({ type: 'camp', x: lx * TILE + TILE/2, y: ly * TILE + TILE/2, opened: false, loot: { wood: 3+Math.floor(Math.random()*3), stone: 2+Math.floor(Math.random()*2), berry: 1+Math.floor(Math.random()*3) } });
    }
  }

  // 古老石碑 (恢复理智)
  for (let i = 0; i < 2; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 15 + Math.random() * 20;
    const lx = Math.round(cx + Math.cos(angle) * dist);
    const ly = Math.round(cy + Math.sin(angle) * dist);
    if (lx > 1 && lx < MAP_W-1 && ly > 1 && ly < MAP_H-1) {
      LANDMARKS.push({ type: 'shrine', x: lx * TILE + TILE/2, y: ly * TILE + TILE/2, cooldown: 0 });
    }
  }

  // 篝火残迹 (可重新点燃)
  for (let i = 0; i < 4; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 10 + Math.random() * 25;
    const lx = Math.round(cx + Math.cos(angle) * dist);
    const ly = Math.round(cy + Math.sin(angle) * dist);
    if (lx > 1 && lx < MAP_W-1 && ly > 1 && ly < MAP_H-1) {
      LANDMARKS.push({ type: 'remnant', x: lx * TILE + TILE/2, y: ly * TILE + TILE/2, lit: false });
    }
  }

  // ── 8. 家建筑 ──
  homeBuilding = { x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2, radius: 100 };

  return { map, resData, home: homeBuilding, landmarks: LANDMARKS, biomeMap };
}

// 地形是否阻挡通行
export function isSolidTile(t) {
  return t === T.TREE || t === T.ROCK || t === T.WATER || t === T.IRON || t === T.DEADTREE;
}
