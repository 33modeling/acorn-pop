// Canvas 2D 그림. 그림 파일 없이 모두 코드로 그린다.
import { getCell, HARD, SOFT } from './grid.js';

export const TS = 32;
export const THEMES = {
  forest:  { floor: ['#a7d37f', '#9bc973'], hard: '#7d8a6a', hardHi: '#a5b38f', soft: '#3f8f3a', softHi: '#6cc45e', accent: '#d9463b', sky: '#2f5d2a' },
  marsh:   { floor: ['#9fc3a8', '#93b99c'], hard: '#6a7a80', hardHi: '#93a6ad', soft: '#8aa04b', softHi: '#c2d36b', accent: '#e8d36a', sky: '#24423f' },
  cave:    { floor: ['#5f5a7a', '#58536f'], hard: '#3a3552', hardHi: '#6a6290', soft: '#7fc6d9', softHi: '#d2f4ff', accent: '#ff9be0', sky: '#1c1830' },
  snow:    { floor: ['#e6eef6', '#dbe6f1'], hard: '#8fa6bb', hardHi: '#c5d6e6', soft: '#ffffff', softHi: '#bfe0ff', accent: '#4f8ad8', sky: '#3a5a7a' },
  volcano: { floor: ['#6b5146', '#624a40'], hard: '#2e2524', hardHi: '#58463f', soft: '#8a6f62', softHi: '#c4a08b', accent: '#ff7a2e', sky: '#2a1512' },
};
export const PLAYER_COLORS = [
  { name: '도담', body: '#d9853b', belly: '#f8d9a8', tail: '#b9652a', scarf: '#2f6fd6' },
  { name: '보리', body: '#8d96a8', belly: '#e9ecf2', tail: '#6f7889', scarf: '#d63b5a' },
  { name: '달래', body: '#f1efe7', belly: '#fffdf6', tail: '#d8d3c2', scarf: '#3aa565' },
  { name: '먹쇠', body: '#4a3b33', belly: '#a58a76', tail: '#33281f', scarf: '#e8b52a' },
];

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };

function drawHard(ctx, th, x, y, world) {
  const px = x * TS, py = y * TS;
  ctx.fillStyle = th.hard; rr(ctx, px + 1, py + 1, TS - 2, TS - 2, 6); ctx.fill();
  ctx.fillStyle = th.hardHi; rr(ctx, px + 4, py + 3, TS - 12, 8, 4); ctx.fill();
  if (world === 'cave') { ctx.fillStyle = '#9b8cff'; ctx.beginPath(); ctx.moveTo(px + 20, py + 26); ctx.lineTo(px + 25, py + 12); ctx.lineTo(px + 29, py + 26); ctx.fill(); }
  if (world === 'forest') { ctx.fillStyle = '#5d9b4a'; circle(ctx, px + 8, py + 25, 4); ctx.fill(); }
  if (world === 'volcano') { ctx.strokeStyle = '#ff7a2e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px + 8, py + 26); ctx.lineTo(px + 14, py + 18); ctx.lineTo(px + 19, py + 24); ctx.stroke(); }
  if (world === 'snow') { ctx.fillStyle = '#ffffff'; rr(ctx, px + 2, py + 1, TS - 4, 6, 3); ctx.fill(); }
}
function drawSoft(ctx, th, x, y, world) {
  const px = x * TS, py = y * TS;
  if (world === 'forest' || world === 'marsh') {
    ctx.fillStyle = th.soft;
    for (const [cx, cy, r] of [[10, 20, 9], [22, 20, 9], [16, 11, 9]]) { circle(ctx, px + cx, py + cy, r); ctx.fill(); }
    ctx.fillStyle = th.softHi;
    for (const [cx, cy] of [[12, 9], [7, 18], [20, 17]]) { circle(ctx, px + cx, py + cy, 3); ctx.fill(); }
    ctx.fillStyle = th.accent;
    for (const [cx, cy] of [[22, 24], [11, 24]]) { circle(ctx, px + cx, py + cy, 2.2); ctx.fill(); }
  } else if (world === 'cave') {
    ctx.fillStyle = th.soft;
    ctx.beginPath(); ctx.moveTo(px + 4, py + 28); ctx.lineTo(px + 9, py + 6); ctx.lineTo(px + 15, py + 28); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px + 13, py + 28); ctx.lineTo(px + 20, py + 3); ctx.lineTo(px + 28, py + 28); ctx.fill();
    ctx.fillStyle = th.softHi; ctx.beginPath(); ctx.moveTo(px + 18, py + 24); ctx.lineTo(px + 20, py + 8); ctx.lineTo(px + 21, py + 24); ctx.fill();
  } else if (world === 'snow') {
    ctx.fillStyle = th.softHi; rr(ctx, px + 3, py + 6, TS - 6, TS - 9, 9); ctx.fill();
    ctx.fillStyle = th.soft; rr(ctx, px + 4, py + 5, TS - 8, TS - 14, 8); ctx.fill();
    ctx.strokeStyle = '#9cc7f2'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px + 9, py + 18); ctx.lineTo(px + 15, py + 14); ctx.lineTo(px + 21, py + 19); ctx.stroke();
  } else {
    ctx.fillStyle = th.soft; rr(ctx, px + 3, py + 4, TS - 6, TS - 7, 7); ctx.fill();
    ctx.fillStyle = th.softHi; rr(ctx, px + 6, py + 7, 10, 6, 3); ctx.fill();
    ctx.strokeStyle = '#3a2a24'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px + 9, py + 24); ctx.lineTo(px + 16, py + 16); ctx.lineTo(px + 24, py + 22); ctx.stroke();
  }
}

