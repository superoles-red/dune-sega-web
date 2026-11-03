# Ordinary-campaign native fidelity differential

`tools/test_native_campaign_fidelity.c` compares the untouched original translated USA program with the campaign, selection, native-menu and direct-menu observers recorded for each execution on the same original machine-step clock. Sources are the genuine Harkonnen, Atreides and Ordos mission9 snapshots produced by the ordinary campaign-start regression. They are not authored demo/training worlds.

Both copies receive no gamepad or pointer/action intent. No units/buildings are created by the harness; no cash, cargo, HP, map, research, schedule, AI or timer fields are edited. Natural native AI supplies the economy, attacks and delayed reinforcements. At every native VDP frame boundary the harness compares **all391624 bytes** of CPU registers, RAM, devices, VDP, palettes and completed RGB with `memcmp`, without excluded ranges. Only identical source setup selects `AUDIO_MUTE` and the pinned ROM pointer in both copies.

The archived long runs compare105824 native frames and1209919364 original native instructions **per copy**. All complete with zero byte differences and no native fault. The ROM/instruction suffix remains byte-identical to the pinned original; hashes, source fixture identities, exact runtime-header identities, raw event logs and per-case summaries are in `data/native-campaign-fidelity/manifest.json`.

## Short audit of267ffc74… — 2026-11-03

WASM `267ffc74caade44236994f4e342d0fe26a91f151bb1370c6af59a758cb8eb17d` records campaign header `039bf446354ecf52baaa36bf9e8cf549172977785a6e2a08c6365228f7c64f0f`. The105824-frame long results below retain their original campaign hash `3eefcf98…`; their manifest identities have **not** been replaced by the current hash.

The unchanged native harness was freshly compiled with that039bf… header in a separate binary/sandbox. All three original mission9 sources reached6000-frame TRACE boundaries after every full-CPU comparison passed:18000 newly checked frames. H0/H1/H2 produced236/238/211 actual cargo increments and3 refinery deliveries each. There were no shots, HP loss or scheduled waves during these short prefixes. Each process was intentionally terminated and joined after its verified TRACE boundary; none reached its long-scenario completion assertions. These are prefix equality results, not new long-run PASS results.

An exact source-delta check removes only the four new `route_hold` presentation additions from the audited039bf… text in memory and reconstructs the archived campaign header hash byte-for-byte. The additions are host static generation/enabled state, its reset after load, a `world_hold` presentation predicate branch, and the generation-checked export. They add no native CPU/RAM writes. This source evidence supports compatibility; it does not pretend to execute Pause or the enabled hold through SDL.

The headless no-input audit leaves the hold disabled after load and does not exercise browser/WASM rendering, enabled hold, Pause transitions or real PCM. Current evidence, exact hashes, planned termination status and logs are in `data/native-campaign-fidelity/current-route-hold-audit/audit.json`. All audit child processes have stopped. ROM/instruction suffix identity was checked again. Subsequent self-input/world-A intent-lock fixes and their explicit cancel hooks were added after this audit. They are not silently covered by these18000 prefixes or the older long runs; their native command regressions and final browser build must be attributed separately.

## Archived long results

| Ordinary mission9 | Full CPU frames equal | Original projectiles | Actor HP decreases | Actual cargo increments | Actual refinery deliveries | Scheduled deployments accepted | Result at stop |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Harkonnen | 40000 | 37 | 47 | 1103 | 17 | 2 | Original natural defeat preserved |
| Atreides | 32897 | 29 | 36 | 1186 | 5 | 4 | First own-color unit unloaded, scenario active |
| Ordos | 32927 | 27 | 26 | 1000 | 42 | 4 | First own-color unit unloaded, scenario active |

Projectile evidence records successful original projectile allocation through `$483E6` / `$484DC`, not just a firing request. HP tracking excludes projectile lifetime fields and compares continuing same-type, same-owner units/buildings. Original cargo growth is observed at `$45B26`; refinery evidence requires actual cargo subtraction at `$D1B6` and an actual bank increase in the same original transaction, after native capacity clamping. These are enemy-house4 AI harvesters; this is not claimed as a player input test.

Original scheduled deployment is observed at `$239FE`; accepted unit indices are then tracked until they really enter the map (`flags&7 ==3`) with the same original type and owner. Atreides accepts its native Sonic Tank12 and Launcher7; Launcher7 is actually unloaded with owner1 at native tick32930. Ordos accepts Deviator8 and Troopers3; Troopers3 is actually unloaded with owner2 at tick32960. The other friendly unit is still in native transport at the chosen stop. Enemy scheduled units and player defenders also produce the original owner-tagged projectiles; all corresponding native palette/VDP bytes remain identical between copies.

Harkonnen's untouched idle base is naturally defeated at tick32180, before its first friendly reinforcement deadline. Both copies follow that same original defeat and remain identical through40000 frames. The test deliberately does **not** change the scenario, protect the base or suppress AI to manufacture Harkonnen friendly-color coverage. Its own friendly arrival is an explicit untested boundary. Harkonnen still covers the actual8minute enemy wave, combat, harvesting, income and defeat.

This establishes equivalence for these continuous ordinary-campaign contexts with idle modern intent. It is not a complete27mission playthrough, all later12/21minute waves, adapted-camera visual QA, touch/browser pacing, a hardware-console comparison, or real YMFM PCM evidence. Deliberately adapted input/UI behavior—two-tap purchase preview, explicit native A/B/self actions and placement—is covered by separate command tests. Source ROM unit definitions and instruction handlers are unchanged, but this report does not substitute that fact for unexecuted behavior.

Run with the command recorded in the manifest, then `.local/test-native-campaign-fidelity-final 0`, `1`, or `2`. All output/provenance files are newly added; no shipping runtime header was edited for this audit.
