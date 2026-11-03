# Reproducible local UI asset package

```sh
python3 tools/build_ui_assets.py
python3 tools/build_ui_assets.py --check
```

The builder copies the canonical `data/shop-layout-kit`, `data/screen-assets`,
`data/campaign` and `data/unit-assets` into their corresponding directories in
`web/ui-assets`. It writes a deterministic root `manifest.json` with every
relative file path, byte length, SHA-256, per-kit source manifest hash and
coverage. Files in these four derived output groups are synchronized to their
sources; canonical data and runtime code are never changed.

The current package contains343 files, including333 PNG, and1,126,325 bytes.
The root manifest is authoritative for regenerated inventories. This includes
the full native scene-composition additions and the final campaign routing,
cinematic/textless-frame and continuous-frontend-audio verification JSON.
It does not include a new game simulation or a flattened screenshot UI.
The live original frame supplies current focus, colors, monitor picture,
counter, quantities and lights; packaged parts supply the original composition
geometry, fonts and static surfaces. Unit inventories explicitly preserve real
missing resources instead of supplying fabricated replacements.

`data/screen-assets` is augmented by `tools/extract_scene_presentation.py` after
its base extraction. Those recipes retain the complete320×224 title, story,
movie and ending compositions. Options uses a208×136 illustration joined from
two untouched native soldier/launcher fragments, above separate controls. The
original baked labels and unrecoverable hidden pixels are not painted over.
`tools/merge_starport_ui_assets.py` then appends20 independently extracted
Starport parts and3 modules, preserving its own native gray palette.
This packaging command copies the canonical additions; it does
not rerun extraction or replace live native animation with static PNG loops.

The separate modern tutorial is reproduced by
`tools/extract_modern_tutorial.py` from its offline native tutorial captures.
Its canonical `data/modern-tutorial` mirrors to `web/tutorial-assets`, loaded
only by `web/tutorial.mjs`. The current v2 package contains the33 complete
original320×224 descriptive frames in one atlas, with Previous/Next and Back.
It is opened only from startup Options. It does not run a practice scenario,
poll native state, or issue campaign orders. Earlier practice assets and their
proofs remain archival; they are not part of this visible tutorial flow.
The runtime cinematics remain live.

Local browser QA can additionally package all60 validated native building-menu
snapshots:

```sh
python3 tools/verify_building_ui_fixtures.py
python3 tools/build_ui_assets.py --qa-fixtures
python3 tools/build_ui_assets.py --qa-fixtures --check
```

The optional output is `web/qa-fixtures/buildings/`: normal original v2
`.state.bin` files and a compact provenance/hash/coverage manifest. Raw CPU
structs and native RGB evidence remain under `.local/building-ui-fixtures`.
The builder checks each normal save's hash, magic, version and declared size
against the verified native fixture inventory. It adds no raw CPU loader.

The existing v2 format records original machine state but excludes transient
host preview arming. Preview snapshots retain their original native selected
pixels and catalogue; loading one in a browser starts a new first-tap preview
cycle. The fixture manifest records both this boundary and capture-time state.

The build commands write local derived files only. They do not publish or
deploy the game.

Captured campaign/story screens have a separate optional QA export:

```sh
python3 tools/build_qa_scene_fixtures.py
```

It creates `web/qa-fixtures/scenes/manifest.json` and27 ordinary v2 snapshots.
Three come from original menu flow;22 are native outcome screens reached after
explicit controlled offline conditions. Two additional snapshots stop naturally
at original PC$22AB2 before the native outcome predicates execute. Their capture
guards require mapContext1, fault0, outcome none, sequence0 and an armed native
run; original continuation assertions verify one matching victory/defeat edge.
They remain labelled controlled/not-earned, with individual capture-source and
state hashes. Use `?qa`, whose progress/save slots live in isolated sessionStorage.
Export uses atomic replacement and retains identical existing save bytes.
