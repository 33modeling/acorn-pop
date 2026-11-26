// 헤드리스 브라우저 시험. Playwright 를 설치하지 않고 PLAYWRIGHT_MODULE(다른 곳의 playwright/index.mjs)이나
// 이 레포 node_modules 의 playwright 를 쓴다. 없으면 건너뛴다. 스크린샷은 shots/ 에 남긴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from '../../scripts/server.mjs';

async function chromium() {
  try {
    const mod = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    return (mod.chromium ? mod : mod.default).chromium;
  } catch { return null; }
}
const pw = await chromium();
const skip = pw ? false : 'playwright 없음';
fs.mkdirSync('shots', { recursive: true });

test('브라우저: 첫 화면·모험·조작·저장·대전·휴대폰 화면', { skip, timeout: 180000 }, async () => {
  const srv = await startServer(0);
  const browser = await pw.launch({ args: ['--disable-gpu', '--mute-audio'] });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(srv.url);
    await page.waitForTimeout(300);
    assert.equal(await page.title(), '도토리 펑');
    await page.screenshot({ path: 'shots/title.png' });

    // 모험 시작 → 판 소개 → 키보드로 걷고 도토리 놓기
    await page.click('#btn-continue');
    await page.waitForFunction(() => window.__acorn.state.kind === 'campaign' && window.__acorn.state.intro <= 0, null, { timeout: 5000 });
    const x0 = await page.evaluate(() => window.__acorn.game.players[0].x);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(250); await page.keyboard.up('ArrowRight');
    const x1 = await page.evaluate(() => window.__acorn.game.players[0].x);
    assert.ok(x1 > x0, `오른쪽으로 걷기 ${x0}→${x1}`);
    await page.keyboard.press('Space');
    await page.waitForTimeout(80);
    assert.equal(await page.evaluate(() => window.__acorn.game.bombs.length), 1);
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'shots/game.png' });

    // 멈춤 메뉴
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
    assert.equal(await page.evaluate(() => window.__acorn.state.paused), true);
    await page.click('#overlay button:has-text("계속")');

    // 자동 플레이로 1-1 끝까지 → 저장 확인
    await page.evaluate(() => { window.__acorn.startStage(0); });
    await page.evaluate(() => { window.__acorn.autopilot(true); window.__acorn.fast(200); });
    const status = await page.evaluate(() => { for (let i = 0; i < 400 && window.__acorn.game.status === 'play'; i++) window.__acorn.fast(120); return window.__acorn.game.status; });
    assert.equal(status, 'won');
    await page.waitForTimeout(100);
    assert.match(await page.textContent('#overlay'), /판을 깼다/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('acorn-pop-save-v1')));
    assert.equal(saved.unlocked, 1);
    assert.ok(saved.cleared['1-1']);
    await page.evaluate(() => window.__acorn.autopilot(false));

    // 다시 열어도 이어하기
    await page.reload();
    await page.waitForTimeout(200);
    assert.match(await page.textContent('#btn-continue'), /이어하기 \(1-2\)/);

    // 대전: 사람 대 컴퓨터
    await page.click('#btn-vs');
    await page.selectOption('#vs-p2', 'cpu');
    await page.selectOption('#vs-p3', 'cpu');
    await page.selectOption('#vs-rounds', '1');
    await page.evaluate(() => window.__acorn.setSeed(5));
    await page.click('#btn-vs-start');
    await page.waitForFunction(() => window.__acorn.state.kind === 'versus' && window.__acorn.state.intro <= 0, null, { timeout: 5000 });
    assert.equal(await page.evaluate(() => window.__acorn.game.players.length), 3);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'shots/versus.png' });
    const vs = await page.evaluate(() => { for (let i = 0; i < 200 && window.__acorn.game.status === 'play'; i++) window.__acorn.fast(60); return window.__acorn.game.status; });
    assert.equal(vs, 'roundEnd');
    await page.waitForTimeout(100);
    assert.match(await page.textContent('#overlay'), /우승|비겼다|승리/);
    assert.deepEqual(errors, []);

    // 휴대폰 세로: 가로 스크롤 없음, 터치 단추 44px 이상, 터치로 걷기·놓기
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const m = await ctx.newPage();
    const merr = [];
    m.on('pageerror', (e) => merr.push(String(e)));
    await m.goto(srv.url);
    await m.waitForTimeout(200);
    await m.screenshot({ path: 'shots/mobile-title.png' });
    await m.tap('#btn-continue');
    await m.waitForFunction(() => window.__acorn.state.intro <= 0, null, { timeout: 5000 });
    const sizes = await m.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, w: innerWidth, bomb: r('#btn-bomb'), pause: r('#btn-pause'), touch: getComputedStyle(document.querySelector('#touch')).display };
    });
    assert.ok(sizes.sw <= sizes.w, `가로 넘침 ${sizes.sw}>${sizes.w}`);
    assert.notEqual(sizes.touch, 'none');
    assert.ok(sizes.bomb.width >= 44 && sizes.pause.width >= 44);
    const pad = await m.evaluate(() => { const r = document.querySelector('#dpad').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
    const y0 = await m.evaluate(() => window.__acorn.game.players[0].y);
    // 아래쪽 누르기(포인터 이벤트)
    await m.dispatchEvent('#dpad', 'pointerdown', { pointerId: 7, clientX: pad.x, clientY: pad.y + pad.w * 0.4, isPrimary: true, pointerType: 'touch' });
    await m.waitForTimeout(250);
    await m.dispatchEvent('#dpad', 'pointerup', { pointerId: 7, clientX: pad.x, clientY: pad.y + pad.w * 0.4, pointerType: 'touch' });
    const y1 = await m.evaluate(() => window.__acorn.game.players[0].y);
    assert.ok(y1 > y0, `터치로 아래로 ${y0}→${y1}`);
    await m.dispatchEvent('#btn-bomb', 'pointerdown', { pointerId: 8, pointerType: 'touch' });
    await m.waitForTimeout(80);
    assert.equal(await m.evaluate(() => window.__acorn.game.bombs.length), 1);
    await m.waitForTimeout(400);
    await m.screenshot({ path: 'shots/mobile-game.png' });
    // 글자 16px 이상(화면에 보이는 글자)
    const small = await m.evaluate(() => [...document.querySelectorAll('#scr-game *')].filter((el) => el.offsetParent && el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => el.outerHTML.slice(0, 60)));
    assert.deepEqual(small, []);
    assert.deepEqual(merr, []);
    await ctx.close();
  } finally {
    await browser.close();
    srv.close();
  }
});
