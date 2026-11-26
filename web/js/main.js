// 화면 흐름: 첫 화면 → (모험: 판 고르기·판 진행) / (대전: 설정·라운드). 게임 갱신은 1/60초 고정 간격.
import { LEVELS, WORLDS, STAGES_PER_WORLD } from './levels.js';
import { createGame, stepGame } from './game.js';
import { botThink } from './bot.js';
import { drawGame, drawSquirrel, drawAcorn, drawEnemy, PLAYER_COLORS, TS } from './render.js';
import { ENEMY_TYPES } from './enemies.js';
import { ITEMS } from './items.js';
import { loadSave, writeSave, recordClear } from './save.js';
import { createInput } from './input.js';
import { playEvents, unlockAudio, setSound } from './audio.js';

const $ = (s) => document.querySelector(s);
const cv = $('#cv');
const ctx = cv.getContext('2d');
const input = createInput(window);
let save = loadSave();
setSound(save.sound);

const S = { game: null, kind: null, levelIndex: 0, theme: 'forest', paused: false, intro: 0, ended: false, series: null, autopilot: false, hudT: 0, t: 0 };
const WORLD_STORY = [
  '솔방울 대왕이 숲의 씨앗 상자를 덤불 속에 숨겼다. 도토리를 놓아 길을 뚫자!',
  '안개 낀 늪. 개구리와 안개불이 떠다닌다. 늪두꺼비 할멈이 둘째 씨앗을 품고 있다.',
  '수정 동굴의 박쥐는 덤불을 뚫고 날아다닌다. 줄이 맞으면 돌진하니 조심!',
  '눈꽃 고개. 꾀돌이 두더지는 불꽃 길을 피한다. 길을 막아 몰아넣자.',
  '잿빛 화산 꼭대기의 잿불 용이 마지막 씨앗을 지킨다. 용도 불씨 폭탄을 낳는다!',
];

// ── 화면 전환
function show(id) {
  for (const el of document.querySelectorAll('.screen')) el.classList.toggle('on', el.id === 'scr-' + id);
  if (id !== 'game') { S.game = null; S.kind = null; }
  if (id === 'map') buildMap();
  if (id === 'title') refreshTitle();
  window.scrollTo(0, 0);
}
for (const b of document.querySelectorAll('[data-go]')) b.addEventListener('click', () => show(b.dataset.go));
function refreshTitle() {
  $('#btn-continue').textContent = save.unlocked > 0 ? `이어하기 (${LEVELS[save.unlocked].id})` : '모험 시작';
  $('#btn-sound').textContent = save.sound ? '소리 켜짐' : '소리 꺼짐';
  $('#btn-sound').setAttribute('aria-pressed', String(save.sound));
}
$('#btn-continue').addEventListener('click', () => startStage(save.unlocked));
$('#btn-map').addEventListener('click', () => show('map'));
$('#btn-vs').addEventListener('click', () => { loadVsForm(); show('vs'); });
$('#btn-help').addEventListener('click', () => { buildHelp(); show('help'); });
$('#btn-sound').addEventListener('click', () => { save.sound = !save.sound; setSound(save.sound); writeSave(save); refreshTitle(); });

// ── 첫 화면 그림
function drawLogo(t) {
  const c = $('#logo'), x = c.getContext('2d');
  x.clearRect(0, 0, c.width, c.height);
  x.fillStyle = '#2b4f27'; x.beginPath(); x.ellipse(160, 128, 150, 20, 0, 0, Math.PI * 2); x.fill();
  drawSquirrel(x, 120, 92, PLAYER_COLORS[0], 'right', t, true, 2.4);
  drawAcorn(x, 220, 98, 1.8, t, 1);
}

// ── 판 고르기
let mapWorld = null;
function buildMap() {
  if (mapWorld === null) mapWorld = Math.floor(Math.min(save.unlocked, LEVELS.length - 1) / STAGES_PER_WORLD);
  const tabs = $('#world-tabs');
  tabs.innerHTML = '';
  WORLDS.forEach((w, i) => {
    const b = document.createElement('button');
    b.textContent = `${i + 1}. ${w.name}`;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(i === mapWorld));
    b.disabled = i * STAGES_PER_WORLD > save.unlocked;
    b.addEventListener('click', () => { mapWorld = i; buildMap(); });
    tabs.appendChild(b);
  });
  $('#world-desc').textContent = WORLD_STORY[mapWorld];
  const grid = $('#stage-grid');
  grid.innerHTML = '';
  for (const L of LEVELS.filter((l) => l.world === mapWorld)) {
    const b = document.createElement('button');
    const open = L.index <= save.unlocked;
    b.disabled = !open;
    if (L.boss) b.classList.add('boss');
    b.innerHTML = `<span class="id">${L.id}${L.boss ? ' 대장' : ''}${save.cleared[L.id] ? ' ✓' : ''}</span><span class="nm">${open ? L.name : '잠김'}</span>`
      + (save.best[L.id] ? `<span class="best">최고 ${save.best[L.id]}</span>` : '');
    b.addEventListener('click', () => startStage(L.index));
    grid.appendChild(b);
  }
}

