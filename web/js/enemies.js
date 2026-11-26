// 적 종류와 움직임. 적은 칸 가운데에서 가운데로만 움직이고, 가운데에 닿을 때마다 다음 방향을 고른다.
// ctx 가 주는 것: passable(x,y,e) · rng · players(살아 있는 사람 목록) · playerDist()(사람까지 거리 지도)
//                 danger()(폭탄이 곧 태울 칸) · spawnEnemy · layBomb · placeSoft · freeCell
import { DIRS } from './grid.js';

export const ENEMY_TYPES = {
  pine:   { name: '솔방울이', speed: 1.6, hp: 1, score: 100, desc: '아무 데나 굴러다님' },
  frog:   { name: '통통개구리', speed: 3.4, hp: 1, score: 150, desc: '곧게 뛰다 막히면 방향을 틂, 쉬었다 뜀' },
  wisp:   { name: '안개불', speed: 1.2, hp: 1, score: 200, desc: '덤불을 뚫고 다님', ghost: true },
  fox:    { name: '여우불', speed: 2.1, hp: 1, score: 300, desc: '가까우면 쫓아옴' },
  mole:   { name: '꾀돌이 두더지', speed: 2.1, hp: 1, score: 400, desc: '불꽃 길을 피하고 쫓아옴' },
  turtle: { name: '돌껍질 거북', speed: 1.0, hp: 2, score: 500, desc: '두 번 맞아야 쓰러짐' },
  // 보스(월드마다 하나)
  bossPine:   { name: '솔방울 대왕', speed: 1.9, hp: 3, score: 2000, boss: true, desc: '솔방울이를 불러냄' },
  bossToad:   { name: '늪두꺼비 할멈', speed: 1.6, hp: 4, score: 2500, boss: true, desc: '높이 뛰어 다른 곳에 내려앉음(공중에선 안 맞음)' },
  bossBat:    { name: '수정 박쥐', speed: 1.7, hp: 4, score: 3000, boss: true, ghost: true, desc: '덤불을 뚫고, 줄이 맞으면 돌진' },
  bossBear:   { name: '눈보라 곰', speed: 1.8, hp: 5, score: 3500, boss: true, desc: '쫓아오며 얼음 덤불을 쌓음, 맞을수록 빨라짐' },
  bossDragon: { name: '잿불 용', speed: 1.7, hp: 6, score: 5000, boss: true, desc: '불씨 폭탄을 낳음' },
};

let nextId = 1;
export function makeEnemy(type, x, y, rng) {
  const T = ENEMY_TYPES[type];
  if (!T) throw new Error('모르는 적: ' + type);
  return {
    id: 'e' + nextId++, type, x, y, tx: x, ty: y, dir: null, hp: T.hp, maxHp: T.hp, alive: true,
    boss: !!T.boss, ghost: !!T.ghost, inv: 0, wake: 0, t: rng ? rng() * 3 : 0, phase: 0, air: 0, dash: 0, rage: 0, face: 1,
  };
}

const at = (e) => Math.abs(e.x - e.tx) < 1e-6 && Math.abs(e.y - e.ty) < 1e-6;
function options(e, ctx) {
  const cx = e.tx, cy = e.ty;
  return DIRS.filter((D) => ctx.passable(cx + D.dx, cy + D.dy, e));
}
const isReverse = (a, b) => a && b && a.dx === -b.dx && a.dy === -b.dy;

function wander(e, ctx, keep = 0.7) {
  const opts = options(e, ctx);
  if (!opts.length) return null;
  if (e.dir && opts.some((D) => D.dx === e.dir.dx && D.dy === e.dir.dy) && ctx.rng() < keep) return e.dir;
  const fwd = opts.filter((D) => !isReverse(D, e.dir));
  return ctx.rng.pick(fwd.length ? fwd : opts);
}
function straight(e, ctx) {
  const opts = options(e, ctx);
  if (!opts.length) return null;
  if (e.dir && opts.some((D) => D.dx === e.dir.dx && D.dy === e.dir.dy)) return e.dir;
  return ctx.rng.pick(opts);
}
// 사람까지의 거리 지도(사람 칸에서 시작한 BFS)를 따라 내려간다
function chase(e, ctx, range) {
  const dist = ctx.playerDist(e);
  if (!dist) return null;
  const w = ctx.grid.w;
  const here = dist[e.ty * w + e.tx];
  if (here < 0 || here > range) return null;
  let best = null, bd = here;
  for (const D of options(e, ctx)) {
    const d = dist[(e.ty + D.dy) * w + e.tx + D.dx];
    if (d >= 0 && d < bd) { bd = d; best = D; }
  }
  return best;
}
function smart(e, ctx) {
  // 다섯 번에 한 번은 허둥대며 아무 데로나 간다(완벽하게 피하면 사람이 잡을 수 없다)
  if (ctx.rng() < 0.2) return wander(e, ctx, 0.5);
  const danger = ctx.danger();
  const w = ctx.grid.w;
  const opts = options(e, ctx);
  const safe = opts.filter((D) => danger[(e.ty + D.dy) * w + e.tx + D.dx] > 1.2);
  const hereDanger = danger[e.ty * w + e.tx];
  if (hereDanger < Infinity) {
    // 지금 칸이 위험하면 가장 늦게 타는 칸으로
    if (!opts.length) return null;
    return opts.slice().sort((a, b) => danger[(e.ty + b.dy) * w + e.tx + b.dx] - danger[(e.ty + a.dy) * w + e.tx + a.dx])[0];
  }
  const c = chase(e, ctx, 10);
  if (c && safe.includes(c) && ctx.rng() < 0.75) return c;
  if (!safe.length) return null; // 기다린다
  if (e.dir && safe.includes(e.dir) && ctx.rng() < 0.6) return e.dir;
  return ctx.rng.pick(safe);
}

