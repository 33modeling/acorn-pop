// 아이템: 덤불 속에 숨어 있다가 덤불이 부서지면 나온다. 바닥의 아이템은 불꽃에 타 없어진다.
export const ITEMS = {
  fire: { name: '불씨', desc: '불꽃 길이 +1' },
  bomb: { name: '도토리 주머니', desc: '동시에 놓는 도토리 +1' },
  speed: { name: '바람 깃털', desc: '걸음 빠르게' },
  shield: { name: '잎사귀 방패', desc: '한 번 막아 줌' },
  time: { name: '모래시계', desc: '남은 시간 +30초' },
};
export const LIMITS = { power: 8, bombs: 8, speed: 4 };
export const BASE_SPEED = 3.4; // 칸/초
export const SPEED_STEP = 0.55;

export function freshStats() {
  return { power: 1, bombs: 1, speed: 0, shield: 0 };
}
export function moveSpeed(stats) {
  return BASE_SPEED + SPEED_STEP * stats.speed;
}
// 아이템 하나를 먹은 결과. stats 를 바꾸고 실제로 바뀌었는지 돌려준다(상한이면 점수만).
export function applyItem(stats, type, game = null) {
  switch (type) {
    case 'fire': if (stats.power < LIMITS.power) { stats.power++; return true; } return false;
    case 'bomb': if (stats.bombs < LIMITS.bombs) { stats.bombs++; return true; } return false;
    case 'speed': if (stats.speed < LIMITS.speed) { stats.speed++; return true; } return false;
    case 'shield': if (stats.shield < 1) { stats.shield = 1; return true; } return false;
    case 'time': if (game) { game.timeLeft += 30; return true; } return false;
    default: return false;
  }
}
// 맞았을 때: 방패가 있으면 방패만 잃고 산다
export function absorbHit(stats) {
  if (stats.shield > 0) { stats.shield = 0; return true; }
  return false;
}
