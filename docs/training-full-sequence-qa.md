# Native tutorial delivery and long-idle verification

The final ordinary v2 tutorial payload is140056bytes, SHA256
`a3852e515ece3faa93df071bed4de469ccbb5afc4b3e08695628fa4ac7d92265`.
The three copies in `.local/training-fixture`, `data/training` and `web` match.
The earlier fixture remains archived in `.local/training-before-schedule-fix`.

## Confirmed causes

The earlier tutorial removed mapped enemy actors but left11 future reinforcement
records at`FFC0A2`,16slots×10bytes. Their allocated off-map units50..60 had
flags7, so a check for `(flags&7)==3` skipped them. Original native wave scripts
therefore continued to introduce attacks later. Six original scripted Teams
also remained. This is established from the actual old CPU fixture, not inferred
from the bank counter alone. Evidence: `.local/training-reinforcement-before.json`.

The authored tutorial now sets each slot's first word toFFFF, exactly as original
scenario initialization at`161CE..161E8`. The other eight bytes in each record
remain unchanged. Original consumer`238E6` skips the native empty sentinel.
Original Unit_Remove clears all allocated old units, including those stored
off-map, before the three tutorial actors are created. Original Team_Reset at
`2DE30(long0)` clears the old Teams. This changes only the offline authored
tutorial data; normal campaigns and the technical red demo retain their waves
and original AI. See `data/training/schedule-source-proof.json`.

The Harvester's reported death during unloading was a metadata error. A real
stored Harvester has flags`1107`,150HP and a Refinery link to unit44. It remains
allocated while absent from the map. `alive` now means allocated with positive
HP; `inWorld` requires the native mapped/not-stored flag combination, while
`stored` is separate. No native actor flag is modified by this report.

The player house pointer is also read through the exact original House_Get
formula (`DC24 +70×player`, native`22922`), with current-pointer/display/counter
diagnostics retained. In the full original return probe both pointers and
actual bank agreed throughout; unloading increased the real bank. There was
no evidence that the reported income loss required a currency or gameplay fix.

## Continuous proof

`tools/build_training_fixture_native.c` first executes108000 genuine native
frames: thirty minutes. The Tank stays200HP, Soldier20HP, Harvester cargo0,
Yard and Refinery remain alive, all wave slots remain empty and Team count0.
No runtime AI pause, invulnerability, timer acceleration or force-outcome is used.

A further single sequence runs without restoring between steps:

1. Select/move the Tank, then destroy the real full-HP Soldier.
2. Preview/pay for Concrete4 and place it at native tile16,34.
3. Harvest original spice until the real cargo reaches100.
4. Move the full Harvester through the previously observed northwest waypoint400,1008.
5. Tap the Refinery's first native cell; original action1/target selection remains unchanged.
6. Enter and unload100→0; actual bank increases4983→5683.

The read-only getter is checked against the entire CPU structure on1461 stored
frames and consistently reports the stored Harvester alive. Smaller original
gather/delivery and paid-construction cases also pass. The log is
`.local/training-fixture/build.log`; setup/object/source details are in
`data/training/manifest.json`.

The earlier browser approach stall was not reproduced as a deterministic native
instruction defect: even an original probe with a558HP Refinery and the same
Concrete4 placement unloaded full cargo through the first-cell command. The
training Silos are now farther west/south, opening the tight Refinery approach.
The exact northwest-waypoint case above passes with that layout. Original
pathfinding, building entrance, orders and harvesting instructions are untouched.

Rebuild with `python3 tools/build_training_fixture.py`. This is native controlled
QA; the root agent owns the final browser sequence and physical-phone testing
is not established by this report.
