# Starport, Upgrade portrait and ready-Yard unit input

The 3 November2026 polish keeps the original USA ROM/game instructions intact.
The changes are presentation pixels and a narrow native-clear-then-A input
sequence. No stock, cost, allocation, cooldown, HP or placement guard is changed.

## Original Starport chrome

`tools/extract_starport_chrome.py` exports20 pieces and3 modules into
`data/starport-ui/`. The source is the actual completed native context3 RGB
`.local/building-ui-fixtures/house1-building11.rgb`, SHA256
`8344f187356580fcc25fd102dccb066245863303944ec54ded7f48a851014bdd`.
The body sample at `[136,88,8,8]` is original gray RGB145/145/145. It is not a
recoloured Construction Yard. Monitor, resources, cabinet corners and aperture
profiles are exact Starport pixels. Only the rolling-cash glyph aperture in the
static window is cleared with its original black interior pixel; native rolling
digits continue to come from the live frame. Cabinet masks exclude the original
command/icon viewport while retaining its actual frame edges.

Reproduce:

```sh
python3 tools/extract_starport_chrome.py .local/building-ui-fixtures/house1-building11.rgb
python3 tools/merge_starport_ui_assets.py
python3 tools/build_ui_assets.py
```

The interface keeps the four native rows and original live button/focus pixels.
The added stock/order/total panel is removed. Native hidden stock does not add
HTML disabled state, availability labels or quantities in ARIA. Original
explicitly disabled FIX/STOP commands retain their native explanation and
remain pointer-clickable so the original guard decides the outcome.

## Upgrade illustration

The corrupted top strip exists in the actual native completed fixture, before
responsive composition. The observed Infantry resource is original record
`0x8FDB8`, compressed patterns`0x8FE82`,1920 decoded bytes,84 native mapping
words.180 leading pattern bytes differ in current native VRAM at`0x7000`.
Tiles1,2 and3 are mapped2,10 and5 times respectively, explaining why the number
of affected screen pixels exceeds the number of changed source nibbles.
This evidence does not establish whether the mismatch occurs on real hardware.

The read-only frame getter reconstructs only the96×56 monitor at`[160,40]`,
using the selected original ROM resource, native flips/map and current CRAM0.
It applies only while the actual native window/plane map exactly matches that
resource. It writes neither CPU nor VRAM; every pixel outside the monitor stays
byte-identical. No generated artwork, colour replacement or new animation is
introduced.

`tools/test_em_web_building_art.c` passed57 settled menus,3 Upgrade repairs and
3 intentionally unpublished outgoing Starport palette fades, across all houses.
Whole-CPU bytes are unchanged by the getter. The3 Upgrade repairs change3611
displayed pixels combined. Atreides changes1213 pixels; its resulting16128 RGB
bytes equal both a direct decode of the original ROM resource and the previously
exported `data/unit-assets/portraits/02-infantry.png` exactly.

Review evidence:

- `.local/campaign-analysis/upgrade-before-after-native.png` (native left, corrected right).
- `.local/campaign-analysis/upgrade-before-after-monitor-4x.png` (same pixels, nearest-neighbour4×).
- `.local/campaign-analysis/upgrade-readonly-source-proof.json`.

Reproduce the getter comparison and corrected RGB capture:

```sh
clang -std=c11 -O1 tools/test_em_web_building_art.c -o .local/test-building-art -lm
.local/test-building-art .local/building-ui-presentation-fixtures .local/building-upgrade-corrected.rgb
```

Native UI palettes1/3 must equal the original menu palette and selected static
completed-frame pixels must equal current VDP planes/palette before a frame is
published. This prevents full-colour PNG chrome from appearing over an original
fade. The existing scene-generation readiness guard remains required by the
outer interface. `holdFrame` retains the last composed building pixels while
the outer single exit curtain covers the outgoing native fade. A null getter
between the50ms outer polls also retains an already valid composed frame until
that curtain starts; a new producer without cached pixels remains hidden.

`tools/test_em_web_building_entry.c` verifies actual original entry transitions.
For Atreides mission9, Yard enters native context at frame105 but is published
only at107; Starport enters at104 and is published at106. Both reject two
original fade frames, and the first published chrome palette equals the settled
palette60frames later. There is no guessed delay in the readiness predicate.

## Ready Yard to unit

A short tap on a mapped own unit while a paid-ready Yard alone is selected
queues the original pure clear, waits for its native continuation, then emits
one original pointer A at that unit. It does not attempt construction or write
a replacement selected-unit pointer. An already active unit retains the
original target-command priority. A drag from the ready OK Yard retains the
existing native construction path.

Fresh `tools/test_em_web_ready_unit_switch.c` passes three cases: one clear+A
selects the original unit with paid product/allocation unchanged and zero
placement attempts; explicit CLEAR cancels the deferred tap; ready-Yard drag
still starts native placement. Fresh `tools/test_em_web_selection.c` also passes
all11 existing original command/production/placement/cancellation scenarios.

## Checks and limits

The full Node suite passes69/69 tests, including5 new presentation regressions:
no hidden Starport stock in DOM/ARIA, original gray chrome/4-row rendering,
held-frame exit behaviour, the inter-poll null-frame race, and hashes of all20
packaged PNGs/3 modules.
The60 native building fixture producer/purchase tests pass. These are native
controlled QA states, not an earned campaign. WASM/browser integration belongs
to the root agent's separate run; this document does not claim physical phone
testing, real-device appearance, or complete campaign playthrough.
