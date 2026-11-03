# Third-party notices

The optional YM2612 backend includes selected unmodified sources from
[ymfm](https://github.com/aaronsgiles/ymfm), by Aaron Giles and contributors,
revision `81aec25ccbb98f4873a255f7551ac4dadac59b4a`.
Sources and their license are in `genesis_recompiler/ymfm/`.
The following license must accompany source and binary distributions using it.

```text
BSD 3-Clause License

Copyright (c) 2021, Aaron Giles
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## External runtime dependencies

### 1. Simple DirectMedia Layer 2 (SDL2)

The WebAssembly core and native runtime link SDL2, licensed under the zlib License:

```text
Simple DirectMedia Layer (SDL2)
Copyright (C) 1997-2025 Sam Lantinga <slouken@libsdl.org>

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
   claim that you wrote the original software. If you use this software
   in a product, an acknowledgment in the product documentation would be
   appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be
   misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.
```

### 2. Emscripten WebAssembly Toolchain

WebAssembly compilation is powered by the Emscripten toolchain, licensed under the MIT / University of Illinois/NCSA Open Source License.

---

## Intellectual Property & Game Assets

Original *Dune II: The Battle for Arrakis* code, visual assets, audio samples, and game data are intellectual property of Westwood Studios, Virgin Interactive Entertainment, Sega, and The Herbert Limited Partnership. They are not covered by the project's MIT open-source license.

ReArrakis is an independent, clean-room static recompiler and runtime engine developed for educational research, interoperability, and digital software preservation.

