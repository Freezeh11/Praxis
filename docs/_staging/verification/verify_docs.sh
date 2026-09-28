#!/usr/bin/env bash
# One-shot re-run of the independent verification battery for the Praxis docs suite.
#
# Every check below was written by the verifier and does not trust the suite, its gate, or its
# claim ledgers. Run from the repository root:
#
#   bash docs/_staging/verification/verify_docs.sh
#
# Exit code 0 means every check completed; the *findings* are in docs/verification-report.md.
set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 1
V=docs/_staging/verification
ROOT="$(pwd)"
mkdir -p "$V"

echo "== 1. the suite's own gate (expects 5 BLOCKER -> 0 now that the report exists) =="
node docs/_staging/tools/check-docs.mjs | tail -20

echo
echo "== 2. API audit (47 TestClient observations) =="
( cd backend && ./venv/bin/python "$ROOT/$V/api_audit.py" > "$ROOT/$V/api_audit.json" 2>"$ROOT/$V/api_audit.err" )
echo "exit=$? ; observations: $(grep -c '"label"' "$V/api_audit.json")"

echo
echo "== 3. numeric audit (every scoring worked example) =="
( cd backend && ./venv/bin/python "$ROOT/$V/numeric_audit.py" 2>/dev/null \
    | sed -n '/###JSON###/,$p' | tail -n +2 > "$ROOT/$V/numeric_audit.json" )
echo "exit=$? ; keys: $(python3 -c "import json;print(len(json.load(open('$V/numeric_audit.json'))))")"

echo
echo "== 4. engine audit =="
node "$V/engine_audit.mjs"  > "$V/engine_audit.json"  2>&1; echo "engine_audit  exit=$?"
node "$V/engine_audit2.mjs" > "$V/engine_audit2.json" 2>&1; echo "engine_audit2 exit=$?"

echo
echo "== 5. citation checker (file:line targets exist and are in range) =="
node "$V/check-citations.mjs" > "$V/citations.json" 2>&1
python3 -c "
import json;d=json.load(open('$V/citations.json'))
print('stats:', json.dumps(d['stats']))
print('out-of-range:', len(d['outOfRange']))
for o in d['outOfRange']: print('  ', o['doc']+':'+str(o['line']), o['resolved']+':'+o['spec'], 'fileLines', o['fileLines'])
"

echo
echo "== 6. authoritative link + anchor checker (github-slugger) =="
( cd "$V" && node check-links.mjs > links.json 2>&1 )
python3 - "$V" <<'PY'
import json, re, sys, collections
v = sys.argv[1]
d = json.load(open(f'{v}/links.json'))
ba = d['brokenAnchors']
isL = lambda x: re.fullmatch(r'L\d+(-L\d+)?', x['want'])
cat1 = [x for x in ba if not isL(x) and x.get('resolved') is None]
cat2 = [x for x in ba if not isL(x) and x.get('resolved') is not None]
cat3 = [x for x in ba if isL(x)]
print('stats:', json.dumps(d['stats']))
print(f'broken heading anchors: {len(cat1)+len(cat2)}  (same-page {len(cat1)}, cross-file {len(cat2)})')
print(f'GitHub #L line anchors into source files (valid, not defects): {len(cat3)}')
json.dump({'cat1': cat1, 'cat2': cat2, 'cat3': cat3}, open(f'{v}/anchor_classified.json', 'w'), indent=1)
for f, n in collections.Counter(x['doc'] for x in cat1 + cat2).most_common():
    print(f'  {n:>3}  docs/{f}')
PY

echo
echo "== 7. curated claim table (135 machine-checked claims) =="
bash "$V/claim_checks.sh" | tail -3

echo
echo "== 8. Mermaid parser gate (needs .mermaid-check/node_modules) =="
if [ -d "$V/../tools/.mermaid-check/node_modules" ]; then
  node docs/_staging/tools/.mermaid-check/validate-mermaid.mjs docs/09-diagrams/DIAGRAMS.md | tail -4
else
  echo "SKIPPED: node_modules missing. Rebuild with:"
  echo "  cd docs/_staging/tools/.mermaid-check && npm install mermaid@12.0.0 jsdom --cache ./.npm-cache --no-audit --no-fund --no-package-lock"
fi

echo
echo "== 9. secret audit (suite docs only) =="
python3 - <<'PY'
import os
ROOT = '/home/xris/Documents/GitHub/Praxis'
vals = []
for f in ('backend/.env', 'frontend/.env.local'):
    p = os.path.join(ROOT, f)
    if not os.path.exists(p):
        continue
    for line in open(p):
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        v = v.strip().strip('"').strip("'")
        if len(v) >= 8 and 'localhost' not in v and 'vercel.app' not in v:
            vals.append((f, k.strip(), v))
docs = []
for dp, dn, fn in os.walk(os.path.join(ROOT, 'docs')):
    if 'node_modules' in dp or '_staging' in dp:
        continue
    docs += [os.path.join(dp, n) for n in fn if n.endswith('.md')]
hits = [(os.path.relpath(d, ROOT), k) for (_, k, v) in vals for d in docs if v in open(d, encoding='utf-8', errors='replace').read()]
print(f'non-public credential values harvested: {[(k, len(v)) for _, k, v in vals]}')
print('SUITE DOC HITS:', hits if hits else 'NONE — clean')
PY

echo
echo "DONE. Findings and severities: docs/verification-report.md"
