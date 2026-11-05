# Updating an offline installation

The offline worker serves one complete, verified version. URL query strings
such as `?v=...` cannot replace that package. Previously, a new worker could
remain waiting indefinitely while any older Dune tab or installed window
was still open.

The stable recovery address is
<https://superoles-red.github.io/dune-sega-web/update.html>.
It also works when the saved game predates the update interface: older workers
do not have that address in their manifest. Both `update.html` and its standalone
`update-game.mjs` remain outside all new precaches and pass through the worker.
The recovery document starts no game and imports no versioned game modules.

1. Open the recovery link while connected. It registers/checks the real worker
   with `updateViaCache: none` and waits for its exact complete-package marker.
2. Close other Dune tabs and the installed game. Leave the recovery page open.
3. Apply the update, then open the game from that page.

Only the actual recovery client can request activation. The worker verifies
the client's origin/path/identity and refuses when another project window
exists, including uncontrolled/hidden windows. Normal installs still wait;
neither the game host nor background checks call `skipWaiting` or `claim`.
Activation rechecks clients before collecting superseded game caches.
No localStorage, campaign progress, Continue slot, IndexedDB or save-file data
is deleted by the updater. A failed download preserves the prior package.
An offline network failure is never reported as a successful latest-version
check.

At ordinary startup, only an existing opt-in offline registration checks for
updates. An unchanged worker downloads no new game package. A fully installed
waiting worker sets a nonmodal update notice and enables the explicit update
path in Files & Offline. New players are not automatically registered.

Tests exercise old-package retention, activation refusal with a second game
window, retry after closing it, wrong client identity/path, incomplete packages,
network failure and already-active recovery. Native program, save ABI and
game rules are outside this change.

For an update, unchanged assets may be copied from preceding complete packages
after their response bytes match the new package's SHA-256 and byte length.
Missing, changed or corrupt bytes use the ordinary bounded verified download.
This keeps complete-package integrity while avoiding a full repeat download.

The compact How to play screen uses only four gesture/action pairs for the
current input device, with the original descriptive tutorial nested underneath.
Installation is the original-art corner button on Home. Confirmation panels
are centered in the measured viewport, with safe-area padding and scrolling.
The native WASM remains SHA-256
`f4a8cb4fc34845f17652b449e11401c34cfeba6900d76fa16e926f63c0337938`.
