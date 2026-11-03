# Portable demo audio continuation — 2026-11-03

Both local demo payloads now contain the actual865-byte YMFM state paired
with their native Z80/PSG state. The engine and audio pipeline are unchanged.
The genuine frontend payload already had full YM state and remains unchanged.
The public site includes the red demo; the blue demo remains in the source workspace.

The former demo was built from an `AUDIO_MUTE` analysis fixture. That explicit
debug backend returns YM status0 and does not simulate timer overflow. Its Z80
was therefore waiting at `$02BB/$02BD` (`BIT0,(HL); JP Z,$02BB`, HL=`$4000`).
The old demo's `ym_size=0` caused the ordinary v2 loader to reset the real FM chip,
then restore that already waiting Z80. With no restored timer configuration,
the sound driver could remain in its wait although native master/sample clocks
and the world continued. `sceneGameFrame` is a scene-entry marker, not a running
world-frame counter; its static value did not prove a frozen simulation.

The fix is offline. `capture_demo_audio_source_native.c` continues the genuine
full-YM cold Main snapshot through the original NewHouse/briefing/scenario flow
into each original ninth mission. The same original-helper city builder then
places the accepted city, saving actual chip state together with CPU/Z80/PSG.
Each menu verification clones the matching YM state alongside its CPU clone.
There is no runtime driver reboot, timer-register repair, replacement music,
world-clock acceleration or balance change.

The complete accepted building/feature type-and-tile list matches the former
city for each house.5000 credits,600/380 power,5005 storage,32 original enemy
buildings and all15 native interiors remain. The scenario/map seed is original.
This is a fresh ordinary AUDIO_ON continuation: global frame/audio/AI timing
need not byte-match the former silent analysis snapshot. It is not a migration
of a played campaign save, and the original enemy AI remains active.

| Workspace payload | Bytes | YM bytes | SHA256 |
| --- | ---: | ---: | --- |
| `web/demo-harkonnen.state.bin` |140921|865|`8ec715f0b5cc08574dbe3668a15f2d3c4cf30b01cbcea7a6cc26f2651e4bf244`|
| `web/demo.state.bin` (Atreides) |140921|865|`c246c131d801fcaf5a127f3eb8738635065b73fc9467ba6253dddc2fcdaeabc4`|
| `web/frontend.state.bin` (unchanged) |140921|865|`6bfd6cb318ba28ced014c1a318a430ee5899025fdc2975d98a880e4abd2d7955`|

The builders verify30 seconds of native continuation for each demo:1,441,857
PCM frames each,26,136/27,876 additional YM writes, nonzero PCM, no native drops
or faults. A separate test uses the exact current browser v2 loader on frontend,
red and blue payloads. Each runs300 native frames, produces nonzero PCM and
new YM writes, preserves every payload world-RAM byte at load, and reports no
new dropped samples or fault. It tests the actual load rather than manually
recreating a chip configuration.

Root's integrated red browser sample at44.1kHz spans2358 native frames, with
230426 additional YM writes and no native drops, worklet underruns or overflows;
maximum reported producer gap is37.785ms. This is a bounded browser sample,
not physical-phone, thermal or unlimited-battle proof. Exact source identities,
logs and any copied browser evidence are in
`data/demo-audio-verification/manifest.json`.

For a rebuild, run `python3 tools/build_demo_fixture.py --house 0` or
`python3 tools/build_demo_fixture.py --house 1`. The default path creates a genuine
AUDIO_ON source first. A custom `--fixture` requires its matching `--ym` file;
muted visual fixtures are no longer accepted as demo audio sources. Historical
visual/analysis QA fixtures retain their recorded identities and are not
claimed as complete playable-audio snapshots.
