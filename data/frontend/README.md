# Original cold Main payload

`frontend.state.bin` is an ordinary DSAV v2 save, identical to the copy at
`web/frontend.state.bin`. It is a clean original Main machine state for leaving
gameplay without calling the Main graphics loader on top of live world RAM.

The builder starts at the original ROM reset vector, with real AUDIO_ON/YMFM,
and executes only original `machine_step`. It stops at the actual native input
poll `$004D4E`, whose original stack return is `$0178D2`, after at least eight
additional completed native frames. The current capture settles for ten frames
and has zero differences between its completed native RGB and current VDP.

The captured machine has houseID−1, native house word`$FFFF`, house pointer0,
and mapContext0. There is no mission/world fixture, no invented world state,
no scene-PC jump and no borrowed `$017418` call from a battle.

The current v2 serializer includes the complete original Z80/PSG state and
865bytes of YMFM state:140921bytes total. The exact same YMFM source is used by
the browser. Its format uses explicitly encoded fixed-width little-endian
values, rather than copying a C++ object or pointers. The offline build checks
byte-identical YMFM save→restore→save and4096 identical clocked stereo samples
against the original running chip. The captured music is active and nonzero.

Load this file through the existing ordinary v2 loader. That loader restores
the FM chip and rebases its host sample clock to the restored original master
clock. Let the normal native scene observer reach its actual ready/input poll;
do not synthesize readiness in the host. Keeping the frontend catalogue open
should use the existing frontend hold for the original attract counter, while
native video/audio clocks continue normally.

## Rebuild

```sh
python3 tools/build_frontend_fixture.py
```

Prerequisites are the operator's exact USA ROM, the pinned translated original
source and the existing generated browser source containing its v2 serializer.
The driver validates source hashes, extracts that actual serializer, compiles
the original C machine and the same YMFM backend, then cold-boots and exports.
No pre-existing raw CPU fixture is needed.

Local evidence is in `.local/frontend-fixture/`: actual completed native PNG/
RGB, raw CPU, exact YMFM bytes, report, build log and reproducibility check.
Raw host CPU dumps contain process-specific pointers, including Audio.fm, and
are not portable save files. For native test use, restore the chip from
`frontend.ym.bin`; browser use must load the actual v2 payload instead.

The manifest distinguishes these offline proofs from the separate hot-world
return, native route, browser and physical-device tests.
