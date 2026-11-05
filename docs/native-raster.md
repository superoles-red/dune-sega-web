# Exact-pixel browser raster compositor

`tools/em_web_raster.h` changes only the conversion of a completed, synchronous
VDP snapshot into RGB. `tools/prepare_source.py` retains the unchanged original
`vdp_render_pixels_reference` and routes the normal H32/H40 renderer through the
new compositor. Wider diagnostic calls use the original renderer. The pinned
vendored sources are not edited; the preparation guard still requires the
original ROM and translated instruction suffix to match byte for byte.

Each plane row reads its horizontal scroll once. Name-table entries are reused
only until the next scrolled eight-pixel tile boundary or screen-space
sixteen-pixel VSRAM column boundary. Original `vdp_tile_pixel` still resolves
flips, palette, transparency and priority, including transparent high-priority
pixels in shadow/highlight mode. Window regions retain the original horizontal
OR vertical test. The final priority/shadow compositor is unchanged; its RGB
channels use a per-call 3×64×3 lookup built with the original `vdp_channel`.

The scratch rows and palette are local to one call. Nothing survives between
frames, so DMA, changed VRAM/CRAM/VSRAM, fades and scrolling require no cache
invalidation. This adds no field to VDP/CPU or DSAV, changes no sprite traversal,
and does not change video timing, machine steps, audio clocks or game handlers.
Performance must be measured on the actual browser; pixel equivalence does not
establish a frame-rate improvement.

## Native oracle

The public test includes the original pinned source directly, with its renderer
renamed by a test-only macro. It requires neither a local source bootstrap nor
private CPU fixtures for its deterministic synthetic run:

```sh
mkdir -p .local
clang -std=c11 -O1 tools/test_em_web_raster.c -o .local/test-web-raster -lm
.local/test-web-raster
```

The synthetic run passes 274 full RGB comparisons and 1,638 direct encoded-plane
row comparisons. It covers H32/H40, 224/240 lines, all four scroll register modes,
global/column VSRAM, display disabled, normal/shadow/highlight, every plane size,
window sides and boundaries, flipped and transparent priority tiles, random
VRAM/CRAM/VSRAM/registers, wrapped scroll tables and the wide-call fallback.
Output canaries are compared as well. Both paths must leave every VDP input byte
unchanged, including padding.

Optional arguments load genuine ignored CPU fixtures and step the original
machine. Main, Harkonnen demo, briefing and victory-results fixtures supplied
95 additional completed native frames: every RGB byte equals both the original
oracle and the original completed framebuffer. Calling both display paths leaves
the entire CPU/device structure unchanged. No native outcome is fabricated.
Those local fixtures are not required by CI or included in the public package.

The CI workflow runs the public synthetic oracle after pinned-source integrity
checks. Actual WASM performance, browser rendering and physical-phone controls
remain separate checks on the final built core.
