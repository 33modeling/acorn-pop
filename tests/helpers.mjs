// 시험용 작은 판 만들기: 문자열 지도로 격자를 만든다. '#' 바위, '+' 덤불, '.' 바닥
import { makeGrid, setCell, HARD, SOFT } from '../web/js/grid.js';
export function gridFrom(rows) {
  const g = makeGrid(rows[0].length, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => setCell(g, x, y, ch === '#' ? HARD : ch === '+' ? SOFT : 0)));
  return g;
}
export function worldOf(grid, bombs = [], items = new Set()) {
  return { grid, bombAt: (x, y) => bombs.find((b) => !b.exploded && b.x === x && b.y === y) || null, itemAt: (x, y) => items.has(`${x},${y}`) };
}
export const bomb = (x, y, power = 1, fuse = 2.4) => ({ x, y, power, fuse, exploded: false, owner: 'p0', passers: new Set() });
