# Web app loading, installation, controls and rendering — 2026-11-05

Browser module/cache version: `20261105-webapp5`.
Runtime build: `f3d433a1fc5e88fb8319136842e11f786ad13ea383d2fadec00fd549b0438c1e`.
Runtime package: 439 manifest entries, 8,677,151 bytes before HTTP compression.
Accepted host rendering, raster optimization and inertia remain unchanged.
Physical touch inertia passes on the tested Samsung; public installation/offline
checks are performed separately after deployment.
Core: `f4a8cb4fc34845f17652b449e11401c34cfeba6900d76fa16e926f63c0337938`.
Loader: `68fb1ad2cae3e188f3cdea405c744d6ed99cc23ae4add7f86b118abe7f451f9a`.

The first HTML response now contains a visible loading screen, the exact
original English/Russian bitmap font PNGs, and its small controller. It does
not wait for a module, a remote font or the game engine. The graphics counter
reports completed preparation, with an explicit retry after a startup error.
Once the interface is visible, a later error cannot put this startup cover
back over a running game. Main stylesheets load without delaying this inline
screen; the interface waits for both stylesheets before publishing its first
screen. A stylesheet error or bounded readiness timeout offers the same retry.
The manual legacy launch remains separate.

The 293 interface images can be transported as one PNG atlas and one catalogue.
All crops preserve the original RGBA pixels and dimensions, including fonts,
button states and decorations. The source PNGs remain available as a bounded
fallback; the atlas check is deterministic and rejects stale catalogues,
invalid crops, altered source images and altered atlas pixels. Original title
art is available while the first native intro frame is being prepared.

The document, map canvas and HTML screens now share one measured viewport.
Visual-viewport changes, orientation changes and app resume update that
rectangle without a permanent geometry timer. Bottom controls retain the
appropriate safe-area offset. A narrowly guarded portrait correction covers
the short-viewport/status-bar case on iPhone standalone apps; it is excluded
for ordinary browser tabs, Android, landscape, page zoom and focused text
inputs. **The reported bottom strip still requires a retest on a physical
iPhone; desktop geometry tests cannot prove what an iOS webview paints.**

