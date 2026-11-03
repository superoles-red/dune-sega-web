# Original Sega USA unit shop art

All 27 native unit definitions are inventoried. Every nonzero original unit icon
pointer is exported at32×24, plus the original Upgrade and Starport command
icons. All17 genuine unit monitor-picture resources are exported at96×56.
The remaining monitor pointers reference a non-picture dummy record; missing
images and zero icon pointers remain explicitly absent, never replaced.

Ordinary production/Starport shop portraits cover unit IDs0..17 except Saboteur6,
which is a Palace special rather than a normal shop purchase. Death Hand and
projectile/delivery/non-shop definitions are still inventoried accurately.

Icons use source nibble-zero transparency, original tile ordering and CRAM.
Production Sonic Tank12 is forced to palette lane1; Starport uses lane3. Its
base production, own-selected-portrait and Starport palette variants are separate.
The live native-frame bridge remains authoritative for exact changing palettes,
red focus, counts, unavailable states, lights and animations.

Reproduce:

```sh
clang -std=c11 -O1 tools/extract_unit_assets_native.c -o .local/extract-unit-assets-native -lm
python3 tools/extract_unit_assets.py '/path/to/Dune - The Battle for Arrakis (USA).gen' --native-helper .local/extract-unit-assets-native
```

The Python exporter uses only the standard library plus the local original
building-asset decoder module. Optional native validation compares every
decompressed byte against original offline routine$0C32. No ROM/gameplay/runtime
code or original assets are modified.
