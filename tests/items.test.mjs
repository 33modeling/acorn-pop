import test from 'node:test';
import assert from 'node:assert/strict';
import { applyItem, absorbHit, freshStats, moveSpeed, LIMITS } from '../web/js/items.js';
import { createGame, stepGame, placeBomb } from '../web/js/game.js';
import { LEVELS } from '../web/js/levels.js';
import { key, setCell, FLOOR, SOFT } from '../web/js/grid.js';

test('화력·폭탄 수·속도는 상한까지만 오른다', () => {
  const s = freshStats();
  for (let i = 0; i < 20; i++) { applyItem(s, 'fire'); applyItem(s, 'bomb'); applyItem(s, 'speed'); }
  assert.equal(s.power, LIMITS.power);
  assert.equal(s.bombs, LIMITS.bombs);
  assert.equal(s.speed, LIMITS.speed);
  assert.ok(moveSpeed(s) > moveSpeed(freshStats()));
});

test('방패는 한 번 막아 주고 사라진다', () => {
  const s = freshStats();
  assert.equal(absorbHit(s), false);
  applyItem(s, 'shield');
  assert.equal(absorbHit(s), true);
  assert.equal(s.shield, 0);
});

test('모래시계는 시간 +30초', () => {
  const g = { timeLeft: 10 };
  applyItem(freshStats(), 'time', g);
  assert.equal(g.timeLeft, 40);
});

test('덤불이 부서지면 숨은 아이템이 나오고, 밟으면 먹는다', () => {
  const game = createGame({ mode: 'campaign', level: LEVELS[0] });
  game.enemies = [];
  const p = game.players[0];
  // 출발점 오른쪽 둘째 칸에 덤불+불씨를 숨긴다
  setCell(game.grid, 3, 1, SOFT);
  game.hidden.set(key(3, 1), 'fire');
  p.x = 2; p.y = 1;
  p.stats.power = 1;
  assert.equal(placeBomb(game, p), true);
  p.x = 1; p.y = 2; // 비켜서기(1,2)
  p.x = 1; p.y = 3;
  for (let i = 0; i < 200; i++) stepGame(game, 1 / 60, []);
  assert.equal(game.grid.cells[1 * 15 + 3], FLOOR);
  assert.equal(game.items.get(key(3, 1)), 'fire');
  p.x = 3; p.y = 1;
  stepGame(game, 1 / 60, []);
  assert.equal(p.stats.power, 2);
  assert.equal(game.items.size, 0);
});

test('바닥에 나온 아이템은 다음 불꽃에 탄다', () => {
  const game = createGame({ mode: 'campaign', level: LEVELS[0] });
  game.enemies = [];
  const p = game.players[0];
  game.items.set(key(3, 1), 'bomb');
  p.x = 1; p.y = 1; p.stats.power = 3;
  placeBomb(game, p);
  p.x = 1; p.y = 3;
  for (let i = 0; i < 160; i++) stepGame(game, 1 / 60, []);
  assert.equal(game.items.has(key(3, 1)), false);
});
