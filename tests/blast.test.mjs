import test from 'node:test';
import assert from 'node:assert/strict';
import { blastCells, resolveChain, dangerMap } from '../web/js/blast.js';
import { gridFrom, worldOf, bomb } from './helpers.mjs';

const at = (cells) => new Set(cells.map((c) => `${c.x},${c.y}`));

test('불꽃은 십자로 power 칸까지 뻗는다', () => {
  const g = gridFrom(['.........', '.........', '.........', '.........', '.........']);
  const r = blastCells(worldOf(g), 4, 2, 2);
  assert.deepEqual(at(r.cells), new Set(['4,2', '5,2', '6,2', '3,2', '2,2', '4,1', '4,0', '4,3', '4,4']));
  assert.equal(r.cells.find((c) => c.x === 6).part, 'end');
  assert.equal(r.cells.find((c) => c.x === 5).part, 'arm');
});

test('바위 앞에서 멈추고 바위 칸은 타지 않는다', () => {
  const g = gridFrom(['.....', '..#..', '.....']);
  const r = blastCells(worldOf(g), 2, 2, 3);
  assert.ok(!at(r.cells).has('2,1'));
  assert.ok(!at(r.cells).has('2,0'));
});

test('덤불은 그 칸까지 태우고 멈춘다(뒤 칸은 안전)', () => {
  const g = gridFrom(['.+...']);
  const r = blastCells(worldOf(g), 0, 0, 4);
  assert.deepEqual(r.soft, [{ x: 1, y: 0 }]);
  assert.ok(!at(r.cells).has('2,0'));
});

test('바닥 아이템은 태우고 멈춘다', () => {
  const g = gridFrom(['......']);
  const r = blastCells(worldOf(g, [], new Set(['2,0'])), 0, 0, 5);
  assert.deepEqual(r.items, [{ x: 2, y: 0 }]);
  assert.ok(!at(r.cells).has('3,0'));
});

test('연쇄: 불꽃이 닿은 폭탄이 같은 순간 터지고 깊이가 기록된다', () => {
  const g = gridFrom(['.........']);
  const a = bomb(0, 0, 2), b = bomb(2, 0, 2), c = bomb(4, 0, 3), far = bomb(8, 0, 1);
  const w = worldOf(g, [a, b, c, far]);
  const r = resolveChain(w, [a]);
  assert.deepEqual(r.order, [a, b, c]);
  assert.equal(r.depth.get(c), 2);
  assert.equal(far.exploded, false);
  assert.ok(r.flames.has(7 + 0 * 64)); // c 의 불꽃이 7 칸까지
});

test('연쇄에서 덤불은 한 번만, 두 불꽃이 같은 덤불을 쳐도 뒤로 번지지 않는다', () => {
  const g = gridFrom(['..+..']);
  const a = bomb(0, 0, 3), b = bomb(4, 0, 3), c = bomb(1, 0, 1);
  const r = resolveChain(worldOf(g, [a, b, c]), [a, b]);
  assert.equal(r.soft.length, 1);
  assert.equal(c.exploded, true);
});

test('위험 지도: 연쇄로 앞당겨지는 시간까지 계산한다', () => {
  const g = gridFrom(['.......', '.......']);
  const a = bomb(0, 0, 2, 0.5), b = bomb(2, 0, 2, 2.0);
  const d = dangerMap(worldOf(g, [a, b]), [a, b]);
  assert.equal(d[0 * 7 + 4], 0.5); // b 의 불꽃 칸인데 a 때문에 0.5초 뒤
  assert.equal(d[1 * 7 + 6], Infinity);
  const d2 = dangerMap(worldOf(g, []), [], [{ x: 3, y: 1 }]);
  assert.equal(d2[1 * 7 + 3], 0);
});
