# Dune Sega USA — original shop graphics

Local source art for designing a responsive building/shop interface.

- building-assets: all 19 native building IDs, original 32×24 button icons and
  96×56 monitor illustrations. Reused original resources remain separate IDs.
- shop-ui-assets: original controls, selection frames, panels, icons and chrome,
  plus complete native reference frames. See its manifest for palette coverage.
- PNG files retain native resolution and palette-derived colors. Only genuine
  transparent sprite pixels have alpha; opaque original backgrounds stay opaque.
- Monitor illustrations are static ROM resources. Console flashes, monitor noise,
  numbers and other UI effects are separate layers, not invented animation frames.

Keep native row/column or item IDs when connecting these pictures to the game.
Read prices, availability, production and actions from the original program;
the art manifest is not a replacement rules database. The current preview/confirm
input path can be reused with a future responsive panel.

Each package includes a manifest with hashes, source records/rectangles and its
extraction instructions. The source ROM and generated original CPU program are
not included. The tools/ directory contains the reproducible local extractors.

The separate review page is served at /asset-library/. It is not loaded by the
game and does not add PNG downloads to normal gameplay.
