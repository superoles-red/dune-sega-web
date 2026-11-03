# Temporary native demonstration

`demo.state.bin` is an ordinary browser DSAV v2 save. The identical shipping
copy is `web/demo.state.bin`. It contains an authored demonstration city for
Atreides on the original ninth mission, SCENA009.INI (map seed27).

The host must load this payload in its isolated demo mode, without writing a
normal save or campaign progress. The binary itself has no custom cheat or
demo-mode API. Returning home should follow the host's ordinary cleanup.

The city contains all18 real Sega building/feature types:15 persistent building
types, plus native1/4cell concrete and a wall segment. There are23 owned active
buildings in total: six Windtraps give600 native power against380 usage; the
Refinery and four Silos give5005 native
credit capacity. The initial actual and visibly rendered bank is5000.

All15 interiors supported by the original game were opened through real
pointer input and checked against their intended original producer. Unused
IX(type6) is excluded: its native house mask is0, the Sega Yard explicitly
skips it, and it has no original interactive interior. Its former3x3site stays
original unoccupied rock; every other city position is preserved. Concrete and
Wall placement free their
temporary allocation records and persist as native map features instead.
The original one-per-house Palace and original purchase/upgrade availability
rules remain in effect; this fixture does not replace catalog tables.

All32 original Emperor buildings, original units, AI and mission predicates
remain present. No AI pause, force-win, invulnerability, or modified mission
flag is installed. Original AI can eventually attack: this is a demonstration
city rather than an endless sandbox. An1800frame original no-input run was
checked for a native fault or immediate victory/defeat.

## Rebuild

With the pinned original ROM, translated source and genuine full-YM frontend
CPU/chip capture available:

```sh
python3 tools/build_demo_fixture.py
```

The driver validates the ROM and translated-source hashes against
`docs/source-identity.json`, copies the actual current browser v2 serializer,
compiles `tools/build_demo_fixture_native.c`, and builds the city entirely
offline. It writes the ordinary payload, manifest, and both shipping copies.
Raw CPU/RGB captures,15 native interior reports, the completed native PNG and
the build log stay in `.local/demo-fixture/` as local evidence.

The driver now obtains its source through
`tools/capture_demo_audio_source_native.c`: genuine AUDIO_ON frontend followed
by original NewHouse/briefing/scenario flow. CPU and matching actual YMFM state
are captured together. `--fixture` requires a paired `--ym`; old AUDIO_MUTE
analysis snapshots are not complete demo-audio sources.

The current payload contains865 portable YMFM bytes. Actual current-v2 loading
and300 native frames of nonzero audio are checked by
`tools/test_demo_audio_load.c`; the builder also verifies30 seconds of advancing
YM writes and nonzero PCM. See `docs/native-demo-audio.md` and
`data/demo-audio-verification/manifest.json` for exact current identities and
evidence boundaries.

Building placement is original `$00E584` in temporarily scoped native
scenario-init mode. Every chosen footprint is first verified as unoccupied
original rock, then paved by original concrete placement. Original `$010490`
recounts actual power/storage; original `$010870` reveals fog around owned
buildings with their original reveal radius. Original `$011F38` in its forced
refresh mode1 formats the authored initial counter, then four genuine native
frames upload its glyphs. The builder never writes glyphs or VRAM itself.

The former silent fixture had a separate reproducibility check in
`.local/demo-fixture/reproducibility.json`; that historical result is not
relabelled as a repeated full-YM build.
Raw host CPU dumps contain an ASLR-dependent ROM pointer and are deliberately
not the portable shipping format.

`manifest.json` records source/payload hashes, all authored positions, native
power/storage totals and the15 verified menu identities. These offline checks
do not claim a physical-device playtest or user-earned campaign completion.
