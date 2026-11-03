# Contributing

The source is public: clone it, download its ZIP, inspect the code, and propose
changes through GitHub issues or pull requests.

- [Play](https://superoles-red.github.io/dune-sega-web/)
- [Source and issues](https://github.com/superoles-red/dune-sega-web)
- [Download the main branch](https://github.com/superoles-red/dune-sega-web/archive/refs/heads/main.zip)

## Start locally

Python 3 and a current browser are enough to run the included build:

```sh
git clone https://github.com/superoles-red/dune-sega-web.git
cd dune-sega-web
python3 tools/serve.py --port 4174
```

Open `http://127.0.0.1:4174/`. Use HTTP, not `file://`. A current Node.js is
needed for frontend tests. No npm dependencies or account are required.

```sh
node --test tests/*.test.mjs
node tools/test_modern_tutorial.mjs
python3 tools/test_publication.py
python3 tools/build_publication.py --output _site
python3 tools/verify_publication.py _site
```

The native rebuild instructions and source hashes are in
[`vendor/rearrakis/README.md`](vendor/rearrakis/README.md) and the main README.
An installed Emscripten SDK is needed only when changing/rebuilding the native
core; ordinary frontend work uses the checked-in loader and WASM.

## Preserve the game

This project adapts the Sega USA game's presentation and input. Changes to
combat, harvesting income, AI, reinforcements, mission data, unit statistics,
prices, or simulation timing are outside routine UI work. Describe any such
effect explicitly in a proposal. Keep browser/file/PWA functionality outside
the simulation and preserve the original single-unit command semantics.

For a UI change, test desktop and a portrait viewport, pointer gestures,
shop preview/confirmation, return navigation, and browser console health.
For saves, test export/import, corrupt and incompatible files, and storage
failure without losing an existing save. For PWA changes, test a fresh online
install and a subsequent offline reload under the deployed URL prefix.
Do not report desktop simulation as a physical iPhone/Android test.

Explain what changed, what was tested, and any limits. Do not commit personal
saves, credentials, SDKs, `.local`, or generated `_site` output. Check hashes
before updating a recorded native identity; a successful frontend test is not
proof of unchanged original game behavior.

## Licenses and attribution

The adaptation's original code is MIT-licensed under [`LICENSE`](LICENSE).
Retain ReArrakis/RROP, YMFM, SDL2, and Emscripten notices. Original game content,
including ROM-derived portions of generated C/WASM, is not covered by MIT.
See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
