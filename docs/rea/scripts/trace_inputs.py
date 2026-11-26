"""REA 추적 입력 만들기: 저장한 분석 결과(app-bg.json)만 읽어 trace-*-input.json 을 쓴다."""
import json, os, sys

W = sys.argv[1]
os.chdir(W)
ev = json.load(open('app-bg.json'))
sg = ev['normalized_result']['semantic_graph']


def fp(name, suffix):
    cands = [n for n in sg['nodes'] if n['kind'] == 'function' and (n.get('properties') or {}).get('name') == name
             and n['identity']['module_path'].endswith(suffix)]
    if not cands:
        return None
    return next(f['fingerprint_sha256'] for f in sg['fingerprints'] if f['function_node_id'] == cands[0]['node_id'])


for name, module in {'bomb': 'js/Bomb.js', 'bot': 'js/Bot.js'}.items():
    json.dump({'application': ev, 'seed': {'kind': 'module', 'value': module, 'match': 'exact'}, 'direction': 'both'},
              open(f'trace-feature-{name}-input.json', 'w'))

funcs = {'explode-callers': ('explode', 'js/Bomb.js'), 'danger-callers': ('getDangerPositions', 'js/Bomb.js'),
         'issafe-callers': ('isSafe', 'js/Bot.js'), 'plant-callers': ('plantBomb', 'js/Bot.js'),
         'cornerfix-callers': ('getCornerFix', 'js/Player.js')}
props = {'strength-property': 'strength', 'bombsmax-property': 'bombsMax', 'escapebomb-property': 'escapeBomb',
         'exploded-property': 'exploded'}
missing = []
for name, (fn, mod) in funcs.items():
    f = fp(fn, mod)
    seed = {'kind': 'function', 'fingerprint_sha256': f} if f else {'kind': 'property', 'name': fn}
    if not f:
        missing.append(fn)
    json.dump({'application': ev, 'query': {'seed': seed, 'direction': 'callers' if f else 'forward-influence',
                                            'include_ambiguous_dynamic_edges': True}}, open(f'trace-semantics-{name}-input.json', 'w'))
for name, p in props.items():
    json.dump({'application': ev, 'query': {'seed': {'kind': 'property', 'name': p}, 'direction': 'forward-influence',
                                            'include_ambiguous_dynamic_edges': True}}, open(f'trace-semantics-{name}-input.json', 'w'))
print('ok; 지문 없는 함수(속성으로 대신):', missing)
