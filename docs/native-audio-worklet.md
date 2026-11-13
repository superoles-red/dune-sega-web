# Playback thread and native PCM — 2026-11-03

The original game still generates every PCM sample through its original CPU,
Z80, YMFM/PSG clocks and audio banks. The optional AudioWorklet changes the
consumer of that completed stereo48kHz S16 stream. It does not execute the
machine, regenerate a sound effect or run native time faster.

## Confirmed cause and output path

The compiled Emscripten SDL backend creates a `ScriptProcessorNode(2048,0,2)`.
Its audio callback invokes WASM on the main JavaScript thread. A long world
render or input callback therefore prevents output servicing even when SDL
already has PCM queued. Bounding that queue alone cannot move this callback
off the busy thread.

`web/native-audio.mjs` reuses `Module.SDL2.audioContext`, loads
`native-audio-worklet.js` and connects one stereo worklet. Only after setup
succeeds does it disconnect SDL's ScriptProcessor and select the host external
PCM route. Failure keeps, or reconnects, the same SDL fallback. The original
SDL suspended-context unlock timer is retained until the context runs; then
its redundant main-thread silence callbacks are cleared.

The host sends a transferable owned PCM copy per native callback batch,
before a potentially expensive SDL upload. A MessagePort ring uses120ms initial
preroll and a320ms overload ceiling. It requires neither SharedArrayBuffer nor
cross-origin-isolation response headers. At48kHz every ordinary output sample
is the original S16 value divided by32768. For other AudioContext rates, a
fixed source/output rate ratio performs linear interpolation; no adaptive
pitch or game-clock adjustment is used.

A real underrun counts missing output frames, fades the last output to zero
in32 output samples, then waits for fresh120ms preroll. Initial preroll has a
separate counter. Overload trims stale output only and reports the discarded
frames; native `audio.dropped` remains a separate, untouched metric. This path
cannot guarantee uninterrupted sound if main-thread native production remains
slower than real time or stalls longer than the available audio buffer.

The [Web Audio specification](https://www.w3.org/TR/webaudio/) defines worklet
processing on the audio rendering thread. AudioWorklet is feature-tested and
requires a secure context; deployment compatibility still needs actual
browser/device checks. No physical iPhone/Android result is claimed here.

## Integration and lifecycle

```js
import {NativeAudioBridge} from './native-audio.mjs';
const audio = new NativeAudioBridge({Module});
audio.start();     // after SDL device opens; UI does not await setup
audio.resume();    // existing user gestures; concurrent resumes coalesce
audio.snapshot();  // optional QA publication, no native mutation
```

`start()` may retry if it was called before SDL opens. The host export
`dune_web_audio_worklet(1/0)` switches consumers. It is not called until the
processor exists. The native host invokes `Module.nativeAudioBridge.pushPCM`,
`flush` and `setPlaying`; shell code does not need a per-frame PCM poll.

Successful state loads, explicit manual pause and the existing explicit hidden
pause flush a monotonic output epoch. Old MessagePort packets are rejected.
These are output resets, not chip/world resets. An ordinary camera rebase does
not flush sound. No additional background-tab policy is installed by the bridge.
Music/Sound native toggles and native frontend bank guards remain unchanged.

## Tests and evidence limits

`tools/test_em_web_audio_worklet.c` restores the genuine cold-main CPU and
real865-byte YMFM state. Across120 callbacks, the SDL consumer and external
consumer produce identical complete normalized391624-byte CPU/device state,
serialized YMFM state, and all96000 stereo PCM frames/384000 bytes. Only the FM
process pointer and consumed ring/read/count are normalized. The external
path hands off120 packets, queues no duplicate SDL frames and discards none.
The test also verifies explicit pause/hidden/load epochs and an800-frame
failed-packet fallback without sample loss.

The previous batching test still passes its96000-frame PCM comparison,200ms
clock-debt case and stale-output policy for SDL fallback. The native clock test
preserves identical master-clock totals at30/60/120/240Hz. Current prepared C
passes Emscripten syntax checking; the original ROM/instruction suffix guard
passes.

Nine Node tests execute the actual worklet source, checking ordinary stereo
sample identity, variable quantum sizes, fixed44.1kHz output conversion,
100ms producer-stall absorption, true underrun/rebuffer, epoch isolation,
320ms bounded overflow, no double SDL output and setup/runtime fallback.
A ten-second cold suspended-context case consumes480000 native output frames
without posting any PCM history to MessagePort. Explicit or browser-driven
resume requests a fresh epoch from the existing C route setter before fresh
PCM enters preroll. Suspended output is counted separately as
`suspendedDiscardedFrames`; native generation continues normally. Setup does
not call an untrusted `resume()` which could leave an unresolved autoplay
promise blocking a later real user gesture.

Machine-readable source identities and logs are in
`data/audio-worklet-qa/verification.json`. `/qa-audio-worklet.html` is a separate
playback-only browser diagnostic, with a deterministic test signal and100/250ms
main-thread stalls. It does not load a ROM or touch progress. A standalone
signal result is distinct from integrated battle/audio, subjective listening,
physical-device or thermal proof. Actual standalone browser results are recorded separately below; historical267ffc/779ac measurements are not relabelled.

Useful QA fields: bridge `backend`, `contextState`, `maxProducerGapMs`,
`producerGapsOver80ms`; processor `queuedMs`, `prerollFrames`,
`underrunFrames/events`, `discardedFrames`, `overflowEvents`; native
`hostAudioExternal`, `hostAudioEpoch`, `hostAudioExternalFrames/Packets`,
`audioDropped`, `hostStepMs`, `hostServiceMs`, `hostCallbackMaxMs`.

## Actual browser output-thread result

Root CUA ran the standalone diagnostic in a secure browser context at48kHz.
After a requested100ms main-thread block, the measured producer gap was
110.835ms, the worklet minimum queue was320frames and underrun count remained0.
A requested250ms block measured267.225ms and exceeded the buffer:6848 output
frames were missing in one event; subsequent playback was primed again with
no processor error. This proves finite-stall isolation and recovery for this
synthetic producer. It is not a native-battle listening or physical-phone
result. Exact snapshots are
in `data/audio-worklet-qa/browser-standalone.json`.

The first integrated loader exposed an EM_JS parameter-name parsing error
which valid C syntax/native tests could not detect. The pointer declaration
now uses an explicit separator (`const int16_t *p`). Build recording executes
the actual generated JavaScript functions with32PCM frames, flush/playing
arguments and missing-bridge fallback before declaring success. Its negative
control rejects the observed `int16_tp`/undefined-`p` loader; a fresh tiny
Emscripten artifact from the shipping declaration passes. Full-engine loader
validation passed for972f665e3fa5ff74f4a02e2390d5ce78156b0877c53dbaffe743cdadcb551b09 and runs again automatically for subsequent builds.
Root also observed that integrated build using the worklet at44.1kHz, native
external route1 and frame counter569, with no reported native drops, worklet
underruns or new errors. This short integration sample is not a sustained
battle or listening result.

## Published demo source audio

A later browser check distinguished a silent analysis-fixture problem from
playback starvation: an old ym0 demo restored Z80 at a YM timer wait after
resetting the chip. Both public demos are now rebuilt offline from genuine
AUDIO_ON campaign sources with matching865-byte YMFM continuation. No worklet,
bank, original gameplay or runtime loader change was needed. Exact load/native
proof and bounded red-browser observations are in
[native-demo-audio](native-demo-audio.md).
