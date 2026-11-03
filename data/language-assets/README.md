# EN/RU presentation resources from the supplied Sega ROMs

The shipping projection is `web/language-assets/`. It contains only English and
Russian, compact strings/pointer lookups, original bitmap fonts/commands and the
Russian33-card guide atlas. Research/provenance stays here and is not mirrored
into the runtime. European source inventory is research only.

The original USA game code, ROM, maps, rules, balance, native clock and save
identity are retained. These resources are for read-only host presentation:
lookup the original USA string/pointer and draw translated text or original
Russian command pixels. Do not load the European/fan ROM as the game engine and
do not rewrite its native prices, HP, AI, schedules or order fields.

## Contract

`web/language-assets/manifest.json` has `languages` entries for `en`/`ru`:
`catalogPath`, `font`, and `commands`. Fonts provide `maskPath`, `shadowPath`,
`width`, `height`, `advance:8` and `glyphs` keyed by Unicode decimal codepoint,
with8x8 `x/y/w/h`. English uses its unchanged original bitmap ASCII; Russian
contains only Cyrillic Unicode entries plus lower-case aliases of the original
upper-case shapes. Merge/fallback by codepoint; never replace the English bank
with the fan ROM's co-opted ASCII encoding.

`en.json`/`ru.json` have `strings` keyed by stable semantic ID and `nativeTexts`
keyed by canonical USA ROM pointer. There are259 keys per locale:111 canonical
campaign/intro records,3 house names,19 building names,27 unit names,58 native
music/sound test names,14 original unit-action names,14 option-value strings,
4 inline shop labels and9 result-rank slots. Source raw bytes, table locations,
hashes and normalized English-to-source lookup remain in the full data JSON,
not the compact runtime projection.

The Russian catalog preserves the supplied fan translation verbatim. It is not
certification of a faithful translation. `research/translation-review.json`
records concrete meaning differences, notably changed/omitted quota advice,
free rank titles and Dmg→ЖЗН. A separately authored faithful Russian story/UI
may override them in the host. The original Mentat Cyril greeting really is in
the English game and is not a translator credit.

## Original fonts and commands

Normal font glyphs come from literal4bpp ROM patterns at`0x4F6C8+byte*32`.
The USA title's original one-pixel shadow geometry is independently checked
against94 completed native VRAM glyphs. Byte64 is a special native control
shape and is not presented as standard@ punctuation. All32 Russian alphabet
letters available in the fan font are exported without new strokes. Its missing
Ё is explicitly marked as a derived optional composition: original E rows and
source period-dot strokes, not a claimed original glyph or generated image.

Original32x24 command sprites at table`0x70CA4`, IDs28..32 already contain
ВЫХОД / РЕМ / СТОП, including native disabled РЕМ/СТОП. No letters were painted.
The fan Repair abbreviation is РЕМ; a full accessible label may say Ремонт.
The label rectangle`[2,6,28,12]` covers the translated strokes while keeping the
native frame/focus outside it. Preserve live enabled/disabled/focus state.

ID27 is the identical USA/Russian non-text Send Order/Upgrade arrow. It is
exported as `send-order-enabled`; the33-entry source table has no separate
disabled Send Order icon. The original inline `Send Order` caption remains
English in the fan ROM. It needs an authored Russian host label, not a fake
source bitmap.

`font-preview.png` and `command-preview.png` show the actual exported art.
No native country flags were found in the bounded named-resource/native-UI
inventory. Faction banners are not country flags. See
`research/country-flags.json` for the exact search limit; any country symbol in
a new language picker is authored interface art and must be described that way.

## Russian original guide

