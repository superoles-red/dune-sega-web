# Native unit self-actions and contextual B — 2026-11-03

The missing special button was an input-adapter availability problem. The Sega
USA unit code remains unchanged. A unit's first selection does not by itself
make its original B special action available: Devastator and MCV first require
an original A command onto themselves. The adapter now exposes that self-A
intent separately, followed by the actual armed B action.

## Exact original behavior

| Selected actor/state | Original self-A | Original B |
| --- | --- | --- |
| Devastator11, unarmed | Arms its original255-tick preparation | Deselects |
| Devastator11, armed | Cancels preparation | Completes countdown; original loop performs Die10 |
| MCV17, unarmed | Arms its original255-tick preparation | Deselects |
| MCV17, armed | Cancels preparation | Completes countdown; original loop attempts deployment |
| Other playable ground types2..16 | Original contextual self behavior; no such countdown | Ordinary deselection unless original flags already contain bit`0x80` |

Repeating self-A does **not** extend the timer. It cancels; a later original
self-A rearms from255. In the native regression the completed A/reselection
sequence leaves252 ticks, and an untouched Devastator then reaches its original
death action in exactly252 native frames. At native NTSC frequency the original
255-tick interval is about4.25 seconds; the adapter does not convert, freeze,
accelerate or add ticks.

The exact original unit B branch `$284F4..$28518` tests `unit+6 & 0x80`, clears
byte`unit+15`, and enters `$A78A`; it has no owner or unit-type test. Its
availability descriptor preserves that predicate, including an already armed
inspected enemy. The additional self-A button remains own Devastator/MCV only.
No test invents enemy arming or substitutes an owner's identity.

Pure CLEAR keeps an already armed native countdown running. It is deliberately
separate from original B and from the self-A cancellation operation.

## Adapter contract

`dune_web_action_self()` queues one genuine original A at the selected actor's
current occupied map cell. It follows actual map occupancy if the actor moves;
it writes no unit pointer, ability flag, countdown, HP or deployment result.
After original A deselects the actor, one further genuine A selects that same
actor, allowing the user to see and invoke its native armed B action. A pending
self intent is rejected/canceled on a changed/dead/stored actor, changed
selection, physical pad input or explicit CLEAR. Existing placement/selection
operation values are preserved; this adds no group selection or fan-out order.

`dune_web_actions_debug()` adds `selfAvailable`, `selfKind`, `selfPending`,
`selfPointer`, `selfRequests`, `nativeSelfCount`, `nativeSelfSelections`,
`selfResult` and `unitSpecial`. The latter reports the actual armed flag,
countdown byte and whether self-A currently arms or cancels. Existing B labels
remain `confirm-devastator` / `confirm-mcv`; other native bit`0x80` unit cases use
`confirm-native`. Labels describe input intent; the original native action
handler still owns every guard and result.

The frozen selection header SHA256 is
`a3590d1c29279781f84284d42cc58b5805721c562dc2f4d4b6b54bba7afd5603`.
Root integration owns the exported API and on-screen button artwork/labels.

## Executed native checks

`tools/test_em_web_unit_context.c` tests all16 playable ground types2..17 through
original Unit_Create and original contextual A. Only11/17 arm this ability.
Both API flows test one queued self intent, whole-CPU immutability when queuing
and reading descriptors, original A plus original reselect, cancel, rearm and
actual original B destruction/deployment. No ability/timer/HP result is injected.

The four existing `tools/test_em_web_actions_special.c` cases were freshly
recompiled and pass: countdown-preserving pure clear, original Devastator Die10
through B, an ordinary unit's priority over a lingering ready Yard, and actual
MCV-to-Yard deployment. These are controlled offline actor arrangements based
on an original first-mission CPU snapshot, rather than an earned campaign roster.

`tools/test_em_web_clock.c` also passes30/60/120/240Hz host scheduling cases:
60seconds consistently request3,221,590,512 master clocks and3595 original NTSC
frames. This is a scheduling-formula regression using28-clock quanta, not a
physical-device or browser performance measurement.

```sh
clang -std=c11 -O1 tools/test_em_web_unit_context.c -o .local/test-unit-context -lm
.local/test-unit-context ../dune-web/data/evidence/mission-atreides-01.cpu.bin
clang -std=c11 -O1 tools/test_em_web_actions_special.c -o .local/test-actions-special-current -lm
.local/test-actions-special-current ../dune-web/data/evidence/mission-atreides-01.cpu.bin
clang -std=c11 -O1 tools/test_em_web_clock.c -o .local/test-web-clock
.local/test-web-clock
```

Machine-readable identities, observed catalogue and log hashes are in
`data/unit-action-qa/verification.json`. Genuine ordinary-campaign whole-CPU
comparisons for economy, firing and reinforcement waves are recorded separately
under `data/native-campaign-fidelity/`; do not confuse these controlled special
unit arrangements with that unedited campaign evidence.

## PROCEED presentation-only regression

