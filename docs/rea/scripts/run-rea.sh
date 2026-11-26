#!/usr/bin/env bash
# 도토리 펑 REA 분석 다시 하기: MIT 라이선스 폭탄 미로 웹 게임(MattSkala/html5-bombergirl)을 REA(rea-agents 6.8.0)로 정적 분석한다.
# 대상 코드는 내려받아 읽기만 한다(빌드·설치·실행 없음). 그림·소리 폴더는 받지 않는다.
# 사용법: bash docs/rea/scripts/run-rea.sh <작업 폴더>   (Node 22, git, python3 필요)
set -euo pipefail
WORK=${1:?작업 폴더를 지정하세요}
HERE=$(cd "$(dirname "$0")" && pwd)
REA="nice -n 10 npx -y rea-agents@6.8.0"
mkdir -p "$WORK/bg-target" "$WORK/bg-work"
T="$WORK/bg-target"
if [ ! -d "$T/bg" ]; then
  git init -q "$T/bg"
  git -C "$T/bg" remote add origin https://github.com/MattSkala/html5-bombergirl.git
  git -C "$T/bg" sparse-checkout set --no-cone /js/ /index.html /README.md /LICENSE.txt
  git -C "$T/bg" fetch -q --depth 1 --filter=blob:none origin 0044a17d794bbfe05841a04328ccfd07146cb1b7
  git -C "$T/bg" checkout -q FETCH_HEAD
fi

cd "$WORK/bg-work"
rm -f runs.jsonl
rr() {  # rr <이름> <출력 파일> <명령...> : 시간·종료 코드·크기·SHA-256 을 runs.jsonl 에 남긴다
  local label=$1 out=$2; shift 2
  local start end code
  start=$(date +%s.%N)
  set +e; "$@" > "$out" 2> "${out%.json}.err"; code=$?; set -e
  end=$(date +%s.%N)
  python3 -I -c 'import json,sys,hashlib,os; p=sys.argv[5]; print(json.dumps({"label":sys.argv[1],"cmd":sys.argv[2],"exit":int(sys.argv[3]),"seconds":round(float(sys.argv[4]),1),"out":p,"bytes":os.path.getsize(p),"sha256":hashlib.sha256(open(p,"rb").read()).hexdigest()}, ensure_ascii=False))' \
    "$label" "$*" "$code" "$(echo "$end - $start" | bc)" "$out" >> runs.jsonl
  echo "[$label] exit=$code"
}

# 1) 소스 목록과 모듈 관계
rr ref-bg ref-source-bg.json $REA import-reference-source "$T/bg" --format json
rr ref-bg-summary ref-source-bg.summary.json $REA import-reference-source "$T/bg" --detail summary --outline-depth 3 --format json

# 2) JS 정적 분석(실행 없음)
python3 -I -c 'import json,os,sys; d=sys.argv[1]; json.dump(sorted("js/"+f for f in os.listdir(d+"/js") if f.endswith(".js")), open("selection-bg.json","w"))' "$T/bg"
NODE_OPTIONS=--max-old-space-size=4096 rr app-bg app-bg.json $REA analyze-javascript-application "$T/bg" \
  --source-paths-json "$PWD/selection-bg.json" --max-semantic-nodes 300000 --max-semantic-unknowns 300000 --format json

# 3) 보기(view): 요약·모듈 참조·파일별 사실
E='{"kind":"evidence-file","path":"app-bg.json"}'
echo "{\"source\":$E,\"view\":{\"kind\":\"summary\"}}" > view-bg-summary.json
echo "{\"source\":$E,\"view\":{\"kind\":\"javascript\",\"collection\":\"modules\",\"projection\":\"references\",\"where\":{\"kind\":\"javascript-asset\"},\"offset\":0,\"limit\":64}}" > view-bg-modules.json
python3 -I -c '
import json
json.dump({"source": {"kind": "evidence-file", "path": "app-bg.json"},
           "view": {"kind": "javascript-facts", "where": {"paths": ["js/Bomb.js", "js/Fire.js", "js/Bot.js", "js/Player.js", "js/GameEngine.js"]},
                    "property_keys": ["path", "parse_status", "bytes", "analysis_status", "syntax_status", "semantic_status"],
                    "include_available_property_keys": True, "offset": 0, "limit": 64}}, open("view-bg-facts.json", "w"))'
for v in summary modules facts; do
  NODE_OPTIONS=--max-old-space-size=4096 rr "view-bg-$v" "app-bg-$v-view.json" $REA inspect-analysis-view "view-bg-$v.json" --format json
done

# 4) 추적: 모듈 기준 기능 추적과 의미 추적(함수 호출자·상태 속성 영향)
python3 -I "$HERE/trace_inputs.py" "$WORK/bg-work"
for n in bomb bot; do
  NODE_OPTIONS=--max-old-space-size=4096 rr "feature-$n" "trace-feature-$n.json" $REA trace-application-feature "trace-feature-$n-input.json" --format json
done
for n in explode-callers danger-callers issafe-callers plant-callers cornerfix-callers \
         strength-property bombsmax-property escapebomb-property exploded-property; do
  NODE_OPTIONS=--max-old-space-size=4096 rr "sem-$n" "trace-semantics-$n.json" $REA trace-javascript-semantics "trace-semantics-$n-input.json" --format json
done

# 5) 요약(대상 코드 조각은 옮기지 않음)
python3 -I "$HERE/facts.py" "$WORK/bg-work" "$HERE/../evidence"
