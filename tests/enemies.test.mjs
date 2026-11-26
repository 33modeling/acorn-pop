import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEnemy, updateEnemy, hurtEnemy, walk } from '../web/js/enemies.js';
import { getCell, HARD, SOFT, bfs } from '../web/js/grid.js';
import { makeRng } from '../web/js/rng.js';
import { gridFrom } from './helpers.mjs';
import { dangerMap } from '../web/js/blast.js';

function ctxOf(grid, { players = [], bombs = [], seed = 1 } = {}) {
  const bombAt = (x, y) => bombs.find((b) => b.x === x && b.y === y) || null;
  const pass = (x, y, e) => { const c = getCell(grid, x, y); return c !== HARD && (c !== SOFT || e.ghost) && !bombAt(x, y); };
  return {
    grid, rng: makeRng(seed), players,
    passable: pass,
    playerDist: (e) => (players.length ? bfs(grid, players[0].x, players[0].y, (x, y) => pass(x, y, e)) : null),
    danger: () => dangerMap({ grid, bombAt, itemAt: () => false }, bombs),
    countType: () => 0, spawnEnemy() {}, layBomb: () => false, placeSoft: () => false, freeCell: () => null, event() {},
  };
}
const run = (e, ctx, sec) => { for (let i = 0; i < sec * 60; i++) updateEnemy(e, 1 / 60, ctx); };

test('적은 바위·덤불·폭탄을 지나가지 않고 늘 칸 가운데를 따라 움직인다', () => {
  const g = gridFrom(['#######', '#..+..#', '#.#.#.#', '#.....#', '#######']);
  const e = makeEnemy('pine', 1, 1, makeRng(3));
  const ctx = ctxOf(g, { bombs: [{ x: 1, y: 3, power: 1, fuse: 9 }] });
  for (let i = 0; i < 600; i++) {
    updateEnemy(e, 1 / 60, ctx);
    const cx = Math.round(e.x), cy = Math.round(e.y);
    assert.ok(getCell(g, cx, cy) !== HARD && getCell(g, cx, cy) !== SOFT, '막힌 칸에 들어감');
    assert.ok(Math.abs(e.x - cx) < 1e-9 || Math.abs(e.y - cy) < 1e-9, '칸 줄을 벗어남');
    assert.ok(!(cx === 1 && cy === 3), '폭탄 칸에 들어감');
  }
});

test('안개불은 덤불을 뚫고 지나간다', () => {
  const g = gridFrom(['#####', '#.+.#', '#####']);
  const e = makeEnemy('wisp', 1, 1, makeRng(1));
  const ctx = ctxOf(g);
  let seen = false;
  for (let i = 0; i < 900 && !seen; i++) { updateEnemy(e, 1 / 60, ctx); if (Math.round(e.x) === 3) seen = true; }
  assert.ok(seen);
});

test('통통개구리는 막힐 때까지 곧게 간다', () => {
  const g = gridFrom(['#########', '#.......#', '#########']);
  const e = makeEnemy('frog', 1, 1, makeRng(1));
  const ctx = ctxOf(g);
  const xs = [];
  for (let i = 0; i < 400; i++) { updateEnemy(e, 1 / 60, ctx); xs.push(e.x); }
  // 오른쪽 끝(7)까지 갔다가 돌아온다
  const top = Math.max(...xs);
  assert.ok(top > 6.6, `가장 멀리 ${top}`);
  const turn = xs.indexOf(top);
  assert.ok(xs.slice(0, turn).every((x, i, a) => i === 0 || x >= a[i - 1]), '가는 중에 되돌아감');
});

test('여우불은 가까운 사람을 쫓아간다(지름길)', () => {
  const g = gridFrom(['#########', '#.......#', '#.#.#.#.#', '#.......#', '#########']);
  const e = makeEnemy('fox', 7, 3, makeRng(1));
  const p = { x: 1, y: 1, alive: true };
  const ctx = ctxOf(g, { players: [p] });
  run(e, ctx, 4);
  assert.ok(Math.abs(e.x - 1) + Math.abs(e.y - 1) <= 1.01, `여우 위치 ${e.x},${e.y}`);
});

test('꾀돌이 두더지는 대체로 터질 줄의 칸에 들어가지 않는다', () => {
  const g = gridFrom(['#######', '#.....#', '#.....#', '#.....#', '#######']);
  let inside = 0, total = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const e = makeEnemy('mole', 1, 2, makeRng(seed));
    const bombs = [{ x: 3, y: 2, power: 2, fuse: 1.0 }];
    const ctx = ctxOf(g, { bombs, seed });
    run(e, ctx, 0.95);
    total++;
    const cx = Math.round(e.x), cy = Math.round(e.y);
    if (cy === 2 || cx === 3) inside++;
  }
  assert.ok(inside <= 6, `20번 중 ${inside}번 불꽃 줄에 있음`);
});

test('잠든 적은 움직이지 않고, 거북은 두 번 맞아야 쓰러진다', () => {
  const g = gridFrom(['#####', '#...#', '#####']);
  const e = makeEnemy('turtle', 1, 1, makeRng(1));
  e.wake = 1;
  run(e, ctxOf(g), 0.9);
  assert.equal(e.x, 1);
  assert.equal(hurtEnemy(e), false);
  assert.equal(hurtEnemy(e), false, '맞은 직후엔 무적');
  e.inv = 0;
  assert.equal(hurtEnemy(e), true);
  assert.equal(e.alive, false);
});

test('보스: 늪두꺼비는 뛰어 다른 칸에 내려앉고 공중에선 안 맞는다', () => {
  const g = gridFrom(['#########', '#.......#', '#.......#', '#########']);
  const e = makeEnemy('bossToad', 1, 1, makeRng(1));
  const ctx = ctxOf(g);
  ctx.freeCell = () => ({ x: 7, y: 2 });
  e.t = 4.5;
  updateEnemy(e, 1 / 60, ctx);
  assert.ok(e.air > 0);
  assert.equal(hurtEnemy(e), false);
  run(e, ctx, 1.2);
  assert.equal(e.air <= 0, true);
  assert.equal(Math.round(e.x) === 7 || Math.round(e.y) === 2, true);
});

test('보스: 잿불 용은 불씨 폭탄을 낳고, 솔방울 대왕은 졸개를 부른다', () => {
  const g = gridFrom(['#######', '#.....#', '#######']);
  const laid = [], spawned = [];
  const ctx = ctxOf(g);
  ctx.layBomb = (x, y) => { laid.push([x, y]); return true; };
  ctx.spawnEnemy = (t) => spawned.push(t);
  const d = makeEnemy('bossDragon', 1, 1, makeRng(1)); d.t = 0;
  const k = makeEnemy('bossPine', 5, 1, makeRng(1)); k.t = 0;
  run(d, ctx, 8); run(k, ctx, 13);
  assert.ok(laid.length >= 2);
  assert.ok(spawned.length >= 2 && spawned.every((t) => t === 'pine'));
});

test('가는 중에 앞 칸이 막히면 돌아선다', () => {
  const g = gridFrom(['#####', '#...#', '#####']);
  const e = makeEnemy('frog', 1, 1, makeRng(1));
  const bombs = [];
  const ctx = ctxOf(g, { bombs });
  walk(e, 0.3, ctx);
  assert.equal(e.tx, 2);
  bombs.push({ x: 2, y: 1 });
  walk(e, 0.1, ctx);
  assert.equal(e.tx, 1);
  assert.ok(e.x < 1.3);
});
