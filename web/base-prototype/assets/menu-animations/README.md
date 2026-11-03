# Native menu focus animation

Exact original 32×24 RGBA focus artwork from the completed Sega USA VDP frames.
The frame never disappears: 208 opaque border pixels persist throughout the
four native brightness phases. The interior remains transparent.

- Yard: 8 native frames per phase, 32 per cycle.
- Starport: 16 native frames per phase, 64 per cycle in the observed native menu.
- Native clock: 53,693,175 master clocks/s; 896,040 clocks/frame.
- Keep one continuous animation when moving the selected cell; do not animate
  CSS opacity and do not repaint its palette.

`pulse.png` is APNG and uses the closest 16-bit PNG delay fraction; the exact
native fraction and the sub-nanosecond preview error are in `manifest.json`.
The individual PNG phases allow an exact clocked canvas implementation.

Reproduce with `tools/test_em_web_menu_animation.c` followed by
`tools/export_menu_animations.py`. The full temporal raw evidence stays under
`.local/menu-animation-oracle`, outside the shipped game. All exported RGB and
alpha values originate in native frames and SAT pattern nibbles.
