#!/usr/bin/env bash
set -euo pipefail
cd /workspace/K
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) throw new Error("Node.js 22.12+ is required")'
npm ci --ignore-scripts --no-audit --no-fund
python3 -m venv --system-site-packages /workspace/.panel-studio-venv
/workspace/.panel-studio-venv/bin/python -m pip install --disable-pip-version-check -r requirements-dev.txt
test -s assets/fonts/fonts.js
test -s assets/demo/demo.js
test -s vendor/jszip.min.js
command -v chromium
node --check src/app.js
node --check src/geometry.js
node --check electron.cjs
