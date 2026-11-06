# Single selection, contextual actions and paid-building drag

`tools/em_web_selection.h` contains browser input intent only. It stores no
multiple-unit selection, group membership or fan-out commands. The modern
selector/command vocabulary is documented in [native-typed-input.md](native-typed-input.md).
The legacy `dune_web_selection_tap_screen` / `dune_web_tap_screen` paths still
provide the complete original contextual A. Original targeting, movement, attack, harvesting,
production, placement, special actions and AI remain in translated game code.

## Integration and public API

Include after `em_web_host.h` and `em_web_camera.h`. Keep the existing
`em_web_selection_observe()` hook immediately before `dune_mouse_observe()` at
every instruction boundary. Save loading calls `dune_web_selection_reset()`;
this clears host intent, without changing native selection pointers.

- `dune_web_actions_debug()` returns selected unit/building, native contextual B
  availability/kind, ready Yard state, placement outcome and execution counters.
  `dune_web_selection_debug()` is a read-only alias for existing debug tooling.
- `dune_web_clear_selection()` removes unit/building highlights through original
  clear continuations. It sends no B and preserves paid production and any
  armed special-action countdown.
- `dune_web_action_b()` dispatches one complete native B at the current cursor,
  without repositioning it. It exposes idle producer Repeat and armed
  Devastator/MCV confirmation, using the actual active unit before a building.
- `dune_web_placement_begin(cssX,cssY)` accepts only a ready own Construction
  Yard under the pointer, without an active selected unit. If needed it first
  selects the Yard through original A. A short ordinary tap does not call this
  function; the gesture recognizer calls it after crossing the drag threshold.
- `dune_web_placement_move(cssX,cssY)` updates the original hover footprint.
  During a drag it projects geometrically even over the native HUD. Camera/edge
  pan belongs to the camera adapter and may call this again after panning.
- `dune_web_placement_end(cssX,cssY)` accepts one release, checks the same
  Yard/product/paid-object identity, and runs complete original A at the target
  tile. Duplicate releases are ignored. Returning to the source Yard cancels
  rather than opening its production menu. HUD/outside releases cancel.
- `dune_web_placement_cancel()` / `dune_web_placement_active()` control the drag
  lifetime. Native menus own their own stack; a canceled Yard preview is cleared
  after returning to the map if its original identity is still current.
- `dune_web_placement_begin_world(worldX,worldY)` queues exactly the same begin
  handler without projecting a remembered source through the current viewport.
  The existing preview point is world-anchored: releasing the finger, panning
  or zooming does not itself change that point. Only another placement move
  changes it. `dune_web_placement_confirm()` submits the saved point through
  the existing release handler, even when it is now offscreen or under the HUD.
  It neither adds a second validation route nor bypasses the source-Yard cancel
  rule. A repeated confirmation is ignored.
- The read-only target JSON includes `target.ready`; actions JSON includes
  `placement` with `active`, `preview`, `worldX`, `worldY`, `tile`, `yard`,
  `yardId`, `product`, `paidIndex`, `house`, `campaign` and `identityValid`.
  These describe existing host intent/native identity; they add no save state.

The adapter observes native return `$00E57A` before requesting pure clear after
both success and rejection. The original `$00F100` validator owns legality; the
original `$00E6D0` routine owns placement. Rejection keeps the paid product ready.

## Original state semantics

`C25C` is the current unit. `C578` is the current building reference and can
remain populated while a unit is selected; the building's highlight bit15 is
then off. `C57C` remembers the last selected own building, including buildings
that do not produce anything. It is not a standalone "last producer" field.

Native A `$027B80` supplies all unit/building target inputs. With an own selected
unit, the clicked building becomes its target rather than a new selection.
Native B `$028392` similarly gives the active unit priority. For an idle selected
own producer, B repeats product `building+82` under the original guards
`$0283AA..$028490`. For a ready Yard B only clears selection; it does not start
placement and must not be labeled Repeat in that state.

Unit byte15 is a shared effect/countdown field, not Stop. For an armed
Devastator11 or MCV17, B ends the countdown, allowing the original unit loop to
perform Die10 or deployment. Original A on an already armed Devastator cancels
its preparation. Pure clear preserves that countdown and thus does not cancel
the special action. The older group-era test/doc label "Stop sentinel" was
incorrect; no Stop action is issued by the native B branch examined here.

Pure unit clear uses `$02851C`; building clear uses `$02840E`. Combined clear
continues to original building clear at `$028530`, avoiding the normal restoration
of the previous building highlight. Native register/stack gates are checked at
`$027B5E`, including the normal caller return `$00E270` at `SP+32`. No original
translated instruction handler or ROM byte is edited.

## Native verification

`tools/test_em_web_selection.c` exercises original single-A priority, original B
production, invalid and successful building drag, early/in-flight cancellation,
duplicate release and native modal return. Its paid Windtrap fixture remembers
product9 in the idle Yard (an explicit fixture), then uses native B, allocation,
payment and every production tick until ready. No ready bit, production timer,
credits or placement result is fabricated. A read-only original `$00F100` oracle
chooses a legal test cell; release independently validates it again.

The test writes actual CPU snapshots to ignored local paths:
`.local/qa-baseline.cpu.bin` and `.local/qa-ready-yard.cpu.bin`. These are local QA
fixtures, not public game assets or release evidence.

The sticky-preview regression keeps the real paid Yard's world candidate for
180 native frames without a held finger or repeated move calls, then confirms
one original placement at that cell. A separate cancel preserves the paid
product with zero construction attempts. New world API queueing and JSON
queries are checked against all native CPU/device bytes for zero immediate
mutation. Actual camera/gesture integration remains browser QA.

`tools/test_em_web_actions_special.c` verifies original self-A arming,
countdown-preserving clear, contextual B unit priority, Devastator native Die10,
and actual MCV-to-Yard deployment. `tools/test_em_web_selection_combat.c` uses
single native A only: an original projectile reduces enemy HP and an original
Harvester increases cargo. Fixtures use original object creation; enemy isolation
is explicitly test arrangement. No damage, cargo or deployment outcome is mocked.

```sh
clang -std=c11 -O1 tools/test_em_web_selection.c -o .local/test-selection -lm
clang -std=c11 -O1 tools/test_em_web_actions_special.c -o .local/test-actions-special -lm
clang -std=c11 -O1 tools/test_em_web_selection_combat.c -o .local/test-actions-combat -lm
```

Pass the original first-mission CPU snapshot as the executable's sole argument.
Browser geometry, shell layout, edge pan and physical-device gestures require
separate integration validation; native proofs establish the gameplay command
path rather than complete iPhone/Android coverage.
