// 게임 한 판의 상태와 한 틱 갱신. 화면(DOM·Canvas) 없이 돌아가서 node 시험과 헤드리스 자동 플레이에 그대로 쓴다.
import { getCell, setCell, FLOOR, HARD, SOFT, key, bfs, cloneGrid } from './grid.js';
import { resolveChain, dangerMap } from './blast.js';
import { applyItem, absorbHit, freshStats, moveSpeed } from './items.js';
import { makeEnemy, updateEnemy, hurtEnemy, ENEMY_TYPES } from './enemies.js';
import { buildLevel, buildVersus } from './levels.js';
import { makeRng } from './rng.js';
import { botThink } from './bot.js';

export const FUSE = 2.4;
export const FLAME_TIME = 0.55;
export const SUDDEN_AT = 60; // 대전: 남은 시간이 이만큼이면 벽이 조여 옴

// opts.mode 'campaign': { level(def), stats?, godMode? }  'versus': { players:[{kind:'human'|'cpu', level?}], seed }
export function createGame(opts) {
  const mode = opts.mode || 'campaign';
  const seed = opts.seed ?? (opts.level ? opts.level.seed : 1);
  const built = mode === 'campaign' ? buildLevel(opts.level) : buildVersus(seed, opts.density ?? 0.7);
  const rng = makeRng(seed ^ 0x5bd1e995);
  const game = {
    mode, def: opts.level || null, grid: cloneGrid(built.grid), rng, time: 0, timeLeft: built.time,
    bombs: [], flames: new Map(), items: new Map(), hidden: new Map(built.hidden), exit: built.exit ? { ...built.exit, revealed: false, open: false } : null,
    players: [], enemies: [], events: [], debris: [], score: 0, status: 'play', endT: 0, winner: null,
    godMode: !!opts.godMode, sudden: null, suddenT: 0, cache: null, nextBombId: 1, stats0: null,
  };
  // 출구는 덤불이 부서지거나(일반 판) 대장이 쓰러지면(대장 판) 나타난다
  if (mode === 'campaign') {
    const stats = { ...freshStats(), ...(opts.stats || {}) };
    const base = opts.level.baseStats || {};
    for (const k of ['power', 'bombs', 'speed']) stats[k] = Math.max(stats[k], base[k] || 0);
    game.stats0 = { ...stats };
    game.players.push(makePlayer(0, built.spawn[0], stats, null));
    for (const e of built.enemies) { const m = makeEnemy(e.type, e.x, e.y, rng); m.wake = m.boss ? 1.0 : 2.0; game.enemies.push(m); }
  } else {
    (opts.players || [{ kind: 'human' }, { kind: 'cpu', level: 2 }]).forEach((pl, i) => {
      game.players.push(makePlayer(i, built.spawn[i], freshStats(), pl.kind === 'cpu' ? { level: pl.level ?? 2, t: 0, input: idle() } : null));
    });
  }
  return game;
}
const idle = () => ({ dx: 0, dy: 0, bomb: false });
function makePlayer(slot, at, stats, cpu) {
  return { id: 'p' + slot, slot, x: at.x, y: at.y, alive: true, stats, dir: 'down', moving: false, inv: slot >= 0 ? 0 : 0,
    cpu, deadT: 0, walkT: 0, kills: 0 };
}

export const bombAt = (game, x, y) => game.bombs.find((b) => !b.exploded && b.x === x && b.y === y) || null;
export const cellOf = (e) => ({ x: Math.round(e.x), y: Math.round(e.y) });
const overlaps = (a, b, r = 0.9) => Math.abs(a.x - b.x) < r && Math.abs(a.y - b.y) < r;
export function worldView(game) {
  return { grid: game.grid, bombAt: (x, y) => bombAt(game, x, y), itemAt: (x, y) => game.items.has(key(x, y)) };
}
export function liveBombsOf(game, owner) {
  return game.bombs.filter((b) => !b.exploded && b.owner === owner).length;
}

function blockedForPlayer(game, p, x, y) {
  if (getCell(game.grid, x, y) !== FLOOR) return true;
  const b = bombAt(game, x, y);
  return !!(b && !b.passers.has(p.id));
}

