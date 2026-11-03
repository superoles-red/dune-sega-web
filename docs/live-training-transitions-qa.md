# Live training and presentation corrections — 2026-11-03

Scope: original Sega USA program and native rules; frontend input/presentation only. No public release.

## Changes

- Completed native title/licence pixels unlock the engine credit. No elapsed-time approximation.
- Tutorial first shows 33 complete original descriptive frames. Practice then loads a separate authored ordinary native v2 game; the actual native input, pathfinding, combat, construction and harvesting run normally. A read-only report gates the next instruction on the actual result. Campaign Continue and unlocks are excluded from training and demonstration.
- Full 320×224 Options composition replaces the previously cropped/spliced image. Baked menu glyphs are reconstructed from traced native pixels; this is a local native-piece restoration, not recovery of an unknown hidden master. The source and pixel/tile mapping are retained in `data/options-native-reconstruction/`.
- Native building transition intent starts before the first palette fade. Presentation caches hold the last complete map/building until one host curtain is opaque. A generation acknowledgement only releases those caches; the original CPU and palette timing continue. Readiness waits for native palette restoration and a fresh completed frame. Repeated polling cannot start another fade for the same generation.
- Original seven-plane formations render into the current adapted viewport, with unchanged native formation animation. Projection operates on a shadow CPU, not live gameplay state. Input stays blocked during the native sequence.
- The native statistics-to-password edge now leads under one curtain directly to the custom next-mission page; the original password entry is not presented.
- Palace targeting uses a larger original reticle at the actual pointer/tap. A pan or pinch does not send an order. Committed feedback uses the native world target.
- Technical demonstration now loads the Harkonnen fixture: 5000 credits, all original building types, native power 600/380. The previous Atreides fixture is retained.
- Mission completion stars removed; Options/Pause Back has native sound feedback. Landscape story layout keeps the entire animated frame alongside its text and controls.

## Native evidence

Native tests cover continuous Yard/Starport transitions, sticky generation/readiness, immutable acknowledgements, exact completed-frame licence recognition, the original vertical statistics scroll, and seven adapted flyover viewports/zoom settings. Original ROM and translated instruction-suffix guards pass during source preparation.

The separate training fixture passes 108000 native idle frames (30 game minutes) without damage to either training opponent, then actual movement, projectile damage, slab purchase/production/placement and cargo delivery. Its authored scenario clears original future reinforcement/team records offline, using the native empty sentinels and native reset/removal procedures. No runtime AI pause or invulnerability is installed. The continuous combat → slab purchase/placement → full cargo100 → Refinery delivery test also passes without restoring between steps; stored units remain alive.

## Browser verification

Observed in the local in-app browser:

- Five consecutive Yard enter/exit cycles, plus Starport entry/preview (its exit is also covered by the native regression). Native transition generations and host opacity traces show one cover/reveal cycle, with native readiness after the complete fade-in.
- Portrait Starport native grey cabinet/monitor/corners, original prices and selection. No stock counts exposed to the player.
- Victory portrait and defeat landscape flyovers retain the adapted map and all seven native planes.
- Native results lead under one curtain directly to MISSION COMPLETE. NEXT MISSION starts Atreides mission2; no password page is displayed.
- All16 live training steps completed in one browser session, including real native movement/projectile damage, Concrete4 purchase/drag placement, harvesting and actual delivery. Bank4979→5677; training exit using keyboard Space on DONE returns Home with every house still at its original unlock state.
- Pause/Resume preserves the training step. The normal Options Back increments native sound requests/consumed/calls from1 to2, once each.
- Palace: the234CSSpx original reticle follows the touch, rather than a fixed centre. Panning keeps order seq0. A tap at CSS310,250 commits native special order seq1 to expected original cell720,816; the camera centre is a different cell.
- Cold Home buttons are available with titleLicenseReady=false. The exact native licence gate later becomes true and the engine credit appears with the final title/licence image.
- Options full-width art and briefing full animated composition inspected in portrait and landscape.

Screenshots and DOM/native observer traces are in the external `dune-final-controls` visualization folder. Automated frontend suite:76/76; separate real-asset DOM tutorial and read-only training-model regressions also pass. No physical-phone or public-release claim is made.

Final WASM:5244154bytes, SHA-256 `2400ef0ca1efc457a0efe989e176032ea43df36b098112af6ae9e06270b89cba`. Training v2:140056bytes, SHA-256 `a3852e515ece3faa93df071bed4de469ccbb5afc4b3e08695628fa4ac7d92265`.
