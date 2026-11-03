# Original descriptions

The current tutorial contains33 original full320x224 descriptions of terrain, units and buildings. BACK returns through the host callback; PREV and NEXT move between pages. The first PREV and last NEXT are disabled. There is no interactive practice, native-state polling or continuous guide rendering.

The one referenced atlas is byte-identical to its completed native source frames. Other historical PNGs and archived lesson data are unreferenced research artifacts. Training fixtures and native tools remain archived; this guide never loads them.

Reproduce from the existing complete native capture:

```sh
python3 tools/extract_modern_tutorial.py
```

To recapture the original tutorial first:

```sh
clang -std=c11 -O1 tools/capture_modern_tutorial_native.c -o .local/capture-modern-tutorial -lm
.local/capture-modern-tutorial .local/frontend-fixture/frontend.cpu.bin .local/modern-tutorial-all 42000 30
```