function choose(e, ctx) {
  switch (e.type) {
    case 'pine': case 'bossPine': return wander(e, ctx, 0.7);
    case 'frog': return straight(e, ctx);
    case 'wisp': return wander(e, ctx, 0.5);
    case 'turtle': return wander(e, ctx, 0.8);
    case 'fox': return chase(e, ctx, 6) || wander(e, ctx, 0.6);
    case 'mole': return smart(e, ctx);
    case 'bossToad': return wander(e, ctx, 0.6);
    case 'bossBat': return chase(e, ctx, 30) || wander(e, ctx, 0.6);
    case 'bossBear': return chase(e, ctx, 40) || wander(e, ctx, 0.6);
    case 'bossDragon': return (ctx.rng() < 0.6 ? chase(e, ctx, 40) : null) || wander(e, ctx, 0.7);
    default: return wander(e, ctx);
  }
}

export function enemySpeed(e) {
  const T = ENEMY_TYPES[e.type];
  let s = T.speed;
  if (e.type === 'bossBear') s += 0.35 * (e.maxHp - e.hp);
  if (e.dash > 0) s *= 3.2;
  return s;
}

// 한 칸씩 걷기. 가는 중에 앞 칸이 막히면(누가 폭탄을 놓음) 왔던 칸으로 돌아선다.
export function walk(e, dist, ctx) {
  let left = dist;
  for (let guard = 0; guard < 8 && left > 1e-9; guard++) {
    if (at(e)) {
      e.x = e.tx; e.y = e.ty;
      if (atCenter(e, ctx)) return; // 멈추거나 뛰어오름
      const D = choose(e, ctx);
      if (!D) { e.dir = null; return; }
      e.dir = D;
      e.tx = e.tx + D.dx; e.ty = e.ty + D.dy;
      if (D.dx) e.face = D.dx;
    } else if (!ctx.passable(e.tx, e.ty, e)) {
      e.tx = e.tx - e.dir.dx; e.ty = e.ty - e.dir.dy;
      e.dir = { dx: -e.dir.dx, dy: -e.dir.dy, name: 'back' };
    }
    const ddx = e.tx - e.x, ddy = e.ty - e.y;
    const d = Math.abs(ddx) + Math.abs(ddy);
    if (d <= left) { e.x = e.tx; e.y = e.ty; left -= d; }
    else { e.x += Math.sign(ddx) * left; e.y += Math.sign(ddy) * left; left = 0; }
  }
}

// 칸 가운데에 닿을 때 하는 일(보스 특수 행동·개구리 쉬기). true 면 이번 프레임은 더 움직이지 않는다.
function atCenter(e, ctx) {
  switch (e.type) {
    case 'frog': return e.phase > 0.45; // 0.45초 뛰고 0.35초 쉰다
    case 'bossPine':
      if (e.t > 6) { e.t = 0; if (ctx.countType('pine') < 3) ctx.spawnEnemy('pine', e.tx, e.ty); }
      return false;
    case 'bossToad':
      if (e.t > 4) {
        const c = ctx.freeCell(e);
        if (c) { e.t = 0; e.air = 1.1; e.landX = c.x; e.landY = c.y; e.inv = 1.1; ctx.event('jump', e.x, e.y); return true; }
      }
      return false;
    case 'bossBat':
      if (e.dash <= 0 && e.t > 2.5 && ctx.players.some((p) => Math.round(p.x) === e.tx || Math.round(p.y) === e.ty)) { e.t = 0; e.dash = 0.9; }
      return false;
    case 'bossBear':
      if (e.t > 5 && e.dir && ctx.placeSoft(e.tx - e.dir.dx, e.ty - e.dir.dy)) e.t = 0;
      return false;
    case 'bossDragon':
      if (e.t > 3.5 && ctx.layBomb(e.tx, e.ty, 2, e.id)) e.t = 0;
      return false;
    default: return false;
  }
}

// 한 프레임 갱신
export function updateEnemy(e, dt, ctx) {
  if (!e.alive) return;
  if (e.wake > 0) { e.wake -= dt; return; } // 판 시작 직후 잠깐 졸고 있다
  e.t += dt;
  if (e.inv > 0) e.inv -= dt;
  if (e.type === 'frog') e.phase = (e.phase + dt) % 0.8;
  if (e.dash > 0) e.dash -= dt;
  if (e.air > 0) {
    e.air -= dt;
    if (e.air <= 0) { e.x = e.tx = e.landX; e.y = e.ty = e.landY; e.dir = null; e.inv = 0; ctx.event('land', e.x, e.y); }
    return;
  }
  walk(e, enemySpeed(e) * dt, ctx);
}

// 불꽃에 맞았을 때. 쓰러지면 true
export function hurtEnemy(e) {
  if (!e.alive || e.inv > 0 || e.air > 0) return false;
  e.hp--;
  if (e.hp <= 0) { e.alive = false; return true; }
  e.inv = e.boss ? 1.4 : 1.0;
  return false;
}
