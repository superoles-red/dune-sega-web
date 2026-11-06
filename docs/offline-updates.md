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
2. The page shows **UPDATE READY** and a single **RESTART GAME** button.
3. Press it once. The verified update activates and the game opens automatically.

Only the actual recovery client can request activation. The worker verifies
the client's origin/path/identity. Automatic activation still defers while
another game window exists. An explicit Restart can activate without closing
those windows: their original complete packages are pinned by client ID, including
old-only lazy assets. Pins survive worker termination and successive updates.
New document navigations receive the latest package. Other game windows are
not closed or reloaded. Activation retains their caches and the preceding-package
fallback before collecting unreferenced packages.
No localStorage, campaign progress, Continue slot, IndexedDB or save-file data
is deleted by the updater. A failed download preserves the prior package.
An offline network failure is never reported as a successful latest-version
check.

At ordinary startup, only an existing opt-in offline registration checks for
updates. An unchanged worker downloads no new game package. A fully installed
waiting worker enables the explicit update path in Files & Offline. The Home
route uses the single updater page without a separate notice. New players are
not automatically registered.

Tests exercise old-package retention, automatic deferral, explicit Restart with
a second game window, wrong client identity/path, incomplete packages, network
failure, worker restart, several package generations and already-active recovery.
A physical Samsung two-tab check confirms that one Restart opens the new Home,
the older campaign keeps the same document and its own exact old shell, and
all local save values remain unchanged. Native program, save ABI and game rules
are outside this change.

For an update, unchanged assets may be copied from preceding complete packages
after their response bytes match the new package's SHA-256 and byte length.
Missing, changed or corrupt bytes use the ordinary bounded verified download.
This keeps complete-package integrity while avoiding a full repeat download.

The compact How to play screen uses only four gesture/action pairs for the
current input device, with the original descriptive tutorial nested underneath.
Installation is the original-art corner button on Home. Confirmation panels
are centered in the measured viewport, with safe-area padding and scrolling.
The native WASM remains SHA-256
`e43b28261eb6b9f05c29641cd44b752755e9ef0ffd44c5387e6adbc92ff6ef2e`.

Starting with webapp7, an existing offline registration also checks on visible
focus, pageshow and return from the background. Once a complete newer package
is waiting, a settled Home screen opens `update.html?auto=1`; that standalone
page verifies it and applies/returns automatically when no other game window
is open. A playing mission, campaign click/transition, dialog, import or
installation prompt blocks automatic navigation. With another game window open,
the same page offers one explicit Restart, with no extra confirmation or
close-window instructions. No background registration is
created for a player who has never opted into offline installation. A legacy
installation without this bootstrap needs the stable recovery link once.
