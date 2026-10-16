#!/usr/bin/env bash
# new_film.sh <target-dir> [--demo]
# Scaffolds a Rusty Lake-style film project (engine + kit), installs deps, checks the toolchain.
# --demo also copies the three reference scenes (family photo / green hall / grey room) and wires them in.
set -euo pipefail
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:?usage: new_film.sh <target-dir> [--demo]}"
if [ -e "$TARGET/src/engine.js" ]; then echo "error: $TARGET already has src/engine.js; not overwriting" >&2; exit 1; fi
mkdir -p "$TARGET"
rsync -a "$SKILL_DIR/template/" "$TARGET/"
mkdir -p "$TARGET/out/check" "$TARGET/assets"
if [ "${2:-}" = "--demo" ]; then
  cp "$SKILL_DIR"/examples/s0*.js "$TARGET/src/scenes/"
  cat > "$TARGET/src/main.js" <<'JS'
import { shots, start } from './engine.js';
import { endCardShot } from './endcard.js';
import { SHOTS as s01 } from './scenes/s01-family.js';
import { SHOTS as s02 } from './scenes/s02-hall.js';
import { SHOTS as s03 } from './scenes/s03-paradise.js';
shots([...s01, ...s02, ...s03, ...(PROJECT.endcard?.on === false ? [] : [endCardShot()])]);
start();
JS
  sed -i '' "s/endcard: { on: true,/endcard: { on: false,/" "$TARGET/src/config.js" 2>/dev/null || sed -i "s/endcard: { on: true,/endcard: { on: false,/" "$TARGET/src/config.js"
fi
cd "$TARGET"
echo "== installing puppeteer-core, three"
npm install --silent --no-audit --no-fund
command -v node   >/dev/null && echo "node   $(node -v)"   || echo "MISSING: node"
command -v ffmpeg >/dev/null && echo "ffmpeg ok"           || echo "MISSING: ffmpeg (macOS: brew install ffmpeg)"
FOUND=0
for c in "${CHROME_PATH:-}" "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "/Applications/Chromium.app/Contents/MacOS/Chromium" /usr/bin/google-chrome /usr/bin/chromium; do
  if [ -n "$c" ] && [ -x "$c" ]; then echo "chrome $c"; FOUND=1; break; fi
done
[ "$FOUND" = 1 ] || echo "MISSING: Chrome (or pass --chrome=<path> to render.mjs)"
echo "== ready: $TARGET   next: edit src/config.js, write src/scenes/*.js, then node render.mjs --audit --out=out/audit"