export function drawAcorn(ctx, cx, cy, s, t, glow) {
  const pulse = 1 + Math.sin(t * 10) * 0.06 * glow;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s * pulse, s * pulse);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(0, 12, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b06a2c'; ctx.beginPath(); ctx.ellipse(0, 3, 10, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d98f4b'; ctx.beginPath(); ctx.ellipse(-3, 3, 3, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b4a2b'; ctx.beginPath(); ctx.ellipse(0, -6, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8b6640'; ctx.lineWidth = 1; for (let i = -9; i <= 9; i += 4) { ctx.beginPath(); ctx.moveTo(i, -10); ctx.lineTo(i + 2, -2); ctx.stroke(); }
  ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -11); ctx.quadraticCurveTo(3, -16, 6, -15); ctx.stroke();
  if (glow) { ctx.fillStyle = Math.sin(t * 30) > 0 ? '#fff27a' : '#ff9d2e'; circle(ctx, 6, -15, 2.6); ctx.fill(); }
  ctx.restore();
}

function drawFlame(ctx, f, t) {
  const px = f.x * TS + TS / 2, py = f.y * TS + TS / 2;
  const k = Math.max(0, Math.min(1, f.ttl / 0.55));
  const w = 10 + 12 * k;
  ctx.save(); ctx.translate(px, py);
  const horiz = f.dir === 'left' || f.dir === 'right';
  const grad = (c1, c2) => { ctx.fillStyle = c1; ctx.globalAlpha = 0.95; };
  if (f.part === 'center') {
    grad('#ff8a2a'); circle(ctx, 0, 0, w * 0.75); ctx.fill();
    ctx.fillStyle = '#ffd34d'; circle(ctx, 0, 0, w * 0.5); ctx.fill();
    ctx.fillStyle = '#fffbe0'; circle(ctx, 0, 0, w * 0.25); ctx.fill();
  } else {
    if (!horiz) ctx.rotate(Math.PI / 2);
    const flip = f.dir === 'left' || f.dir === 'up' ? -1 : 1;
    ctx.scale(flip, 1);
    const len = f.part === 'end' ? TS * 0.42 : TS / 2;
    grad('#ff8a2a'); rr(ctx, -TS / 2, -w / 2, TS / 2 + len, w, w / 2); ctx.fill();
    ctx.fillStyle = '#ffd34d'; rr(ctx, -TS / 2, -w / 4, TS / 2 + len - 3, w / 2, w / 4); ctx.fill();
    // 꽃잎 모양 끝
    if (f.part === 'end') { ctx.fillStyle = '#ffb347'; circle(ctx, len - 2, 0, w * 0.35 + Math.sin(t * 25) * 1.2); ctx.fill(); }
  }
  ctx.restore();
}

