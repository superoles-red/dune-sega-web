# Native screen routing and completed-frame presentation

`tools/em_web_campaign.h` owns queued screen intent. ROM bytes, translated
instructions, scenario data and combat handlers remain unchanged.

`dune_web_screen_route(target)` accepts:

| target | Native destination |
| --- | --- |
| 0 | Main, from an ordinary clean frontend context |
| 1 | Startup Options, from a clean frontend context |
| 2 | Tutorial, from a clean frontend context |
| 3 | In-game Pause, idempotent |
| 4 | Resume map |

Global routes 0/1/2 reject an actual map/building, an armed run or a valid native
house pointer without changing the CPU. The startup main renderer is not a safe
subroutine inside a live game: it uses shared graphics memory and restores its
previous callback during exit. The earlier short clock/credits-only check did
not establish world-memory safety. Borrowing `$17418` from a game has been removed.

The host saves the current run before Main Menu and loads `frontend.state.bin`
through the ordinary current v2 state API. This fixture is captured after genuine
cold boot at the real original main poll, with no house and a complete native
YMFM state. A completed-frame barrier prevents the old world frame from appearing
before its main art is ready. Continue restores the real saved mission through
the same ordinary v2 loader. Pause/Back stays in the same live world through its
original pause/resume handlers.

Clean Options/Tutorial may return through native route 0, preserving native
Music/Sound choices. When a full frontend load is needed, the host synchronizes
changed preferences under its transition cover through the original Options
rows and their original handlers, then returns to main. It does not write option
flags directly into RAM.

A request before main advances old publisher/title waits through original single
presses and neutral releases, navigates the original main cursor and waits for
its target. No intermediate frontend Continue is required. Tutorial tap uses
mask 16; `$418B8` accepts face buttons to advance the script. Back uses Start 128
and the original tutorial return. Returning to Tutorial does not replay boot.

Pause is a destination, not a Start toggle. Repeating Menu while pause opens or
is ready does not close it. A queued raw battle Start is eligible only at original
`$617A/$6E06`; another UI poll cannot consume it. Building menus leave through the
original Exit cell and A action. This same helper handles a direct campaign start
that supersedes navigation while the old shop is still open. Native B only clears
an action, so it is not used as a building exit.

The WASM start/route wrappers release only host pad/mouse buffers, the menu adapter
preview cache and pointer cache, unpause the host scheduler and reset its wall-clock
baseline. Native selection, orders and paid products are preserved. A successful
state load clears every pending route, borrowed audio call and input intent.

## Readiness and idle policy

A scene transition increments `sceneGeneration` and clears its old cached poll.
Before the current native continuation is observed, `inputKind` is `transition`
and `pollValid` is false. A callback alone is not scene evidence: `$4504` is shared
by unrelated screens.

Interactive menus wait for their original drawing/input setup and a new completed
VDP frame. `sceneReadyAfterFrame` and `completedFrame` expose that barrier.
Autoplay uses verified draw checkpoints: ending `$127B4`, credits `$11840/$11844`.
Those publish completed original art without waiting for an input gate.
`inputReady` / `pollValid` remain false while the first staff scroll retains its
original closed D4 input gate. No browser timeout guesses when art is ready.

Building entries `$287DC/$28A18` invalidate readiness before loading art; relevant
polls are `$847E/$28884` and `$9188/$28AC0`. Building presentation combines
`scene == building`, `sceneReady` and its own frame readiness. A stale producer
pointer/shared callback therefore cannot turn another screen into a shop.

`em_web_campaign_world_visible(c)` exposes only a stable ready real map to the
raw SDL canvas. Other raw output is black. Original completed `VDP.frame` remains
intact for the custom responsive UI. Start completion waits for the first real
`$617A/$6E06` map poll, one native frame after the former callback-only checkpoint.
All 27 original scenario values and active-object counts remain unchanged.

`dune_web_frontend_hold(enabled)` holds only the original main-menu idle word D7
at `$384`, at the actual `$178D2` input continuation. This is the same counter
that native Up/Down resets. It prevents the modern Home/catalogue from silently
entering the original attract demo. Native audio, Z80 and video continue to run.
Default is false so legacy retains its original attract behavior; actual route,
mission and load requests release the hold.

## Frontend feedback

`dune_web_ui_sound()` queues original feedback through `$2DDB6 -> $1664` and
preserves the caller's registers. The loaded native effects-bank pointer selects
the cue: Main's thirteen-entry `$CF970` bank uses its own confirm 12, and the
ordinary campaign bank uses 25. The original Sound/DC51 guard performs muting.
The call may borrow only a verified interactive poll. Shared boot/animation wait
`$4724` is excluded: early feedback waits for an actual interactive poll after
native audio setup. Live map/building feedback requests are rejected. Ordinary
menu, purchase and combat actions already provide their own original sound.

