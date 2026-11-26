// 판 35개(월드 5개 × 일반 6판 + 보스 1판). 판 모양은 씨앗과 무늬로 정해져 늘 똑같이 만들어진다.
import { baseArena, cloneGrid, getCell, setCell, bfs, FLOOR, HARD, SOFT, key } from './grid.js';
import { makeRng } from './rng.js';

export const WORLDS = [
  { id: 'forest', name: '도토리 숲', enemies: ['pine', 'frog'], boss: 'bossPine', bossName: '솔방울 대왕',
    stages: ['숲 입구', '이끼 오솔길', '버섯 마당', '그루터기 갈림길', '나뭇잎 미로', '큰 참나무 아래'] },
  { id: 'marsh', name: '안개 늪', enemies: ['frog', 'pine', 'wisp'], boss: 'bossToad', bossName: '늪두꺼비 할멈',
    stages: ['갈대밭', '징검돌 다리', '물안개 웅덩이', '연잎 섬', '반딧불 둑', '늪 한가운데'] },
  { id: 'cave', name: '수정 동굴', enemies: ['wisp', 'fox', 'turtle'], boss: 'bossBat', bossName: '수정 박쥐',
    stages: ['동굴 어귀', '종유석 복도', '빛나는 굴', '거꾸로 고드름', '메아리 방', '수정 심장'] },
  { id: 'snow', name: '눈꽃 고개', enemies: ['fox', 'mole', 'turtle'], boss: 'bossBear', bossName: '눈보라 곰',
    stages: ['첫눈 언덕', '얼음 개울', '눈사람 마을', '바람 골짜기', '고드름 숲', '고개 마루'] },
  { id: 'volcano', name: '잿빛 화산', enemies: ['mole', 'fox', 'wisp', 'turtle'], boss: 'bossDragon', bossName: '잿불 용',
    stages: ['재 들판', '용암 개울', '검은 바위길', '숯불 굴', '연기 기둥', '분화구 가장자리'] },
];
export const STAGES_PER_WORLD = 7;
const PATTERNS = ['classic', 'rooms', 'ring', 'cross', 'zigzag', 'islands', 'spiral'];
export const SPAWN = { x: 1, y: 1 };
const SAFE = [[1, 1], [2, 1], [1, 2], [3, 1], [1, 3]];

export const LEVELS = [];
for (let w = 0; w < WORLDS.length; w++) {
  for (let s = 0; s < STAGES_PER_WORLD; s++) {
    const boss = s === STAGES_PER_WORLD - 1;
    const W = WORLDS[w];
    const enemyCount = boss ? Math.min(w, 3) : Math.min(3 + Math.floor(s * 0.8) + Math.floor(w * 0.6), 8);
    const items = boss ? ['fire', 'bomb', 'speed'] : ['fire', 'bomb'];
    if (!boss && s % 2 === 1) items.push('speed');
    if (!boss && s === 3) items.push('shield');
    if (!boss && s === 5) items.push('time', 'fire');
    if (!boss && w >= 2 && s === 2) items.push('bomb');
    LEVELS.push({
      id: `${w + 1}-${s + 1}`, index: LEVELS.length, world: w, stage: s, boss: boss ? W.boss : null,
      name: boss ? `${W.bossName}의 둥지` : W.stages[s],
      seed: 9173 + w * 101 + s * 17,
      pattern: boss ? 'classic' : PATTERNS[(s + w) % 6],
      softDensity: boss ? 0.22 : Math.min(0.32 + 0.05 * s + 0.03 * w, 0.68),
      enemyTypes: W.enemies, enemyCount, items,
      time: boss ? 240 : 180,
      // 월드를 처음 들어가도 너무 약하지 않게 받는 기본 능력
      baseStats: { power: Math.min(1 + w, 4), bombs: Math.min(1 + Math.floor(w * 0.75), 4), speed: Math.min(Math.floor(w / 2), 2), shield: 0 },
    });
  }
}

function patternCells(name) {
  const out = [];
  const add = (x, y) => out.push([x, y]);
  switch (name) {
    case 'rooms':
      for (let y = 1; y <= 11; y++) if (y !== 3 && y !== 9 && y % 2 === 1) { add(5, y); add(9, y); }
      break;
    case 'ring':
      for (let x = 3; x <= 11; x++) if (x !== 7 && x % 2 === 1) { add(x, 3); add(x, 9); }
      for (let y = 3; y <= 9; y++) if (y !== 6 && y % 2 === 1) { add(3, y); add(11, y); }
      break;
    case 'cross':
      for (let x = 3; x <= 11; x += 2) if (x !== 7) add(x, 6);
      for (let y = 3; y <= 9; y += 2) if (y !== 5 && y !== 7) add(7, y);
      break;
    case 'zigzag':
      for (let i = 0; i < 6; i++) { add(3 + i * 2, 1 + ((i * 3) % 5) * 2); add(1 + ((i * 2) % 6) * 2 + 1, 4 + (i % 3) * 2); }
      break;
    case 'islands':
      for (const [cx, cy] of [[4, 4], [10, 4], [4, 8], [10, 8]]) { add(cx + 1, cy); add(cx - 1, cy); add(cx, cy + 1); }
      break;
    case 'spiral':
      for (let x = 3; x <= 11; x += 2) add(x, 3);
      for (let y = 5; y <= 9; y += 2) add(11, y);
      for (let x = 9; x >= 5; x -= 2) add(x, 9);
      add(5, 7); add(7, 5);
      break;
    default: break;
  }
  return out;
}

