// 저장(localStorage). 개인 정보 없이 진행 상황·최고 점수·설정만. 저장소를 못 쓰는 브라우저에서도 게임은 돈다.
export const SAVE_KEY = 'acorn-pop-save-v1';
export function defaultSave() {
  return { v: 1, unlocked: 0, cleared: {}, best: {}, carry: null, sound: true, touch: 'auto',
    vs: { p2: 'cpu', level: 2, p3: 'none', p4: 'none', rounds: 3 }, vsWins: [0, 0, 0, 0] };
}
export function loadSave(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const d = JSON.parse(raw);
    const base = defaultSave();
    return { ...base, ...d, vs: { ...base.vs, ...(d.vs || {}) }, cleared: d.cleared || {}, best: d.best || {} };
  } catch {
    return defaultSave();
  }
}
export function writeSave(save, storage = globalThis.localStorage) {
  try { storage && storage.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch { return false; }
}
// 판을 깼을 때 저장 갱신(순수 함수: 새 객체를 돌려줌)
export function recordClear(save, levelIndex, levelId, score, stats, total) {
  const s = { ...save, cleared: { ...save.cleared, [levelId]: true }, best: { ...save.best } };
  if (!(s.best[levelId] >= score)) s.best[levelId] = score;
  s.unlocked = Math.min(Math.max(save.unlocked, levelIndex + 1), total - 1);
  s.carry = { power: stats.power, bombs: stats.bombs, speed: stats.speed, shield: 0 };
  return s;
}
