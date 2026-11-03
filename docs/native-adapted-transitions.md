# Native presentation transitions

This bridge changes host presentation only. The USA ROM, original translated instruction suffix, scenario data, AI, prices, damage, timers and outcome predicates remain original. `tools/prepare_source.py` continues to check ROM/instruction identity on every regeneration.

## Battle flyover

Original victory and defeat enter `$26984` through `$26952` / `$26A9A`; callback `$B544` advances the original seven-aircraft formation. Its source node points at `$FFD306`; descriptor `$B5FC` and native direction/phase remain original.

The modern SDL renderer stays in adapted battle presentation for `victory_flyover` / `defeat_flyover`. Camera, zoom and viewport stay in the existing `DuneView`. The presentation copy of that one formation projects its native 320×224 trajectory across the current viewport, with original aircraft pixels/spacing scaled by the map zoom. Fixed HUD compositing omits the formation to avoid duplication. No input route is enabled during this cinematic and no live CPU position/velocity is written.

`battlePresentation` tells the host to keep the SDL battle surface visible; `flyover` identifies the cinematic. The later native movie, story, results and finale continue to use completed native frames.

## Building entry and exit

The public JSON fields are:

- `transitionGeneration`, `transitionIntent` (`none`, `building_enter`, `building_exit`), `transitionTarget` (`none`, `building`, `map`), `transitionObject`.
- `transitionPhase` (`none`, `out`, `loading`, `in`, `ready`), `transitionActive`, `transitionReady`, `transitionCovered`.
- `nativeFadeActive`, `nativeFadeDirection`, `nativeFadeSerial`, `nativeFadeLastFrames`, `nativeDisplayEnabled`, `nativeFrameBlack`.

The intent is observed before the first native palette fade: Yard `$287DC`, Starport `$28A18`; normal Exit `$2895C`, Starport Exit `$28CE8`. Original palette/chrome setup returns at `$28854` / `$28A90`. Original map palette restoration returns through the native fade-in routine `$786`.

On entry, SDL reuses its last good world/HUD textures and layout until the host acknowledges cover. It does not rebuild those textures against a fading palette. The generic native RGB getter also holds the preceding completed frame. On exit, the building bridge holds its last published corrected RGB, preserving the Upgrade repair.

The host covers once, calls `dune_web_transition_covered(generation)`, waits for `transitionReady`, then renders and reveals. A stale generation is rejected. Acknowledgement changes host state only. Native execution continues at its original speed.

Readiness requires the original target setup and a fresh completed raster. Importantly, original map input callbacks also run *inside* the palette fade-in. They do not authorize `sceneReady` / `transitionReady` until the fade returns and another frame completes. This prevents publishing a partially faded map under a second host reveal.

The generation, intent, target and ready flag remain available until the next transition or state load. `transitionActive` remains true until both ready and covered; a ready result cannot disappear before the JavaScript poll sees it. Scripted campaign/router exits do not create another building-curtain generation.

## Password scroll

`passwordPresentation` begins at `$272EA`, before `$26F0A` draws the incoming password page. The `password_scroll` phase retains the results scene during native vertical motion. The source plane-A page occupies VRAM `$EE00..$FBFF`; the departing results occupy `$E000..$EDFF`. Native VSRAM scroll remains unchanged.

`dune_web_readonly_textless_frame_rgb()` removes only incoming page plane-A pixels by their actual scrolled name-table address and recomposes the completed-frame plane B and sprites beneath them. Departing statistics and the original desert/soldier backdrop remain intact. It uses the completed VDP snapshot, not live post-render VRAM or a static other-mission patch. The host can instead cover once at the early marker and show its completion choices. One native Continue still stops at the separate password wait.

## Title credit timing

`titleLicenseReady` requires the native end-title checkpoint `$177D8` (or an actual restored Main poll), a subsequent completed frame, and the exact original LICENSED BY SEGA plane-A raster at `[96,202,128,6]` with actual visible foreground ink. The raster fingerprint is FNV-1a `e76b252d`; palette index34 supplies the light foreground, index44 the dark shadow. No frontend timer or early static fallback can authorize credits.

## Verification

`tools/test_em_web_transition.c` runs actual entry/exit continuations, not isolated finished UI fixtures: Yard map→shop→map and restored Starport→map, stale/current acknowledgement, readiness retained before acknowledgement, complete native fade return, whole-CPU immutability, results→password scroll and genuine reset→title. The continuous native scroll contains 76 completed frames, VSRAM0→224; 52 frames contain incoming password words removed by the compositor while 74 retain departing visible statistics. One input remains one page advance. Genuine cold-title verification with the current fixture sequence authorizes the license at native frame2156, after2033 earlier completed frames report false; this is measured evidence, not a timing constant.

`tools/test_em_web_adapted_flyover.c` runs both pre-victory and pre-defeat continuations and the actual DuneView chunk traversal: 960×540,390×844,844×390 at zoom100/50 and320×224 at100. All14 cases retain exactly seven connected aircraft, no fixed HUD duplicate, the existing panned camera and a byte-identical live CPU. Proof PNG/metadata are under `.local/adapted-flyover/`, with defeat proofs in `loss/`.

`tools/test_em_web_presentation.c` also passes the prior strategic-map471frames/loader93frames, story textless composition, native movie readiness, defeat terminal results and all three original finales/early credits. Native SDL syntax checking passes; standalone non-Emscripten compilation emits expected undefined-static warnings for hooks whose definitions are compiled only for the browser. Browser/device behavior is a separate integration check.

Raw continuous JSON/RGB proofs remain in `.local/transitions/`; logs are `.local/campaign-analysis/test-transition.log`, `test-adapted-flyover.log`, `test-adapted-flyover-loss.log` and `test-presentation.log`.