// 사람 움직이기: 한 축으로만 움직이고, 모퉁이에 살짝 걸치면 길 가운데로 미끄러뜨려 준다
export function movePlayer(game, p, dx, dy, dist) {
  if (!dx && !dy) { p.moving = false; return; }
  p.moving = true;
  p.dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
  const H = dx !== 0;
  const along = H ? 'x' : 'y', side = H ? 'y' : 'x';
  const s = H ? dx : dy;
  let c = Math.round(p[along]);
  let lane = Math.round(p[side]);
  let off = p[side] - lane;
  const cell = (a, l) => (H ? [a, l] : [l, a]);
  const blocked = (a, l) => blockedForPlayer(game, p, ...cell(a, l));
  if (Math.abs(off) > 1e-6) {
    if (!blocked(c + s, lane)) {
      const m = Math.min(dist, Math.abs(off));
      p[side] -= Math.sign(off) * m; dist -= m;
      if (Math.abs(p[side] - lane) < 1e-6) p[side] = lane;
    } else {
      const other = lane + Math.sign(off);
      if (Math.abs(off) > 0.28 && !blocked(c + s, other) && !blocked(c, other)) {
        const m = Math.min(dist, 1 - Math.abs(off));
        p[side] += Math.sign(off) * m; dist -= m;
        if (Math.abs(p[side] - other) < 1e-6) p[side] = other;
      }
      return;
    }
  }
  if (dist <= 0) return;
  lane = Math.round(p[side]); off = p[side] - lane;
  if (Math.abs(off) > 1e-6) return;
  c = Math.round(p[along]);
  let nv = p[along] + s * dist;
  if (blocked(c + s, lane)) nv = s > 0 ? Math.min(nv, Math.max(p[along], c)) : Math.max(nv, Math.min(p[along], c));
  p[along] = nv;
}

export function placeBomb(game, p) {
  if (!p.alive) return false;
  const { x, y } = cellOf(p);
  if (getCell(game.grid, x, y) !== FLOOR || bombAt(game, x, y) || game.flames.has(key(x, y))) return false;
  if (liveBombsOf(game, p.id) >= p.stats.bombs) return false;
  const b = { id: game.nextBombId++, x, y, power: p.stats.power, fuse: FUSE, owner: p.id, exploded: false, passers: new Set() };
  for (const q of game.players) if (q.alive && overlaps(q, b)) b.passers.add(q.id);
  game.bombs.push(b);
  game.events.push({ type: 'place', x, y });
  return true;
}

function enemyPassable(game, x, y, e) {
  const c = getCell(game.grid, x, y);
  if (c === HARD) return false;
  if (c === SOFT && !e.ghost) return false;
  if (bombAt(game, x, y)) return false;
  return true;
}

function ctxFor(game) {
  const cache = game.cache || (game.cache = {});
  const alivePlayers = game.players.filter((p) => p.alive);
  return {
    grid: game.grid, rng: game.rng, players: alivePlayers,
    passable: (x, y, e) => enemyPassable(game, x, y, e),
    playerDist: (e) => {
      const k = e.ghost ? 'g' : 'n';
      if (cache[k] !== undefined) return cache[k];
      if (!alivePlayers.length) return (cache[k] = null);
      // 여러 사람이면 가장 가까운 사람: 여러 출발점 BFS 대신 사람마다 구해 최소값
      let best = null;
      for (const p of alivePlayers) {
        const c = cellOf(p);
        const d = bfs(game.grid, c.x, c.y, (x, y) => enemyPassable(game, x, y, e));
        if (!best) best = d; else for (let i = 0; i < d.length; i++) if (d[i] >= 0 && (best[i] < 0 || d[i] < best[i])) best[i] = d[i];
      }
      return (cache[k] = best);
    },
    danger: () => cache.danger || (cache.danger = dangerOf(game)),
    countType: (t) => game.enemies.filter((e) => e.alive && e.type === t).length,
    spawnEnemy: (t, x, y) => { const e = makeEnemy(t, x, y, game.rng); game.enemies.push(e); game.events.push({ type: 'spawn', x, y }); },
    layBomb: (x, y, power, owner) => {
      if (bombAt(game, x, y) || getCell(game.grid, x, y) !== FLOOR) return false;
      game.bombs.push({ id: game.nextBombId++, x, y, power, fuse: FUSE, owner, exploded: false, passers: new Set() });
      game.events.push({ type: 'place', x, y });
      return true;
    },
    placeSoft: (x, y) => {
      if (getCell(game.grid, x, y) !== FLOOR || bombAt(game, x, y) || game.items.has(key(x, y))) return false;
      if (game.exit && game.exit.x === x && game.exit.y === y) return false;
      if (game.flames.has(key(x, y))) return false;
      const spot = { x, y };
      if (game.players.some((p) => p.alive && overlaps(p, spot, 1.0))) return false;
      if (game.enemies.some((q) => q.alive && overlaps(q, spot, 1.0))) return false;
      setCell(game.grid, x, y, SOFT);
      game.events.push({ type: 'ice', x, y });
      return true;
    },
    freeCell: (e) => {
      const list = [];
      for (let y = 1; y < game.grid.h - 1; y++) for (let x = 1; x < game.grid.w - 1; x++) {
        if (getCell(game.grid, x, y) !== FLOOR || bombAt(game, x, y)) continue;
        if (alivePlayers.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 3)) continue;
        if (Math.abs(e.x - x) + Math.abs(e.y - y) < 3) continue;
        list.push({ x, y });
      }
      return list.length ? game.rng.pick(list) : null;
    },
    event: (type, x, y) => game.events.push({ type, x, y }),
  };
}
export function dangerOf(game) {
  const flames = [...game.flames.values()];
  return dangerMap(worldView(game), game.bombs, flames);
}

