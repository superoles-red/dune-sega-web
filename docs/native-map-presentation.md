# One expanded-map presentation per browser callback

The browser camera invalidates the expanded world when panning, pinching or
moving through the minimap. The previous host called the full SDL service both
before and after native simulation. A camera invalidation could consequently
run the expensive expanded-world software raster and uploads twice in the same
synchronous WASM callback. The browser cannot paint between those two calls.

`tools/em_web_host.h` now defers only the unpaused, running map's pre-step canvas
presentation through `em_web_canvas_presentable()`. SDL input polling and audio
service still run before simulation. The final service presents the current
camera once. No-due callbacks and a pause/halt reached during the first service
still receive their required final presentation. Already paused/stopped/faulted
paths retain the old behavior; hidden callbacks remain suspended. Non-map
screens, native fades, story sequences and their presentation cadence are not
changed by this predicate.

The original instruction loop, master-cycle accounting, catch-up budget, native
VDP scheduling, sound synthesis, entity data and gameplay remain unchanged.
The change does not lower resolution, skip simulation or change the renderer.

There is one intentional sampling distinction. Native NTSC frames and browser
callbacks are not exactly the same frequency. Occasionally a callback advances
native instructions without completing another VDP frame. Previously a camera
invalidation displayed the earlier pre-step RAM snapshot, then skipped the
post-step draw because the completed-frame serial had not changed. The new
single map draw uses the final current RAM snapshot. This is a display sampling
boundary, not a change to native animation clocks, game state or balance. Both
paths use the unchanged original pixel renderer, font, palette and graphics.

## Native differential proof

`tools/test_em_web_map_present.c` uses the actual authored Harkonnen demo CPU,
its paired real YMFM chip state, and the actual expanded-world software raster.
Its SDL event/audio boundary is the existing deterministic stand-in, rather
than a physical display or device-performance measurement.

For 120 camera-invalidated callbacks it checks:

- expensive world rasters fall from 239 to 120 while input/audio services remain
  240; there is exactly one final map raster per new callback;
- complete CPU/device state matches at every corresponding native cycle
  boundary, normalizing only the instance-specific FM pointer and consumed PCM
  output-ring fields;
- all 96,000 original stereo PCM frames and the complete 865-byte real YMFM
  state remain identical;
- every final world/HUD pixel matches a direct invocation of the unchanged
  original renderer on that final CPU and layout;
- old/new displayed pixels match whenever another native VDP frame completes;
  callback113 is the one verified no-VBlank case, serial3646→3646, with the
  expected pre-step/final-step sampling distinction;
- no-due, already-paused, hidden, stopped, pre-step input pause, unwakeable halt,
  fault and non-map presentation branches retain their required behavior.

The original host-audio and worklet tests also pass: exact native CPU/device,
YMFM and PCM comparisons; external output still transfers 120 packets without
SDL duplication or discarded samples. The clock test retains identical master
clocks at 30/60/120/240Hz. The typed-input proof remains 11/11.

The local fixture files are ignored QA inputs. Compilation requires the
bootstrapped original C source, SDL2 headers/library and the existing YMFM C++
backend. Native verification establishes state/pixel routing; actual Samsung
idle/pan frame rates, responsiveness and audio require a separate device A/B.