`uiSoundRequests`, `uiSoundConsumed` and `uiSoundNativeCalls` are evidence counters.
`uiCallActive` protects a transient borrowed sound call from autosaving; there is
no longer a borrowed startup-main call in a game context.

## Cinematics and textless completed frames

`presentationReady` is independent of `sceneReady` and `inputReady`. It exposes
an actual completed original 320×224 frame, including genuine black fades and
inputless animation. `presentationPhase` identifies `briefing_exit`, `strategic_map`,
`battle_loading`, `victory_flyover` / `defeat_flyover`, movie setup and plane-art
phases, `results_setup` / `results_counting`, `finale_setup` / `finale` and
`credits`; `presentationFullFrame` requests the whole native composition.
`presentationGeneration` changes at the corresponding native checkpoints.
Entering a new full cinematic phase invalidates the previous interactive poll;
the public tap API rejects input until a current original poll is available.

Replay uses `terminalHouseId` / `terminalMission`. After the finale the native
scenario counter has already advanced, so ordinary `mission` is zero at credits
while `terminalMission` remains 9. Native regression replays the same Atreides
mission from defeat results and final credits, keeps the new briefing manual
for 400 frames and observes no false completion.

The original strategic-map fall `$2610C…$264C8`, both plane loops and every
finale continue to execute normally. The seven-aircraft formation above the
battlefield precedes the separate movie art: `$22AFC → $26952 → $26984` for a win,
`$22BE8 → $26A9A → $26984` for a loss. `$B576` creates the original formation in
its `$F3A8` render list; callback `$B544` advances `$D306/$D308` using
`$D30C/$D30E`, then renders the original list through `$1088`. The first native
outcome edge already exposes that complete battlefield frame. A continuous
pre-predicate test observes 203 presentable native frames in each flyover, with
visible aircraft moving across the base. Finished movie fixtures alone cannot
prove this preceding animation.

The separate movie setup also remains presentable across its original fades.
The following movie-art checkpoints are `$12916/$129FE`; the finale uses `$127B4`
and credits `$11840/$11844`. Results become presentable from `$271E2`, with
`results_counting` at `$27238`, before the first result input poll `$272D2`.
The original `$26F98` loops animate the values and bars; continuous win and loss
tests each retain 147 frames and 65 distinct completed images before that first
input poll. The interface does not recompute values. Input readiness and terminal
actions still wait for the genuine result poll.

A separate explicitly controlled offline trace supplies nonzero native statistic
fields before the original outcome predicate. The original renderer then shows
447 counter frames, 365 distinct completed images and 315 numerical states.
It ends at score1234, spice1200/800, units17/23 and structures7/9. These are test
conditions, not earned kills or runtime edits. The read-only JSON getter reads
the entire original five-cell fields: score starts at x72; each count starts at
x256, with its ones digit at x288. Starting at the ones digit had previously
truncated multi-digit values. Native alignment spaces remain in the strings.
`outcomeTerminal` is true at defeat results or the final credits' genuine open
input gate. Ninth-mission victory results are intermediate: their original
finale and complete staff scroll still follow. These flags do not award wins.

`dune_web_readonly_textless_frame_rgb()` uses `tools/em_web_frame.h`, captured
immediately after the real VDP render. It removes only original story-font
cells in `[16,16,288,40]` and the native choice sprites in
`[184,164,96,24]` / `[184,188,96,28]`. Five text rows are possible in the original.
For Main it removes words `[128,160,80,24]` and the arrow's sprite region
`[104,156,144,32]` from the original choice-writing checkpoint `$1780A`, before
the first START GAME writer. Restored settled Main is recognized at `$178D2`.
This prevents 18 visible choice frames before the first interactive poll from
flashing behind the modern interface. It does not mask the earlier intro.
`mainChoicesWritten` exposes the observed writer generation. Story glyph attributes
are `$C000`; Main glyph attributes are `$6000`. The compositor restores the
snapshot's own plane B, untouched plane A and other sprites. It neither blanks
map pixels with a static patch nor replays live sprite handlers a frame ahead.
The logo, subtitle, copyright, map, portraits and all pixels outside those
original text/choice regions retain their completed-frame RGB values.

## Continuous clean-frontend music

`dune_web_frontend_audio(enabled)` is opt-in and defaults off for legacy. It
activates only after the real no-house Main poll and is released by mission,
Tutorial or state-load requests. In this clean frontend it retains the original
Theme0 engine while bypassing only Main/Options presentation stop, fade and
bank-reload calls. Original Music/Sound handlers still change DC50/DC51; Music
OFF stops the real track and ON starts it once through its original routine.
No world/campaign audio call is intercepted by this policy.

