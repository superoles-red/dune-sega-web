# Web app loading, installation and controls — 2026-11-05

Runtime build: `a9d02910bc4f2925c6bd849ead4113ce523d62b5aa5b46a5b23f2a0d7302e1fb`.
Browser module/cache version: `20261105-webapp1`.
Runtime package: 438 manifest entries, 8,668,045 bytes before HTTP compression.

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

## Preservation and validation

The native browser adapter now separates selection from the original contextual
command. One touch selects an object or clears empty ground; a double tap gives
the command. Desktop left click selects and right click commands. Repeating a
single tap/left click on a selected building opens its original menu or action;
repeating it on a selected unit does not issue a self order. An already aimed
Palace requires a double tap or a pair of left clicks/right clicks to fire.
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
storage keys and exported-save format remain unchanged. The final core is
`d464dfb2ba1407c2a36ad9d2e01c311953db49bdb0d5d7765a10944d69dba953`;
the loader is `68fb1ad2cae3e188f3cdea405c744d6ed99cc23ae4add7f86b118abe7f451f9a`.
The host maximum WASM heap is 512 MiB; initial memory remains 64 MiB and stack
16 MiB. This is a host allocation limit, not a change to game clocks or logic.

Startup tests execute the real controller, decode the embedded font PNGs and
inspect actual rasterized glyphs in both languages, including the
English-first/Russian-later decode order, stylesheet readiness and error/retry
lifecycle. Atlas tests compare every crop to its source pixels and verify the
fallback. Typed-input native tests check original selection/command dispatch,
retained-actor restoration, Palace target confirmation, Devastator self-A/B and
no-input preservation. Local checks pass: 268 JavaScript tests, 33 descriptive
tutorial checks, seven independent atlas tests, four source-bootstrap tests,
six publication tests, embedded-startup/atlas freshness, and all 55 pinned
native source inputs. Eleven typed-input native proof groups and eleven prior
selection/placement proof groups also pass on the rebuilt adapter.

On physical Samsung Galaxy A07 / SM-A075F (Android 16/API36), Chrome
154.0.8037.126 passed final touch selection, separated singles without self-arm,
double-self Devastator arming with original B, one-tap Palace clear, drag without
order, and double-tap Palace activation at native tile1618 / original `$027EA6`.
The final marker fix also hides its DOM indicator after a single selection
switch. Fullscreen covers the 720×1600 portrait canvas. Desktop browser checks
with this core passed single-left selection, right-click original movement,
single-clear Palace, no cast on one right click, and original cast on double left.

Samsung Internet 30.0.5.24 on that phone crashes its renderer before the game
interface. The previous published build, an isolated core-only launch and the
512 MiB maximum do the same; atlas-specific causation is not established. This
tested browser/device combination is unsupported for now; use Chrome on Samsung.
Public HTTPS installation and offline relaunch are checked separately after
deployment. Physical iPhone portrait geometry still needs the user's retest.

Browser, device, CI/artifact and served-file checks are separate evidence.
This note does not claim a complete earned campaign playthrough or verified
behaviour on every Android model. No physical pinch injection, hardware audio
listening, earned full campaign or iPhone validation is inferred from these
checks. Installation/offline evidence must identify the served release.