`manifest.ru.tutorial` (also the Russian language entry's `tutorial`) points to
`tutorial/ru-native-descriptions.png`:1280x2016, four columns,33 frames320x224,
in exactly the existing English guide order. The preserved original atlas is172KiB and every source card
pixel equals its recorded original resource-renderer output. Descriptive words
are genuinely inside the native Russian bitmaps, not a rewritten plaintext
summary or AI reconstruction.

The offline capturer executes the pinned USA translated resource routines from
an original frontend snapshot with the supplied Russian ROM data. It reaches
Main→Tutorial normally and decodes all33 resource compositions. This is an
asset-only decoder exercise, not a full execution-equivalence claim for the
Russian hack's changed68K code; no Russian gameplay program is installed into
the web game. Source ROM/code/fixture/capture hashes and every frame hash are
in `tutorial/provenance.json`.

All33 cards were visually reviewed and manually transcribed into
`tutorial/transcription-ru.json`. Original fan terminology, the original A-button
instruction and house spelling are explicitly noted; no pixel corrections are
silently applied. The readable review is `research/tutorial-review/index.html`,
33 original PNGs and six2x contact sheets (`sheet-00.png`..`sheet-05.png`). The
contact sheets use exact pixel repetition, no interpolation.

## Finite proofread guide corrections

The original Russian atlas stays immutable at
`tutorial/ru-native-descriptions.png` in this research directory. The shipping
URL with that basename receives the explicit corrected copy
`tutorial/ru-native-descriptions-corrected.png`; runtime metadata declares
`variant: native-source-glyph-corrected`.

`tools/recompose_language_tutorial.py` recovers exact8x8 italic source cells
from108 transcribed native lines. It preserves both original ink colours:
white and native145/145/182 shade. No letters are shrunk, interpolated, painted
or generated. Fifteen title cards are aligned with the modern Russian names,
including ДЕСАНТНИК, РАКЕТНЫЙ ТАНК, ОРНИТОПТЕР and ЗВУКОВОЙ ТАНК.
MCV says СОЗДАЕТ НОВЫЙ / СТРОИТЕЛЬНЫЙ / ЦЕНТР without the old pad-A instruction.
The Death Hand description changes only ХАРКОНЕНОВ→ХАРКОННЕНОВ; its other words
remain in place. Longer titles widen only their green plate using the same
source corners, borders and horizontal fill. All other art/sprites stay put.

Sixteen of33 Russian cards change. Every pixel outside the declared text/plate
regions is compared byte-for-byte with the untouched original. Every recovered
glyph is independently checked against its recorded source pixels. The English
atlas is unchanged: its original MCV card already says CREATES NEW OR /
ADDITIONAL / CONSTRUCTION / SITE and never mentioned A.

Optional source aliases ТРАНСПОРТ, СКЛАДЫ and БЕТОННАЯ СТЕНА remain because
alternative words would require Ч/Щ missing from this recovered italic caption
set. They were not invented from another font. Four unused armour-description
lines remain unresolved by the strict cell matcher; none is used to generate a
correction or falsely claimed as a parsed full alphabet.

Proof is `tutorial/cleanup-proof.json`. Before/after review is
`research/tutorial-corrected/index.html` and four2x comparison sheets
(original left, corrected right). The normal extractor runs this finite
composition after preserving/repacking original resources, so reproduction
does not silently restore the old words in the runtime.

## European and gameplay data inventory

All259 parsed European text records equal the USA English records. Both ROMs
also carry43 English,43 French and43 German legacy REGION INI captions; many
French/German lines really end mid-word at the absent accented character. Those
resources do not establish a complete selectable French/German UI and are not
shipped as locales. They are preserved in `research/legacy-region-captions.json`.

Each source has37 named resource-index entries and27 parsed scenarios.
The27 scenario semantics and the explicitly listed19-building/27-unit statistic
fields match the USA in both supplied variants. This is a data comparison with
stated field bounds, not a claim that all regional/fan machine code is identical.
The runtime remains the USA program regardless.

REA's advertised raw-binary schema did not expose68000, so no ROM was bound
under an incorrect architecture. This work follows the REA skill's evidence
boundary and reuses the already pinned original native consumer code with
format-aware byte and bitmap parsers; it does not claim REA decompiled these ROMs.

## Reproduce and verify

First capture the optional native Russian guide resources:

```sh
clang -std=c11 -O1 tools/capture_language_tutorial_native.c -o .local/capture-language-tutorial -lm
.local/capture-language-tutorial .local/frontend-fixture/frontend.cpu.bin '/path/to/Russian.gen' .local/language-tutorial-ru
```

Then extract and verify (source names/hashes are guarded; paths can be supplied):

```sh
python3 tools/extract_language_assets.py --source-dir '/path/to/Dune lang' --usa '/path/to/USA.gen'
python3 tools/verify_language_assets.py
```

The standard-library verifier checks all518 EN/RU source literal records,
source font geometry, all12 command PNGs, all33 original guide frame hashes,16 finite corrected frames and exact
source-glyph/outside-region identity, EN/RU-only
runtime projection and absence of operator paths/raw provenance there. All
source ROM hashes are checked again after extraction. No Pillow, neural image
generation, package installation, public deployment or runtime-source edit is
used by this pipeline.
