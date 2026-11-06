# Live original building-menu bridge

`tools/em_web_building_ui.h` is included after `em_web_menu_select.h` in the
browser host. It observes the existing original CPU, menu grids and completed
VDP frame. It does not add a catalogue, recalculate availability or change
native production, repair, upgrade, Starport, Palace or payment instructions.

## Browser API

| Export | Result |
| --- | --- |
| `dune_web_building_ui_json()` | Pointer to a static NUL-terminated UTF-8 JSON buffer, at most 32 KiB. Copy before another call. |
| `dune_web_building_ui_tap_checked(context, producerPointer, col, row)` | Queues one existing native pointer intent if that exact menu/producer remains active. Returns 1 on enqueue, 0 on rejection. |
| `dune_web_building_ui_tap(col, row)` | Same intent with current identity, for callers that already coordinate menu state. |
| `dune_web_building_ui_frame_rgb()` | Pointer to the completed original 320×224 RGB frame, 215,040 bytes, or NULL outside a ready building/Starport menu. Copy before another game frame. |

Context2 has six rows × three columns. Starport context3 has four rows × three
columns. Rows include the native EXIT/FIX/STOP commands; they are not additional
rows of purchases. `cells[].sourceRect` selects the original 32×24 pixels,
including actual focus phase, unavailable palette and Starport quantity. The
96×56 portrait, name, counters, meters and stat-glyph rectangles are supplied
in `sourceRects`. An HTML button can provide hit testing/accessibility while
its visible content comes from these live pixels.

`cells[].raw` is the exact signed production or unsigned Starport native grid
value. Empty production cells are −128; empty Starport cells are255. Native
production commands are EXIT−1, FIX−2/disabled−4, STOP−3/disabled−5. Starport
commands are EXIT28, FIX29/disabled31, STOP30/disabled32. Upgrade remains its
native byte-sized product boundary (building19, unit27), never an invented unit.

All nonempty cells remain clickable, including disabled commands and sold-out
items. `available`, `affordable` and `disabled` are read-only metadata; original
instructions decide whether an action succeeds. Purchase intents continue
through the existing first-tap information / second-tap confirmation adapter.
EXIT, repair and STOP retain the adapter's original immediate-command path.
The checked call guards stale producer/context identity and rejects empty cells,
out-of-grid coordinates, paused/stopped host and full input queue. It never
writes stock, money or production RAM and never synthesizes an extra purchase.

## Live values

`producer` identifies the real active building, native type/house, current/max
HP, actual product/progress flags and upgrade level. Definitions and names are
read from the exact ROM tables, building `$6B954` and unit `$6C5BC`.

Production prices come from definition+22. Paid Upgrade price is the original
half producer-definition cost. **Starport prices always come from its live
`$C2D8` records+4**, alongside signed stock+3 and current order count+2. No ROM
base-price fallback is supplied while a Starport record is not ready. Delivery
can clear the order count quickly after an accepted purchase; the bridge shows
that current native value.

`creditsActual` is the player's bank at house record+18, used by original
payment guards. `creditsCounter` (`$D6C0`), `creditsVelocity` (`$D6BC`) and
`creditsDisplayed` (`$C058`) are separate diagnostics for the original animated
counter. For the exact visible number use **`creditsText`**, the original six
ASCII glyphs cached at `$C85A` by routine `$A5DA`, or its live RGB rectangle
`creditsGlyphRect={x:248,y:16,w:48,h:8}`. Native menu SAT mapping `$6A7EE`,
position table `$6A80E`, uses these six cells. The number can differ from C058
by one while moving and can visibly lag the real bank during original rolling
animation. Leading spaces are preserved. The full eight-byte cache is exposed
only as `creditsGlyphCache` for diagnostics.

`detailTexts` reads the original RAM strings used by the current native detail
panel, so signed power, damage, HP, price and command-specific displays need not
be reinterpreted by a new UI. Building metadata `power` is its signed source
value; the original displayed secondary number negates that value. Unit
secondary information is damage. Live glyph pixels remain authoritative.

## Native coverage and reproduction

The fixture suite enters every ordinary building-menu producer type for every
authentic player house: IDs2,3,4,5,7,8,9,10,11,12,13,15,16,17,18. Native
concrete0/1, IX6 and wall14 have no ordinary enterable menu; no menu is invented.
Palace currently has its native service grid, without adding a new ability
purchase button.

```sh
clang -std=c11 -O1 -Wformat tools/test_em_web_building_ui.c -o .local/test-building-ui -lm
.local/test-building-ui .local/campaign-fixtures .local/building-ui-fixtures
python3 tools/verify_building_ui_fixtures.py
```

Campaign CPU baselines are produced by the separate original campaign-flow
fixture runner. All 27 authentic house/mission starts were loaded through the
native NewHouse, briefing and scenario routines. The building fixtures start
from those baselines, then use the original `Building_Create` routine in
scenario-init mode to author missing producers offline. Upgrade tests add a
real native Outpost prerequisite; repair fixtures take controlled damage before
native menu creation. No fixture edits the generated menu, price or stock.

For each capture, the JSON getter is checked by byte comparison against the
whole CPU, pointer queue and purchase adapter. Guard-rejected intents must
change none of these states. The tests also use real pointer intents to check
all-house first/second-tap Windtrap purchases, immediate STOP, paid Upgrade,
real repair and Starport stock/credit/delivery paths.

The verification script validates native grids/metadata and uses the existing
`.local/export-save` converter to produce normal browser v2 `.state.bin`
snapshots. It adds no raw-CPU runtime loader. These snapshots serialize native
machine state; transient host purchase-preview arming is deliberately not part
of that existing format, so a browser load requires its own first preview tap.
`manifest.json` records capture-time arming, original input provenance and
SHA-256 hashes. The source RGB remains available for pixel comparison.

## Original static art inventory

`data/building-assets/manifest.json` has all19 building icons and illustrations.
`data/unit-assets/manifest.json` inventories all27 native unit definitions,
all23 nonzero unit-icon pointers, all17 real unit monitor images and the native
Upgrade/Starport command variants. Real missing pointers and dummy monitor
resources are explicitly absent. Static exports preserve the original 4bpp
patterns, tile mappings, flips, transparent color0 and source CRAM palettes.
Every real portrait's decoded bytes were compared with original routine$0C32.
Selected/state/house palettes and console effects belong to the live frame;
the PNG inventory does not replace them with approximations.

## Complete original monitor presentation

Since 20261106-shop1, the read-only RGB getter reconstructs the displayed 96x56
monitor from the complete original ROM resource when shared VRAM or color0
transparency leaves stale pixels. Original $8306/$905E resource choice, current
CRAM0 and a matching live name-table guard determine the result. Only the
monitor pixels may differ; all CPU/RAM/VRAM state remains byte-identical.
The cached resource and converted picture avoid repeated decoding.

Modern product cells now open a shared native-art BUY/CANCEL dialog with name and live native item icon
on a second phone press after the original first preview; desktop hover previews
and a click opens it. Buy on the left revalidates the current
producer and preview before submitting one original second checked tap; Cancel
on the right spends nothing. See [release details](release-20261106-shop.md).