The separate `tools/test_em_web_briefing_exit_frame.c` runs an actual captured
Harkonnen1 briefing continuously through original PROCEED to the real map.
Mode4 removes only original story glyph cells and retains original choice
sprites, whereas mode1 also hides those sprites. It audits212 completed frames:
20 story,184 briefing-exit and8 map. Across these frames382,320 glyph-pixel
occurrences change;51,200 choice-sprite pixel occurrences remain original.
Every pixel outside actual glyph cells, and every map pixel, stays identical.
All391,624 CPU/device/frame bytes remain unchanged after every projection.

```sh
clang -std=c11 -O1 tools/test_em_web_briefing_exit_frame.c -o .local/test-briefing-exit-frame -lm
.local/test-briefing-exit-frame
```

This proves native frame composition and continuous original execution. Browser
transition timing and physical phones remain separate validation.

## Source and isolation boundary

The supplied1,048,576-byte USA ROM SHA256 remains
`b1bbe73186e0902fa8b2db0f227bf306e3d6a80fe592f927d1aa9d60c0f335ba`.
The pinned generated original C source SHA256 remains
`e3055a76cd0eeb151591984a2c12312dcea49754afa0edee9f84889814ad1578`.
Its20,287,078-byte ROM/instruction suffix is byte-identical in base and prepared
runtime source, SHA256
`4e763ee0cacf0868846699f2b36cc7bcc1db9ef27facefdc61fb2d7e99c398c1`.

Offline demo/training builders are absent from the prepared runtime source and
preparation includes. The included training observer contains no memory-write,
machine-step or original-handler execution calls. Its authored scenario removals
are confined to the separate saved fixture; ordinary campaign loading continues
to use original scenario data. No runtime damage, harvest-rate, AI, wave, balance
or game-clock patch was introduced for these contextual buttons.

## Follow-up: real demo ARM versus stale render hover

The first catalogue harness did not render a persistent mouse hover between
native input-edge consumption and contextual-A dispatch. A real browser ARM
press revealed that gap. `tools/test_em_web_self_demo.c` now uses the actual red
demo's original Devastators37/40 without actor setup writes. It reproduces the
renderer's `dune_mouse_world_point` after each native frame, with the old pointer
in the adjacent cell. Before the fix, unit37 has correct occupancy1873 yet
commits original move1 to1872 and reports `native-rejected`, exactly matching
the observed browser failure. This was a stale input lifetime, not map ghosting
or a changed ability guard.

The pending SELF/RESELECT intent now keeps the mouse's world point authoritative
after queue-pop until the original A dispatcher accepts it. Only host input
fields are changed; the adapter writes no CPU, unit, map, timer or ability bytes.
Both original Devastators pass ordinary self intent and seven competing render
hover updates each: original A targets the same actor, arms the native ability,
and the original extra A reselects it with B available. The16-type catalogue and
four original special-action checks were recompiled and pass again. Before/after
logs are retained under `data/unit-action-qa/logs`.

```sh
clang -std=c11 -O1 tools/test_em_web_self_demo.c -o .local/test-self-demo-final -lm
.local/test-self-demo-final
```

The long ordinary-campaign differential has its own earlier frozen-header hashes;
this follow-up applies only while an explicit SELF/RESELECT intent is pending.
No further full-campaign coverage is inferred from the new input regression.

## Final generic world-A integration

`tools/em_web_world_intent.h` also keeps ordinary world-A mouse coordinates
authoritative through the original `$27B80` consumer. A native free cursor can
auto-center during the several VBlanks after queue-pop even with no external
hover, so queue consumption alone is not the action boundary. The helper only
updates `DuneMouse` intent fields; it writes no native CPU/order/ability fields.
It releases at actual original A, or resets on explicit input reset/drop, a
non-map context, disabled/pad input, lost queue, machine rewind or host rebase.
A second tap before consumption is rejected without replacing the first target;
subsequent native selection/entry taps remain separate original A commands.
`dune_web_end` does not cancel an accepted tap, because normal pointer release
calls that method too. Campaign, load and route cancellation is tracked in the
separate build metadata.

`tools/test_em_web_world_intent_state.c` passes queue, overlap, Clear/drop,
selection-reset/load, rebase, lost-queue, disabled-input and rewind boundaries,
with full-CPU immutability for the helper calls. The self-demo regression was
freshly compiled with this helper included: both original Devastators pass
generic initial selection plus self-A/reselection, quietly and with seven
competing hover updates each. The16-type catalogue and four earlier special
cases were freshly recompiled/run again after final header freeze. All child
compile/test processes finished.

The exact original Palace target proof belongs to
`data/world-input-qa/verification.json` and `docs/native-world-input-qa.md`: the
legacy no-hover input shifts requested1618 to1682; the shipping helper preserves
1618 quietly and through nine hover frames plus native-camera movement. This
change does not alter native Death Hand scatter or weapon accuracy.

Final input header SHA256 values are recorded under `shippingInputHeaders` in
`data/unit-action-qa/verification.json`; the normal WASM metadata recorder already
uses `tools/em_web_*.h`, including the new helper and camera. Historical campaign
long-run identities stay unchanged rather than being relabeled as this build.
