import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, placeBomb } from '../web/js/game.js';
import { botThink } from '../web/js/bot.js';
import { LEVELS } from '../web/js/levels.js';

test('컴퓨터는 자기가 놓은 도토리에서 피한다(판 20개 × 30초)', () => {
  let selfKills = 0, bombs = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const g = createGame({ mode: 'versus', seed, players: [{ kind: 'cpu', level: 3 }, { kind: 'human' }] });
    g.players[1].alive = false; // 혼자 덤불만 부수게
    g.endT = -1e9;
    for (let i = 0; i < 30 * 60 && g.players[0].alive; i++) {
      stepGame(g, 1 / 60, []);
      g.status = 'play';
      bombs += g.events.filter((e) => e.type === 'place').length;
    }
    if (!g.players[0].alive) selfKills++;
  }
  assert.ok(bombs > 100, `놓은 도토리 ${bombs}`);
  assert.ok(selfKills <= 1, `스스로 쓰러짐 ${selfKills}/20`);
});

test('위험한 칸에 있으면 안전한 칸으로 걷는다', () => {
  const g = createGame({ mode: 'campaign', level: LEVELS[0] });
  g.enemies = [];
  const p = g.players[0];
  placeBomb(g, p); // (1,1)
  const inp = botThink(g, p);
  assert.ok(inp.dx === 1 || inp.dy === 1);
  assert.equal(inp.bomb, false);
});

test('컴퓨터끼리 대전하면 판이 끝나고 승패가 갈린다', () => {
  const winners = [];
  for (let seed = 1; seed <= 6; seed++) {
    const g = createGame({ mode: 'versus', seed, players: [{ kind: 'cpu', level: 3 }, { kind: 'cpu', level: 0 }] });
    for (let i = 0; i < 160 * 60 && g.status === 'play'; i++) stepGame(g, 1 / 60, []);
    assert.equal(g.status, 'roundEnd');
    winners.push(g.winner);
  }
  assert.ok(winners.filter((w) => w === 0).length >= 3, `고수 승 ${winners}`);
});
