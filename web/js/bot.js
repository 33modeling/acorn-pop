// 컴퓨터 상대(대전)와 시험용 자동 플레이어. 생각은 세 단계다.
// 1) 지금 칸이 곧 탈 칸이면, 도착할 때까지 타지 않는 칸만 밟아 가장 가까운 안전한 칸으로 간다.
// 2) 여기서 도토리를 놓으면 덤불이나 상대(적)를 맞힐 수 있고, 놓은 뒤에도 피할 곳이 있으면 놓는다.
// 3) 아니면 목표(출구·아이템·상대를 맞힐 자리·덤불 옆)를 향해 안전한 칸으로만 걷는다.
import { getCell, FLOOR, SOFT, DIRS, key } from './grid.js';
import { blastCells, dangerMap } from './blast.js';
import { moveSpeed } from './items.js';

const FUSE = 2.4;
const cellOf = (e) => ({ x: Math.round(e.x), y: Math.round(e.y) });

function view(game) {
  const bombAt = (x, y) => game.bombs.find((b) => !b.exploded && b.x === x && b.y === y) || null;
  return { grid: game.grid, bombAt, itemAt: (x, y) => game.items.has(key(x, y)) };
}

// 위험을 고려한 BFS: 칸에 도착하는 시간보다 그 칸이 늦게 탈 때만 들어간다
function search(game, me, danger, speed, avoid) {
  const g = game.grid, w = g.w;
  const dist = new Int16Array(w * g.h).fill(-1);
  const parent = new Int16Array(w * g.h).fill(-1);
  const q = [me.x, me.y];
  dist[me.y * w + me.x] = 0;
  const v = view(game);
  for (let i = 0; i < q.length; i += 2) {
    const x = q[i], y = q[i + 1];
    const d = dist[y * w + x];
    for (const D of DIRS) {
      const nx = x + D.dx, ny = y + D.dy, ni = ny * w + nx;
      if (dist[ni] >= 0 || getCell(g, nx, ny) !== FLOOR || v.bombAt(nx, ny)) continue;
      if (avoid && avoid.has(ni)) continue;
      const tArrive = (d + 1) / speed;
      if (danger[ni] !== Infinity && danger[ni] - tArrive < 0.35 && danger[ni] + 0.6 > tArrive) continue;
      dist[ni] = d + 1; parent[ni] = y * w + x;
      q.push(nx, ny);
    }
  }
  return { dist, parent };
}
function firstStep(res, w, me, target) {
  let i = target.y * w + target.x;
  const start = me.y * w + me.x;
  if (i === start) return null;
  while (res.parent[i] !== start && res.parent[i] >= 0) i = res.parent[i];
  return { x: i % w, y: Math.floor(i / w) };
}
function nearest(res, w, test) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < res.dist.length; i++) {
    const d = res.dist[i];
    if (d >= 0 && d < bd && test(i % w, Math.floor(i / w), i)) { bd = d; best = i; }
  }
  return best < 0 ? null : { x: best % w, y: Math.floor(best / w), d: bd };
}
// target 칸을 power 칸 안에서 맞힐 수 있는 자리들(바위·덤불에 막히지 않는 줄)
function strikeSpots(game, t, power) {
  const out = new Set();
  const w = game.grid.w;
  out.add(t.y * w + t.x);
  for (const D of DIRS) for (let i = 1; i <= power; i++) {
    const x = t.x + D.dx * i, y = t.y + D.dy * i;
    if (getCell(game.grid, x, y) !== FLOOR) break;
    out.add(y * w + x);
  }
  return out;
}