function hitPlayer(game, p, why) {
  if (!p.alive || p.inv > 0 || game.godMode) return;
  if (absorbHit(p.stats)) { p.inv = 1.5; game.events.push({ type: 'shield', x: p.x, y: p.y }); return; }
  p.alive = false; p.deadT = 0; p.why = why;
  game.events.push({ type: 'die', x: p.x, y: p.y, who: p.id });
}

function explode(game, list) {
  const r = resolveChain(worldView(game), list);
  for (const [k, f] of r.flames) {
    const prev = game.flames.get(k);
    const owners = new Set(prev ? prev.owners : []);
    for (const b of r.order) owners.add(b.owner);
    game.flames.set(k, { ...f, ttl: FLAME_TIME, owners });
  }
  for (const it of r.items) { game.items.delete(key(it.x, it.y)); game.events.push({ type: 'burn', x: it.x, y: it.y }); }
  for (const s of r.soft) {
    setCell(game.grid, s.x, s.y, FLOOR);
    game.debris.push({ x: s.x, y: s.y, t: 0 });
    const k = key(s.x, s.y);
    if (game.hidden.has(k)) { game.items.set(k, game.hidden.get(k)); game.hidden.delete(k); }
    if (game.exit && game.exit.x === s.x && game.exit.y === s.y) { game.exit.revealed = true; game.events.push({ type: 'exit', x: s.x, y: s.y }); }
  }
  game.bombs = game.bombs.filter((b) => !b.exploded);
  game.events.push({ type: 'boom', x: r.order[0].x, y: r.order[0].y, chain: r.order.length });
  return r;
}

function suddenOrder(g) {
  const out = [];
  let x0 = 1, y0 = 1, x1 = g.w - 2, y1 = g.h - 2;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push([x, y0]);
    for (let y = y0 + 1; y <= y1; y++) out.push([x1, y]);
    if (y0 < y1) for (let x = x1 - 1; x >= x0; x--) out.push([x, y1]);
    if (x0 < x1) for (let y = y1 - 1; y > y0; y--) out.push([x0, y]);
    x0++; y0++; x1--; y1--;
  }
  return out;
}

