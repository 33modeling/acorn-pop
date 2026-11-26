// 헤드리스 자동 플레이 스모크: 화면 없이 게임을 오래 돌려 오류·이상 상태가 없는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../web/js/game.js';
import { botThink } from '../web/js/bot.js';
import { LEVELS } from '../web/js/levels.js';
import { getCell, HARD, SOFT } from '../web/js/grid.js';

function sane(g) {
  for (const p of g.players) if (p.alive) assert.ok(getCell(g.grid, Math.round(p.x), Math.round(p.y)) !== HARD, '사람이 바위 속');
  for (const e of g.enemies) {
    const c = getCell(g.grid, Math.round(e.x), Math.round(e.y));
    assert.ok(c !== HARD || e.air > 0, '적이 바위 속');
    assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y));
  }
  for (const b of g.bombs) assert.ok(b.fuse > -0.1);
}

test('모험: 판마다 컴퓨터가 무적 없이 60초씩 플레이해도 오류가 없다', () => {
  let booms = 0, kills = 0, items = 0, chains = 0;
  for (const def of LEVELS) {
    const g = createGame({ mode: 'campaign', level: def });
    const p = g.players[0];
    let t = 0, inp = { dx: 0, dy: 0, bomb: false };
    for (let i = 0; i < 60 * 60 && g.status === 'play'; i++) {
      t -= 1 / 60;
      if (t <= 0) { inp = botThink(g, p); t = 0.05; } else inp = { ...inp, bomb: false };
      stepGame(g, 1 / 60, [inp]);
      for (const e of g.events) { if (e.type === 'boom') { booms++; if (e.chain > 1) chains++; } if (e.type === 'kill' || e.type === 'bossDown') kills++; if (e.type === 'item') items++; }
      if (i % 30 === 0) sane(g);
    }
  }
  assert.ok(booms > 300, `폭발 ${booms}`);
  assert.ok(kills > 20, `쓰러뜨린 적 ${kills}`);
  assert.ok(items > 10, `먹은 아이템 ${items}`);
  assert.ok(chains >= 1, `연쇄 ${chains}`);
});

test('대전: 컴퓨터 넷이 10판을 끝까지 겨룬다', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const g = createGame({ mode: 'versus', seed, players: [0, 1, 2, 3].map((i) => ({ kind: 'cpu', level: i })) });
    for (let i = 0; i < 160 * 60 && g.status === 'play'; i++) { stepGame(g, 1 / 60, []); if (i % 60 === 0) sane(g); }
    assert.equal(g.status, 'roundEnd');
  }
});