function drawItem(ctx, type, x, y, t) {
  const cx = x * TS + TS / 2, cy = y * TS + TS / 2 + Math.sin(t * 4 + x) * 1.5;
  ctx.fillStyle = '#fff6dc'; circle(ctx, cx, cy, 13); ctx.fill();
  ctx.strokeStyle = '#c78a3a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); ctx.translate(cx, cy);
  if (type === 'fire') {
    ctx.fillStyle = '#ff6a1f'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(9, 0, 0, 9); ctx.quadraticCurveTo(-9, 0, 0, -9); ctx.fill();
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(0, -3); ctx.quadraticCurveTo(4, 3, 0, 7); ctx.quadraticCurveTo(-4, 3, 0, -3); ctx.fill();
  } else if (type === 'bomb') {
    ctx.restore(); drawAcorn(ctx, cx, cy + 1, 0.55, t, 0); ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#2e7d32'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('+', 5, -3);
  } else if (type === 'speed') {
    ctx.rotate(-0.6); ctx.fillStyle = '#5bb5f0'; ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1f5f8f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 11); ctx.stroke();
  } else if (type === 'shield') {
    ctx.fillStyle = '#3aa565'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(11, -2, 0, 10); ctx.quadraticCurveTo(-11, -2, 0, -10); ctx.fill();
    ctx.strokeStyle = '#1f6b3c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
  } else if (type === 'time') {
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-7, -10, 14, 3); ctx.fillRect(-7, 7, 14, 3);
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(-5, -7); ctx.lineTo(5, -7); ctx.lineTo(0, 0); ctx.lineTo(5, 7); ctx.lineTo(-5, 7); ctx.lineTo(0, 0); ctx.fill();
  }
  ctx.restore();
}

