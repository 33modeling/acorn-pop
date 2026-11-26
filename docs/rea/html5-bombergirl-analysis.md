# REA 분석: html5-bombergirl → 도토리 펑

- 분석일: 2026-11-26 · 도구: REA(rea-agents 6.8.0, `npx -y rea-agents@6.8.0`, setup·MCP 등록 없이 CLI만)
- 결과물: 이 저장소의 게임 「도토리 펑(Acorn Pop)」 — `web/`
- 다시 하기: `bash docs/rea/scripts/run-rea.sh <작업 폴더>` (기록: `docs/rea/evidence/rea-runs.json`)

## 1. 무엇을, 왜 분석했나

과제는 칸 단위 폭탄 미로 장르(격자 미로, 십자 폭발로 부서지는 벽, 화력·폭탄 수·속도 아이템, 적, 출구, 보스)의 오리지널 웹 게임이다.
장르 규칙만 참고하고, 특정 게임의 이름·캐릭터·그림·음악·판 배치는 가져오지 않았다.

- 주인공은 파란 목도리를 두른 다람쥐 **도담**, 폭탄은 **도토리**, 부서지는 벽은 **덤불**, 출구는 **나무 굴**이다.
- 월드 5개(도토리 숲·안개 늪·수정 동굴·눈꽃 고개·잿빛 화산), 적 6종과 대장 5종의 이름·생김새·움직임은 새로 정했다.
- 그림은 모두 Canvas 2D 코드, 소리는 WebAudio 로 그 자리에서 만든다. 판 35개는 씨앗과 무늬로 만든다.

REA 로는 같은 장르의 공개 웹 게임 코드를 정적으로 분석해 폭발 전파·연쇄·컴퓨터 상대의 판단·격자 이동을 어떤 상태 값과 흐름으로 구현했는지 확인했다.

## 2. 분석 대상 고르기

GitHub 저장소 검색(`bomberman` · JavaScript/TypeScript, 별 순)에서 이렇게 걸렀다.

| 후보 | 판단 |
|---|---|
| **MattSkala/html5-bombergirl** (MIT, 별 161) | 순수 JS + CreateJS, 폭탄·불꽃·연쇄·보너스 3종·봇(위험 칸 피하기)이 파일별로 나뉨 → **대상** |
| cri5ti/html5-bomberman, dylanbeattie/KaboomJS, davidfowl/BombRMan | 라이선스 없음 — 제외 |
| DmytroVasin/bomber, diegozanon/bombermon, Bombanauts (MIT) | 서버 다인용·3D 중심, 혼자 하는 규칙(봇·보너스)이 적거나 덩치가 큼 |
| pr0mming/Bomberman-JS, DrummerSi/BomberJS, bocaletto-luca/Bomberman | GPL — 제외 |

라이선스: `LICENSE.txt` MIT(Copyright 2018 Matous Skala). 허용 라이선스지만 이 저장소에는 코드 한 줄도 옮기지 않았다.
증거 파일에는 대상 코드 조각을 넣지 않고 개수·파일 경로·줄 번호·식별자 이름만 남겼다.

### 받은 범위(sparse clone, 빌드·설치·실행 없음)

| 대상 | 커밋 | 받은 경로 | 받지 않은 것 |
|---|---|---|---|
| MattSkala/html5-bombergirl | `0044a17d794b` | `js/` 12개(Bomb·Fire·Bot·Player·GameEngine·InputEngine·Bonus·Tile·Menu·Utils·Entity·core) `index.html` `README.md` `LICENSE.txt` (약 60 KB) | `img/`, `sound/`, `lib/`(CreateJS·jQuery), `css/`, `favicon.ico` |

## 3. REA 실행 기록

모두 종료 코드 0, 합계 17회 43.2초. 큰 결과(앱 분석 6.7 MB, 추적 결과)는 저장소에 넣지 않고 `evidence/rea-runs.json` 에 크기와 SHA-256 만 적었다.

