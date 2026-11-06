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
   Tile decoding still uses the unchanged `vdp_tile_pixel`, including palette,
   flip, priority and transparent high-priority semantics.
4. Plane/sprite ordering and `vdp_shadow_pixel` remain unchanged. Pixels outside
   the original 2048x2048 world are still black. Original chunk coordinates,
   sprite stride, world texture size and native HUD stay the same.

There is no cross-frame/chunk RAM, ROM, VRAM or CRAM cache. The helper advances
no instructions and changes no game memory, timing, units, fog rules, audio or
save state. Sprite replay and its shadow-copy cost are deliberately retained.

## Oracle

The standalone test uses the unchanged pinned terrain and RGB functions as its
reference. It compares every RGB byte, output/row guards, whole source CPU,
palette VDP and sprite input across 2,956 deterministic synthetic chunks. Cases
include negative/world-edge coordinates, unaligned tile boundaries, widths
0/1/7/8/9 through 1025, empty chunks, source/shadow palette independence, three
channel-dominant palette banks, flips, priority, transparency, shadow/highlight,
and the original `C198` overlay suppression.

```sh
mkdir -p .local/world-raster-test
clang -std=c11 -O1 tools/test_em_web_world_raster.c \
  -o .local/world-raster-test/test-world-raster -lm
.local/world-raster-test/test-world-raster
```

Optional caller-provided genuine CPU paths add complete world comparisons with
the original sprite replay. Local red/blue demonstration fixtures and the
original Ordos mission09 snapshot cover nine full images: native view,
portrait expansion, map-edge black regions and a visible placement cursor.
Every world RGB byte matches and all 391,624 source CPU/device bytes remain
unchanged. These local inputs are not included in the public repository.

This establishes pixel and source-state identity. Actual WASM/mobile frame
timing is a separate physical-device measurement; the native test is not an
Android/iPhone speed claim.