// ── 하는 법
function mini(draw, w = 40, h = 36) {
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2; c.style.width = w + 'px'; c.style.height = h + 'px';
  const x = c.getContext('2d'); x.scale(2, 2); draw(x);
  return c;
}
function buildHelp() {
  const body = $('#help-body');
  if (body.childElementCount) return;
  const sec = (title, html) => { const s = document.createElement('section'); s.innerHTML = `<h3>${title}</h3>${html}`; body.appendChild(s); return s; };
  sec('조작', `<ul>
    <li>키보드: 방향키 또는 W A S D 로 걷고, 스페이스(또는 Z·X·F) 로 도토리를 놓습니다. Esc·P 는 멈춤.</li>
    <li>대전: 1P 는 W A S D + 스페이스, 2P 는 방향키 + 엔터.</li>
    <li>터치: 왼쪽 방향 패드를 누른 채 미끄러뜨려 걷고, 오른쪽 둥근 단추로 도토리를 놓습니다.</li>
    <li>게임패드: 십자키·왼쪽 막대로 걷고 A 단추로 놓습니다. 1번 패드는 1P, 2번 패드는 2P.</li></ul>`);
  sec('규칙', `<ul>
    <li>도토리는 2.4초 뒤에 터져 위·아래·왼쪽·오른쪽으로 불꽃이 뻗습니다. 바위는 막고, 덤불은 부서집니다.</li>
    <li>불꽃이 다른 도토리에 닿으면 그 도토리도 바로 터집니다(연쇄).</li>
    <li>방금 놓은 도토리 위에서는 비켜날 수 있지만, 한 번 벗어나면 다시 지나갈 수 없습니다. 적도 도토리를 못 지나갑니다.</li>
    <li>덤불 속 어딘가에 나무 굴 출구가 숨어 있습니다. 적을 모두 쓰러뜨리면 출구가 열립니다.</li>
    <li>대장 판은 대장을 쓰러뜨리면 오른쪽 아래에 출구가 나옵니다.</li></ul>`);
  const items = sec('아이템', '<ul id="help-items"></ul>');
  for (const [k, v] of Object.entries(ITEMS)) {
    const li = document.createElement('li');
    li.append(mini((x) => drawItemIcon(x, k), 32, 32), `${v.name} — ${v.desc}`);
    items.querySelector('ul').appendChild(li);
  }
  const en = sec('적', '<ul></ul>');
  for (const [k, v] of Object.entries(ENEMY_TYPES)) {
    const li = document.createElement('li');
    li.append(mini((x) => drawEnemy(x, { type: k, face: 1, hp: v.hp, maxHp: v.hp, boss: !!v.boss, inv: 0, air: 0, phase: 0, dash: 0, wake: 0 }, 0, 20, 20), 40, 36),
      `${v.name}${v.boss ? ' (대장)' : ''} — ${v.desc}`);
    en.querySelector('ul').appendChild(li);
  }
}
function drawItemIcon(x, type) {
  // render.js 의 아이템 그림을 쓰려고 작은 가짜 판을 그린다
  const g = { grid: { w: 1, h: 1, cells: new Uint8Array(1) }, items: new Map([[0, type]]), bombs: [], flames: new Map(), enemies: [], players: [], debris: [], exit: null, mode: 'help' };
  drawGame(x, g, 'forest', 0);
}

// ── 대전 설정
function loadVsForm() {
  $('#vs-p2').value = save.vs.p2; $('#vs-level').value = String(save.vs.level);
  $('#vs-p3').value = save.vs.p3; $('#vs-p4').value = save.vs.p4; $('#vs-rounds').value = String(save.vs.rounds);
}
$('#btn-vs-start').addEventListener('click', () => {
  save.vs = { p2: $('#vs-p2').value, level: +$('#vs-level').value, p3: $('#vs-p3').value, p4: $('#vs-p4').value, rounds: +$('#vs-rounds').value };
  writeSave(save);
  startVersus(save.vs);
});

