// ═══════════════════════════════════════════════════════════
//  地图生成 - 丰富地形 + 装饰物 + 家区域
// ═══════════════════════════════════════════════════════════

export const TILE = 32;
export const MAP_W = 80, MAP_H = 80;

// 地形类型
export const T = {
  GRASS: 0, TREE: 1, ROCK: 2, BUSH: 3, WATER: 4,
  STUMP: 5, DEADROCK: 6, FLOWER: 7, MUSHROOM: 8,
  PATH: 9, SAND: 10, GRAVEL: 11,
};

// 家建筑 (固定在出生点)
export let homeBuilding = null;

export function generateMap() {
  const map = [];
  const resData = [];

  for (let y = 0; y < MAP_H; y++) {
    map[y] = [];
    resData[y] = [];
    for (let x = 0; x < MAP_W; x++) {
      map[y][x] = T.GRASS;
      resData[y][x] = null;
    }
  }

  const cx = Math.floor(MAP_W / 2);
  const cy = Math.floor(MAP_H / 2);

  // ── 中心家区域: 碎石地 + 花坛 ──
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) continue;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist <= 3) {
        map[y][x] = T.GRAVEL; // 家区域铺碎石
      }
    }
  }

  // ── 从家向外延伸的小径 ──
  const paths = 4;
  for (let i = 0; i < paths; i++) {
    const angle = (i / paths) * Math.PI * 2 + Math.random() * 0.5;
    let px = cx, py = cy;
    const len = 8 + Math.floor(Math.random() * 8);
    for (let s = 0; s < len; s++) {
      px += Math.round(Math.cos(angle));
      py += Math.round(Math.sin(angle));
      if (px >= 0 && px < MAP_W && py >= 0 && py < MAP_H) {
        if (map[py][px] === T.GRASS) map[py][px] = T.PATH;
      }
    }
  }

  // ── 撒资源 ──
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const dx = x - cx, dy = y - cy;
      const distC = Math.sqrt(dx * dx + dy * dy);
      if (distC < 6) continue; // 家附近不放资源

      const r = Math.random();

      // 花丛 (装饰, 不可采集)
      if (r < 0.06 && map[y][x] === T.GRASS) {
        map[y][x] = T.FLOWER;
        resData[y][x] = { color: ['#E8D5B0', '#B89292', '#a4c', '#c4a8c4', '#FC8'][Math.floor(Math.random() * 5)] };
      }
      // 蘑菇 (可采集, 恢复少量饥饿+理智)
      else if (r < 0.08 && map[y][x] === T.GRASS) {
        map[y][x] = T.MUSHROOM;
        resData[y][x] = { hp: 1 };
      }
      // 树
      else if (r < 0.20) {
        map[y][x] = T.TREE;
        resData[y][x] = { hp: 3 };
      }
      // 岩石
      else if (r < 0.26) {
        map[y][x] = T.ROCK;
        resData[y][x] = { hp: 4 };
      }
      // 浆果丛
      else if (r < 0.32) {
        map[y][x] = T.BUSH;
        resData[y][x] = { hp: 2, berries: 2 + Math.floor(Math.random() * 2) };
      }
      // 水域
      else if (r < 0.34) {
        map[y][x] = T.WATER;
      }
      // 沙地 (装饰)
      else if (r < 0.36 && map[y][x] === T.GRASS) {
        map[y][x] = T.SAND;
      }
    }
  }

  // ── 扩展森林簇 ──
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(Math.random() * MAP_W);
    const y = Math.floor(Math.random() * MAP_H);
    if (map[y][x] === T.TREE) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H && map[ny][nx] === T.GRASS && Math.random() < 0.5) {
          map[ny][nx] = T.TREE;
          resData[ny][nx] = { hp: 3 };
        }
      }
    }
  }

  // ── 家建筑 ──
  homeBuilding = { x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2, radius: 100 };

  return { map, resData, home: homeBuilding };
}

// 地形是否阻挡通行
export function isSolidTile(t) {
  return t === T.TREE || t === T.ROCK || t === T.WATER;
}
