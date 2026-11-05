# Browser SELECT and COMMAND intents

`tools/em_web_typed_input.h` is included by the existing selection adapter.
It adds browser input intent, without editing the ROM, translated instruction
handlers, native unit/building fields, production, economy, AI or timers.
One unit remains selected at a time.

## API and original handlers

- `dune_web_target_screen(cssX, cssY)` returns JSON describing the world/native
  UI classification, native occupancy target and selected object. It queues
  nothing and reads native map flags/index rather than drawn sprite rectangles.
  `selected` remains the true native selection; `inputActor` separately reflects
  the accepted pending SELECT target for fresh input. Its `powerArmed` belongs
  only to that actor when it is also the currently armed native Palace.
- `dune_web_actor_capture()` returns a short-lived, one-use actor ticket. It
  records the actual selected own actor and whether its Palace weapon was
  already armed. A fresh capture after an accepted pending SELECT uses that
  intended target, including before the next native frame; a pending empty
  SELECT returns no actor. An independently retained before-SELECT ticket still
  refers to its original actor. The token serial survives state loads; tickets
  do not.
- `dune_web_select_screen(cssX, cssY)` clears a different old selection through
  the original clear continuations, then selects the real target with original
  contextual A `$027B80` from no active unit. Empty space only clears. Repeating
  SELECT on the same unit is a no-op. Repeating it on a building executes its
  original A entry/Palace arming; a paid ready Yard remains drag-only. An already
  armed selected Palace follows its original information-screen entry after
  the shell's own-building double-command window expires.
- `dune_web_command_screen(cssX, cssY, ticket)` restores the ticket's actor,
  if necessary, using original clear then original A selection. It subsequently
  executes original contextual A at the requested tile. Thus its original code
  chooses movement, attack, harvesting, deployment or rejection; the adapter
  does not force an attack. Ordinary building tickets can only target themselves.
  Remote Palace casting additionally requires an originally armed ticket and
  the weapon still being ready. If the first tap canceled it, original A selects
  and re-arms that same Palace before original target-A executes.
  For an explicit armed COMMAND targeting its own selected Palace footprint,
  the adapter chooses the original target branch at the same-object UI fork
  `$027BCE` by continuing at original `$027BEC` (the instruction that classifies
  Palace targeting as a target instead of a building-info click). It does not
  enter activation directly: original `$027D60..$027E96` still checks selected
  bit15, type2, ready bit7, cooldown86, inhibit bit8 and armed `DC4C`; original
  `$022CC8` still owns house/resources, allocation, scatter/damage/spawn and
  cooldown. The choice is restricted to COMMAND's `EXECUTING` phase and matching
  native A3/A0/C578 identity, with no selected unit. SELECT, original A, and
  COMMAND's actor-restoration/arming phases retain their original routing.

The shell owns mouse/touch recognition and captures the actor before the first
immediate single SELECT. A later matching double command can therefore restore
that original actor even after the first tap changed/cleared selection. There
is no intentional single-tap recognition delay in this native adapter.

The state machine waits at the established native map callback `$027B5E`,
checks the expected caller `$00E270` at `SP+32`, and observes native return
`$00E57A`. It never fabricates native selection pointers or unit orders. An
already executing first selector finishes before the command restores its
actor. Devastator/MCV self commands reuse the existing original self-A and real
follow-up A selection, leaving native contextual B available. Pure Palace clear
executes original B disarm and original building-clear in one requested intent.

Targets are restricted to the original mission rectangle. Tickets are rejected
after destruction/slot reuse observed at an instruction boundary, identity or
ownership changes, mission/house change, state reset/rebase, clock rewind or
expiry. Accepted tickets are consumed once. Placement and contextual B cannot
interleave a pending typed intent. None of this state is a new game mechanic or
part of a DSAV save.

## Native verification and limits

`tools/test_em_web_typed_input.c` loads the genuine authored Harkonnen demo CPU
fixture and executes the unchanged translated game. It checks:

- full CPU bytes remain unchanged when SELECT/COMMAND are queued;
- same-unit SELECT issues no A; switching A→B and empty-clear issue no order;
- restored commands reach original `$0281BC` with the captured actor and exact
  requested ground/building tile;
- commands arriving before first clear or during the first original A selector
  preserve the original actor and target;
- a fresh PC command capture after a pending SELECT B uses B, while a separately
  retained before-SELECT ticket continues to command A; a pending empty SELECT
  cannot accidentally capture A;
- a double tap before any native frame can arm the real Devastator and leave
  its original B confirmation reachable;
- one pure-clear/empty SELECT removes the armed Palace marker and selection
  without consuming its charge; restoration/rearming reaches original Palace
  activation `$027EA6` at the requested tile;
- read-only hit testing, original mission boundary, consumed/stale/dead/reused/
  reset/expired ticket guards, and repeated-building original entry;
- 120 no-input native frames produce byte-identical complete CPU/device state
  compared with the same original execution without selection observation.

The death/reuse rejection test explicitly changes an isolated fixture's HP to
exercise the guard, then restores it; it does not claim a combat/death proof.
The other commands and Palace/self-action outcomes above execute original code.
The raw CPU fixture is local ignored QA data, not a distributable save format.

```sh
clang -std=c11 -O0 tools/test_em_web_typed_input.c -o .local/test-typed-input -lm
.local/test-typed-input
```

This establishes native input routing and scoped state preservation. Actual
browser coordinates, double-tap timing, touch ergonomics, whole campaigns and
physical-device performance require separate validation.

## Dedicated Palace command verification

`tools/test_em_web_palace_command.c` uses genuine house0/1 full-base fixtures and
the genuine house2 Palace interior fixture, exiting that last screen through its
original `EXIT` before testing the map. No house is recolored or reassigned and
no charge is fabricated. It exercises all three original house powers, explicit
commands on the Palace itself and another own building, and a lone deferred
SINGLE entering the original Palace information screen without activation.

For every successful command it records the seven original eligibility checks,
one native A, one original weapon call, the requested target tile, and one charge
consumption. At the common guarded target entry it also copies the complete CPU
and independently executes the unchanged original code without adapter
observation to the same original activation-return boundary. All 391,624 CPU/
device bytes match, including entity allocation, target, RNG/scatter, game RAM
and native clocks within that original branch. This is a matched-entry branch
proof; an old same-building A would have chosen the information screen instead.

Isolated negative fixtures invalidate selected bit15, charge, cooldown, inhibit
bit8 or `DC4C` after dispatch and verify the original downstream guards reject
without information-screen fallback. The original house/resource failure branch
is checked as well. Uncharged, dead and changed-owner actors are also rejected
before dispatch. Those negative states are explicit QA fixture mutations, not
product writes or new mechanics. The 11 prior typed-input regressions still pass.