// 한 틱. inputs[slot] = {dx, dy, bomb}(사람). 컴퓨터 상대는 bot 이 입력을 만든다.
export function stepGame(game, dt, inputs = []) {
  game.events = [];
  game.cache = null;
  if (game.status !== 'play') return game;
  game.time += dt;
  game.timeLeft -= dt;
  for (const d of game.debris) d.t += dt;
  game.debris = game.debris.filter((d) => d.t < 0.5);

  // 1) 사람
  for (const p of game.players) {
    if (!p.alive) { p.deadT += dt; continue; }
    if (p.inv > 0) p.inv -= dt;
    let inp = inputs[p.slot] || idle();
    if (p.cpu) {
      p.cpu.t -= dt;
      if (p.cpu.t <= 0) { p.cpu.input = botThink(game, p); p.cpu.t = [0.32, 0.2, 0.1, 0.05][p.cpu.level] ?? 0.1; }
      inp = p.cpu.input;
      if (p.cpu.input.bomb) p.cpu.input = { ...p.cpu.input, bomb: false };
    }
    if (inp.bomb) placeBomb(game, p);
    movePlayer(game, p, Math.sign(inp.dx || 0), inp.dx ? 0 : Math.sign(inp.dy || 0), moveSpeed(p.stats) * dt);
    if (p.moving) p.walkT += dt;
  }
  for (const b of game.bombs) for (const id of [...b.passers]) {
    const q = game.players.find((p) => p.id === id);
    if (!q || !overlaps(q, b)) b.passers.delete(id);
  }

  // 2) 적
  const ctx = ctxFor(game);
  for (const e of game.enemies) updateEnemy(e, dt, ctx);

  // 3) 폭탄: 불꽃 위 폭탄은 바로, 아니면 도화선이 다 타면 터짐(연쇄 포함)
  const due = [];
  for (const b of game.bombs) {
    b.fuse -= dt;
    if (b.fuse <= 0 || game.flames.has(key(b.x, b.y))) due.push(b);
  }
  if (due.length) explode(game, due);
  for (const [k, f] of game.flames) { f.ttl -= dt; if (f.ttl <= 0) game.flames.delete(k); }

  // 4) 불꽃 피해
  for (const p of game.players) {
    if (!p.alive) continue;
    const c = cellOf(p);
    if (game.flames.has(key(c.x, c.y))) hitPlayer(game, p, 'fire');
  }
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const f = game.flames.get(key(Math.round(e.x), Math.round(e.y)));
    if (!f) continue;
    if (e.type === 'bossDragon' && [...f.owners].every((o) => o === e.id)) continue;
    if (hurtEnemy(e)) {
      game.score += ENEMY_TYPES[e.type].score;
      game.events.push({ type: e.boss ? 'bossDown' : 'kill', x: e.x, y: e.y, enemy: e.type });
      if (e.boss && game.exit) { game.exit.revealed = true; game.events.push({ type: 'exit', x: game.exit.x, y: game.exit.y }); }
    } else if (e.inv > 0) game.events.push({ type: 'bossHit', x: e.x, y: e.y });
  }
  game.enemies = game.enemies.filter((e) => e.alive);

  // 5) 적과 부딪힘
  for (const p of game.players) {
    if (!p.alive) continue;
    for (const e of game.enemies) if (!(e.air > 0) && overlaps(p, e, 0.68)) hitPlayer(game, p, 'enemy');
  }

  // 6) 아이템
  for (const p of game.players) {
    if (!p.alive) continue;
    const c = cellOf(p);
    const k = key(c.x, c.y);
    const t = game.items.get(k);
    if (t) {
      game.items.delete(k);
      applyItem(p.stats, t, game);
      game.score += 50;
      game.events.push({ type: 'item', x: c.x, y: c.y, item: t, who: p.id });
    }
  }

  // 7) 대전: 벽 조이기
  if (game.mode === 'versus' && game.timeLeft <= SUDDEN_AT) {
    if (!game.sudden) game.sudden = { list: suddenOrder(game.grid), i: 0 };
    game.suddenT -= dt;
    while (game.suddenT <= 0 && game.sudden.i < game.sudden.list.length) {
      const [x, y] = game.sudden.list[game.sudden.i++];
      if (getCell(game.grid, x, y) === HARD) continue;
      game.suddenT += 0.3;
      setCell(game.grid, x, y, HARD);
      game.bombs = game.bombs.filter((b) => !(b.x === x && b.y === y));
      game.items.delete(key(x, y)); game.hidden.delete(key(x, y));
      for (const p of game.players) if (p.alive && Math.round(p.x) === x && Math.round(p.y) === y) { p.inv = 0; p.stats.shield = 0; hitPlayer(game, p, 'wall'); }
      game.events.push({ type: 'wall', x, y });
    }
  }

  // 8) 끝 판정
  if (game.mode === 'campaign') {
    const p = game.players[0];
    if (game.exit && game.exit.revealed && !game.exit.open && game.enemies.length === 0) {
      game.exit.open = true; game.events.push({ type: 'open', x: game.exit.x, y: game.exit.y });
    }
    if (p.alive && game.exit && game.exit.open && Math.abs(p.x - game.exit.x) < 0.35 && Math.abs(p.y - game.exit.y) < 0.35) {
      game.status = 'won';
      game.score += Math.max(0, Math.round(game.timeLeft)) * 10;
      game.events.push({ type: 'win' });
    }
    if (p.alive && game.timeLeft <= 0) { game.godMode = false; p.inv = 0; p.stats.shield = 0; hitPlayer(game, p, 'time'); if (p.alive) game.timeLeft = 0; }
    if (!p.alive && p.deadT > 1.6) game.status = 'lost';
  } else {
    const alive = game.players.filter((p) => p.alive);
    if (alive.length <= 1 || game.timeLeft <= 0) {
      game.endT += dt;
      if (game.endT > 1.2 || game.timeLeft <= 0) {
        const still = game.players.filter((p) => p.alive);
        game.winner = still.length === 1 ? still[0].slot : null;
        game.status = 'roundEnd';
        game.events.push({ type: 'roundEnd' });
      }
    }
  }
  return game;
}
