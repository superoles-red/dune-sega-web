# Original scene composition pieces

Run `python3 tools/extract_scene_presentation.py` after the base
`extract_screen_assets.py`. It appends native pieces/recipes to the existing
screen-assets manifest and copies those exact assets into the web asset folder.
It never changes game instructions or frontend JS.

The actual complete source frames are separately available in
`data/scene-references/`; their manifest records raw RGB provenance and hashes.
These PNGs are review frames, not replacement video loops.

## Options and Pause

`options-original-window` is the complete320×224 original native WINDOW
artwork: the actual helmeted man, shoulder launcher and desert. Dynamic values,
pointer, Restart and Pick Another House sprites are not baked into this layer.

The picture does contain eight static label regions, listed exactly in
`controlHoles`. In particular, PRESS START TO EXIT at[72,192,168,8] is also
part of the WINDOW bitmap. `options-clean-background` is the same original
RGB with only those complete label rectangles transparent. New opaque native
control panels must cover them. It is a composition layer, not fabricated
picture reconstruction behind the original words.

The current separate-art layout uses `options-responsive-art`,208×136.
It joins the untouched original WINDOW rectangles[112,48,208,88] and
[112,144,208,48] at native pixel resolution. The skipped8px source row contains
the baked password label; no obscured art pixels are guessed or repainted.
Place this coherent helmet/launcher/desert illustration above the controls,
without covering the picture or displaying the old OPTIONS plaque. The full
WINDOW and transparent-label composition remain explicit reference alternatives.

The exact label-free original pieces are also available:

- `options-helmet-and-launcher`:208×88, source[112,48,208,88].
- `options-native-lower-body`:320×48, source[0,144,320,48].
- `options-native-bottom-terrain`:320×24, source[0,200,320,24].
- `options-native-right-side`:176×144, source[144,48,176,144].
- `options-native-left-shoulder`:32×96, source[0,48,32,96].

All fragment RGB bytes are literal native layer pixels. There is no AI image,
new pattern, image stretching, recolour or replacement results-soldier art.

## Complete title and story

`title-choices-underlay` is the actual144×32 planeB region at[104,156,144,32].
`title-complete-without-choices` preserves the entire native320×224 image,
replacing only that menu-choice region with its real underlying planet/stars.
This static part is valid for settled Main. Live intro keeps its full frame;
the live Main compositor must hide choices only after the actual178D2 poll.

Briefings/debriefings use the entire320×224 advisor-plus-map composition.
Five native text rows can overlap the map's top8pixels. A flat black rectangle
cannot safely erase the whole[16,16,288,40] area. The read-only native textless
compositor must omit only the original480..4DE font cells while keeping the
actual underlying map and live advisor. Choice areas[184,164,96,24] and
[184,188,96,28] have a genuine black background outside advisor/map, so native
gold buttons can be covered there when larger controls are placed elsewhere.

Movies, original results, endings and credits retain their entire320×224
native canvas and original cadence. The actual movie content often occupies
[8,40,304,120]; that is not permission to crop away the native surrounding
canvas or enlarge the film relative to its original composition.
