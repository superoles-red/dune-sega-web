# iOS audio interruption recovery

A phone call can suspend the audio context without navigating away. Some
WebKit failures leave it listed as running although the clock or rendering
has stopped. See [WebKit 243727](https://bugs.webkit.org/show_bug.cgi?id=243727)
and [WebKit 263627](https://bugs.webkit.org/show_bug.cgi?id=263627).

The iOS bridge listens for page focus/visibility and supported AudioSession
state changes without changing the session category. After an interruption
it tries the current audio graph first. When native PCM continues, it checks
clock and worklet output-frame progress. A stuck output gets one bounded
suspend/resume attempt. After a failed restart, a trusted touch release can
open a new context at the same sample rate and connect a replacement
AudioWorklet. The old graph is released after successful handoff. The
original SDL callback and buffer format remain available as fallback.

Only the output queue is flushed. CPU, YM synthesis, game pause, saves and
volume settings are unchanged. Recovery does not use audio amplitude to
decide whether a graph works, and does not add a timer to normal gameplay.
The page never starts an output replacement during a reported active
interruption. A context that recovers naturally can keep its existing graph.

Tests: `node --test tests/audio-interruption-recovery.test.mjs tests/audio-shell-lifecycle.test.mjs tools/test_native_audio_worklet.mjs`.
The local `qa-audio-worklet.html` can close a real browser output and verify
that a trusted click restores a rendering worklet without reloading the page.
This diagnostic is excluded from the public game. These checks do not simulate
a cellular call at the operating-system level; verify that on a real iPhone.
