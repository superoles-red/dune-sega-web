# Exact-pixel expanded-world conversion

`tools/em_web_world_raster.h` changes only pixel conversion inside each existing
expanded-map chunk. `tools/prepare_source.py` retains the pinned original
`dune_view_terrain`, `dune_view_rgb`, sprite traversal and outer world/HUD
composition. It replaces the chunk's nested per-pixel conversion with one
`em_web_world_raster_chunk` call.

For each original 256x192 chunk:

1. The original source CPU is still copied and its original sprite builder is
   replayed exactly as before.
2. The helper calculates a three-intensity, 64-color RGB table from the exact
   **shadow VDP after that replay**. This preserves its palette, backdrop and
   shadow/highlight flags rather than assuming they equal the source VDP.
3. Source terrain descriptors are reused only to the next 8px world boundary.
   `tools/em_web_tile_row.h` loads that original pattern row's four actual VRAM
   bytes once. Its per-pixel decoding matches the pinned `vdp_tile_pixel`,
   including palette, both flips, priority and transparent high-priority pixels.
   The same exact row decoder serves the native VDP/HUD plane compositor.
4. Plane/sprite ordering and `vdp_shadow_pixel` remain unchanged. Pixels outside
   the original 2048x2048 world are still black. Original chunk coordinates,
   sprite stride, world texture dimensions and native HUD stay the same.

Only the expanded world's host buffer/texture uses RGBA32, with alpha 255 for
every pixel, including black map-edge regions and the completed-native-frame
central overlay. Cached colors are constructed as RGBA bytes and copied into
native-endian words; no packed-word endian assumption changes colors. The
separate world texture explicitly uses `SDL_BLENDMODE_NONE` and a four-byte
pitch. Native-menu RGB24 uses a different SDL texture, so a same-sized 320x224
menu/map transition cannot reuse the wrong format. Native VDP RGB buffers,
read-only RGB exports and the existing HUD RGBA buffer remain unchanged.

The pinned SDL GLES2 renderer natively supports RGBA32. Direct RGBA output
avoids its former RGB24-to-native conversion during world texture upload;
there is no added RGB-to-RGBA conversion pass.

Sprite-free terrain runs can reuse a 256-entry RGBA row cache (under 16 KiB).
Its full key is both actual packed pattern rows and their palette/priority,
transparent-shadow and flip attributes. A hash only selects a slot; every key
field must match. The complete replayed three-intensity RGB palette, backdrop
and shadow mode are compared before every chunk; any change clears the rows.
This bounded presentation cache can survive frames/chunks, but stores no map,
ROM or VRAM pointers and assumes no source state is unchanged. Sprite-containing
runs retain the exact per-pixel compositor. Collisions only recompute pixels.

The helper advances no instructions and changes no game memory, timing, units,
fog rules, audio or save state. Original sprite replay, shadow CPU copies,
resolution, chunk traversal and outer HUD composition are retained.

## Oracle

The standalone test uses the unchanged pinned terrain and RGB functions as its
reference. It compares every RGB byte plus fixed opaque alpha, output/row guards, whole source CPU,
palette VDP and sprite input across 3,284 deterministic synthetic chunks. Cases
include negative/world-edge coordinates, unaligned tile boundaries, widths
0/1/7/8/9 through 1025, empty chunks, source/shadow palette independence, three
channel-dominant palette banks, flips, priority, transparency, shadow/highlight,
and the original `C198` overlay suppression. Repeated sprite-free rows exercise
cache hits, followed by changed referenced VRAM pattern bytes, ROM attributes,
map descriptors, every CRAM entry, backdrop and both source/shadow mode flags.
Mixed sprite rows verify that cached terrain never masks native sprite priority.

```sh
mkdir -p .local/world-raster-test
clang -std=c11 -O1 tools/test_em_web_world_raster.c \
  -o .local/world-raster-test/test-world-raster -lm
.local/world-raster-test/test-world-raster
```

Optional caller-provided genuine CPU paths add complete world comparisons with
the original sprite replay. Local red/blue demonstration fixtures and the
original Ordos mission09 snapshot cover 15 full images: native view, portrait
expansion, map-edge black regions, the completed-frame central overlay with a
visible free cursor, and a placement cursor. Every deinterleaved world RGB byte
matches the original RGB builder, every alpha byte is 255, and the entire HUD
RGBA (including transparent RGB bytes) matches. All 391,624 source CPU/device
bytes and the final original sprite-replay shadow CPU remain unchanged. These
local inputs are not included in the public repository.

A private prepared-source oracle also compares these 15 modes using the actual
modern ready-marker/flyover/cursor adapters against the preceding RGB builder.
The prepared production source matches that proved candidate after removing
the test-only RGB reference builder; the original ROM/instruction suffix is
still byte-identical to the pinned source.

This establishes pixel and source-state identity. Actual WASM/mobile frame
timing is a separate physical-device measurement; the native test is not an
Android/iPhone speed claim.

The native VDP oracle (`tools/test_em_web_raster.c`) separately compares 274
synthetic frames and 1,638 encoded plane rows with the unchanged renderer.
Three local genuine CPU fixtures add 72 advancing frames (346 total frame
comparisons, 2,070 plane rows), including all original source CPU/device bytes.
