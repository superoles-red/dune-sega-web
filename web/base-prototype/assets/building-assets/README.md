# Original Sega USA building menu graphics

This local source-art package contains all 19 native building IDs: 32×24 menu
icons and 96×56 monitor illustrations. The asset names and IDs come from the
original ROM, including the two concrete IDs and reused native artwork.

`manifest.json` contains dimensions, exact ROM offsets, palettes, tile maps,
file/resource SHA-256, shared-resource identities and decoder validation.
Paths in the manifest are relative to this directory. Icons use original
transparent nibble zero; complete monitor images have an opaque black backdrop.

The monitor images are static original resources. Console lights, digits,
cursor frames and menu chrome are separate layers for a future interface.
World-map buildings, owner palettes, turret headings and construction/animation
overlays are outside this package; they have not been silently approximated.

Refinery ID12 has a native length quirk: 2700 declared VRAM-upload bytes versus
2720 complete decoded bytes. Its PNG preserves the complete ROM resource; see
the manifest for the exact distinction from a state-dependent native frame.

Reproduce from the exact USA ROM:

```sh
clang -std=c11 -O1 tools/extract_building_assets_native.c -o .local/extract-building-assets-native -lm
python3 tools/extract_building_assets.py '/path/to/Dune - The Battle for Arrakis (USA).gen' --native-helper .local/extract-building-assets-native
```

PNG encoding, LCW decoding and palette conversion use Python standard library
only. The optional native helper executes the original offline LCW routine,
then compares every decompressed byte for every building with the independent
decoder. No game mechanics or original program bytes are modified.
