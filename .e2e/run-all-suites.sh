#!/bin/bash
cd /home/xris/Documents/GitHub/Praxis
R=.e2e/_results
mkdir -p "$R"
run() {
  name="$1"; shift
  echo "===== $name ====="
  timeout 1800 "$@" > "$R/$name.log" 2>&1
  code=$?
  echo "$name exit=$code"
  tail -6 "$R/$name.log"
  echo
}
run verify-sandbox node .e2e/verify-sandbox.mjs
run verify-sandbox-input node .e2e/verify-sandbox-input.mjs
run sandbox-engine-audit node .e2e/sandbox-engine-audit.mjs
run generator-stress node .e2e/generator-stress.mjs
run sandbox-ui node .e2e/sandbox-ui.mjs
run sandbox-input-ui node .e2e/sandbox-input-ui.mjs
run responsive-tiers node .e2e/responsive-tiers.mjs
run mobile-landscape node .e2e/mobile-landscape-workspace.mjs
run mobile-ux node .e2e/mobile-ux-verify.mjs
run mobile-pages node .e2e/mobile-pages-verify.mjs
run tutorial-overlap node .e2e/tutorial-overlap-verify.mjs
run popup-overlap env SKIP_TIP=1 node .e2e/popup-overlap-verify.mjs
run tutorial-gate node .e2e/tutorial-gate.mjs
run gameplay node .e2e/gameplay.mjs
run law-comments node .e2e/law-comments.mjs
run acceptance node .e2e/acceptance-features.mjs
echo "ALL DONE"
