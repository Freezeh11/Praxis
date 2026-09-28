# Re-running the Mermaid parser gate on a frozen `DIAGRAMS.md`

This directory holds the only tooling used to verify that every fence in
`docs/09-diagrams/DIAGRAMS.md` actually parses. `check-docs.mjs` section 4 can only confirm that a
fence *starts* with a known diagram keyword; it cannot tell you that the diagram is syntactically
valid. `validate-mermaid.mjs` runs the real parser (`mermaid.parse()` from Mermaid 12.0.0 inside a
jsdom DOM), so it catches errors such as an unquoted `A[Label (parens)]` node or a
`state ID as "label"` declaration — both of which are invisible to the keyword check.

## The gate command (run from the repository root)

```bash
node docs/_staging/tools/.mermaid-check/validate-mermaid.mjs docs/09-diagrams/DIAGRAMS.md
```

Expected tail, exit code `0`:

```text
  PASS #12 (line 910) flowchart TB -> flowchart-v2

ALL 12 MERMAID FENCES PARSE OK
```

## Frozen artifact verified with this gate

| Field | Value |
|---|---|
| file | `docs/09-diagrams/DIAGRAMS.md` |
| lines | 995 |
| mermaid fences | 12 |
| parser gate | 12/12 PASS (re-run after the ERD score-range correction) |
| sha256 | `422ec86a94ef09b837ffdd493aeb7869a3b214e9e3cf30d062c00706e3b97004` |

> **Superseded hash.** An earlier revision of this table recorded
> `8e27cee9da3e39e5cc2f4ef09b8073b8c085bcd10130ce9ee193d3156d81b4f4` at 982 lines for the
> pre-correction file. That hash is stale: `data-scoring` corrected false score ranges in its
> `erDiagram` input after `DIAGRAMS.md` was first assembled, so four `erDiagram` attribute comments
> and the D10 prose were rewritten and the file re-verified. Use the hash above.

## Recreating the dependency tree

The `node_modules/` tree (Mermaid 12 + jsdom, ~229 MB) and the npm cache are removed after **each**
verification run, so this directory is normally just the three small files you see here; if it weighs
~320 MB, a verification is in progress or a tree was left behind. Either way the tree is rebuilt on
demand with the command below. Removing it each time is deliberate, because a raw `npm install` under
`docs/` is a hazard: `check-docs.mjs` walks **every `.md` file under `docs/`**, so 247 package
`README.md`/`CHANGELOG.md` files would be scanned as if they were our docs and reported as broken-link
BLOCKERs. (The checker now skips `node_modules/` and dot-directories, but the tree is still foreign bulk
that should not sit in a documentation directory.)

To re-run the gate, recreate it in one command — the registry install takes a few seconds:

```bash
cd docs/_staging/tools/.mermaid-check \
  && printf '{"name":"mermaid-check","private":true,"type":"module","version":"1.0.0"}\n' > package.json \
  && npm install mermaid jsdom --no-audit --no-fund --no-package-lock \
  && cd - >/dev/null \
  && node docs/_staging/tools/.mermaid-check/validate-mermaid.mjs docs/09-diagrams/DIAGRAMS.md
```

### If `npm install` fails with `EROFS` or a `/home/<user>/node_modules` path

npm is trying to use the home directory as its install prefix and cache because the working directory
has no `package.json`. The `printf` line above fixes the prefix; also point the cache inside the
workspace if the home cache is read-only:

```bash
npm install mermaid jsdom --cache ./.npm-cache --no-audit --no-fund --no-package-lock
```

## After verifying

Delete this whole directory (`docs/_staging/tools/.mermaid-check/`) so nothing but
`docs/09-diagrams/DIAGRAMS.md` remains from the diagrams work.