| # | 명령 | 대상 | 결과 |
|---|---|---|---|
| 1 | import-reference-source | 전체 | 파일 15개(JS 12), 관계 0, 파싱 실패 0 |
| 2 | import-reference-source `--detail summary --outline-depth 3` | 전체 | 3.7 KB 요약 |
| 3 | analyze-javascript-application | `js/` 12개 | 파싱 실패 0, AST 7,963, 의미 그래프 노드 3,486(함수 105·속성 칸 212·호출 지점 366·리스너 5·타이머 2), 관계 3,311(resolved 1,518·candidate 1,793), modules 0 |
| 4–6 | inspect-analysis-view (summary·modules·facts) | 앱 분석 | 보기 3개(12–26 KB), `evidence/app-analysis.summary.json` 에 다시 정리 |
| 7–8 | trace-application-feature | 모듈 `js/Bomb.js`·`js/Bot.js` 양방향 | 둘 다 씨앗 2, 노드 27·간선 26(그래프 전체), 관찰 52, coverage partial |
| 9 | trace-javascript-semantics | `explode` | Bomb.js 82·110행 — 터짐 처리와 불꽃 칸의 다른 폭탄을 다시 터뜨리는 곳(연쇄) |
| 10 | trace-javascript-semantics | `getDangerPositions` | Bomb.js 95행(터질 때), Bot.js 324행(봇 안전 판단) — 같은 함수가 폭발과 회피에 함께 쓰임 |
| 11 | trace-javascript-semantics | `isSafe` | Bot.js 71·165행 — 위험할 때 도망칠 칸 고르기, 갈 칸 후보 거르기 |
| 12 | trace-javascript-semantics | `plantBomb` | Bot.js 66행(update 안 한 곳) |
| 13 | trace-javascript-semantics | `getCornerFix` | Player.js 169행 — 막힌 방향에서 모퉁이 보정 |
| 14 | trace-javascript-semantics | 속성 `strength` | Bomb.js 42·134행 — 만들 때 받은 화력이 불꽃 칸 수 반복의 끝 |
| 15 | trace-javascript-semantics | 속성 `bombsMax` | Bot.js 212·304, Player.js 119·337 — 보너스로 오르고, 놓을 때 남은 수 비교 |
| 16 | trace-javascript-semantics | 속성 `escapeBomb` | Player.js 286·295·296 — 방금 놓은 폭탄만 통과, 벗어나면 지움 |
| 17 | trace-javascript-semantics | 속성 `exploded` | Bomb.js 78·87·108, Player.js 308 — 두 번 터지지 않게 막는 깃발, 불꽃 검사 |

## 4. REA 가 알려 준 구조

- 모듈 시스템이 없다(`modules: 0`). `index.html` 의 `<script>` 들이 `gGameEngine`·`gInputEngine` 전역을 공유한다.
- 객체는 `Class.extend({...})` 로 만든다. 그래서 105개 함수 중 이름이 잡힌 것은 `Class` 하나뿐이고, 호출자 추적은 함수 지문 대신 같은 이름의 속성 추적으로 했다.
- 폭발은 `Bomb` 한 곳에 모여 있다: 불꽃 칸 계산(`getDangerPositions`) → 칸마다 `Fire` 만들기 → 나무 상자는 지우고, 빈 칸의 다른 폭탄은 `explode` 재귀. 봇도 같은 계산을 빌려 위험 칸을 안다.
- 봇의 한 틱은 위험하면 안전 칸으로, 아니면 이웃 칸 중 하나를 목표로 걷다가 나무 상자 옆이나 사람을 맞힐 자리에서 폭탄을 놓는 구조다.
- 입력 리스너는 `InputEngine.addListener` 5곳(재시작·소리·Esc·폭탄 키), 타이머는 `setInterval`(죽을 때 흐려짐)·`setTimeout`(재시작 지연) 2개다.

## 5. 기능 비교와 도토리 펑의 구현

상태: 구현 14 · 보류 2 · 옮기지 않음 1 (manifest.json 의 features 와 같음).

