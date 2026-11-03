# Pinned native source used by the web build

This directory makes the native inputs available for inspection and rebuilding
without relying on an unpublished `.local/source` directory.

- Foundation: [andvolodko/dune2-sega-web](https://github.com/andvolodko/dune2-sega-web),
  revision `56c6a6da10`, based on [kruzeman/ReArrakis](https://github.com/kruzeman/ReArrakis).
- `build/dune-base.c` is the exact generated baseline used by this adaptation:
  SHA-256 `e3055a76cd0eeb151591984a2c12312dcea49754afa0edee9f84889814ad1578`.
- Original USA game identity: 1,048,576-byte ROM,
  SHA-256 `b1bbe73186e0902fa8b2db0f227bf306e3d6a80fe592f927d1aa9d60c0f335ba`.
- `genesis_recompiler/` includes the pinned runtime headers, audio implementation,
  recompiler Python modules, and YMFM sources. `source-manifest.json` records
  every retained input's size and SHA-256. No SDK, cache, local saves, or logs are
  vendored. The baseline and runtime together occupy approximately 21 MB.

The generated baseline contains original game instructions and embedded ROM
data. Publishing it for inspection does **not** make those portions MIT-licensed.
`LICENSE` is the upstream engine license; `genesis_recompiler/ymfm/LICENSE` is
YMFM's BSD 3-Clause license. The original game's rights remain with its owners.
See the repository's `THIRD_PARTY_NOTICES.md`.

Verify these inputs with:

```sh
python3 tools/bootstrap_core_source.py --check
```

Run that command from the repository root. Without `--check`, the tool creates
the expected `.local/source` build layout from these verified files. It refuses
to overwrite a differing local input. `tools/prepare_source.py` then applies the
public host adapters and verifies the original ROM/instruction blocks remain
unchanged. The public native build command is `bash tools/build.sh`.

Rebuilding this **existing generated baseline** does not require another ROM
file: its data is already embedded. Recompiling a different ROM from scratch is
a separate upstream workflow, requires an appropriate ROM supplied by the
operator (for example `/path/to/Dune-USA.gen`), and is outside this adaptation's
supported build. Changing the ROM invalidates the recorded source identity.
