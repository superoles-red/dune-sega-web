# Separate real native tutorial fixture

This is an authored original-program exercise, not a simulation of Dune rules.
`training.state.bin` is an ordinary DSAVv2 payload, copied identically to
`web/training.state.bin`. The host must isolate it with trainingMode and restore
the prior world when the exercise ends; it must not save normal progress or
award campaign unlocks.

The original Harkonnen mission9 terrain and scenario predicates are used.
Offline original Unit_Remove/Building_Free remove allocated actors, including
off-map future-wave units, and production buildings. All16 reinforcement slots
use the original emptyFFFF sentinel; original Team_Reset clears the six scenario
Teams. One remote original enemy Windtrap remains, preventing an immediate
victory. The city contains the original Yard, Refinery, Windtrap and five Silos,
with the Silos placed away from the Refinery's western approach.
The initial bank is5000, native capacity6005. Original Unit_Create supplies a
Tank200HP, Harvester150HP/cargo0 and an enemy Soldier20HP. Their original Guard
orders, stats, projectiles, movement, gathering, delivery and production remain
unchanged. Native fog-unveil helpers prepare the visible training district.
There is no runtime AI pause, invulnerability or injected successful action.

The Tank and Soldier begin nine cells apart, beyond their original ranges4/2.
An actual108000-frame idle test (thirty native minutes) retains Tank200HP,
Soldier20HP, Harvester cargo0 and the live Yard/Refinery. Real pointer-input tests then verify Tank
movement/clear, projectile damage, harvesting and Refinery unloading (actual
credits4998→5012/cargo1→0), first shop tap preview, second tap payment, original
concrete production, and successful native placement. One additional sequence
performs Tank move/attack, Concrete4 at16,34, gathering to100cargo, a real move
through400,1008 and a first-cell Refinery command without restoring the world
between steps. It unloads100→0 and increases actual credits4983→5683.

`tools/em_web_training.h` only reads the current world. Its getter is checked
against the whole CPU structure before/after; all4096 pure terrain-classifier
results equal the original routine. Tank/Harvester/enemy IDs43/44/45 are stable;
the report includes their actual positions/HP/actions/cargo, native selected
pointers, Yard paid index/flags/ready state, actual bank/storage/power, concrete
count and nearby native spice cells. A stored Harvester remains alive while its
native allocation/HP exist: `inWorld` and `stored` are separate from `alive`.
The test observes1461 stored frames with whole-CPU read-only getter checks.
Order/placement event counters come from
the existing original-command observer rather than a new fake event source.

Rebuild: `python3 tools/build_training_fixture.py`. `manifest.json` contains
source hashes, all object IDs and positions, exact setup helpers and validation
coverage. Raw CPU/RGB, native log and PNG are local in `.local/training-fixture`.
An independent rebuild produced the same portable save SHA256. These are native
controlled checks; browser and physical-device validation remain separate.
