#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir"
python3 tools/bootstrap_core_source.py
if [[ -n "${EMSDK:-}" && -f "$EMSDK/emsdk_env.sh" ]]; then
  source "$EMSDK/emsdk_env.sh" >/dev/null
elif [[ -f "$project_dir/.local/emsdk/emsdk_env.sh" ]]; then
  source "$project_dir/.local/emsdk/emsdk_env.sh" >/dev/null
elif ! command -v emcc >/dev/null || ! command -v em++ >/dev/null; then
  echo 'Emscripten 3.1.74 is required; run bash tools/bootstrap_emsdk.sh.' >&2
  exit 1
fi
compiler_version="$(emcc --version)"
if [[ "$compiler_version" != *'3.1.74'* ]]; then
  echo 'This build records Emscripten 3.1.74; select that SDK before rebuilding.' >&2
  exit 1
fi
python3 tools/prepare_source.py
mkdir -p .local/objects web/engine
em++ -std=c++17 -O2 -I.local/source/genesis_recompiler -c .local/source/build/dune-web-audio.cpp -o .local/objects/audio.o
emcc -std=c11 -O2 -Wno-unused-function -DGENESIS_SDL2 -DGENESIS_AUDIO -Itools -sUSE_SDL=2 -c .local/source/build/dune-web.c -o .local/objects/dune.o
em++ -O2 -sUSE_SDL=2 -sASYNCIFY=0 -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=536870912 -sSTACK_SIZE=16777216 -sINITIAL_MEMORY=67108864 -sEXPORTED_RUNTIME_METHODS='["HEAPU8","UTF8ToString"]' .local/objects/dune.o .local/objects/audio.o -o web/engine/dune_web.js
python3 tools/record_wasm_build.py
