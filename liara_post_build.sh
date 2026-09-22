#!/bin/sh
set -eu

# Keep only dependencies required by dist/server.js in the release image.
test -s dist/server.js
test -s dist/client/index.html
npm prune --omit=dev --ignore-scripts --no-audit --no-fund
npm cache clean --force
echo "Production dependencies after build:"
du -sh node_modules dist
