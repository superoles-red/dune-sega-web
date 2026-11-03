# Authored training: original delayed reinforcements

This concerns only the separately authored Harkonnen mission9 training fixture. It does not change the campaign, native AI, world clock, combat, runtime handlers, or normal saves.

The previous fixture removed only units whose low flags equalled3. Original scheduled reinforcement units are allocated off-map with flags7, so this filter skipped them. The original schedule subsequently deploys them and repeats enemy waves. A short idle test cannot establish safety across those later deadlines.

## Exact native schedule

RAM `$FFC0A2` contains16 records of10bytes:

| Offset | Original value |
| --- | --- |
| +0 | Unit index; `$FFFF` means unused |
| +2 | Entry location |
| +4 | Remaining deployment countdown |
| +6 | Original countdown used by repetition |
| +8 | Repeat flag |

Original initialization `$161CE..$161E8` writes `$FFFF` to the first word of each record, advances10bytes, and repeats16times. Original parser `$1698C..$16A68` creates the reserved off-map unit and fills the record. Its encoded time becomes `highByte*6+1`; low byte `'+'` enables repetition.

The actual consumer `$238AA..$23A74` checks record+0 at `$238EA`. `$FFFF` immediately branches to the next record, before countdown, unit lookup, deployment or replacement allocation. A successful repeating deployment can create a fresh reserved unit through original `Unit_Create`, store its new index and restore the original countdown. Removing initial actors alone therefore does not disable later waves and risks references to reused IDs.

Read-only inspection of `.local/training-fixture/training.cpu.bin` found11 active scheduled records. Enemy house4 owns IDs50..55, with native types7/10/3/12/10/12, all flags7; remaining countdowns48/72/126, original49/73/127, repetition enabled. Player reinforcements occupy IDs56..60. The exact record dump is `.local/training-reinforcement-before.json`.

## Offline fixture construction

The authored training builder can put all16 first words back to `$FFFF`, exactly matching original schedule initialization. The other record words need not be modified. It must also remove the old allocated off-map actors using original `Unit_Remove($43504)`, alongside the old mapped actors, before creating the three training actors. The original removal routine clears the actor flags at `$435A2` and updates native allocation/count bookkeeping. Clearing the schedule first prevents stale slot IDs from targeting later reused training IDs.

The initial training still has six original empty enemy team scripts. The original `Team_Reset($2DE30)` accepts one long argument: zero retains the existing pool pointer `$FFDCA0`, clears its `$540`bytes and resets the active count `$FFDC5C` to zero. This is the original scenario-reset helper called at `$16C82` / `$26898`. The observed pool is `$FF47CC`,16records×84bytes; all six initial teams belong to house4 with zero recruited members. Clearing those authored-fixture teams through this helper before creating the training actors prevents later recruitment of the controlled target Soldier. It does not pause runtime AI. The normal team iterator is bounded by the reset count.

The owning fixture builder performs the changes and the extended continuous training checks. This analysis and its probe are read-only; no shipping header or campaign data was edited here. A 30minute run must still be distinguished from this address/record proof and from browser playtesting.