Keeping Main's music profile also keeps its smaller effects bank. Startup
Options ordinarily requests feedback 25/40/44 from another bank; treating those
IDs as entries in the thirteen-entry Main bank starts unrelated ROM bytes as
sound streams. Only with the clean-frontend policy active, out-of-profile UI
feedback is mapped to Main's native confirm 12 through the original mute guard.
It does not reset the music driver or invent audio samples. The adjacent Options
stop/resume pair is bypassed together so the host's next machine step cannot
execute an unmatched resume call.

Theme0 already has genuine infinite multi-note loops (`64 7F … 65` in its
original stream); there is no browser loop timer. Real YMFM regression runs
18,000 native frames across Main → Options → Main, checking advancing native
stream state, YM writes and frequency changes, with no extra Theme0 play/stop or
driver reset. It also exercises original Music/Sound OFF/ON and verifies the
campaign's original stop/profile initialization remains active.

## Scripted campaign feedback and repeated tutorial

An explicit campaign request drops unconsumed host feedback. While that request
is pending before stage4, only the old hidden menu-navigation feedback call sites
are omitted: `$17AF6`, `$4830/$4856`, `$25D14` and duplicate acknowledgements
`$26C22/$1F3C8/$25D2C`. One actual native Main confirm12, or the first original
confirm when Main is absent, remains. Music, voices, requested briefing input,
ordinary user actions and combat sounds remain original. `campaignFeedbackSuppressed`
counts the omitted scripted cues. Six real-YM native cases (three houses × first
and second mission) observe exactly one menu confirm and no extra host sound.

Three consecutive native Tutorial → Main cycles from the same full-YM frontend
reach actual `$418B8` page polls and `$178D2` Main polls each time, without loading
a replacement CPU between cycles. This native regression does not reproduce a
browser-side second-launch failure, so no speculative tutorial/core reset was
added. The frontend may independently use its clean frontend payload when it
requires a fresh presentation context.

## Verification

Native tests cover queued Menu/Resume, original Options/Tutorial from six startup
polls and the real reset vector, building frame readiness and safe exits, original
sound/mute, restored native text and result pages, all 27 scenario starts and zero
false victory edges. Direct building starts cover Palace, Yard and Starport,
including a real hovered product and superseded Pause request.

`test_em_web_frontend_hold.c` also uses real `AUDIO_ON`/YMFM: the default attract
appeared after 1828 native frames, while modern hold retained main for 5684 frames
and 2841 idle-counter refreshes with native audio/video still executing. It checks
that shared `$4724` cannot borrow a sound call and deferred feedback plays once.

`test_em_web_frontend_load.c` uses the exact current v2 save/load API, full native
YMFM frontend payload and browser-like JSON reads. SDL presentation-only rebasing
and queued-audio calls are native stubs. Regenerate that test include with
`python3 tools/prepare_native_state_test.py`. Logs and raw evidence are under
`.local/campaign-analysis`; structured coverage is in
`data/campaign/routing-verification.json`. These are native checks, separate from
browser and physical-device proof or a full earned campaign playthrough.

## Explicit cold navigation — 2026-11-03

A cold Options request originally took1048 native frames with the modern audio
policy (1051 before that policy). Substituting Start for A did not help: the
shared `$4724` poll masks `$F0` and accepts both, while the long title holds do
not poll input at all. The prepared UI could therefore cover a valid, but
uninterruptible, seventeen-second intro sequence.

An explicit clean global route0/1/2 or campaign request before stage4 now chooses
the original warm/no-intro Main argument at `$17424/$174D2`. If the request
arrives after that branch, only the verified fixed200/300/200 title-hold
counters finish early. The original console-logo routine `$1864` also finishes
its decorative198-VBlank hold after one genuine VBlank, guarded by exact
`$1898/$189A` PCs and the original `$17EE` caller at SP+16. That early boot
phase precedes house initialization, so its guard uses the exact callsite and
absence of world/context/armed run; the later Main guard also requires house-1.
All actual initialization, asset loading and native fade/audio calls execute
with their original instruction clocks. No live-world fast-forward or
startup-main borrowing is introduced.

Continuous reset-vector tests, including real YMFM, now reach actual completed
Options in263frames instead of1048; warm Options remains58frames. Four requests
already inside the intro reach Options in110/189/148/102frames. A cold Atreides1
request reaches the original validator/manual new briefing stage4 at frame354.
Without an explicit request the complete original boot/title sequence remains
(198 logo VBlanks, real Main ready at frame2173). An ordinary Atreides9
sixty-frame run compares complete CPU/device state every instruction; it
matches the original, and even coincident helper PCs cannot alter a world.

263 native frames are about4.39seconds, rather than1.5seconds or instantaneous
loading. Remaining native initialization/loader/palette work and browser
download costs are retained. Exact current-header provenance and logs are in
`data/campaign/cold-route-verification.json`; the older routing/fidelity records
keep their original identities. Physical-device and browser latency are
separate checks.
