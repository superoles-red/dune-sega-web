# Original Results illustrations

The original USA ROM selects the Results background by the displayed mission
number modulo3, independently of victory or defeat:

| Missions | Original tilemap | Illustration | Exported ornament |
| --- | --- | --- | --- |
| 1,4,7 | `0xA6290` | Soldier in the desert | `results-soldier-scene` |
| 2,5,8 | `0xA659A` | Ornithopter flying over the desert | `results-aircraft-scene` |
| 3,6,9 | `0xA5EE4` | Tanks in the desert | `results-final-tanks-scene` |

Original `$27218` reads the mission argument and calls `$26C68`, which computes
the remainder and selects one of the three pointers in ROM table `$26C5C`.
The existing `results-final-tanks-scene` name is historical: its original
illustration also appears after missions3 and6.

The new aircraft ornament is an exact RGB crop `[0,96,320,128]` of the original
plane B. Its wing starts at y99; this preserves the complete aircraft and the
desert through the last native row223. The palette, all seven pattern banks, tilemap decompression and VDP
rendering come from the original native handlers. Existing soldier/tank PNGs
were verified byte-for-byte against the same decode; they were not changed.
Native live statistics and their timing/counters remain separate from this
static modern completion/password decoration.

## Reproduction

Use the pinned generated USA source and the previously captured native Results
CPU fixture. Raw fixture and decoded buffers remain local. Run the addon after
the ordinary screen-assets extraction/merges, before final UI packaging:

```sh
mkdir -p .local/outcome-art-audit
clang -std=c11 -O0 tools/audit_native_results_art.c -o .local/audit-native-results-art -lm
.local/audit-native-results-art .local/campaign-scenes/house1-mission01-defeat-results.cpu.bin .local/outcome-art-audit
python3 tools/extract_native_results_art.py --web
python3 tools/build_ui_assets.py
```

The offline audit invokes native `$26C68` on separate copies with mission
arguments1,2,3. This is controlled source-art decoding, not a claim that those
missions were completed by a player. No original ROM, fixture or game function
is modified. `proof.json` records the source identities, native map pointers,
instruction counts and pixel hashes. For each variant the actual shipping
read-only Results textless helper also passes a whole-CPU byte comparison and
changes zero pixels outside its recognized original label/rank glyph cells.

The preceding native outcome movies use separate artwork: victory `$22B02`
calls `$128AE` and loads descriptor11 (soldiers firing upward); defeat `$22BEE`
calls `$12996` and loads descriptor9 (burning aircraft wreckage). Those movies
must not be substituted for the mission-indexed statistics background.
