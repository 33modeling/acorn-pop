"""REA 결과 요약: 작업 폴더의 REA JSON 만 읽어 docs/rea/evidence/ 에 요약 파일을 쓴다.

대상은 MIT 라이선스지만 이 저장소는 코드를 옮기지 않기로 했으므로 대상 코드 조각(식·문장)은 남기지 않는다.
남기는 것은 개수, 파일 경로·줄 번호, 식별자 이름(함수·속성), REA 가 붙인 관계 종류와 한계 문구뿐이다.
사용법: python3 -I facts.py <작업 폴더> <evidence 폴더>
"""
import collections, json, os, sys

W, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
J = lambda f: json.load(open(os.path.join(W, f)))


def dump(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=1)
        fh.write('\n')


def line(n):
    sr = (n.get('identity') or {}).get('source_range')
    return sr['start']['line'] if sr else None


def loc(n):
    v = ((n.get('evidence') or {}).get('location') or {}).get('value') or {}
    s = v.get('start') or {}
    return f"{v.get('source')}:{s.get('line')}" if s else None


d = J('ref-source-bg.json')
dump('reference-source.summary.json', {'bg': {
    'schema': d.get('schema'), 'inventory_state': d.get('inventory_state'), 'languages': d.get('languages'),
    'files': [{k: e.get(k) for k in ('path', 'language', 'size', 'sha256', 'classifications')} for e in d['entries'] if e.get('kind') == 'file'],
    'relationships': len(d.get('relationships') or []), 'parse_failures': len(d.get('parse_failures') or []),
    'vcs_head': (d.get('vcs') or {}).get('head')}})

ev = J('app-bg.json')
nr = ev['normalized_result']
sg, g = nr['semantic_graph'], nr['graph']
fns = collections.defaultdict(list)
for n in sg['nodes']:
    if n['kind'] == 'function':
        fns[n['identity']['module_path']].append({'name': (n.get('properties') or {}).get('name'), 'line': line(n)})
for v in fns.values():
    v.sort(key=lambda x: x['line'] or 0)
props = collections.Counter()
for n in sg['nodes']:
    if n['kind'] == 'property-slot':
        nm = (n.get('properties') or {}).get('name')
        if isinstance(nm, str) and nm.isidentifier():
            props[(n['identity']['module_path'], nm)] += 1
dump('app-analysis.summary.json', {'bg': {
    'evidence_id': ev.get('evidence_id'),
    'statistics': nr.get('statistics'),
    'application_graph': {'nodes': dict(collections.Counter(n['kind'] for n in g['nodes'])),
                          'edges': dict(collections.Counter((e.get('properties') or {}).get('kind') or 'contains' for e in g['edges'])),
                          'limitations': g.get('limitations')},
    'semantic_graph': {
        'nodes': dict(collections.Counter(n['kind'] for n in sg['nodes'])),
        'relations': dict(collections.Counter(r['relation'] for r in sg['relations'])),
        'resolution': dict(collections.Counter(r['resolution'] for r in sg['relations'])),
        'fingerprints': len(sg['fingerprints']),
        'unknowns': {f'{a}/{b}': c for (a, b), c in collections.Counter((u.get('family'), u.get('reason')) for u in sg['unknowns']).most_common()},
    },
    'functions': fns,
    'functions_named': sum(1 for v in fns.values() for f in v if f['name']),
    'functions_total': sum(len(v) for v in fns.values()),
    'listeners': [{'module': n['identity']['module_path'], 'line': line(n), 'event': (n.get('properties') or {}).get('event_name'),
                   'method': (n.get('properties') or {}).get('method')} for n in sg['nodes'] if n['kind'] == 'listener'],
    'timers': [{'module': n['identity']['module_path'], 'line': line(n), 'method': (n.get('properties') or {}).get('method')}
               for n in sg['nodes'] if n['kind'] == 'timer'],
    'state_properties_top': [{'module': m, 'name': nm, 'slots': c} for (m, nm), c in props.most_common(80)],
}})

traces = {}
for f in sorted(os.listdir(W)):
    if not f.startswith('trace-') or f.endswith('-input.json') or not f.endswith('.json'):
        continue
    try:
        d = J(f)
    except Exception as e:  # 실패한 실행은 빈 파일일 수 있다
        traces[f] = {'error': str(e)}
        continue
    nr = d.get('normalized_result') or {}
    name = f[len('trace-'):-len('.json')]
    if f.startswith('trace-semantics-'):
        nodes = {n['node_id']: n for n in nr.get('nodes', [])}
        traces[name] = {
            'seed': nr.get('seed'), 'direction': nr.get('direction'), 'status': nr.get('status'), 'summary': nr.get('summary'),
            'seed_locations': sorted({loc(nodes[i]) for i in nr.get('seed_node_ids', []) if i in nodes and loc(nodes[i])}),
            'reached_locations': sorted({loc(n) for n in nr.get('nodes', []) if loc(n)}),
            'relations': dict(collections.Counter(f"{r['relation']}/{r['resolution']}" for r in nr.get('relations', []))),
            'unknowns': dict(collections.Counter(f"{u.get('family')}/{u.get('reason')}" for u in nr.get('unknowns', []))),
        }
    else:
        traces[name] = {'kind': 'trace-application-feature', 'keys': sorted(nr.keys()),
                        'summary': nr.get('summary'), 'coverage': nr.get('coverage'), 'limitations': nr.get('limitations')}
dump('trace-summaries.json', traces)

runs = [json.loads(l) for l in open(os.path.join(W, 'runs.jsonl'))]
dump('rea-runs.json', {
    'tool': 'rea-agents 6.8.0 (npx, 전역 설치·MCP 설정·setup 없음)',
    'node': os.popen('node --version').read().strip(),
    'targets': {'bg': {'repo': 'https://github.com/MattSkala/html5-bombergirl', 'commit': '0044a17d794bbfe05841a04328ccfd07146cb1b7',
                       'license': 'MIT (LICENSE.txt, Copyright 2018 Matous Skala)',
                       'sparse_paths': ['/js/', '/index.html', '/README.md', '/LICENSE.txt'],
                       'excluded': ['img/(그림)', 'sound/(소리)', 'lib/(CreateJS·jQuery)', 'css/', 'favicon.ico']}},
    'note': '큰 결과는 저장소에 넣지 않았다(bytes·sha256 만). 같은 명령(scripts/run-rea.sh)으로 다시 만들어 SHA-256 으로 대조한다. trace-*-input.json 은 app-bg.json 을 그대로 감싼 입력이라 따로 적지 않았다.',
    'runs': [{'label': r['label'], 'command': 'npx -y rea-agents@6.8.0 ' + r['cmd'].split('rea-agents@6.8.0 ', 1)[-1].replace(W, '<work>').replace(os.path.dirname(W) + '/bg-target', '<target>'),
              'exit': r['exit'], 'seconds': r['seconds'], 'output': {'file': r['out'], 'bytes': r['bytes'], 'sha256': r['sha256']}} for r in runs],
})
print('wrote', sorted(os.listdir(OUT)))
