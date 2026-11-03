# Browser host service and PCM queue

The original batching change is confined to `tools/em_web_host.h`; the subsequent optional playback-thread bridge is described in `native-audio-worklet.md`. It does not alter ROM instructions, machine-step scheduling, native master frequency, game timers, world/AI execution, audio banks, chip register writes, native sample generation or Music/Sound semantics.

## Avoidable work

The former browser callback called the complete SDL service before execution, roughly every modeled millisecond during execution, and afterwards. The build uses `ASYNCIFY=0`: new browser DOM events cannot run while that synchronous WASM call is executing. Those inner calls therefore could not obtain new browser input. They repeatedly crossed into SDL/WebAudio, queued roughly48sample PCM chunks and presented intermediate catch-up frames which the browser could not display before the callback returned.

The browser host now services SDL at callback entry and exit. It runs the same machine-step sequence and retains every owed master cycle. The existing four-native-frame catch-up budget is unchanged. Intermediate SDL presentation is omitted; original native VDP rendering and completed RGB still execute normally.

A separately controlled `dune_web_canvas_visible(int)` flag defaults to visible. The host exposes `em_web_canvas_presentable()` for the prepared SDL service gate. While an opaque HTML UI owns presentation, that gate skips SDL texture upload/draw/present only. Native RGB, clocks, sound and input polling continue. Returning to SDL invalidates its presented serial so the latest frame is drawn. The prepared SDL service gate and frontend now apply this flag. Frontend frame/canvas caches also use the completed serial and dirty layout state, and diagnostic-only JSON publication is limited to QA mode; required game/action state polling remains active.

## Playback backlog

The prior Emscripten SDL queue allowed up to half a second of old PCM before clearing it. A delayed click could therefore remain behind a large audible backlog. Repeated tiny queue allocations also added unnecessary browser work.

The host drains native PCM in callback-sized batches. Its SDL fallback playback consumer permits at most96ms combined SDL/ring backlog. If that limit is exceeded, it clears stale queued output and retains at most64ms of the newest native ring samples. It does not restart or rewind music, regenerate samples or run game logic faster. Normal playback preserves every sample. Output discarded during overload is counted separately from native `audio.dropped`.

In SDL fallback, the existing20ms startup preroll and volume/soft-knee scaling remain unchanged. This bounds software backlog; actual browser/device audio latency requires browser/device measurement. Dropping stale output under overload is distinct from proving that every host can keep up in real time.

## Cheap observation

`dune_web_frame_serial()` returns the low32bits of completed native `rendered_frames`, without serializing JSON or copying pixels. Frontend code can use it to avoid duplicate canvas uploads. A state-load/view-change must invalidate frontend caches independently.

The existing debug JSON now also reports:

- `hostCanvasVisible`, `hostServiceCalls`, `hostPresentations`.
- Cumulative `hostServiceMs`, `hostStepMs`, `hostCallbackTotalMs`; last/max `hostCallbackMs`, `hostCallbackMaxMs`.
- `hostAudioQueuedMs`, `hostAudioRingMs`, `hostAudioPeakMs`, `hostAudioDiscardedFrames`, `hostAudioResets`.

Native instruction, frame, generated-sample and YM-write counters remain available under their original names. Duration deltas divided by real elapsed browser time can distinguish simulation, presentation/service, and JavaScript costs. These metrics are observation only.

## Native proof

`tools/test_em_web_host_audio.c` uses the real original CPU and restored real YMFM state, with a deterministic mock playback device. Across120 ordinary RAF callbacks it proves byte-identical normalized native CPU/device state, serialized YMFM state and all96000 scaled stereo PCM frames. SDL services fall2160→240; normal visible native presentations remain119→119.

For one200ms host stall, the same native CPU and PCM are produced,133.321ms owed native credit remains, SDL services fall68→2 and intermediate presentations4→1. No native tick is dropped.

The overload consumer test starts with500ms queued output plus an85ms native ring and proves64ms of newest output remains,25024 discarded host-output frames are reported separately, native generated-sample count/world RAM stay unchanged and native dropped remains7. Pause clears output, and the cheap serial matches the native counter.

`tools/test_em_web_clock.c` still proves the original master-clock totals at30/60/120/240Hz, fractional instruction overshoot, pause/resume, explicit suspension and clock discontinuities. Its guard for host discontinuities greater than one second is unchanged.