// ── 게임 시작
function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = 15 * TS * dpr; cv.height = 13 * TS * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function startStage(i) {
  const L = LEVELS[Math.max(0, Math.min(i, LEVELS.length - 1))];
  show('game');
  S.kind = 'campaign'; S.levelIndex = L.index; S.theme = WORLDS[L.world].id; S.ended = false; S.paused = false;
  S.game = createGame({ mode: 'campaign', level: L, stats: save.carry || undefined });
  input.setSolo(true);
  setupCanvas();
  S.intro = 1.6;
  overlay(`<h2>${L.id} ${L.name}</h2><p>${L.stage === 0 ? WORLD_STORY[L.world] : L.boss ? `대장 ${ENEMY_TYPES[L.boss].name}: ${ENEMY_TYPES[L.boss].desc}` : '덤불 속 출구를 찾아 적을 모두 쓰러뜨리자'}</p>`);
}
function startVersus(cfg, keepSeries = false) {
  const players = [{ kind: 'human' }, { kind: cfg.p2 === 'human' ? 'human' : 'cpu', level: cfg.level }];
  if (cfg.p3 === 'cpu') players.push({ kind: 'cpu', level: cfg.level });
  if (cfg.p4 === 'cpu') { if (players.length === 2) players.push({ kind: 'cpu', level: cfg.level }); players.push({ kind: 'cpu', level: cfg.level }); }
  if (!keepSeries || !S.series) S.series = { cfg, wins: players.map(() => 0), round: 0, need: Math.ceil(cfg.rounds / 2) };
  S.series.round++;
  show('game');
  S.kind = 'versus'; S.ended = false; S.paused = false;
  S.theme = WORLDS[(S.series.round - 1) % WORLDS.length].id;
  S.game = createGame({ mode: 'versus', players, seed: S.seedOverride ?? Math.floor(Math.random() * 1e9) });
  input.setSolo(players.filter((p) => p.kind === 'human').length === 1);
  setupCanvas();
  S.intro = 1.2;
  overlay(`<h2>${S.series.round}번째 판</h2><p>${players.map((p, i) => `${PLAYER_COLORS[i].name}${p.kind === 'cpu' ? '(컴퓨터)' : `(${i + 1}P)`}`).join(' · ')}</p>`);
}

// ── 덮개(오버레이)
function overlay(html, buttons = []) {
  const o = $('#overlay');
  o.innerHTML = html + (buttons.length ? '<div class="btns"></div>' : '');
  const box = o.querySelector('.btns');
  for (const [label, fn] of buttons) {
    const b = document.createElement('button');
    b.textContent = label; b.addEventListener('click', fn);
    box.appendChild(b);
  }
  o.hidden = false;
  const first = o.querySelector('button');
  if (first) first.focus();
}
const hideOverlay = () => { $('#overlay').hidden = true; };
function pauseMenu() {
  if (!S.game || S.ended || S.intro > 0) return;
  S.paused = true;
  overlay('<h2>잠깐 멈춤</h2>', [
    ['계속', () => { S.paused = false; hideOverlay(); }],
    ['처음부터', () => (S.kind === 'campaign' ? startStage(S.levelIndex) : startVersus(S.series.cfg, true))],
    ['나가기', () => show(S.kind === 'campaign' ? 'map' : 'title')],
  ]);
}
$('#btn-pause').addEventListener('click', pauseMenu);

