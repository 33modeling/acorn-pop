// 자동 플레이: 판마다 시험용 자동 플레이어가 끝까지 깨는지 본다. node scripts/autoplay.mjs [무적 0|1] [판 번호...]
import { LEVELS } from '../web/js/levels.js';
import { createGame, stepGame } from '../web/js/game.js';
import { botThink } from '../web/js/bot.js';

export function autoplay(def, { god = true, maxSeconds = 600, stats, noTimer = god } = {}) {
  const game = createGame({ mode: 'campaign', level: def, godMode: god, stats });
  if (noTimer) game.timeLeft = 1e9; // 시간 제한 없이: 깰 수 있는지만 본다
  const p = game.players[0];
  let input = { dx: 0, dy: 0, bomb: false }, t = 0, bombs = 0, chains = 0;
  const dt = 1 / 60;
  for (let f = 0; f < maxSeconds * 60 && game.status === 'play'; f++) {
    t -= dt;
    if (t <= 0) { input = botThink(game, p); t = 0.05; } else input = { ...input, bomb: false };
    stepGame(game, dt, [input]);
    for (const e of game.events) { if (e.type === 'place') bombs++; if (e.type === 'boom' && e.chain > 1) chains++; }
  }
  return { id: def.id, status: game.status, seconds: Math.round(game.time), deaths: game.players[0].alive ? 0 : 1, why: game.players[0].why, bombs, chains, enemiesLeft: game.enemies.length, stats: { ...p.stats } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const god = process.argv[2] !== '0';
  const pick = process.argv.slice(3).map(Number);
  const list = pick.length ? pick.map((i) => LEVELS[i]) : LEVELS;
  for (const def of list) console.log(JSON.stringify(autoplay(def, { god })));
}
