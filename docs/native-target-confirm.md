# Tap-to-position building and Palace targets (20261106-target1)

The mobile flow is Ready/OK -> choose the world point -> Clear (left) or
Place/Confirm (right). Native construction preview appears immediately on
entering placement. Ordinary map taps move the preview without committing;
panning and zooming preserve its world position. Palace targeting uses the
same workflow with a world-anchored original-game reticle. On desktop the
preview follows the pointer, a left click commits, and only Clear is shown.
Place has a subdued green variant of the original command-button palette:
frame pixels, highlights and font stay native; no new bitmap is shipped.

Three narrow bridge exports were added: `dune_web_placement_begin_world`,
`dune_web_placement_confirm`, `dune_web_command_world`. They enter the original
selection, construction validation and command handlers. The saved placement
point is restored before confirmation, rather than relying on the current
pointer position. Palace confirmation revalidates the same actor and captures
a fresh native ticket; cancelling disarms without spending the charge.
Cancellation retains the already-paid construction product. No placement
legality, price, AI, combat, harvest, world clock or ROM instruction was changed.
Normal selection remains 100 ms and double-tap matching remains 300 ms.

The native WASM SHA-256 is
`3dbc9ad2ab046948add849cfae6ddf9d84cc31d9a7212b406fe5bd08de42f765`.
The loader SHA-256 is
`dc5faa08a60a1eb4298bf05fdb6465a1a8cc16c2eed7a9ded84ebb4e3cb535f6`.
DSAV v2 is unchanged and the preceding 5156b9ee save envelope remains accepted.

## Audio return from the background

The browser output gate closes before native visibility handling and saving.
Background PCM is discarded even if an iOS AudioContext still says running.
Returning starts a fresh output epoch and queue; a trusted gesture can retry
an interrupted or stalled automatic resume. The worklet rejects stale epochs.
The original native synthesizer, sample rate, game pause and music clock remain
unchanged. No context/synthesizer recreation or tempo workaround was added.

## Evidence

- Native selection and typed-input regression groups exercise released previews,
  native placement success/rejection, cancellation, stale actor tickets and
  unchanged CPU/ROM state outside the bridge.
- Controller, actual-shell and audio-lifecycle tests exercise mobile/desktop
  priority, world anchoring, fresh Palace confirmation, background drops,
  interrupted resume and stalled promises.
- Browser checks at 390x844 and 1280x720 load genuine private native saves:
  ready Yard -> green footprint -> pan -> confirm places exactly one paid
  Windtrap; Clear retains it. Palace -> world point -> pan -> Clear retains
  charge; Confirm commits one native special order with the original cooldown.
- Browser warning/error logs were empty. The desktop and simulated-touch paths
  were checked; no connected Samsung or physical iPhone was available for this
  follow-up. iPhone minimize/resume audio still needs an actual-device recheck.

Run `node --test tests/*.test.mjs`,
`node tools/test_native_audio_worklet.mjs`,
`node tools/test_modern_tutorial.mjs`, and
`python3 tools/test_publication.py` before release.