// 막히지 않은(바위가 아닌) 칸이 모두 한 덩어리로 이어져 있는지
export function connectedNonHard(g, from = SPAWN) {
  const dist = bfs(g, from.x, from.y, (x, y) => getCell(g, x, y) !== HARD);
  for (let i = 0; i < g.cells.length; i++) if (g.cells[i] !== HARD && dist[i] < 0) return false;
  return true;
}

export function buildLevel(def) {
  const rng = makeRng(def.seed);
  const g = baseArena();
  const safe = new Set(SAFE.map(([x, y]) => key(x, y)));
  // 1) 무늬 바위: 길을 끊으면 놓지 않는다
  for (const [x, y] of patternCells(def.pattern)) {
    if (getCell(g, x, y) !== FLOOR || safe.has(key(x, y))) continue;
    setCell(g, x, y, HARD);
    if (!connectedNonHard(g)) setCell(g, x, y, FLOOR);
  }
  // 2) 덤불
  const floors = [];
  for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
    if (getCell(g, x, y) === FLOOR && !safe.has(key(x, y))) floors.push({ x, y });
  }
  for (const c of floors) if (rng() < def.softDensity) setCell(g, c.x, c.y, SOFT);
  const softs = () => floors.filter((c) => getCell(g, c.x, c.y) === SOFT);
  // 덤불이 너무 적으면 채운다(아이템·출구 숨길 자리)
  while (softs().length < def.items.length + 4) {
    const c = rng.pick(floors.filter((c) => getCell(g, c.x, c.y) === FLOOR));
    setCell(g, c.x, c.y, SOFT);
  }
  // 3) 출구와 아이템
  const far = (c) => Math.abs(c.x - SPAWN.x) + Math.abs(c.y - SPAWN.y);
  let exit;
  const hidden = new Map();
  if (def.boss) {
    exit = { x: g.w - 2, y: g.h - 2 };
    setCell(g, exit.x, exit.y, FLOOR);
  } else {
    const list = softs().sort((a, b) => far(b) - far(a));
    exit = rng.pick(list.slice(0, Math.max(3, Math.floor(list.length * 0.3))));
  }
  const pool = rng.shuffle(softs().filter((c) => !(c.x === exit.x && c.y === exit.y)));
  def.items.forEach((t, i) => { const c = pool[i]; hidden.set(key(c.x, c.y), t); });
  // 4) 적: 출발점에서 멀리, 바닥 칸에
  const enemies = [];
  const used = new Set();
  const spots = () => floors.filter((c) => getCell(g, c.x, c.y) === FLOOR && far(c) >= 7 && !used.has(key(c.x, c.y))
    && !(c.x === exit.x && c.y === exit.y));
  const want = def.enemyCount + (def.boss ? 1 : 0);
  for (let i = 0; i < want; i++) {
    let list = spots();
    if (!list.length) {
      // 빈 바닥이 없으면 먼 덤불 하나를 치워 자리를 만든다(아이템이 숨은 덤불은 건드리지 않음)
      const c = softs().filter((c) => far(c) >= 7 && !hidden.has(key(c.x, c.y)) && !(c.x === exit.x && c.y === exit.y))
        .sort((a, b) => far(b) - far(a))[0];
      setCell(g, c.x, c.y, FLOOR);
      list = spots();
    }
    let c;
    if (def.boss && i === 0) {
      c = { x: 7, y: 7 };
      setCell(g, c.x, c.y, FLOOR);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (getCell(g, 7 + dx, 7 + dy) === SOFT && !hidden.has(key(7 + dx, 7 + dy))) setCell(g, 7 + dx, 7 + dy, FLOOR);
    } else c = rng.pick(list);
    used.add(key(c.x, c.y));
    enemies.push({ type: def.boss && i === 0 ? def.boss : def.enemyTypes[i % def.enemyTypes.length], x: c.x, y: c.y });
  }
  return { grid: g, spawn: [{ ...SPAWN }], enemies, hidden, exit, time: def.time };
}

// 대전 판: 네 귀퉁이 출발, 덤불 70%, 덤불 40% 에 아이템
export function buildVersus(seed, density = 0.7) {
  const rng = makeRng(seed);
  const g = baseArena();
  const spawns = [{ x: 1, y: 1 }, { x: 13, y: 11 }, { x: 13, y: 1 }, { x: 1, y: 11 }];
  const safe = new Set();
  for (const s of spawns) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) safe.add(key(s.x + dx, s.y + dy));
  const hidden = new Map();
  const bag = ['fire', 'fire', 'fire', 'bomb', 'bomb', 'bomb', 'speed', 'speed', 'shield'];
  for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
    if (getCell(g, x, y) !== FLOOR || safe.has(key(x, y))) continue;
    if (rng() < density) {
      setCell(g, x, y, SOFT);
      if (rng() < 0.4) hidden.set(key(x, y), rng.pick(bag));
    }
  }
  return { grid: g, spawn: spawns, enemies: [], hidden, exit: null, time: 150 };
}

export function levelGrid(def) { return cloneGrid(buildLevel(def).grid); }
