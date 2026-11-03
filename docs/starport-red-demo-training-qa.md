# Original Starport joins and isolated Harkonnen fixtures

Starport's completed source is `.local/building-ui-fixtures/house1-building11.rgb`,
SHA256`8344f187356580fcc25fd102dccb066245863303944ec54ded7f48a851014bdd`.
The actual native chrome is grayscale. Original buttons/vehicles legitimately
use the separate purple-gray145/145/182 palette; only radar/lamps are green.
No invented overall tint is applied.

The old cabinet cut `[24,40,112,112]` captured only its inner bevel. The complete
original shell is `[12,36,132,128]`, with asymmetric margins20/12/16/20 around
the native96×96 viewport. Corners and the lower brace stay native. Original side
connectors/shading appear once; only the quiet8-pixel band at nativey104 extends
the long sides. Top/bottom grain repeats horizontally. This avoids repeating
the three original connector stripes down the whole panel or stretching a
directional texture on the wrong axis. The four native rows and bounded button
sizes are preserved; the cabinet ends after its contents instead of enclosing
a large empty black tail.

The monitor crop ends at nativey116, where the next dollar icon begins. Its
former four stray dollar rows and the unrelated vent-strip overdraw are removed.
All23 parts/3 modules live in `data/starport-ui` and the ordinary screen-assets
kit. `tools/verify_starport_chrome.py` verifies20156 PNG pixels against exact
native source RGB (with documented native-black cash aperture masking).

Review files in `.local/starport-polish`:

- `native-starport.png`: untouched completed original screen.
- `cabinet-before-after-2x.png`: offline component composition, old left/new right.
- `source-proof.json`: source identity, rectangles and pixel verification.

The component montage is not a browser screenshot. The genuine previous
responsive screenshot is in the root QA folder as `dune-continuous-flow/starport-portrait.jpg`;
the root agent owns the new browser comparison.

The red technical demo is `web/demo-harkonnen.state.bin`, SHA256
`49f962f1e03b34c169577b7d27fb4a07b1782ddf5619088ca2f0a3b4871a788d`.
It uses original HarkonnenM9/seed17, retains all32 enemy buildings and native AI,
and passes all15 real interior checks. Former blue files remain untouched and
are additionally archived with exact historical builder sources.

The separate tutorial is `web/training.state.bin`, SHA256
`a3852e515ece3faa93df071bed4de469ccbb5afc4b3e08695628fa4ac7d92265`.
Its source/setup and actual movement, projectile damage, gathering, credit
delivery and paid-construction proofs are recorded in `data/training/manifest.json`.
Thirty native idle minutes keep both combat actors at full original HP and the
base alive. Future-wave slots use the original scenario's empty sentinel and
scripted Teams are reset offline. A continuous full-cargo path passes without
restoring between Tank/combat/construction/harvesting/delivery steps.
Read-only metadata is exported through `tools/em_web_training.h`; normal saves
and campaign progress remain the host's responsibility to isolate.

The BUI frame getter also respects the native host's frozen transition frame.
Its cached last published corrected Upgrade RGB survives outgoing fades and
context0. `tools/test_em_web_building_hold.c` verifies fade/context0/acknowledge,
house isolation and whole-CPU read-only behaviour. It never writes RAM/VRAM or
changes the original instructions, cooldowns, stock, prices or outcome guards.
