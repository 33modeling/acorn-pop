import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, placeBomb, movePlayer, bombAt, FUSE } from '../web/js/game.js';
import { LEVELS } from '../web/js/levels.js';
import { key, setCell, getCell, FLOOR, SOFT, HARD } from '../web/js/grid.js';
import { makeEnemy } from '../web/js/enemies.js';

const run = (g, sec, inputs = []) => { for (let i = 0; i < Math.round(sec * 60); i++) stepGame(g, 1 / 60, inputs); };
function emptyGame() {
  const g = createGame({ mode: 'campaign', level: LEVELS[0] });
  g.enemies = [];
  for (let y = 1; y < 12; y++) for (let x = 1; x < 14; x++) if (getCell(g.grid, x, y) === SOFT) setCell(g.grid, x, y, FLOOR);
  g.hidden.clear();
  return g;
}

test('모퉁이에 살짝 걸치면 길 가운데로 미끄러져 들어간다', () => {
  const g = emptyGame();
  const p = g.players[0];
  p.x = 1.3; p.y = 1; // (2,1) 쪽으로 걸침, 아래 (1,2) 로 가고 싶다
  movePlayer(g, p, 0, 1, 0.5);
  assert.equal(p.x, 1);
  assert.ok(p.y > 1);
  // 기둥(2,2) 에 막힌 줄에서 아래로 누르면 옆 줄로 미끄러짐
  p.x = 1.65; p.y = 1;
  for (let i = 0; i < 20; i++) movePlayer(g, p, 0, 1, 0.05);
  assert.equal(p.x, 1); // 0.35 차이는 (1,*) 줄로
});

test('바위·덤불 앞에서 멈춘다', () => {
  const g = emptyGame();
  const p = g.players[0];
  p.x = 1; p.y = 1;
  for (let i = 0; i < 60; i++) movePlayer(g, p, -1, 0, 0.1);
  assert.equal(p.x, 1);
  setCell(g.grid, 3, 1, SOFT);
  for (let i = 0; i < 60; i++) movePlayer(g, p, 1, 0, 0.1);
  assert.equal(p.x, 2);
});

test('놓은 도토리에서는 비켜날 수 있지만 벗어난 뒤엔 다시 못 들어간다', () => {
  const g = emptyGame();
  const p = g.players[0];
  p.x = 3; p.y = 1;
  assert.ok(placeBomb(g, p));
  assert.equal(placeBomb(g, p), false, '같은 칸·개수 초과');
  run(g, 0.5, [{ dx: 1, dy: 0 }]);
  assert.ok(p.x > 4);
  run(g, 0.6, [{ dx: -1, dy: 0 }]);
  assert.equal(p.x, 4, '도토리 칸 앞에서 막힘');
  assert.equal(bombAt(g, 3, 1).passers.size, 0);
});

test('도화선이 다 타면 터지고, 연쇄가 이어지고, 불꽃에 닿으면 쓰러진다', () => {
  const g = emptyGame();
  const p = g.players[0];
  p.stats.bombs = 3; p.stats.power = 2;
  p.x = 3; p.y = 1; placeBomb(g, p);
  run(g, 1.0, []);
  p.x = 5; p.y = 1; placeBomb(g, p); // 3,1 불꽃이 5,1 에 닿음
  p.x = 9; p.y = 1; placeBomb(g, p); // 5,1 불꽃(7,1까지)엔 안 닿음
  p.x = 1; p.y = 5;
  let boom = null;
  for (let i = 0; i < 120 && !boom; i++) { stepGame(g, 1 / 60, []); boom = g.events.find((e) => e.type === 'boom'); }
  assert.ok(boom);
  assert.equal(boom.chain, 2);
  assert.ok(bombAt(g, 9, 1), '먼 도토리는 남음');
  assert.ok(g.flames.has(key(7, 1)));
  assert.equal(p.alive, true);
  p.x = 7; p.y = 1;
  stepGame(g, 1 / 60, []);
  assert.equal(p.alive, false);
  assert.equal(p.why, 'fire');
});

