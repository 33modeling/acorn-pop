import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, WORLDS, buildLevel, buildVersus, SPAWN, connectedNonHard } from '../web/js/levels.js';
import { getCell, bfs, HARD, SOFT, FLOOR, key } from '../web/js/grid.js';
import { ENEMY_TYPES } from '../web/js/enemies.js';
import { autoplay } from '../scripts/autoplay.mjs';

test('판 35개, 월드 5개, 월드마다 대장 판이 하나', () => {
  assert.ok(LEVELS.length >= 30);
  assert.equal(WORLDS.length, 5);
  for (let w = 0; w < 5; w++) {
    const ls = LEVELS.filter((l) => l.world === w);
    assert.equal(ls.filter((l) => l.boss).length, 1);
    assert.ok(ENEMY_TYPES[ls.find((l) => l.boss).boss].boss);
  }
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, LEVELS.length);
});

test('같은 판은 늘 똑같이 만들어진다', () => {
  for (const def of LEVELS) {
    const a = buildLevel(def), b = buildLevel(def);
    assert.deepEqual([...a.grid.cells], [...b.grid.cells]);
    assert.deepEqual(a.exit, b.exit);
  }
});

for (const def of LEVELS) {
  test(`${def.id} ${def.name}: 출구·적·아이템이 모두 닿는 곳에 있고 출발이 안전하다`, () => {
    const L = buildLevel(def);
    const g = L.grid;
    assert.ok(connectedNonHard(g), '바위가 아닌 칸이 끊겨 있음');
    // 덤불을 부술 수 있다고 보고 출발점에서 닿는 칸
    const reach = bfs(g, SPAWN.x, SPAWN.y, (x, y) => getCell(g, x, y) !== HARD);
    const ok = (x, y) => reach[y * g.w + x] >= 0;
    assert.ok(ok(L.exit.x, L.exit.y), '출구에 못 감');
    if (def.boss) assert.equal(getCell(g, L.exit.x, L.exit.y), FLOOR);
    else assert.equal(getCell(g, L.exit.x, L.exit.y), SOFT, '출구는 덤불 속에');
    for (const e of L.enemies) {
      assert.ok(ok(e.x, e.y), `${e.type} 에 못 감`);
      assert.ok(Math.abs(e.x - SPAWN.x) + Math.abs(e.y - SPAWN.y) >= 7 || (def.boss && e.type === def.boss), '적이 너무 가까움');
      assert.notEqual(getCell(g, e.x, e.y), SOFT);
    }
    for (const k of L.hidden.keys()) assert.equal(g.cells[Math.floor(k / 64) * g.w + (k % 64)], SOFT, '아이템이 덤불 밖');
    assert.equal(L.hidden.size, def.items.length);
    // 출발점에서 첫 도토리(불꽃 1)를 놓고 피할 칸이 있다: (1,1) 옆 두 칸이 비어 있음
    assert.equal(getCell(g, 2, 1), FLOOR); assert.equal(getCell(g, 1, 2), FLOOR);
    assert.equal(getCell(g, 3, 1), FLOOR); assert.equal(getCell(g, 1, 3), FLOOR);
    assert.equal(L.hidden.has(key(L.exit.x, L.exit.y)), false);
    if (def.boss) assert.equal(L.enemies[0].type, def.boss);
  });
}

test('모든 판을 자동 플레이로 실제로 깰 수 있다(무적·시간 제한 없음: 덤불 부수기·적과 대장 쓰러뜨리기·출구 도착)', () => {
  const fails = [];
  for (const def of LEVELS) {
    const r = autoplay(def, { god: true, maxSeconds: 600 });
    if (r.status !== 'won') fails.push(`${def.id}:${r.status}:${r.enemiesLeft}`);
  }
  assert.deepEqual(fails, []);
});

test('대전 판: 네 귀퉁이 출발 자리와 그 옆이 비어 있다', () => {
  for (let seed = 1; seed < 30; seed++) {
    const L = buildVersus(seed);
    for (const s of L.spawn) {
      assert.equal(getCell(L.grid, s.x, s.y), FLOOR);
      const free = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => getCell(L.grid, s.x + dx, s.y + dy) === FLOOR);
      assert.ok(free.length >= 2);
    }
  }
});
