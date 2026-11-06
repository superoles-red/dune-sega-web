# Original monitor artwork, purchase confirmation and phone panning

Runtime cache version: `20261106-shop2`.

Building and unit monitor illustrations now use the complete original ROM
patterns, tile mapping, flips and current native CRAM0 palette. Shared VRAM
scratch uploads could retain earlier tiles; Refinery also requests 2700 bytes
from a 2720-byte resource. Transparent color0 could reveal old chrome. The
read-only presentation getter repairs only the proven 96x56 monitor rectangle.
The resource and converted picture are cached. Native CPU, RAM, VRAM, every
outside pixel, console animation and original program remain untouched.

The native regression covers 140 genuinely entered/previewed menu frames,
all 19 building and 17 genuine unit image-loader cases, palette-cache refresh,
nonmatching name-table guards and three outgoing fades. Isolated loader cases
arrange displayed-item metadata before running the original loader; they do
not claim that every picture is an available purchase in every campaign.

On phones the first product press performs the original native information/
selection action. A second press on that same item opens confirmation. On a
computer, hovering previews a product and a click opens confirmation.
The centered compact dialog contains the item name, its original native 32x24
icon, then BUY on the left and CANCEL on the right, composed from the existing
original dialog frame, command button parts and pixel font. The icon is a fresh native grid-cell snapshot,
with integer scaling; no additional image asset is loaded. Buy re-reads native identity and preview state,
then sends exactly one original second checked tap. Cancel sends no purchase;
reopening the same cancelled preview cannot accidentally buy it. Original
Upgrade, stock, affordability, payment and production handlers remain decisive.
Exit, Fix, Stop and Send Order keep their original immediate-command path.
Rapid repeated item presses cannot submit a purchase before Buy.
English BUY is localized as КУПИТЬ using the existing 8px Russian font.

Phone inertia accepts low-cadence/coalesced swipes and equal clock stamps.
Its measured tail uses exponential decay, capped at 220 CSS px and 850 ms. A lone
large movement after a finger hold gets a conservative shorter inferred tail;
subsequent timed movement replaces that estimate. A deliberate hold after
movement and a new touch stop the map. Mouse, pinch, minimap, menus, resize and
background cancellation do not inherit momentum. No new idle timer or rendering
loop is introduced. Only the original native camera pan is called.

The native WASM SHA-256 is
`b1f1e88198c7d4e7b3a1d444227fdc380e928da749f51f7ddc45d38b332437fa`;
the loader remains
`dc5faa08a60a1eb4298bf05fdb6465a1a8cc16c2eed7a9ded84ebb4e3cb535f6`.
DSAV v2 is unchanged; the preceding 3dbc9ad2 and 5156b9ee save envelopes remain
accepted. Ordinary selection remains 100 ms and double-tap matching 300 ms.

## Validation

```sh
node --test tests/*.test.mjs
node tools/test_native_audio_worklet.mjs
node tools/test_modern_tutorial.mjs
python3 tools/test_publication.py
clang -std=c11 -O0 tools/test_em_web_building_art.c -o .local/test-building-art-all -lm
.local/test-building-art-all .local/building-ui-fixtures .local/building-upgrade-corrected-all.rgb .local/demo-fixture-harkonnen/demo.cpu.bin
```

The native command requires the private genuine CPU fixtures documented in the
building bridge. Browser checks use portable native v2 saves at a portrait
viewport: Cancel retains credits/product and zero purchase confirmations;
Buy produces exactly one original Windtrap confirmation and 300-credit payment.
A simulated-touch 130 px swipe produced an active native-held coast, finite stop
and no selection/orders. Physical phone feel still needs a user recheck.

## iPhone input follow-up

A real pointer/touch activation owns the following grid click. Its touch or
pen type must take priority over Safari's compatibility click metadata,
including detail 0, absent pointerType or a mouse-labelled compatibility click.
A trusted click with unknown input defaults to the two-press phone workflow;
keyboard activation is treated separately. This leaves desktop mouse hovering
and its one-click confirmation intact. No native core rebuild or gameplay
change is involved.

Offline downloads retain the 30-second deadline for small files and allow up to
120 seconds per attempt for files of at least 1 MiB, including the 5.27 MB engine.
The existing three-attempt limit, SHA-256/length verification and complete-
package activation remain intact; host update waits allow 450 seconds so they
do not abort a still-valid large-file retry. A failed download retains the
previous complete package and saved data. These are failure deadlines, not
added waits on successful downloads.
