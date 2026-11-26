// 입력: 키보드(두 사람), 터치(방향 패드·도토리 단추), 게임패드(1·2번 패드). 사람마다 {dx, dy, bomb} 하나로 모은다.
const P1 = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
const P2 = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const BOMB1 = ['Space', 'KeyF', 'KeyQ'];
const BOMB2 = ['Enter', 'NumpadEnter', 'Slash', 'ShiftRight', 'Numpad0'];
const BOMB_SOLO = ['KeyZ', 'KeyX'];

export function createInput(target = window) {
  const st = [0, 1].map(() => ({ stack: [], bomb: false, touchDir: null, padDir: null, padBomb: false }));
  let solo = true;
  let pause = false;
  const padPrev = [{}, {}];
  const dirOf = (code) => (P1[code] ? [0, P1[code]] : P2[code] ? [1, P2[code]] : null);
  const slot = (s) => (solo ? 0 : s);
  function down(e) {
    const d = dirOf(e.code);
    if (d) {
      const s = st[slot(d[0])];
      s.stack = s.stack.filter((c) => c !== e.code); s.stack.push(e.code);
      e.preventDefault(); return;
    }
    if (e.repeat) return;
    if (BOMB1.includes(e.code) || (solo && BOMB_SOLO.includes(e.code))) { st[0].bomb = true; e.preventDefault(); return; }
    if (BOMB2.includes(e.code)) { st[slot(1)].bomb = true; e.preventDefault(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') { pause = true; e.preventDefault(); }
  }
  function up(e) {
    for (const s of st) s.stack = s.stack.filter((c) => c !== e.code);
  }
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', () => { for (const s of st) s.stack = []; });

  function pollPads() {
    const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    let n = 0;
    for (const gp of pads) {
      if (!gp || n > 1) continue;
      const s = st[slot(n)];
      const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      let d = null;
      if (b(12) || ay < -0.5) d = [0, -1]; else if (b(13) || ay > 0.5) d = [0, 1];
      if (b(14) || ax < -0.5) d = [-1, 0]; else if (b(15) || ax > 0.5) d = [1, 0];
      if (Math.abs(ax) > 0.5 && Math.abs(ay) > 0.5) d = Math.abs(ax) > Math.abs(ay) ? [Math.sign(ax), 0] : [0, Math.sign(ay)];
      s.padDir = d;
      const bomb = b(0) || b(1) || b(2);
      if (bomb && !padPrev[n].bomb) s.bomb = true;
      if (b(9) && !padPrev[n].start) pause = true;
      padPrev[n] = { bomb, start: b(9) };
      n++;
    }
  }

  // 터치: 방향 패드는 누른 채 미끄러뜨려 방향을 바꿀 수 있다
  function bindTouch(pad, bombBtn) {
    const dirFrom = (ev) => {
      const r = pad.getBoundingClientRect();
      const x = ev.clientX - (r.left + r.width / 2), y = ev.clientY - (r.top + r.height / 2);
      if (Math.hypot(x, y) < r.width * 0.12) return null;
      return Math.abs(x) > Math.abs(y) ? [Math.sign(x), 0] : [0, Math.sign(y)];
    };
    const showDir = (d) => {
      for (const el of pad.querySelectorAll('[data-dir]')) el.classList.toggle('on', !!d && el.dataset.dir === `${d[0]},${d[1]}`);
    };
    let pid = null;
    pad.addEventListener('pointerdown', (ev) => { pid = ev.pointerId; try { pad.setPointerCapture(pid); } catch { /* 가짜 포인터 */ } st[0].touchDir = dirFrom(ev); showDir(st[0].touchDir); ev.preventDefault(); });
    pad.addEventListener('pointermove', (ev) => { if (ev.pointerId === pid) { st[0].touchDir = dirFrom(ev); showDir(st[0].touchDir); } });
    const end = (ev) => { if (ev.pointerId === pid) { pid = null; st[0].touchDir = null; showDir(null); } };
    pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
    bombBtn.addEventListener('pointerdown', (ev) => { st[0].bomb = true; bombBtn.classList.add('on'); ev.preventDefault(); });
    const off = () => bombBtn.classList.remove('on');
    bombBtn.addEventListener('pointerup', off); bombBtn.addEventListener('pointercancel', off); bombBtn.addEventListener('pointerleave', off);
  }

  return {
    setSolo(v) { solo = v; for (const s of st) { s.stack = []; s.bomb = false; } },
    bindTouch,
    takePause() { const p = pause; pause = false; return p; },
    read() {
      pollPads();
      return st.map((s) => {
        const code = s.stack[s.stack.length - 1];
        const d = s.touchDir || s.padDir || (code ? P1[code] || P2[code] : null);
        const out = { dx: d ? d[0] : 0, dy: d ? d[1] : 0, bomb: s.bomb };
        s.bomb = false;
        return out;
      });
    },
    clear() { for (const s of st) { s.stack = []; s.bomb = false; s.touchDir = null; } pause = false; },
  };
}
