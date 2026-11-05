#!/usr/bin/env python3
"""Embed original bitmap glyphs and the boot controller in the first response."""
from pathlib import Path
import argparse
import base64
import json
import re

ROOT = Path(__file__).resolve().parents[1]

def generated(root=ROOT):
    web = root/'web'
    skin = json.loads((web/'ui-assets/screen-assets/manifest.json').read_text())
    locale = json.loads((web/'language-assets/manifest.json').read_text())
    en = skin['fonts']['uiShadow']
    ru = next(l for l in locale['languages'] if l['code']=='ru')['font']
    uri = lambda p: 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()
    fonts = {'en': {'image': uri(web/'ui-assets/screen-assets'/en['path']), 'glyphs': en['glyphs']},
             'ru': {'image': uri(web/'language-assets'/ru['shadowPath']), 'glyphs': ru['glyphs']}}
    data = json.dumps(fonts, separators=(',', ':'))
    code = (web/'startup.js').read_text().strip()
    return '<!-- BEGIN GENERATED STARTUP -->\n<script id="startup-font" type="application/json">'+data+'</script>\n<script>\n'+code+'\n</script>\n<!-- END GENERATED STARTUP -->'

def verify(root=ROOT):
    html = (root/'web/index.html').read_text()
    if generated(root) not in html:
        raise ValueError('Startup controller or native fonts changed; run tools/build_startup.py')
    return {'inlineOriginalFonts': True, 'inlineStartupController': True}

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    if not args.check:
        path=ROOT/'web/index.html';text=path.read_text();block=generated()
        pattern=r'<!-- BEGIN GENERATED STARTUP -->.*?<!-- END GENERATED STARTUP -->'
        if re.search(pattern,text,re.S):text=re.sub(pattern,lambda _:block,text,flags=re.S)
        else:text=text.replace('<script type="module"',block+'\n<script type="module"',1)
        path.write_text(text)
    print(json.dumps(verify()))
