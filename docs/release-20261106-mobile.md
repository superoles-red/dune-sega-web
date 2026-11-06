# Portrait iPhone safe area and expanded-map performance

## Follow-up: 20261106-mobile3

The updater has one short status, a progress bar during preparation and one
Restart Game button when ready. A tap applies the verified package and opens
the game automatically, with no second confirmation or close-tab instructions.
Russian uses the same single-screen layout. A failed download reuses the same
button for Retry. Home no longer adds a separate update notice.

An explicit Restart preserves other open game windows with persistent client
package pins. Their lazy resources continue to come from their exact old cache;
new document navigations use the new complete cache. Automatic checks still do
not interrupt a running mission. The physical Samsung two-tab test preserved
the old campaign's document identity, native state and complete save values
while opening the updated Home with one tap. Browser checks on Mac also return
directly from the single updater to Home. All 343 frontend checks pass; the
native e43b2826 WASM is unchanged.

Outcome movies and live statistics were checked against the original USA
branches and three native Results tilemaps. Statistics select the soldier for
missions 1/4/7, the ornithopter for 2/5/8 and tanks for 3/6/9, independently of
victory or defeat. The shipping native/localized statistics already preserve
those backgrounds. The modern replacement for the password screen now keeps
the same mission-specific art instead of always showing the soldier.
Its missing ornithopter crop is 3,842 bytes and retains every original non-sky
pixel. See [original-art proof and reproduction](../data/native-results-art/README.md).
The 294-image transport atlas passes exact original-RGBA verification. These
controlled source-art decodes do not claim a naturally completed campaign.

## Follow-up: 20261106-mobile2

The installed portrait iPhone canvas now reserves six additional CSS pixels
below the measured status bar (47 to 53px, or 59 to 65px). Menu follows the
same inset. The canvas still ends at the app bottom; other devices and modes
keep their previous geometry. The measurements below describe the initial
mobile1 release; the follow-up geometry is covered by the viewport tests.

On the physical Samsung, a native move committed correctly but its first RAF
callback had timestamp 55102.8 while the acknowledgement started at
performance.now() 55108.4. The negative 5.6ms interval incorrectly discarded
both confirmation pulses. The host now paints with the same performance.now()
clock used to observe the commit; an older timestamp defensively leaves a
pending acknowledgement intact. The original 100/80/100ms blink intervals,
native command handling and original PNGs are unchanged. Regression tests cover
both the pending case and the actual host callback with a stale RAF timestamp.

All 328 frontend checks pass. This follow-up keeps the exact e43b2826 native
WASM and preceding save formats; it does not rebuild or change the game core.

## Initial mobile1 release

The installed iPhone app in portrait reserves the status-bar safe area above
its native canvas. The Menu control uses the same inset plus 10 CSS px. The canvas
height is reduced by that inset, so its bottom remains at the existing app
bottom. Pointer coordinates, camera sizing and order feedback continue using
the actual canvas rectangle. Landscape, ordinary iPhone browser tabs, Android,
iPad and desktop receive no added inset. Existing HTML screens retain their
own padding rather than receiving a second offset.

The safe area is measured from the environment. A transient zero uses a bounded
47 CSS px fallback for tall iPhones or 20 CSS px for classic screens. Browser geometry
checks at 428x926 report canvas top 47/bottom 926, Menu top 57 and a pointer at
client 100,147 mapping to local 100,100; rotation clears the inset. These are
synthetic iPhone browser measurements, not a physical iPhone result. The user's
installed iPhone still requires a post-update check.

The expanded-world converter now reuses terrain descriptors within each 8px
horizontal tile run and calculates RGB from a per-chunk palette. The original
sprite replay, CPU copy, native HUD, layer priority and shadow/highlight rules
remain intact. See [native-world-raster.md](native-world-raster.md). Native
instructions, ROM, timers, movement, combat, AI, prices and sound synthesis are
unchanged; no display-resolution reduction or skipped simulation was added.

## Physical Samsung comparison

Galaxy A07 (SM-A075F), Android 16, Chrome 154; same private red demonstration,
portrait canvas 720x1430 and landscape 1535x558. Fresh demo runs, a warmup and
repeated five-second samples were used; profiler samples were kept separate.
A final warmed preceding-build recheck excluded the one cold/tiering sample
from the speed claim.

- Portrait actual native canvas presentations: approximately 47–48/s before,
  63.7–63.9/s after, about one-third more frequent during the controlled pan.
- Browser animation callbacks: about 47–48/s before, 82–84/s after. These are
  not 82–84 new game frames: the injected touch stream was about 60Hz, and the
  original simulation remains approximately 60 native frames/s.
- Landscape p95 browser interval improves from 22.3ms to 11.2ms; no interval
  above 25ms was observed in the clean candidate samples. Native canvas pan
  presentations increase from about 60.9/s to 65.2/s.
- Original native ticks stay at approximately 60Hz, with no newly issued unit
  orders in the pan samples. This is a short same-device comparison, not a
  frame-rate guarantee for every map, device or thermal condition.

## Preservation checks

2,956 synthetic chunks and 9 complete images from original CPU snapshots for
all three houses match the pinned original renderer byte for byte. Input CPU,
shadow palette VDP and sprite arrays remain unchanged. The existing native
map/audio regression also passes: 120 matched callbacks, identical CPU/device
state, 96,000 stereo PCM frames and 865 bytes of real YMFM state. The generated
native instruction/data suffix remains identical to the pinned source.

All preceding native adapter headers and exported APIs are unchanged; the new
world-pixel helper is separately fingerprinted. DSAV v2, save payload sizes,
Continue/progress storage keys and installation origin/scope remain the same.
The preceding f4a8cb4f build is explicitly accepted by the JSON save envelope.