Logs: `.local/campaign-analysis/test-host-audio.log`, `.local/campaign-analysis/host-audio-syntax.log`. These are native correctness/service-count proofs, not a measured Mac temperature or physical-phone energy result; browser profiling supplies the actual wall-time comparison.

## Checked build and evidence boundary — 2026-11-03

The measured/recorded WASM for this observation is `267ffc74caade44236994f4e342d0fe26a91f151bb1370c6af59a758cb8eb17d`. Its host header is still exactly `2b4eff7c770ed9cfba6e8281fe3803e64d238aa60e15f7f405f67fd75b747975`, the source identity used by the host batching/PCM proofs above. Those measured service-count/PCM results remain attributed to their native harness, rather than described as a new browser temperature or frame-time measurement.

The added campaign `route_hold` retains last-good world textures while Pause prepares its UI. It is host presentation state, defaults off after load, and does not suspend the native world or audio clock. Its enabled browser/SDL transition behavior is separate from the no-input native gameplay differential. A fresh current-header18000-frame prefix audit and the preserved historical105824-frame campaign runs are described in `native-campaign-fidelity.md`; no long rerun has been silently relabelled.

A repeatable late large battle, real browser/device CPU duty, thermals, audio underruns under sustained load and physical-phone energy remain to be measured. Fewer SDL calls and bounded playback backlog do not establish that every Mac or phone is cool or stutter-free. Remaining work is in `performance-plan.md`.

## Reported browser observation for267ffc74…

The root agent reported one fresh-browser run of the recorded build, not a thermal benchmark:

| Observation | Measured value |
| --- | ---: |
| Pause sample wall duration | 10.027s |
| Native frames during sample | 599 |
| Cumulative WASM callback time | 1293.94ms |
| Callback duty relative to one CPU thread | approximately12.9% |
| SDL services | 2400 |
| SDL presents / hero paints | 0 /0 |
| Playback queue at observation | 48.396ms |
| Native dropped / host discarded / queue resets | 0 /0 /0 |

This is WASM-callback duty only: it excludes the rest of JavaScript, browser/GPU/OS work and other threads. It is not total system CPU, an auditory assessment, Mac temperature, physical-phone evidence, or a late-army stress test.

In the same reported warm-route checks, Options preview appeared around275ms, curtain completed around488ms, and native controls became ready at1121ms. Pause preview appeared around287ms, curtain around499ms and native controls at1343ms. These are individual warm observations, not guarantees for every route. Cold startup may wait for an original intro input poll; native loader/palette preparation has not been accelerated. A later self-input fix changes the final WASM, so these observations remain explicitly attributed to267ffc74… until repeated.

The final input-corrected build is `779ac9b3aeecc9f36a7adf2dbaf92ab1b77a87dc35e3f1aeab15b164bcb0a784`;
its host header remains the same. A fresh desktop QA sample on the wide red
demonstration map ran600 native frames and600 SDL presentations in10.026s,
with4446.025ms WASM callback time (approximately44.3% of one thread), queue60.729ms,
no native/host-output drops and no fault. This is a different scene from the
pause sample, not a before/after performance comparison. Wide-map rendering
still performs substantial work; a long heavy battle and physical devices
remain unmeasured. The final build identity, including every adapter header,
is recorded in `wasm-build.json`.

## Optional playback-thread bridge — 2026-11-03

The compiled SDL backend uses a main-thread ScriptProcessor callback. A bounded
queue cannot prevent that callback from starving during a long render. The new
optional AudioWorklet route consumes the same native PCM on the audio rendering
thread, using a MessagePort ring with120ms preroll and320ms overload ceiling.
The main thread still generates native audio and runs the original machine.

A real-YMFM external-consumer test preserves all96000 PCM frames, complete
normalized CPU/device state and serialized chip state, with120 packets and no
duplicate SDL output. Nine worklet/bridge Node tests pass, including ten seconds of suspended output without MessagePort history. SDL fallback remains
available. These are correctness proofs; integrated battle underruns, physical
phones, subjective listening and thermals require separate browser/device
measurements. Current hashes, logs, lifecycle and API are in
[native-audio-worklet](native-audio-worklet.md) and
`data/audio-worklet-qa/verification.json`. Earlier267ffc/779ac browser figures
above remain attributed to their measured builds.
