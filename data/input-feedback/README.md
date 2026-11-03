# Original map cursor feedback image

`order-reticle.png` is the genuine ordinary map cursor held by native BF18.
It is extracted from an original first-mission CPU snapshot on an offline copy:
only that cursor node enters original sprite builder$1088, its SAT output is
rendered by the original VDP sprite/palette code, then cropped to its real bbox.
The original cursor table$60E8C supplies the paired raw pattern bank and mapping.
Its exact256-byte pattern upload to VRAM$F780 is recreated only on the offline
copy, since an early map snapshot may have an empty/pending cursor DMA bank.
Transparent pixels follow native nibble0; retained RGB is not repainted.
The original CPU is checked byte-for-byte, the snapshot file hash is unchanged,
and the independent native BF60 world marker is never edited.

Reproduce from the project root:

```sh
clang -std=c11 -O1 -Wformat tools/extract_input_feedback_native.c -o .local/extract-input-feedback-native -lm
python3 tools/extract_input_feedback.py --snapshot '/path/to/mission-atreides-01.cpu.bin'
```

The PNG and provenance manifest are copied to `web/input-feedback/`. The native
image supplies no gameplay behavior: a host-only double flash is separate from
selection, native order logic, BF18 and BF60. `displayAnchor` centers the feedback
image on a displayed click; `nativeAnchorInCrop` records its original mapping
anchor for reference. No runtime code or original assets are changed.
