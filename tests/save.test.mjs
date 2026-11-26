import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSave, writeSave, recordClear, defaultSave, SAVE_KEY } from '../web/js/save.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };

test('저장하고 다시 읽는다', () => {
  const st = memory();
  let s = loadSave(st);
  assert.deepEqual(s, defaultSave());
  s = recordClear(s, 0, '1-1', 1200, { power: 3, bombs: 2, speed: 1, shield: 1 }, 35);
  assert.ok(writeSave(s, st));
  const r = loadSave(st);
  assert.equal(r.unlocked, 1);
  assert.equal(r.best['1-1'], 1200);
  assert.deepEqual(r.carry, { power: 3, bombs: 2, speed: 1, shield: 0 });
});

test('최고 점수는 낮아지지 않고, 이미 연 판은 닫히지 않는다', () => {
  let s = defaultSave();
  s = recordClear(s, 5, '1-6', 900, { power: 1, bombs: 1, speed: 0 }, 35);
  s = recordClear(s, 0, '1-1', 100, { power: 1, bombs: 1, speed: 0 }, 35);
  s = recordClear(s, 0, '1-1', 50, { power: 1, bombs: 1, speed: 0 }, 35);
  assert.equal(s.unlocked, 6);
  assert.equal(s.best['1-1'], 100);
});

test('저장소가 깨졌거나 막혀 있어도 기본값으로 돈다', () => {
  const bad = { getItem: () => '{깨짐', setItem: () => { throw new Error('막힘'); } };
  assert.deepEqual(loadSave(bad), defaultSave());
  assert.equal(writeSave(defaultSave(), bad), false);
  const thrower = { getItem: () => { throw new Error('막힘'); } };
  assert.deepEqual(loadSave(thrower), defaultSave());
  assert.equal(typeof SAVE_KEY, 'string');
});
