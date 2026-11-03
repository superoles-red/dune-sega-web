# Earlier native presentation pass — 2026-11-03

This record describes the earlier4a22c985 WASM. Its movie fixtures did not cover
the preceding battlefield flyover or the beginning of statistic counting; the
user subsequently found those gaps. The continuous-flow fixes and their exact
native proof are now documented in `native-screen-routing.md` and
`starport-upgrade-ready-unit-qa.md`. Current engine identity is `wasm-build.json`.
The original checks below are retained as a historical checkpoint, not a claim
that they exercised every visible transition.

This pass preserves the pinned USA ROM and the translated original instruction
handlers. Adapter/header identities and the actual shipping WASM are recorded
in `wasm-build.json`; no group-selection exports are present.

## Verified

- All59 Node regressions pass. They cover native-row building layouts, gesture
  arbitration, one global Continue and independent faction unlocks, migration,
  native scene presentation versus input readiness, final outcome controls,
  failed saves, startup export readiness, and stale confirmation cancellation.
- The original Z80/YMFM audio runs18,000 native frames through
  Main6000 → Options6000 → Main6000. There are958 actual frequency updates,
  zero music stops/restarts/driver reloads, and native Music/Sound OFF/ON works.
  `data/campaign/routing-verification.json` and `native-screen-routing.md`
  describe the corrected native sound-bank feedback selection.
- Completed-frame textless composition preserves the original art outside
  native glyph/choice pixels, including five-line dialogue, the map, title,
  subtitle and copyright. An existing empty `visibleMessageText` now means no
  text box: the original writer has not published words yet. A crop of map
  pixels is no longer used as a fallback in that state.
- Browser checks on the shipping WASM: clean startup without console errors,
  Main/Options/Back, native Music OFF/ON, complete title, mission confirmation,
  original full advisor/map speech, PROCEED with its original moving strategic
  map, real battle map, Menu, exit cancellation/confirmation, save and Continue
  with the correct house/mission, restored real battle image after loading.
- Starport was inspected at390×844,844×390 and800×300. It retains four occupied
  native rows and their holes; selection previews the real product without
  buying it, and native stock/order/total values are shown. Short viewports
  scroll rather than stretching all item graphics.
- The ordinary isolated demonstration was loaded through its actual v2 save.
  Atreides Palace: first tap selects, second tap arms its original power and
  displays the extracted large crosshair. Pan produces no order. CLEAR disarms
  without spending the power; rearming and a target tap produce one native
  special order with the original50 cooldown. Demo persistence stays isolated.
- Original defeat movie and final native results were inspected uncropped;
  intermediate movie has no Next/Back overlays, final defeat has Replay and
  Main Menu, and Replay reaches the correct original mission briefing. Native
  harnesses separately verify the three-house Palace flows, attack/move action
  classification, original plane phases, terminal final credits and M9 Replay.
- UI asset package check passes:322 files,312 PNG,1,105,452 bytes, with canonical
  campaign mirrors and hashes. Browser evidence is outside the repository at
  `/Users/oleskarpov/.codex/visualizations/2026/11/02/01a199bd-2da7-7960-86e9-b5ebe7e2488f/dune-native-fidelity/`.

## Evidence limits

This is targeted native regression and browser QA, not a manual playthrough of
all27 missions or physical iPhone/Android verification. Controlled result saves
are presentation fixtures, not earned campaign wins. Original building/menu
rules, combat, AI, maps and power cooldowns still run through original handlers.
Options panels cover letters baked into the source art; hidden character pixels
behind those letters are not claimed to have been recovered or redrawn.
