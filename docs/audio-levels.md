# Independent music and sound output levels

Modern Options/Pause cycles each category through **100% → 50% → OFF → 100%**.
Browser preferences select output gain; they do not change original music
tempo, game speed, costs, AI, world state, voice allocation or chip clocks.

## Native source ownership

The verified USA ROM uses GEMS 2.5. Sequence opcode109 (`$6D`) sets the
sequencer's SFX-timebase bit3. GEMS copies that bit to the allocated physical
voice's flag; the physical flag survives release and logical-channel reuse.
The bridge reads those existing flags without writing native RAM:

| Source | Physical table rows |
| --- | --- |
| YM2612 channels0–5 | `$1795,$179C,$17B8,$17A3,$17AA,$17B1` |
| DAC speech/sample playback | Channel5, row`$17B1` |
| PSG tones0–2 | `$17C0,$17C7,$17CE` |
| PSG noise | `$17D6` |

`tools/test_em_web_audio_sequence_classes.py ROM` checks both original sequence
banks (`$CF970,$F6363`): all140 nonempty first-note prefixes,95 music and45
effects/voices, agree with the original game's `$2DD5C` source classification.
Every effect selects the SFX timebase before its first note. The read-only
verifier requires the original ROM SHA recorded in `docs/source-identity.json`.
GEMS field semantics can also be checked in the primary
[GEMS2.5 assembly](https://github.com/ValleyBell/GEMSPlay/blob/master/asm-sources/Z80_2-5_cleaned.ASM)
(`CCBFLAGS`, `seqsfx`, `VTANDET`). No new GEMS playback engine is included.

## Output path and invariants

`tools/prepare_source.py` produces `dune-web.c` and `dune-web-audio.cpp` in the
local build directory; pinned upstream files remain untouched. The C++ adapter
retains the original YM2612 clock/generate loop and raw interpolation history,
capturing each channel contribution once. Gain is applied only to completed
output. PSG gain is applied to the existing per-voice output integration.

The 100/100 path uses original YM output and produces byte-identical PCM.
Equal channel gains use the original generate fast path. Independent gains
need split FM output history; after a state load, up to two native FM samples
(about38 microseconds) warm that extra presentation history, with original
mixed output retained for that bounded interval. There is no second synthesis
pass, additional game loop, output timer or browser animation loop.

Preferences and split-output history are outside `CPU` and portable saves.
`CPU` remains391624 bytes; original YM state remains865 bytes; DSAV layout and
version are unchanged. At reduced gain, `Audio.previous_input/filter/peak`, PCM
ring values and `PSG.area` naturally reflect the changed output. These are
presentation histories; original CPU/RAM, registers, scheduling, voice ownership
and serialized YM chip state remain identical. No chip register is attenuated
or rewritten. A short normal DC-filter tail can remain after selecting OFF.

## Native proof

`tools/test_em_web_audio_levels.c` runs the genuine cold Main CPU and its real
YM payload, adding six test-only original GEMS play-sequence12 FIFO cues. It
observes music, native effects and PSG output over95200 stereo frames per run.
All nine combinations of0/50/100 preserve the entire391624-byte normalized
CPU/device snapshot and every original865-byte YM state byte. Only process
pointers and the output histories listed above are normalized.

An unmodified generated C/original YM backend reference and the prepared
100/100 path both produce PCM FNV-1a`44729fba0195b267` and absolute sample
energy91558502. Their complete391624-byte CPU/device snapshots also match,
including every PCM/filter/PSG integration history (only ASLR process pointers
are normalized). With effects OFF, music100 has energy86202438 and music50 has
42565372; with music OFF, effects100 has16484940 and effects50 has8222880.
The small rounding/filter difference is expected from native integer PCM.

`tools/test_em_web_audio_levels_cpp.cpp` additionally isolates a changing DAC
signal:15 edges verify independent100/50/OFF amplitude while the original
865-byte YM state remains identical. This is a synthetic output fixture,
separate from the real Main/effect regression. Neither test claims physical
iPhone/Android listening or hardware latency/thermal verification.

For native compilation, use the prepared C++ adapter with
`-I .local/source/genesis_recompiler`; C harnesses also use `-Itools`.
Compile the C baseline with `-DEM_WEB_LEVELS_BASELINE` and link the original
audio adapter; link the normal harness with the prepared adapter. The local
full results are recorded in `.local/volume-levels-proof.json`.