export function botThink(game, p) {
  const g = game.grid, w = g.w;
  const me = cellOf(p);
  const v = view(game);
  const speed = moveSpeed(p.stats);
  const flames = [...game.flames.values()];
  const danger = dangerMap(v, game.bombs, flames);
  const level = p.cpu ? p.cpu.level : 3;
  const rng = game.rng;
  const aligned = Math.abs(p.x - me.x) < 0.22 && Math.abs(p.y - me.y) < 0.22;

  // 적 둘레는 밟지 않는다(무적 시험 모드는 빼고)
  let avoid = null;
  if (!game.godMode && game.enemies.length) {
    avoid = new Set();
    for (const e of game.enemies) {
      const c = cellOf(e);
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) avoid.add((c.y + dy) * w + c.x + dx);
    }
    avoid.delete(me.y * w + me.x);
  }
  const go = (step) => (step ? { dx: Math.sign(step.x - me.x), dy: step.x === me.x ? Math.sign(step.y - me.y) : 0, bomb: false } : centerUp());
  const centerUp = () => {
    // 칸 가운데로 맞추기
    const ox = me.x - p.x, oy = me.y - p.y;
    if (Math.abs(ox) > 0.05) return { dx: Math.sign(ox), dy: 0, bomb: false };
    if (Math.abs(oy) > 0.05) return { dx: 0, dy: Math.sign(oy), bomb: false };
    return { dx: 0, dy: 0, bomb: false };
  };

  const res = search(game, me, danger, speed, avoid);
  // 1) 피하기
  if (danger[me.y * w + me.x] !== Infinity) {
    const safe = nearest(res, w, (x, y, i) => danger[i] === Infinity);
    if (safe) return go(firstStep(res, w, me, safe));
    const anyRes = search(game, me, danger, speed * 3, null);
    const late = nearest(anyRes, w, (x, y, i) => danger[i] === Infinity);
    return go(late ? firstStep(anyRes, w, me, late) : null);
  }

  // 1-1) 적이 바짝 붙으면 멀어지는 칸으로(가능하면 도토리를 놓고)
  if (!game.godMode && game.mode === 'campaign') {
    const close = game.enemies.filter((e) => !(e.air > 0) && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) < 2.2);
    if (close.length) {
      const score = (x, y) => Math.min(...game.enemies.map((e) => Math.abs(e.x - x) + Math.abs(e.y - y)));
      let best = null, bs = score(p.x, p.y);
      for (const D of DIRS) {
        const nx = me.x + D.dx, ny = me.y + D.dy, ni = ny * w + nx;
        if (getCell(g, nx, ny) !== FLOOR || v.bombAt(nx, ny) || danger[ni] !== Infinity) continue;
        const sc = score(nx, ny);
        if (sc > bs) { bs = sc; best = { x: nx, y: ny }; }
      }
      if (best) {
        const canDrop = aligned && !v.bombAt(me.x, me.y) && game.bombs.filter((b) => !b.exploded && b.owner === p.id).length < p.stats.bombs;
        return { ...go(best), bomb: canDrop };
      }
    }
  }

  // 맞힐 대상
  const targets = [];
  if (game.mode === 'versus') for (const q of game.players) { if (q.alive && q !== p) targets.push(cellOf(q)); }
  else for (const e of game.enemies) { targets.push(cellOf(e)); const f = predict(game, e, FUSE); if (f) targets.push(f); }

  // 2) 놓을까
  const canBomb = game.bombs.filter((b) => !b.exploded && b.owner === p.id).length < p.stats.bombs && !v.bombAt(me.x, me.y);
  if (canBomb && aligned) {
    const r = blastCells(v, me.x, me.y, p.stats.power);
    const hitsTarget = targets.some((t) => r.cells.some((c) => c.x === t.x && c.y === t.y));
    const hitsSoft = r.soft.some((s) => !(game.exit && game.exit.revealed && s.x === game.exit.x && s.y === game.exit.y));
    const aggressive = level >= 2 || rng() < 0.5;
    if ((hitsTarget && aggressive) || hitsSoft) {
      const fake = { x: me.x, y: me.y, power: p.stats.power, fuse: FUSE, exploded: false, owner: p.id };
      const v2 = { ...v, bombAt: (x, y) => (x === me.x && y === me.y ? fake : v.bombAt(x, y)) };
      const d2 = dangerMap(v2, [...game.bombs, fake], flames);
      const r2 = search(game, me, d2, speed, avoid);
      const escape = nearest(r2, w, (x, y, i) => d2[i] === Infinity && (x !== me.x || y !== me.y));
      if (escape && escape.d <= 6) return { ...go(firstStep(r2, w, me, escape)), bomb: true };
    }
  }

  // 3) 걷기: 안전한 칸으로만
  const safeRes = { dist: res.dist.map((d, i) => (danger[i] === Infinity ? d : -1)), parent: res.parent };
  const pick = (test) => nearest(safeRes, w, test);
  let goal = null;
  if (game.mode === 'campaign' && game.exit && game.exit.open) goal = pick((x, y) => x === game.exit.x && y === game.exit.y);
  if (!goal) {
    const itemGoal = pick((x, y, i) => game.items.has(key(x, y)) && safeRes.dist[i] <= 7);
    if (itemGoal) goal = itemGoal;
  }
  // 상대(적)를 맞힐 자리: 가까우면 먼저, 멀면 덤불을 다 부순 뒤에
  let strike = null;
  if (targets.length && (game.mode === 'versus' ? level >= 1 : true)) {
    const spots = new Set();
    for (const t of targets) for (const s of strikeSpots(game, t, p.stats.power)) spots.add(s);
    strike = pick((x, y, i) => spots.has(i) && (game.mode === 'versus' || game.godMode || !targets.some((t) => Math.abs(t.x - x) + Math.abs(t.y - y) < 2)));
  }
  const near = game.mode === 'versus' ? 9 : 4;
  // 혼자 하는 모험에서는 10초 쫓고 10초 덤불을 부수는 식으로 번갈아 한다(쫓기만 하다 아이템을 못 얻는 일 막기)
  const hunt = game.mode === 'versus' || !hasSoft(g) || game.time % 20 < 10;
  if (!goal && strike && strike.d <= near && hunt) goal = strike;
  if (!goal) {
    goal = pick((x, y) => {
      for (const D of DIRS) if (getCell(g, x + D.dx, y + D.dy) === SOFT) return !(game.exit && game.exit.revealed && game.exit.x === x + D.dx && game.exit.y === y + D.dy);
      return false;
    });
  }
  if (!goal && strike) goal = strike;
  if (!goal && game.exit && game.exit.revealed) goal = pick((x, y) => x === game.exit.x && y === game.exit.y);
  if (!goal || goal.d === 0) {
    // 가만히 있으면 쉽게 맞으니 가끔 둘러본다
    if (level >= 1 && rng() < 0.25) {
      const open = DIRS.filter((D) => {
        const i = (me.y + D.dy) * w + me.x + D.dx;
        return safeRes.dist[i] === 1;
      });
      if (open.length) { const D = rng.pick(open); return go({ x: me.x + D.dx, y: me.y + D.dy }); }
    }
    return centerUp();
  }
  return go(firstStep(res, w, me, goal));
}
// 적이 지금 방향으로 곧게 간다고 보고 sec 초 뒤 칸을 짐작한다(막히면 그 앞에서 멈춤)
function predict(game, e, sec) {
  if (!e.dir || e.air > 0) return null;
  const T = { pine: 1.6, frog: 2.1, wisp: 1.2, fox: 2.3, mole: 2.1, turtle: 1.0 }[e.type] || 1.6;
  let x = e.tx, y = e.ty;
  const steps = Math.floor(T * sec - (Math.abs(e.tx - e.x) + Math.abs(e.ty - e.y)));
  for (let i = 0; i < steps; i++) {
    const nx = x + e.dir.dx, ny = y + e.dir.dy;
    const c = getCell(game.grid, nx, ny);
    if (c !== FLOOR && !(c === SOFT && e.ghost)) break;
    x = nx; y = ny;
  }
  return { x, y };
}
function hasSoft(g) {
  for (let i = 0; i < g.cells.length; i++) if (g.cells[i] === SOFT) return true;
  return false;
}

