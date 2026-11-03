# Native content for the separate base-screen prototype

`manifest.json` supplies all 19 original building definitions and one observed
Construction Yard menu containing 12 purchasable buildings plus Upgrade, with
an occupied sixth native row.

The statistics are read directly from the exact USA ROM pointer table `$06B954`:
cost at record `+22`, max HP at `+16`, signed power at `+58`, menu sorting priority
at byte `+32`. Positive power consumes energy; negative power generates it.
There are no DOS values or manually chosen balance numbers.

The menu is an explicitly controlled offline fixture: an original first-mission
CPU snapshot is configured for campaign index 8, and prerequisite buildings are
placed through the original scenario-initialization `Building_Create` routine.
The real original availability and menu routines then produce the final grid.
Neither the availability list nor menu cells are written by the extractor.
This is not represented as a campaign-completion save or an ordinary initial base.

The resulting cells are:

| Row | Column 0 | Column 1 | Column 2 |
| --- | --- | --- | --- |
| 0 | EXIT | FIX | STOP disabled |
| 1 | Concrete (4) | Windtrap | Refinery |
| 2 | Outpost | Spice Silo | Vehicle (light) |
| 3 | Barracks | Wall | Turret |
| 4 | Repair | Hi-Tech | Palace |
| 5 | Upgrade | empty | empty |

Palace is deliberately left unbuilt in the updated fixture. The Starport
prerequisite exists, so the original routines now offer Palace, while the
original upgrade option moves naturally into row six. Neither the new Palace
cell nor the Upgrade position is inserted by the exporter.

## Six-row capacity versus real availability

The original menu has **6 rows × 3 columns = 18 total cells**, of which the first
three are EXIT/FIX/STOP. It therefore has 15 remaining product/upgrade slots,
not 18 purchases plus commands. The native fixture occupies 16 of its 18 cells:
3 commands, 12 building purchases and Upgrade. Empty cells are preserved.

Some definition/art records cannot simply be added to fill the gaps. The Sega
availability routine explicitly skips Heavy Vehicle building4 and IX building6
at `$00FF2E..$00FF3A`. WOR7 also has house-specific exclusions at
`$00FF3C..$00FF4A`. Palace2 and Starport11 are removed after an existing one is
counted by `$00FFE6..$010016`. These are Sega-specific checks in addition to the
definition table's tech, upgrade and prerequisite fields.

`nativeGridCapacity` records both capacity and observed occupied rows/cells.
A separate interface prototype may demonstrate six rows of 18 purchase cards,
but this is a design-capacity example rather than an observed exact original
Construction Yard menu. The exporter does not invent native purchases.

All building IDs retain their original statistics even when absent from this
fixture's actual grid. Such entries have `row: null`, `col: null` and
`visibleInNativeFixture: false`; no fictitious native slot is assigned.
`nativeGrid` preserves the original signed command and empty-cell values.

The observed fixture house balance is 991; its animated displayed balance is
606 at the sampled frame. A standalone mockup may deliberately use a separate
sample balance, labelled as prototype state. Changing this content does not
modify the shipping game, its mechanics or its balance.

Icon and portrait paths are relative to this directory and refer to the sibling
`building-assets` package. The menu/picture graphics are not copied or redrawn.

Reproduce from the exact USA ROM and the pinned original CPU snapshot:

```sh
clang -std=c11 -O1 tools/extract_base_prototype_content_native.c -o .local/extract-base-prototype-content-native -lm
python3 tools/extract_base_prototype_content.py '/path/to/Dune - The Battle for Arrakis (USA).gen' --native-helper .local/extract-base-prototype-content-native
```

The helper executes original offline game procedures. It is not included in the
web game or in the standalone prototype runtime.