function drawExit(ctx, ex, t) {
  const px = ex.x * TS, py = ex.y * TS;
  ctx.fillStyle = '#6b4a2b'; rr(ctx, px + 3, py + 4, TS - 6, TS - 6, 12); ctx.fill();
  ctx.fillStyle = ex.open ? `hsl(${(t * 120) % 360},90%,70%)` : '#2a1d12';
  ctx.beginPath(); ctx.ellipse(px + TS / 2, py + TS / 2 + 2, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
  if (ex.open) { ctx.strokeStyle = '#fff6b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px + TS / 2, py + TS / 2 + 2, 12 + Math.sin(t * 6) * 2, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = '#9b6b3d'; ctx.fillRect(px + 6, py + 4, 20, 3);
}

export function drawSquirrel(ctx, cx, cy, col, dir, walkT, alive, scale = 1) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale);
  const bob = alive ? Math.abs(Math.sin(walkT * 12)) * 2 : 0;
  const face = dir === 'left' ? -1 : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(0, 13, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(0, -bob);
  // 꼬리
  ctx.fillStyle = col.tail; ctx.beginPath(); ctx.ellipse(-9 * face, -2, 7, 12, -0.4 * face, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col.body; ctx.beginPath(); ctx.ellipse(-10 * face, -8, 5, 7, -0.6 * face, 0, Math.PI * 2); ctx.fill();
  // 몸
  ctx.fillStyle = col.body; ctx.beginPath(); ctx.ellipse(0, 4, 8, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col.belly; ctx.beginPath(); ctx.ellipse(1 * face, 6, 4.5, 6, 0, 0, Math.PI * 2); ctx.fill();
  // 목도리
  ctx.fillStyle = col.scarf; rr(ctx, -7, -3, 14, 4, 2); ctx.fill();
  // 머리
  ctx.fillStyle = col.body; circle(ctx, 1 * face, -9, 8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-6, -13); ctx.lineTo(-4, -20); ctx.lineTo(-1, -15); ctx.fill();
  ctx.beginPath(); ctx.moveTo(7, -13); ctx.lineTo(5, -20); ctx.lineTo(2, -15); ctx.fill();
  ctx.fillStyle = col.belly; circle(ctx, 3 * face, -6, 4); ctx.fill();
  if (alive) {
    ctx.fillStyle = '#20150e';
    if (dir === 'up') { /* 뒤통수 */ } else { circle(ctx, -1 + 2 * face, -10, 1.6); ctx.fill(); circle(ctx, 4 + 2 * face, -10, 1.6); ctx.fill(); }
    ctx.fillStyle = '#3a2418'; circle(ctx, 4 * face, -6.5, 1.3); ctx.fill();
  } else {
    ctx.strokeStyle = '#20150e'; ctx.lineWidth = 1.5;
    for (const ex of [-1, 4]) { ctx.beginPath(); ctx.moveTo(ex - 1.5, -11.5); ctx.lineTo(ex + 1.5, -8.5); ctx.moveTo(ex + 1.5, -11.5); ctx.lineTo(ex - 1.5, -8.5); ctx.stroke(); }
  }
  ctx.restore();
}

export function drawEnemy(ctx, e, t, cx, cy) {

  const s = e.boss ? 1.55 : 1;
  ctx.save(); ctx.translate(cx, cy);
  if (e.air > 0) {
    // 공중: 그림자만 내려앉을 곳에
    ctx.restore();
    const lx = e.landX * TS + TS / 2, ly = e.landY * TS + TS / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(lx, ly + 10, 16 * (1.2 - e.air), 6 * (1.2 - e.air), 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(lx, ly - 80 * Math.sin(Math.PI * Math.min(1, e.air / 1.1)));
  }
  if (e.inv > 0 && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.scale(s * (e.face || 1), s);
  if (e.wake > 0) ctx.rotate(Math.sin(t * 3) * 0.1);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(0, 12, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
  const eyes = (y, c = '#fff', r = 3) => {
    ctx.fillStyle = c; circle(ctx, -3.5, y, r); ctx.fill(); circle(ctx, 3.5, y, r); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; circle(ctx, -2.6, y + 0.5, r * 0.45); ctx.fill(); circle(ctx, 4.4, y + 0.5, r * 0.45); ctx.fill();
  };
  switch (e.type) {
    case 'pine': case 'bossPine': {
      ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(13, 0, 0, 12); ctx.quadraticCurveTo(-13, 0, 0, -14); ctx.fill();
      ctx.strokeStyle = '#5c3a1a'; ctx.lineWidth = 1.5;
      for (let i = -8; i <= 8; i += 5) { ctx.beginPath(); ctx.moveTo(-8, i); ctx.lineTo(0, i + 4); ctx.lineTo(8, i); ctx.stroke(); }
      eyes(-2);
      if (e.type === 'bossPine') { ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(-7, -13); ctx.lineTo(-5, -20); ctx.lineTo(-1, -15); ctx.lineTo(2, -21); ctx.lineTo(4, -15); ctx.lineTo(8, -20); ctx.lineTo(7, -13); ctx.fill(); }
      break;
    }
    case 'frog': case 'bossToad': {
      const hop = e.type === 'frog' ? Math.max(0, Math.sin((e.phase / 0.45) * Math.PI)) * 4 : 0;
      ctx.translate(0, -hop);
      ctx.fillStyle = e.type === 'frog' ? '#3fae4a' : '#6c7f3a'; ctx.beginPath(); ctx.ellipse(0, 4, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = e.type === 'frog' ? '#bfeab0' : '#c9c48a'; ctx.beginPath(); ctx.ellipse(0, 7, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = e.type === 'frog' ? '#3fae4a' : '#6c7f3a'; circle(ctx, -5, -5, 5); ctx.fill(); circle(ctx, 5, -5, 5); ctx.fill();
      eyes(-5, '#fff', 3.4);
      if (e.type === 'bossToad') { ctx.fillStyle = '#b04a8a'; rr(ctx, -9, -13, 18, 4, 2); ctx.fill(); ctx.fillStyle = '#ffd34d'; circle(ctx, 0, -14, 2.5); ctx.fill(); }
      break;
    }
    case 'wisp': case 'bossBat': {
      if (e.type === 'wisp') {
        ctx.globalAlpha *= 0.8;
        ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.moveTo(-10, 10); ctx.quadraticCurveTo(-12, -8, 0, -14 + Math.sin(t * 8) * 2); ctx.quadraticCurveTo(12, -8, 10, 10);
        ctx.quadraticCurveTo(5, 6, 0, 11); ctx.quadraticCurveTo(-5, 6, -10, 10); ctx.fill();
        ctx.fillStyle = '#e6f7ff'; circle(ctx, 0, 0, 5); ctx.fill();
        eyes(-2, '#e6f7ff', 2.6);
      } else {
        const flap = Math.sin(t * 14) * 5;
        ctx.fillStyle = '#7a6cff';
        ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(-17, -8 + flap); ctx.lineTo(-13, 2); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(3, -2); ctx.lineTo(17, -8 + flap); ctx.lineTo(13, 2); ctx.lineTo(8, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#b7f0ff'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 0); ctx.lineTo(0, 10); ctx.lineTo(-8, 0); ctx.fill();
        eyes(-2, '#ff9be0', 2.4);
        if (e.dash > 0) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, 8); ctx.lineTo(-20, 8); ctx.moveTo(-14, -6); ctx.lineTo(-22, -6); ctx.stroke(); }
      }
      break;
    }
    case 'fox': {
      ctx.fillStyle = '#ff7a2e'; ctx.beginPath(); ctx.moveTo(-10, 10); ctx.quadraticCurveTo(-12, -4, -8, -12); ctx.lineTo(-4, -6); ctx.lineTo(4, -6); ctx.lineTo(8, -12);
      ctx.quadraticCurveTo(12, -4, 10, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(0, 4, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-14, 6); ctx.quadraticCurveTo(-18, -2 + Math.sin(t * 9) * 3, -11, -4); ctx.lineTo(-10, 6); ctx.fill();
      eyes(-2, '#fff3c4', 2.6);
      break;
    }
    case 'mole': {
      ctx.fillStyle = '#5a5148'; ctx.beginPath(); ctx.ellipse(0, 3, 11, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff9aa8'; circle(ctx, 0, 1, 3.5); ctx.fill();
      ctx.fillStyle = '#f2c9a8'; ctx.fillRect(-10, 9, 6, 3); ctx.fillRect(4, 9, 6, 3);
      ctx.fillStyle = '#ffd34d'; rr(ctx, -9, -10, 18, 4, 2); ctx.fill();
      ctx.fillStyle = '#111'; circle(ctx, -4, -3, 1.8); ctx.fill(); circle(ctx, 4, -3, 1.8); ctx.fill();
      break;
    }
    case 'turtle': {
      ctx.fillStyle = '#9fbf6a'; circle(ctx, 10, 2, 5); ctx.fill();
      ctx.fillStyle = e.hp > 1 ? '#7d7f86' : '#a37a5a'; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * 11, 2 + Math.sin(a) * 9); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#4f5157'; ctx.lineWidth = 1.5; ctx.stroke();
      if (e.hp <= 1) { ctx.strokeStyle = '#2a1d12'; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(0, 4); ctx.lineTo(5, -1); ctx.stroke(); }
      ctx.fillStyle = '#111'; circle(ctx, 11, 0.5, 1.4); ctx.fill();
      break;
    }
    case 'bossBear': {
      ctx.fillStyle = '#eef4fb'; ctx.strokeStyle = '#3d5f86'; ctx.lineWidth = 1.6;
      circle(ctx, -8, -9, 4); ctx.fill(); ctx.stroke(); circle(ctx, 8, -9, 4); ctx.fill(); ctx.stroke();
      circle(ctx, 0, 2, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#bcd3ea'; ctx.beginPath(); ctx.ellipse(0, 5, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#26364a'; circle(ctx, 0, 3, 2); ctx.fill();
      eyes(-3, e.hp < e.maxHp ? '#ff8a8a' : '#fff', 2.4);
      ctx.fillStyle = '#4f8ad8'; rr(ctx, -10, -1 + 9, 20, 3, 1.5); ctx.fill();
      break;
    }
    case 'bossDragon': {
      ctx.fillStyle = '#3a2a2a'; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-18, -12 + Math.sin(t * 6) * 3); ctx.lineTo(-10, 4); ctx.fill();
      ctx.fillStyle = '#c2402a'; ctx.beginPath(); ctx.ellipse(0, 4, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c2402a'; circle(ctx, 6, -7, 7); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(2, -12); ctx.lineTo(4, -19); ctx.lineTo(7, -13); ctx.fill(); ctx.beginPath(); ctx.moveTo(8, -12); ctx.lineTo(11, -18); ctx.lineTo(12, -11); ctx.fill();
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.ellipse(0, 7, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; circle(ctx, 8, -8, 2.5); ctx.fill(); ctx.fillStyle = '#111'; circle(ctx, 8.8, -8, 1.2); ctx.fill();
      ctx.fillStyle = '#ff7a2e'; circle(ctx, 14, -5, 1.5 + Math.abs(Math.sin(t * 8)) * 1.5); ctx.fill();
      break;
    }
    default: break;
  }
  if (e.wake > 0) { ctx.scale(1 / (s * (e.face || 1)), 1 / s); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('z', 9, -14 - (t * 8) % 6); }
  ctx.restore();

}

export function drawGame(ctx, game, themeId, t) {
  const th = THEMES[themeId] || THEMES.forest;
  const g = game.grid;
  ctx.fillStyle = th.sky; ctx.fillRect(0, 0, g.w * TS, g.h * TS);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    ctx.fillStyle = th.floor[(x + y) & 1]; ctx.fillRect(x * TS, y * TS, TS, TS);
  }
  if (game.exit && game.exit.revealed) drawExit(ctx, game.exit, t);
  for (const [k, type] of game.items) drawItem(ctx, type, k % 64, Math.floor(k / 64), t);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = getCell(g, x, y);
    if (c === HARD) drawHard(ctx, th, x, y, themeId);
    else if (c === SOFT) drawSoft(ctx, th, x, y, themeId);
  }
  for (const d of game.debris) {
    const k = d.t / 0.5;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = th.softHi;
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + d.x;
      circle(ctx, d.x * TS + TS / 2 + Math.cos(a) * 14 * k, d.y * TS + TS / 2 + Math.sin(a) * 14 * k, 3 * (1 - k) + 1); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  for (const b of game.bombs) drawAcorn(ctx, b.x * TS + TS / 2, b.y * TS + TS / 2 + 1, 0.85 + (b.fuse < 0.6 ? 0.12 : 0), t * (b.fuse < 0.8 ? 2 : 1), 1);
  for (const f of game.flames.values()) drawFlame(ctx, f, t);
  for (const e of game.enemies) drawEnemy(ctx, e, t, e.x * TS + TS / 2, e.y * TS + TS / 2);
  for (const p of game.players) {
    if (!p.alive && p.deadT > 1.2) continue;
    const col = PLAYER_COLORS[p.slot];
    ctx.save();
    if (!p.alive) ctx.globalAlpha = Math.max(0, 1 - p.deadT / 1.2);
    else if (p.inv > 0 && Math.floor(t * 16) % 2 === 0) ctx.globalAlpha = 0.5;
    drawSquirrel(ctx, p.x * TS + TS / 2, p.y * TS + TS / 2, col, p.dir, p.walkT, p.alive);
    if (p.stats.shield) { ctx.strokeStyle = '#3aa565'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x * TS + TS / 2, p.y * TS + TS / 2 - 2, 15, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    if (game.mode === 'versus' && p.alive) {
      ctx.fillStyle = col.scarf; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.cpu ? 'CPU' : `${p.slot + 1}P`, p.x * TS + TS / 2, p.y * TS - 6); ctx.textAlign = 'left';
    }
  }
  // 보스 체력
  const boss = game.enemies.find((e) => e.boss);
  if (boss) {
    const w = 160, x = (g.w * TS - w) / 2, y = 6;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(ctx, x - 4, y - 3, w + 8, 14, 6); ctx.fill();
    ctx.fillStyle = '#ff5a5a'; rr(ctx, x, y, (w * boss.hp) / boss.maxHp, 8, 4); ctx.fill();
  }
}
