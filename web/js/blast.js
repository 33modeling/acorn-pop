// 폭발 전파와 연쇄. 순수 함수라 화면 없이 시험할 수 있다.
//
// 규칙
// - 불꽃은 놓인 칸에서 위·오른쪽·아래·왼쪽으로 power 칸까지 뻗는다.
// - 바위를 만나면 그 칸 앞에서 멈춘다(바위 칸은 타지 않음).
// - 덤불을 만나면 그 칸까지 태우고 멈춘다. 한 번의 연쇄 안에서 덤불은 다 계산한 뒤에 한꺼번에 부서진다.
//   그래서 두 폭탄이 같은 덤불을 쳐도 그 뒤로는 번지지 않는다.
// - 바닥에 놓인 아이템을 만나면 태워 없애고 멈춘다.
// - 다른 폭탄을 만나면 그 칸까지 태우고 멈추며, 그 폭탄이 같은 순간에 바로 터진다(연쇄).
import { getCell, HARD, SOFT, DIRS, key } from './grid.js';

// world: { grid, bombAt(x,y) -> bomb|null, itemAt(x,y) -> bool }
export function blastCells(world, ox, oy, power) {
  const cells = [{ x: ox, y: oy, part: 'center', dir: null }];
  const soft = [];
  const bombs = [];
  const items = [];
  for (const D of DIRS) {
    for (let i = 1; i <= power; i++) {
      const x = ox + D.dx * i, y = oy + D.dy * i;
      const c = getCell(world.grid, x, y);
      if (c === HARD) break;
      const last = i === power;
      if (c === SOFT) { cells.push({ x, y, part: 'end', dir: D.name, soft: true }); soft.push({ x, y }); break; }
      const b = world.bombAt(x, y);
      if (b) { cells.push({ x, y, part: 'end', dir: D.name }); bombs.push(b); break; }
      if (world.itemAt && world.itemAt(x, y)) { cells.push({ x, y, part: 'end', dir: D.name }); items.push({ x, y }); break; }
      cells.push({ x, y, part: last ? 'end' : 'arm', dir: D.name });
    }
  }
  return { cells, soft, bombs, items };
}

// 터질 폭탄(들)에서 시작해 연쇄를 모두 푼다. 폭탄 객체는 {x,y,power,exploded} 이고 exploded 를 바꾼다.
// 돌려주는 값: order(터진 순서), flames(칸 → 가장 굵은 모양), soft(부술 덤불), items(태울 아이템), depth(폭탄별 연쇄 깊이)
export function resolveChain(world, startBombs) {
  const queue = startBombs.filter((b) => !b.exploded).map((b) => ({ b, depth: 0 }));
  for (const q of queue) q.b.exploded = true;
  const order = [];
  const flames = new Map();
  const soft = new Map();
  const items = new Map();
  const depth = new Map();
  const rank = { arm: 1, end: 0, center: 2 };
  for (let i = 0; i < queue.length; i++) {
    const { b, depth: d } = queue[i];
    order.push(b);
    depth.set(b, d);
    const r = blastCells(world, b.x, b.y, b.power);
    for (const c of r.cells) {
      const k = key(c.x, c.y);
      const prev = flames.get(k);
      if (!prev || rank[c.part] > rank[prev.part] || (prev.dir && c.dir && prev.dir !== c.dir && c.part !== 'center')) {
        // 가로·세로 불꽃이 겹치면 가운데 모양으로 그린다
        const merged = prev && prev.dir && c.dir && axis(prev.dir) !== axis(c.dir) ? { ...c, part: 'center' } : c;
        flames.set(k, merged);
      }
    }
    for (const s of r.soft) soft.set(key(s.x, s.y), s);
    for (const it of r.items) items.set(key(it.x, it.y), it);
    for (const nb of r.bombs) {
      if (nb.exploded) continue;
      nb.exploded = true;
      queue.push({ b: nb, depth: d + 1 });
    }
  }
  return { order, flames, soft: [...soft.values()], items: [...items.values()], depth };
}
const axis = (dir) => (dir === 'left' || dir === 'right' ? 'h' : 'v');

// 아직 안 터진 폭탄들이 언제 어느 칸을 태울지 미리 계산한다(연쇄로 앞당겨지는 시간 포함).
// 컴퓨터 상대와 '꾀돌이' 적이 피할 곳을 고를 때 쓴다. 돌려주는 값: Float32Array(칸마다 남은 초, 안전하면 Infinity)
export function dangerMap(world, bombs, flames = []) {
  const g = world.grid;
  const danger = new Float32Array(g.w * g.h).fill(Infinity);
  const live = bombs.filter((b) => !b.exploded);
  const t = new Map(live.map((b) => [b, b.fuse]));
  const reach = new Map(live.map((b) => [b, blastCells(world, b.x, b.y, b.power)]));
  let changed = true;
  for (let guard = 0; changed && guard < live.length + 1; guard++) {
    changed = false;
    for (const b of live) {
      for (const nb of reach.get(b).bombs) {
        if (t.has(nb) && t.get(b) < t.get(nb)) { t.set(nb, t.get(b)); changed = true; }
      }
    }
  }
  for (const b of live) {
    for (const c of reach.get(b).cells) {
      const i = c.y * g.w + c.x;
      if (t.get(b) < danger[i]) danger[i] = t.get(b);
    }
  }
  for (const f of flames) {
    const i = f.y * g.w + f.x;
    danger[i] = 0;
  }
  return danger;
}
