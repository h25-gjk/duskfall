// ═══════════════════════════════════════════════════════════
//  角色定义 - 4个可选角色, 各有特色
// ═══════════════════════════════════════════════════════════

export const CHARACTERS = [
  {
    id: 'vesper',
    name: '维丝帕',
    title: '黄昏之子',
    desc: '均衡型, 理智恢复更快, 适合新手',
    colors: {
      skin: '#E8D5B0', hair: '#B89292', shirt: '#6B7396',
      pants: '#3A3D5C', accent: '#E8D5B0',
    },
    stats: { hp: 100, hunger: 100, sanity: 100 },
    passives: { sanityRegen: 1.5, desc: '理智恢复速度+50%' },
  },
  {
    id: 'ember',
    name: '余烬',
    title: '火焰之女',
    desc: '攻击型, 攻击力高, 但饥饿更快',
    colors: {
      skin: '#D4A88A', hair: '#C44', shirt: '#8B3A3A',
      pants: '#2A2A3A', accent: '#FC8',
    },
    stats: { hp: 120, hunger: 80, sanity: 90 },
    passives: { attackMult: 1.5, hungerRate: 1.3, desc: '攻击力+50%, 饥饿+30%' },
  },
  {
    id: 'sage',
    name: '塞吉',
    title: '林间行者',
    desc: '采集型, 采集速度更快, 携带量更大',
    colors: {
      skin: '#C4B8A4', hair: '#5a6a3a', shirt: '#4a6a3a',
      pants: '#3a4a2a', accent: '#8FaF5a',
    },
    stats: { hp: 90, hunger: 110, sanity: 95 },
    passives: { gatherMult: 2, desc: '采集伤害翻倍' },
  },
  {
    id: 'raven',
    name: '渡鸦',
    title: '暗夜潜行者',
    desc: '潜行型, 夜晚理智不掉, 但血量更低',
    colors: {
      skin: '#9a8a9a', hair: '#1a1a2a', shirt: '#2a2a3a',
      pants: '#1a1a1a', accent: '#6a4a6a',
    },
    stats: { hp: 80, hunger: 100, sanity: 120 },
    passives: { nightSanityImmune: true, desc: '夜晚不流失理智' },
  },
];

export function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}
