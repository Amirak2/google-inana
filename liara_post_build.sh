#!/bin/sh
set -eu

# Keep only dependencies required by dist/server.js in the release image.
test -s dist/server.js
test -s dist/client/index.html
echo "Liara: pruning development dependencies without network access..."
if command -v timeout >/dev/null 2>&1; then
  if ! timeout 60 npm prune --omit=dev --ignore-scripts --offline --no-audit --no-fund; then
    echo "Dependency cleanup skipped; installed runtime dependencies remain available."
  fi
else
  npm prune --omit=dev --ignore-scripts --offline --no-audit --no-fund
fi
echo "Liara: dependency cleanup finished."
echo "Production dependencies after build:"
du -sh node_modules dist
