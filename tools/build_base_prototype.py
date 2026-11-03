#!/usr/bin/env python3
"""Copy the verified native art inputs for the independent layout prototype."""
from pathlib import Path
import shutil

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'web/base-prototype/assets'
PACKAGES=['shop-layout-kit','base-prototype-content','building-assets','shop-ui-assets','menu-animations']
for name in PACKAGES:
    source=ROOT/'data'/name
    assert (source/'manifest.json').is_file(),name
    shutil.copytree(source,OUT/name,dirs_exist_ok=True)
print('Prepared independent native-art base prototype; no game shell integration.')
