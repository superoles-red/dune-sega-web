# Native Sega USA screen assets

This is a separate original-pixel art package for the responsive interface.
No ROM, original gameplay, scenario, balance, live runtime or frozen shop kit
was modified by this extraction. The source ROM/generated-C hashes are pinned
in manifest.json; the normal95-glyph bank is additionally verified against
literal ROM bytes at0x4F6C8, the statistics font at0x50C34.

## Ready native screen pieces

- Boot: separate Virgin/Westwood logos, copyright artwork and starfield.
- Title/main: planet/starfield planeB, separate DUNE logo/subtitle/license and
  native labels. The background contains no native menu-button text.
- Houses: three original emblems/crests/nameplates in original ID order
  0Harkonnen,1Atreides,2Ordos; three advisor RGBA portraits.
- House/mission briefings and outcomes: original map pieces, gold YES/NO and
  PROCEED/ADVICE buttons, native advisor LIVE frame recipes.
- Victory/defeat movies: native304x120 previews and LIVE original frame crops.
- Results: clean soldier/tank planeB backgrounds and native yellow-value font.
- Options/pause: truly label-free helmet/landscape fragments. The full original
  WINDOW backdrop is also retained as reference and honestly marked as having
  baked labels; no hidden helmet pixels were invented or inpainted.
- Confirmation: original blue/white sprite bezel with native-index alpha,
  reusable4px corners/edges and verified opaque-black interior.
- Ending/credits: three actually captured red/blue/green planets, original
  THE END label and full LIVE scrolling-credit recipe. No recorded movie loop
  is substituted for native timing.
- Starport: a separate live native88x16 radar plot and16x48 six-slot green
  bank. Their contours/sourceRects differ from the Yard lamps and radar; do not
  sample Yard regions from a Starport frame or replay a recorded blink loop.
- The legacy password keyboard/art is retained as reference; the post-result
  password display is a different native scene and has its own recipe.

All exact native scene-name keys have background, staticHeroPart, portraitRect,
textRect, artRects and controls fields. Nulls are intentional. Movie sourceRect
is[8,40,304,120]; advisor portraitRect is[0,80,144,144], proven to contain every
actor pixel over192 completed native frames across all three houses. Results
have no staticHeroPart: preserve live values until a native-stats table is ready.
Credits keep their whole[0,0,320,224] source so names cannot be clipped as they
scroll. Native continuation/availability remains authoritative.

## Native UI pieces

command-skin-normal/disabled modules use the genuine original1px command bevel.
The pressed preview is explicitly normal native fill plus the original red
selection frame, not a claim of a separate original depressed-button image.
command-focus0..3 retain the original8-frame colour pulse. back-menu-arrow-native
is the original silver pointer turned180degrees by a lossless pixel permutation.

Fonts ui/Mask/Shadow retain their native8px patterns; textMask/textShadow extend
through ASCII126. statsValue is the genuine original yellow statistics font.
Native lowercase codes contain uppercase visual forms and remain unchanged.
Some original control glyphs (notably64) are not standard ASCII punctuation;
never invent replacement characters or recolour these font pixels.

## Reproduction

Requires the user-supplied USA ROM, pinned generated original source, original
native CPU fixture and existing frozen shop extraction evidence in this workspace.

```sh
clang -std=c11 -O1 tools/extract_screen_assets_native.c -o .local/extract-screen-assets -lm
mkdir -p .local/screen-assets-phase-raw .local/screen-options-raw .local/screen-campaign-raw .local/screen-houses-raw .local/screen-outcomes-raw
.local/extract-screen-assets --boot .local/screen-assets-phase-raw 2400 60
.local/extract-screen-assets --fixture .local/screen-assets-phase-raw/boot-poll-0178d2.cpu.bin .local/screen-assets-phase-raw title-menu 64 1
.local/extract-screen-assets --options ../dune-web/data/evidence/mission-atreides-01.cpu.bin .local/screen-options-raw
```

The native campaign fixture tools tools/test_em_web_campaign.c and
 tools/capture_campaign_scenes.c produce .local/campaign-fixtures/ and
.local/campaign-scenes/. Use the recorder --fixture mode for house-picker64frames,
house-confirm16frames, campaign-briefing96frames (stride1) in screen-campaign-raw.
Use --houses with the natural house-picker.cpu.bin to reproduce all three
picker->YES advisor samples. Capture each outcome CPU with --fixture for16frames,
stride8, preserving its basename as prefix in screen-outcomes-raw. Then run:

```sh
python3 tools/extract_screen_assets.py
```

Every indexed layer used for modular artwork must exactly recompose the completed
original frame (zero mismatched RGB bytes). Alpha comes from native4bpp indices
or explicitly documented source geometry, never an RGB colour key. Complex art
keeps its proportions; only declared straight strips/flat fills may repeat.
Raw capture/index evidence stays in.local/screen-assets-evidence and is not
shipped as hundreds of duplicate frames.

Outcome captures use controlled offline setup (original quota checker or
original Building_Free), followed by the original win/lose/movie/debrief/stats/
ending/credits branches without scene-PC jumps. They prove native art and state
rendering; they are not claims of player-earned campaign completion. Individual
text pages, every possible score/rank, and every alternate outcome/house/mission
combination are not separately claimed as a complete screenshot matrix.