test('잎사귀 방패는 불꽃 한 번을 막는다', () => {
  const g = emptyGame();
  const p = g.players[0];
  p.stats.shield = 1;
  p.x = 3; p.y = 1; placeBomb(g, p);
  run(g, FUSE + 0.05);
  assert.equal(p.alive, true);
  assert.equal(p.stats.shield, 0);
});

test('적은 불꽃에 쓰러지고 점수가 오르며, 적이 남아 있으면 출구가 열리지 않는다', () => {
  const g = emptyGame();
  const p = g.players[0];
  g.exit.revealed = true; g.exit.open = false;
  const e = makeEnemy('turtle', 5, 1); e.wake = 99; e.hp = 1;
  const e2 = makeEnemy('pine', 13, 11); e2.wake = 99;
  g.enemies.push(e, e2);
  p.x = 4; p.y = 1; p.stats.power = 2; placeBomb(g, p);
  p.x = 1; p.y = 5;
  run(g, FUSE + 0.1);
  assert.equal(g.enemies.length, 1);
  assert.equal(g.score, 500);
  assert.equal(g.exit.open, false);
  g.enemies = [];
  stepGame(g, 1 / 60, []);
  assert.equal(g.exit.open, true);
  p.x = g.exit.x; p.y = g.exit.y;
  stepGame(g, 1 / 60, []);
  assert.equal(g.status, 'won');
});

test('적에 닿으면 쓰러지고 잠시 뒤 실패', () => {
  const g = emptyGame();
  const p = g.players[0];
  const e = makeEnemy('pine', 2, 1); e.wake = 99;
  g.enemies.push(e);
  p.x = 1.5; p.y = 1;
  stepGame(g, 1 / 60, []);
  assert.equal(p.alive, false);
  run(g, 2);
  assert.equal(g.status, 'lost');
});

test('대장을 쓰러뜨리면 출구가 나타난다', () => {
  const def = LEVELS.find((l) => l.boss === 'bossPine');
  const g = createGame({ mode: 'campaign', level: def });
  assert.equal(g.exit.revealed, false);
  const boss = g.enemies.find((e) => e.boss);
  g.enemies = [boss];
  boss.hp = 1; boss.wake = 99; boss.x = boss.tx = 7; boss.y = boss.ty = 7;
  g.flames.set(key(7, 7), { x: 7, y: 7, part: 'center', ttl: 0.5, owners: new Set(['p0']) });
  stepGame(g, 1 / 60, []);
  assert.equal(g.enemies.length, 0);
  assert.equal(g.exit.revealed, true);
});

test('잿불 용은 자기 불씨 폭탄에는 다치지 않는다', () => {
  const def = LEVELS.find((l) => l.boss === 'bossDragon');
  const g = createGame({ mode: 'campaign', level: def });
  const d = g.enemies.find((e) => e.boss);
  g.enemies = [d]; d.wake = 99;
  g.flames.set(key(d.tx, d.ty), { x: d.tx, y: d.ty, part: 'center', ttl: 0.5, owners: new Set([d.id]) });
  stepGame(g, 1 / 60, []);
  assert.equal(d.hp, d.maxHp);
});

test('대전: 한 사람만 남으면 그 사람이 이긴다', () => {
  const g = createGame({ mode: 'versus', seed: 7, players: [{ kind: 'human' }, { kind: 'human' }] });
  assert.equal(g.players.length, 2);
  g.players[1].alive = false;
  run(g, 1.5);
  assert.equal(g.status, 'roundEnd');
  assert.equal(g.winner, 0);
});

test('대전: 시간이 1분 남으면 바깥부터 바위가 조여 와 깔리면 쓰러진다', () => {
  const g = createGame({ mode: 'versus', seed: 7, players: [{ kind: 'human' }, { kind: 'human' }] });
  g.timeLeft = 60.01;
  run(g, 0.2);
  assert.equal(getCell(g.grid, 1, 1), HARD);
  assert.equal(g.players[0].alive, false);
  assert.equal(g.players[0].why, 'wall');
});