A later Samsung cropped-screen report showed browser scale 1.26275: the visual
viewport was about 304 CSSpx wide while innerWidth stayed 384. Native map zoom 50
was separate. The user reopened the app and browser scale returned to 1 before
this prevention change; that recovery is not attributed to the new CSS.
The viewport now requests scale 1 limits, document touch-action permits panning
without browser pinch, and the loading cover has touch-action none. Map canvas
none still owns custom game pinch; menu/message/building/reference pan-y rules
remain available for scrolling. This prevents accidental page gestures rather
than forcibly resetting an existing browser zoom. Browser accessibility policy
can override viewport limits; document/UI pinch enlargement is also restricted.
These limits follow [Pointer Events](https://www.w3.org/TR/pointerevents3/#the-touch-action-css-property)
and [WebKit's viewport-zoom policy](https://webkit.org/blog/7367/new-interaction-behaviors-in-ios-10/).
Physical webapp5 page-scale/game-pinch/menu-scroll checks remain separate.

The fullscreen button is hidden on iPhone. The map Menu button takes its left
corner without an empty space. On other devices, the control follows actual
document fullscreen support and retains the exit action while API fullscreen
is active. Already-fullscreen app windows do not receive an extra expand
button.

Install actions use the browser's actual installation prompt, with separate
Chrome/Android, Samsung Internet, Apple and desktop instructions. Accepting
the prompt is not reported as completed installation. The explicit install
path prepares the offline package; cancellation does not start that download.
Offline readiness is confirmed by the selected Service Worker's complete
verified-cache marker. An update waiting for activation asks for a relaunch
and does not replace the files under a running mission. APK packaging is
outside this change.

Opaque frontend-to-native transitions reuse the completed cover instead of
adding another artificial cover wait. Native destination readiness remains
the condition for publishing its screen; original in-game fades and clocks
are unchanged. The loading-caption canvas also avoids painting identical
frames repeatedly.

## Display work while moving the map

Panning invalidated the expanded-world picture. The previous host could rebuild
and upload it both before and after simulation in one synchronous WASM callback,
although the browser cannot display the first picture between those calls.
The host now defers that first map presentation and draws the current camera
once after simulation. Input/audio service still runs before and after; no-due,
pause, stop, fault, hidden and non-map paths retain their required handling.
The native differential test reduces expanded-world rasters from 239 to 120
over 120 camera-invalidated callbacks, while retaining 240 services, identical
normalized CPU/device state, all 96,000 PCM frames and the complete real YMFM state.

Every final world/HUD picture matches an original-renderer invocation on the
same final snapshot. When a native VBlank completes, old/new displayed pixels
also match. One tested callback advances instructions without another VBlank:
the old path displayed its earlier pre-step snapshot, while the new path shows
the final current snapshot. This changes a display sampling boundary, not
native game state or animation clocks. See [native-map-presentation.md](native-map-presentation.md).

Touch/pen map drags now end with a short, bounded camera coast after a fresh
swipe. A new pointer stops it before ordinary tap/target resolution. Pinch,
placement, minimap, menus, resize, blur and page suspension cancel it. Mouse
dragging stays direct. The existing host camera remains held until this display
motion stops; the tail sends only camera deltas, with no A/B or unit command.
It uses the existing browser animation loop and no additional timer or native
simulation step. The inertia overlay itself changes only browser camera intent.
On the physical Galaxy A07, a 260ms swipe released at cameraLeft432 and coasted
through458 after100ms,490 after350ms, then settled499. A fresh pointer-down
stopped another coast at651 throughout a287ms hold; a subsequent deliberate
40px drag moved the map normally. Both runs kept native lastOrder.seq0→0;
the coast issued no A/B or unit order.

The pure VDP compositor also reuses a name-table entry within each tile run,
splitting at both scrolled 8px tiles and screen-space 16px VSRAM columns.
Window regions, original tile decoding, priority and shadow/highlight semantics
stay the same. RGB channel values come from a small per-call table calculated
by the original function. No graphics state is cached across frames or added
to VDP/CPU or saves. The unchanged original compositor remains the oracle and
wide-call fallback. Tests pass 274 synthetic RGB comparisons and 95 additional
genuine completed frames, with every input VDP/CPU byte unchanged. The public
CI oracle requires no private fixture. See [native-raster.md](native-raster.md).

On the same physical Galaxy A07 / Android 16 / Chrome154, short unprofiled
drag samples improved from 14.6 browser callbacks/s to 48.2, with a second
optimized sample at 47.6. Pan p95 intervals fell from 81.4ms to 22.3ms; neither
optimized pan sample had an interval over 50ms. Optimized idle samples measured
47.2/48.0 callbacks/s. Native simulation still advanced 242 frames in about four
seconds, approximately 60.4 native frames/s, with one presentation per callback.
These are short same-device demo-map measurements, not a promised frame rate
for every map, browser or thermal condition; hardware audio listening was not
part of the comparison.

## Preservation and validation

The native browser adapter now separates selection from the original contextual
command. One touch selects an object or clears empty ground; a double tap gives
the command. Desktop left click selects and right click commands. Repeating a
single tap/left click on a selected building opens its original menu or action;
repeating it on a selected unit does not issue a self order. An already aimed
Palace requires a double tap or a pair of left clicks/right clicks to fire.
While that Palace is armed, a first left click/touch on an own building waits
up to300ms before ordinary selection. A matching second click/tap has command
priority: it casts directly with the captured Palace, without selecting the
target building or disarming/rearming the weapon. This includes the source
Palace: modern COMMAND has weapon-target priority, while SELECT retains the
original self-information action. A lone click selects/opens that information
after the small wait. Ground clear remains immediate; other ordinary
selection and the existing paired right-click path retain their timing. This
is browser gesture disambiguation, not a native weapon or balance change.
For an explicit armed self-Palace COMMAND, the native adapter chooses the
existing weapon-target branch at the same-object information/target UI fork.
It does not enter activation directly: the seven original eligibility checks
and the original house/resource, allocation, RNG/scatter, damage and cooldown
procedures still execute. SELECT retains the original information action.
The dedicated native proof passes all three house powers on self/other-own
targets, one native A, original guard/resource rejections and original single
INFO. At the common guarded entry, all 391,624 CPU/device bytes match an
independent original-branch execution through its activation-return boundary.
This is a matched-entry branch proof; old same-building A chose information.
Retained actors are opaque, expiring native tickets, invalidated by reset and
entity identity changes. Pan, pinch, placement, minimap, layout changes, UI
routes and page suspension cancel the browser's retained tap pair.

The screen Clear button is removed. Context buttons expose only an actually
available original B. Devastator/MCV self-A still starts the original countdown;
the later Detonate/Deploy button executes the original B. Controls in both
Options and Pause is a static, scrollable touch/mouse reference using original
dialog artwork, arrows and English/Russian bitmap fonts. It runs no practice
simulation and returns to the menu from which it was opened.

This rebuild changes adapter code and therefore the WASM/loader identity. It
does not edit the original ROM or translated instruction handlers: release
checks compare those sections with the pinned baseline. Selection, restoration
and orders enter the existing original handlers; unit logic, economics, AI,
combat and ability countdowns remain in that code. The native DSAV v2 ABI,
storage keys and exported-save format remain unchanged.
The host maximum WASM heap is 512 MiB; initial memory remains 64 MiB and stack
16 MiB. This is a host allocation limit, not a change to game clocks or logic.

Startup tests execute the real controller, decode the embedded font PNGs and
inspect actual rasterized glyphs in both languages, including the
English-first/Russian-later decode order, stylesheet readiness and error/retry
lifecycle. Atlas tests compare every crop to its source pixels and verify the
fallback. Typed-input native tests check original selection/command dispatch,
retained-actor restoration, Palace target confirmation, Devastator self-A/B and
no-input preservation. The final build passes 288 JavaScript tests, 33 descriptive
tutorial checks, seven atlas tests, four source-bootstrap tests, six publication
tests, all 55 pinned native inputs, embedded startup/atlas freshness, the public
274-case raster oracle and all 439 package entries. All 16 adapter hashes match
its recorded native build. The dedicated Palace proof passes 12 groups and the
prior typed-input proof passes 11. Native clock,
host-audio and worklet proofs retain the original clocks and exact state/PCM
comparisons; typed input remains 11/11.

Before the performance changes, physical Samsung Galaxy A07 / SM-A075F
(Android 16/API36), Chrome 154.0.8037.126 passed touch selection, separated singles without self-arm,
double-self Devastator arming with original B, one-tap Palace clear, drag without
order, and double-tap Palace activation at native tile1618 / original `$027EA6`.
The final marker fix also hides its DOM indicator after a single selection
switch. Fullscreen covered the 720×1600 portrait canvas. Desktop browser checks
with that input build passed single-left selection, right-click original movement,
single-clear Palace, no cast on one right click, and original cast on double left.
Those input traces are not relabelled as a final performance-build/device test;
the new core has its separate physical pan/idle comparison above.

Samsung Internet 30.0.5.24 on that phone crashed its renderer before the game
interface in the pre-performance checks. The previous published build, an
isolated core-only launch and the 512 MiB maximum did the same; atlas-specific
causation is not established. This
tested browser/device combination is unsupported for now; use Chrome on Samsung.
The preceding webapp3 release passed actual WebAPK installation, Home-icon
launch and installed offline reload/gameplay on the Samsung, with scoped network
conditions restored afterward. The final webapp5 cached update and Palace
interaction are checked separately after deployment. Physical iPhone portrait
geometry still needs the user's retest.

Browser, device, CI/artifact and served-file checks are separate evidence.
This note does not claim a complete earned campaign playthrough or verified
behaviour on every Android model. No physical pinch injection, hardware audio
listening, earned full campaign or iPhone validation is inferred from these
checks. Installation/offline evidence must identify the served release.
