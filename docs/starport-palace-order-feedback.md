# Native Starport, Palace and order feedback

This batch changes input presentation and reads the original USA game's action
state. The ROM bytes, gameplay instructions, costs, stock, cooldowns, targeting,
AI and balance remain the original program's responsibility.

## Menus

`web/building-layout.mjs` keeps each occupied native row and column, including
internal holes. Only empty trailing capacity is omitted from the HTML layout.
Starport retains its four-by-three native grid and its distinct live chrome,
button pixels and prices. Slots have bounded dimensions; the four rows no longer
grow into tall stretched panels. The subsequent polish removes the former
additional `STOCK`, `ORDER` and `TOTAL` panel and stock quantities in ARIA: only
the original game reveals unavailability in its own selected-item name.
There is no replacement web cart or delivery simulation. Other buildings keep
their own occupied menu rows; original EXIT/FIX/STOP order and guards stay intact.

## Palace

The original self-A path at `$27CFA..$27D28` arms a ready Palace in `DC4C`.
The large indicator is original cursor5, extracted through the original `$4B38`
setter and `$1088` sprite builder. It is an input hint with no pointer events;
drag and zoom retain the normal camera gesture path. An actual later native A
chooses the cell and executes the original power at `$22CC8`.

All three original powers use the native target cell `C1A8`: Harkonnen Death
Hand, Atreides Fremen orders and Ordos Saboteur orders. They are not replaced by
a common web weapon. Native tests observed their own cooldowns `400/50/125`.

CLEAR runs the original Palace B disarm first, then the existing pure building
deselection continuation. It does not fire the power or consume its cooldown.
Devastator and MCV retain their separate original A/B and countdown behavior.

## Order acknowledgement

The shell does not classify attacks from an object's appearance or ownership.
The read-only observer sees the native contextual-A action register `D4` at
`$281BC`, after the original target guards chose the command. Native action0
gets the original cursor5 crosshair; other committed orders keep the original
ordinary square. Each acknowledgement has two short visible intervals, anchored
to its native world cell through pan and zoom. Palace's successful native return
at `$27EA6` supplies its own acknowledgement.

A first selection, a queued click that never reaches a native command, a drag
and a minimap interaction do not create an order acknowledgement. A native
commit still does not promise a future projectile hit or a reachable path.

An original nuance is preserved: A on a friendly **unit** with another own unit
active chooses move action1; A on a friendly **building** can choose attack0.
The feedback follows that distinction instead of adding friendly-fire rules.

## Evidence and limits

`data/order-feedback-validation/manifest.json` records source/input hashes,
commands and twelve fresh native passing cases: three Palace houses, five
move/attack target scenarios and four existing Devastator/MCV/clear regressions.
Its read-only getter comparison covers the entire CPU structure. Actor/building
fixture setup calls original `Unit_Create`/`Building_Create`; it does not write
ready flags or cooldowns. These are controlled QA cases, not earned campaign
victories. Logs are in `.local/order-feedback-qa/`.

At handoff the full Node suite passed 50 tests, including menu geometry at six
screen sizes, native-event versus selection feedback, two blink intervals,
Palace indication, pan/zoom projection, curtain suppression and save isolation.
The root integration run owns WASM/browser checks. Physical phones and a full
earned campaign are not covered by these native and Node checks.
