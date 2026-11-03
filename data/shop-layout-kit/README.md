# Native modular shop layout kit

Extracted original Sega USA pixels for a separate responsive prototype.
No runtime, balance, source UI assets, or original artwork was changed.

Reproduce:
```sh
clang -std=c11 -O1 tools/extract_shop_layout.c -o .local/extract-shop-layout -lm
mkdir -p .local/shop-layout-raw
.local/extract-shop-layout ../dune-web/data/evidence/mission-atreides-01.cpu.bin .local/shop-layout-raw
python3 tools/extract_shop_layout.py
```

Read manifest modules before drawing: corners/caps keep exact native size;
repeat only their declared straight1px/8px strips. Scale the complete assembly
by an integer. Draw the original font on black using native8x8 cells.
The font atlas was verified against original WINDTRAP and642 display pixels.

For responsive composition use fixed `monitor-stack`112x88 (portrait96x56 at
8,8; title at8,72), complete `radar-clean`48x24 + `header-vents`28x8,
`cash-window-clean`12px high, individual native icons and meter modules.
Use flat `steel-light` (182,182,218) for body and `steel-medium`
(145,145,182) for cells. `steel-grain` is an X-only native shading reference;
its vertical dither must never repeat inY.

The command cabinet uses16px corners/insets but has an8px border/viewport.
Draw black underlay inset8, draw contents, then draw frame-only parts LAST,
with no fill. Its inner corner quadrants are transparent WINDOW black cells,
so no EXIT/STOP sprite fragments are baked into the bezel.
All fixed RGBA pieces use explicit measured source contour row runs, not an
RGB colour key. Native apertures remain opaque black. Retained RGB bytes
are identical to original full-frame/WINDOW pixels.

Lamps use `green-fixture` and `red-fixture`, both16x16, with exact completed
native240-frame recorded timelines. The green fixture excludes the unrelated
roof stripe; its extra lower fixture margin is static in all320 independent
completed-native oracle frames. Recorded clips are for this standalone
visual prototype, not replacements for original runtime timing rules.
Large curved/resource decorations stay fixed; do not stretch them to fill gaps.
