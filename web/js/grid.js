// 칸 격자: 바닥·바위(안 부서짐)·덤불(부서짐). 밖은 모두 바위로 본다.
export const FLOOR = 0;
export const HARD = 1;
export const SOFT = 2;
export const COLS = 15;
export const ROWS = 13;
export const DIRS = [
  { dx: 0, dy: -1, name: 'up' },
  { dx: 1, dy: 0, name: 'right' },
  { dx: 0, dy: 1, name: 'down' },
  { dx: -1, dy: 0, name: 'left' },
];

export function makeGrid(w = COLS, h = ROWS, fill = FLOOR) {
  return { w, h, cells: new Uint8Array(w * h).fill(fill) };
}
export function cloneGrid(g) {
  return { w: g.w, h: g.h, cells: new Uint8Array(g.cells) };
}
export const key = (x, y) => y * 64 + x;
export const unkey = (k) => ({ x: k % 64, y: Math.floor(k / 64) });
export function inside(g, x, y) {
  return x >= 0 && y >= 0 && x < g.w && y < g.h;
}
export function getCell(g, x, y) {
  return inside(g, x, y) ? g.cells[y * g.w + x] : HARD;
}
export function setCell(g, x, y, v) {
  if (inside(g, x, y)) g.cells[y * g.w + x] = v;
}
// 테두리와 짝수 칸 기둥을 세운 기본 판
export function baseArena(w = COLS, h = ROWS) {
  const g = makeGrid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || (x % 2 === 0 && y % 2 === 0)) setCell(g, x, y, HARD);
  }
  return g;
}
// 너비 우선 탐색: pass(x,y) 가 참인 칸만 지나간다. 거리 배열(Int16, -1 은 못 감)을 돌려준다.
export function bfs(g, sx, sy, pass) {
  const dist = new Int16Array(g.w * g.h).fill(-1);
  const q = [sx, sy];
  dist[sy * g.w + sx] = 0;
  for (let i = 0; i < q.length; i += 2) {
    const x = q[i], y = q[i + 1];
    const d = dist[y * g.w + x];
    for (const D of DIRS) {
      const nx = x + D.dx, ny = y + D.dy;
      if (!inside(g, nx, ny) || dist[ny * g.w + nx] >= 0 || !pass(nx, ny)) continue;
      dist[ny * g.w + nx] = d + 1;
      q.push(nx, ny);
    }
  }
  return dist;
}
