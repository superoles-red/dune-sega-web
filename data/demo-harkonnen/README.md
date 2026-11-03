# Red native technical demonstration

`demo.state.bin` and `web/demo-harkonnen.state.bin` are identical ordinary DSAVv2
saves. The actual source is Harkonnen mission9, SCENH009.INI, map seed17.
House0 owns the added city; red house colours come from original game rendering,
not an Atreides recolour. All18 real building/map-feature types are present;
unused IX6 is omitted. Native totals:600 power,380 usage,5005 capacity,5000
actual and displayed starting credits.

All32 original enemy buildings, original units, AI and mission predicates are
retained. Original helper placement authors the extra city on unoccupied native
rock near the original Harkonnen Yard. All15 supported native interiors were
opened and checked for the correct real producer type/house, completed palette
and raster. The original simulation also runs1800 no-input frames without an
immediate victory, defeat or fault. This is separate from the simplified
authored training fixture.

Rebuild with `python3 tools/build_demo_fixture.py --house 0`. Native CPU/RGB,
15 interior JSON/RGB captures and the log stay in `.local/demo-fixture-harkonnen`.
`manifest.json` records the exact source and payload hashes. The host must use
demoMode so loading this technical example never changes normal Continue or
campaign unlocks.

The former blue payload is unchanged in `data/demo` and `web/demo.state.bin`.
`data/demo-atreides-archive` additionally preserves that exact payload, its
original manifest, and the two historical builder sources whose hashes match
the manifest. Native checks do not establish physical-phone testing or an
earned campaign playthrough.