function onEnd() {
  const g = S.game;
  S.ended = true;
  if (S.kind === 'campaign') {
    const L = LEVELS[S.levelIndex];
    if (g.status === 'won') {
      save = recordClear(save, L.index, L.id, g.score, g.players[0].stats, LEVELS.length);
      writeSave(save);
      const last = L.index === LEVELS.length - 1;
      const msg = L.boss ? `${ENEMY_TYPES[L.boss].name}을(를) 물리치고 씨앗을 되찾았다!` : '출구에 닿았다!';
      overlay(`<h2>${last ? '모든 씨앗을 되찾았다!' : '판을 깼다'}</h2><p>${msg}</p><p>점수 ${g.score} · 최고 ${save.best[L.id]}</p>`,
        last ? [['판 고르기', () => show('map')], ['처음으로', () => show('title')]]
          : [['다음 판', () => startStage(L.index + 1)], ['판 고르기', () => show('map')]]);
    } else {
      const why = { enemy: '적에게 닿았다', fire: '불꽃에 데었다', time: '시간이 다 됐다' }[g.players[0].why] || '쓰러졌다';
      overlay(`<h2>앗!</h2><p>${why}. 이 판을 시작할 때 능력으로 다시 합니다.</p>`, [
        ['다시 하기', () => startStage(L.index)], ['판 고르기', () => show('map')]]);
    }
  } else {
    const se = S.series;
    if (g.winner !== null) se.wins[g.winner]++;
    const score = se.wins.map((w, i) => `${PLAYER_COLORS[i].name} ${w}`).join(' · ');
    const champ = se.wins.findIndex((w) => w >= se.need);
    const head = g.winner === null ? '비겼다' : `${PLAYER_COLORS[g.winner].name} 승리`;
    if (champ >= 0) {
      overlay(`<h2>${PLAYER_COLORS[champ].name} 최종 우승!</h2><p>${score}</p>`, [
        ['다시 대전', () => { S.series = null; startVersus(se.cfg); }], ['처음으로', () => show('title')]]);
    } else {
      overlay(`<h2>${head}</h2><p>${score}</p>`, [['다음 판', () => startVersus(se.cfg, true)], ['그만하기', () => show('title')]]);
    }
  }
}

// ── 머리띠(HUD)
function hud() {
  const g = S.game;
  if (!g) return;
  const t = Math.max(0, Math.ceil(g.timeLeft));
  const clock = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  const st = (p) => `불꽃 ${p.stats.power} · 도토리 ${p.stats.bombs} · 걸음 ${p.stats.speed + 1}${p.stats.shield ? ' · 방패' : ''}`;
  let html;
  if (S.kind === 'campaign') {
    const L = LEVELS[S.levelIndex];
    html = `<span class="chip">${L.id} ${L.name}</span><span class="chip ${t <= 30 ? 'warn' : ''}">시간 ${clock}</span>`
      + `<span class="chip">점수 ${g.score}</span><span class="chip">남은 적 ${g.enemies.length}</span><span class="chip">${st(g.players[0])}</span>`;
  } else {
    html = `<span class="chip ${g.timeLeft <= 60 ? 'warn' : ''}">시간 ${clock}</span>`
      + g.players.map((p) => `<span class="chip" style="border:2px solid ${PLAYER_COLORS[p.slot].scarf}">${PLAYER_COLORS[p.slot].name} ${S.series.wins[p.slot]}승${p.alive ? '' : ' (쓰러짐)'}</span>`).join('');
  }
  const el = $('#hud');
  if (el.innerHTML !== html) el.innerHTML = html;
}

// ── 터치 단추
input.bindTouch($('#dpad'), $('#btn-bomb'));
const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
if (coarse) $('#touch').classList.add('on');
window.addEventListener('touchstart', () => $('#touch').classList.add('on'), { once: true, passive: true });
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlockAudio, { once: false, passive: true });

// ── 고리
const DT = 1 / 60;
function tick(dt) {
  const g = S.game;
  if (!g) return;
  S.t += dt;
  if (input.takePause()) { if (S.paused) { S.paused = false; hideOverlay(); } else pauseMenu(); }
  if (S.intro > 0) {
    S.intro -= dt;
    input.read();
    if (S.intro <= 0) hideOverlay();
    return;
  }
  if (S.paused || S.ended) { input.read(); return; }
  const inputs = input.read();
  if (S.autopilot && S.kind === 'campaign') inputs[0] = botThink(g, g.players[0]);
  stepGame(g, dt, inputs);
  playEvents(g.events);
  if (g.status !== 'play') onEnd();
}
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  let n = 0;
  while (acc >= DT && n < 6) { tick(DT); acc -= DT; n++; }
  if (S.game) { drawGame(ctx, S.game, S.theme, S.t); hud(); }
  else if ($('#scr-title').classList.contains('on')) drawLogo(now / 1000);
  requestAnimationFrame(frame);
}
refreshTitle();
requestAnimationFrame(frame);

// 시험용 손잡이(헤드리스 브라우저 시험에서 씀)
window.__acorn = {
  get game() { return S.game; },
  get state() { return { kind: S.kind, intro: S.intro, paused: S.paused, ended: S.ended, status: S.game && S.game.status, levelIndex: S.levelIndex, series: S.series }; },
  save: () => save,
  startStage, startVersus,
  autopilot(v) { S.autopilot = v; },
  fast(frames) { for (let i = 0; i < frames && S.game && !S.ended; i++) tick(DT); return S.game && S.game.status; },
  setSeed(v) { S.seedOverride = v; },
};
