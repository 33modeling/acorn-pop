// 소리: WebAudio 로 그 자리에서 만든다(소리 파일 없음). 첫 터치·키 입력 뒤에 켜진다.
let ac = null;
let on = true;
export function setSound(v) { on = v; }
export function unlockAudio() {
  if (ac || typeof window === 'undefined') return;
  const C = window.AudioContext || window.webkitAudioContext;
  if (C) { try { ac = new C(); } catch { ac = null; } }
}
function tone(freq, dur, type = 'square', vol = 0.06, slide = 0) {
  if (!ac || !on) return;
  const t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.12) {
  if (!ac || !on) return;
  const t = ac.currentTime;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 900;
  s.buffer = buf; g.gain.value = vol;
  s.connect(f).connect(g).connect(ac.destination); s.start(t);
}
export function playEvents(events) {
  for (const e of events) {
    switch (e.type) {
      case 'place': tone(520, 0.06, 'triangle', 0.05); break;
      case 'boom': noise(0.35 + Math.min(0.3, e.chain * 0.05)); tone(90, 0.3, 'sine', 0.12, -40); break;
      case 'item': tone(660, 0.07); setTimeout(() => tone(880, 0.07), 70); setTimeout(() => tone(1175, 0.1), 140); break;
      case 'kill': tone(300, 0.15, 'square', 0.05, 300); break;
      case 'bossHit': tone(180, 0.18, 'sawtooth', 0.06, -60); break;
      case 'bossDown': noise(0.6); tone(220, 0.5, 'triangle', 0.08, 400); break;
      case 'die': tone(440, 0.5, 'square', 0.06, -380); break;
      case 'shield': tone(990, 0.12, 'sine', 0.06, -400); break;
      case 'exit': tone(784, 0.12, 'triangle', 0.06); break;
      case 'open': tone(523, 0.1, 'triangle', 0.06); setTimeout(() => tone(784, 0.15, 'triangle', 0.06), 100); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'triangle', 0.07), i * 110)); break;
      case 'wall': tone(140, 0.08, 'square', 0.03); break;
      default: break;
    }
  }
}
