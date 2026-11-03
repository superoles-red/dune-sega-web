# World-A target lifetime: Palace regression

`tools/test_em_web_generic_world_intent.c` reproduces the reported Palace target error on the actual red demo snapshot. This is a targeted input test on an authored demonstration, separate from the ordinary-campaign execution differential.

The Palace is selected/armed through two original A taps at world424,1032. The following requested world point589,826 belongs to native tile1618 `(18,25)`. Native internal camera movement is required to reach this point:295,839→337,797. The browser's adapted-camera pan is already reflected in the supplied world coordinate; this headless test does not reproduce CSS/DPR projection.

## Original error and cause

The no-lock control produces tile1682 `(18,26)` even with **no stale render hover**. At frame7476 the pointer queue is popped and the existing pointer adapter supplies the correct C2401618. Its final dirty refresh at7477 is also correct. The original free cursor then auto-centres over subsequent VBlanks, moving Y29→32→35; native `$7016` recomputes C2401682 at7479. The main task consumes the original A only at `$27B56` / `$27B80` on frame7480.

This is not Death Hand scatter. `$27E98` copies input D3 to C1A8; `$22CC8` only reads C1A8. Its only other original write is the later clear at `$27EBC`. The `$27EA6` observer therefore faithfully reports the already-drifted input tile.

## Shipping intent lock

The shipping `em_web_world_intent.h` binds an accepted world A to host pointer coordinates until the actual original A entry `$27B80`. It retains only host mouse intent; no CPU registers/RAM, native D3/C1A8/order/random fields or clocks are patched by this observer. The existing pointer adapter still supplies ordinary cursor/tile input, and original native picker/action routines perform the action and apply their guards.

| Native test mode | Original special target at27EA6 |
| --- | ---: |
| Legacy no-lock control, quiet | 1682 — reported error reproduced |
| Shipping lock, quiet | 1618 — exact requested cell |
| Shipping lock,9 stale render-hover updates to589,858 | 1618 — exact requested cell |

The queue pops at7476 and original A is consumed at7480 in every mode. The fixed observer is checked against the entire CPU structure before every original machine step and remains CPU-byte-immutable. A second pending target is rejected without changing the CPU or current mouse queue. The lock is released exactly at native `$27B80`.

Canonical source/header/fixture hashes, positive control, output and full traces are in `data/world-input-qa/verification.json`. The sibling `tools/test_em_web_world_intent_state.c` covers reset/cancel/rebase and quiescent-state guards; its evidence belongs to `data/unit-action-qa`. Successful-load and accepted route/mission cancellation hooks are integrated separately in the campaign bridge.

Browser CSS/DPR projection, the rebuilt WASM, actual button operation and auditory output require separate evidence; this muted native test does not establish those results. The earlier267ffc/039bf18000-frame no-input audit has not been relabelled to cover this later input change.

## Final local browser check

WASM `779ac9b3aeecc9f36a7adf2dbaf92ab1b77a87dc35e3f1aeab15b164bcb0a784`
was loaded in a fresh in-app browser QA tab. With500×890 CSS pixels, DPR2,
adapted camera left391/top666 and scale1.5625, tap310,250 corresponds to
world589.4,826. The original Palace observer committed tile1618, world592,816;
the former neighbouring1682 did not recur. Swiping retained armed state and
issued no order. The on-screen ARM button also armed original Devastator37,
reselected it, exposed its native B and completed that original B action.
Native counters reported selfResult armed and nativeBCount1.

External screenshots and DOM observer JSON are saved under the local
`dune-controls-cleanup` visualization artifact. This is desktop-browser
projection/button evidence, not physical-phone or auditory validation.
