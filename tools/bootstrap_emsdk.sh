#!/usr/bin/env bash
# Install the pinned official SDK locally, without changing shell startup files.
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
sdk_dir="$project_dir/.local/emsdk"
sdk_version="3.1.74"
mkdir -p "$project_dir/.local"
if [[ ! -e "$sdk_dir" ]]; then
  git clone https://github.com/emscripten-core/emsdk.git "$sdk_dir"
elif [[ ! -d "$sdk_dir/.git" || ! -f "$sdk_dir/emsdk" ]]; then
  echo "Refusing to use an unmanaged SDK directory: $sdk_dir" >&2
  exit 1
fi
sdk_origin="$(git -C "$sdk_dir" remote get-url origin)"
if [[ "$sdk_origin" != "https://github.com/emscripten-core/emsdk.git" && "$sdk_origin" != "https://github.com/emscripten-core/emsdk" ]]; then
  echo "Refusing unexpected SDK repository: $sdk_origin" >&2
  exit 1
fi
"$sdk_dir/emsdk" install "$sdk_version"
"$sdk_dir/emsdk" activate "$sdk_version"
echo "SDK $sdk_version is ready. Run bash tools/build.sh to build the core."
