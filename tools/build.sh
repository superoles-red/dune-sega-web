#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir"
source "$project_dir/.local/emsdk/emsdk_env.sh" >/dev/null
python3 tools/prepare_source.py
mkdir -p .local/objects web/engine
em++ -std=c++17 -O2 -c .local/source/genesis_recompiler/audio_ymfm.cpp -o .local/objects/audio.o
emcc -std=c11 -O2 -Wno-unused-function -DGENESIS_SDL2 -DGENESIS_AUDIO -Itools -sUSE_SDL=2 -c .local/source/build/dune-web.c -o .local/objects/dune.o
em++ -O2 -sUSE_SDL=2 -sASYNCIFY=0 -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=16777216 -sINITIAL_MEMORY=67108864 -sEXPORTED_RUNTIME_METHODS='["HEAPU8","UTF8ToString"]' .local/objects/dune.o .local/objects/audio.o -o web/engine/dune_web.js
python3 tools/record_wasm_build.py