| 기능 | html5-bombergirl | 도토리 펑 | 상태 |
|---|---|---|---|
| 십자 폭발 | 네 방향으로 화력 칸, 벽 앞 멈춤, 나무 상자는 태우고 멈춤 | 같은 규칙 + 바닥 아이템도 태우고 멈춤. 팔·끝·가운데 모양을 기록해 그림 | 구현 |
| 연쇄 | 불꽃 칸의 폭탄을 재귀로 바로 터뜨림 | 대기열로 같은 틱에 풀고 깊이 기록. 덤불은 다 계산한 뒤 한꺼번에 부숨 | 구현 |
| 놓은 폭탄에서 비켜나기 | `escapeBomb` 하나 | 폭탄마다 통과 가능한 사람 집합(여럿이 겹쳐도 됨) | 구현 |
| 모퉁이 보정 | 막힌 방향에서 옆 칸으로 밀어 줌 | 지금 줄 가운데로 미끄러뜨리고, 많이 걸쳤으면 옆 줄로 | 구현 |
| 아이템 | 속도·폭탄·화력 | 불씨·도토리 주머니·바람 깃털 + 잎사귀 방패·모래시계, 상한 있음, 불꽃에 탐 | 구현 |
| 컴퓨터 상대 | 위험 칸 목록으로 안전 확인, 상자 옆·사람 근처에서 놓음 | 칸마다 "몇 초 뒤 타는지" 지도(연쇄로 앞당겨짐 포함), 도착 시각 고려 BFS, 놓기 전 피할 곳 확인, 실력 4단계 | 구현 |
| 적 | 없음(봇만) | 6종 움직임 + 대장 5종 | 구현 |
| 출구·판 | 없음(대전 한 판) | 덤불 속 출구, 판 35개(월드 5 × 7) | 구현 |
| 대전 | 사람 2 + 봇 | 사람 2 또는 컴퓨터 섞어 최대 4, 판 수 선택, 바위 조이기 | 구현 |
| 입력 | 키보드 | 키보드 2인·터치·게임패드 2개 | 구현 |
| 저장 | 없음 | localStorage(try/catch) | 구현 |
| 폭탄 차기·원격 기폭 | 없음 | — | 보류 |
| 그림·소리 | 스프라이트·소리 파일 | 코드로 새로 그림·WebAudio | 옮기지 않음 |

### 검증

- 단위 시험(`npm test`): 폭발 전파(바위·덤불·아이템에서 멈춤), 연쇄 순서·깊이, 위험 지도, 아이템 상한·방패·숨은 아이템, 적 종류별 움직임(막힘·뚫기·쫓기·피하기·대장 행동), 컴퓨터 상대가 자기 도토리를 피하는지, 저장.
- 판 검사: 35판 모두 출구·적·아이템이 출발점에서 닿는 곳에 있고, 자동 플레이어가 실제 규칙으로 끝까지 깬다(무적·시간 제한 없음, 판당 77–244초).
- 헤드리스 자동 플레이 스모크: 판마다 무적 없이 60초, 컴퓨터 넷이 10판 대전.
- 브라우저 시험(`npm run test:e2e`): 첫 화면, 키보드 걷기·놓기, 멈춤, 1-1 자동 클리어 뒤 저장·이어하기, 사람+컴퓨터 대전, 휴대폰 화면(가로 넘침 없음·단추 44px·글자 16px·터치 걷기·놓기).

## 6. 한계

- 전역 `<script>` 앱이라 파일 사이 관계를 잇지 못함(관계 0, modules 0).
- `Class.extend` 메서드가 이름 없는 함수로 남아 함수 지문 추적을 못 함 → 속성 이름 추적으로 대신, 9개 중 7개 ambiguous.
- 모듈 기준 기능 추적은 작은 앱에서 그래프 전체(27노드)로 퍼져 기능 단위로 좁혀지지 않음.
- 폭탄 2초·이동 2px 같은 수치는 REA 가 값까지 알려 주지 않아 코드를 직접 읽어 확인함(도토리 펑은 2.4초·칸 단위 속도로 새로 정함).
- 정적 분석이라 손맛은 알 수 없음 — 자동 플레이와 판 검사로 대신 확인.
