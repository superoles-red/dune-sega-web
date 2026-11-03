#!/usr/bin/env python3
"""Package the locally extracted original menu art and a standalone review page.

The game shell never imports this page or these PNGs. No ROM is bundled.
"""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'web/asset-library'
PACKAGES = ('building-assets', 'shop-ui-assets')

GUIDE = '''# Dune Sega USA — original shop graphics

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
'''

HTML = r'''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dune Sega USA — графика магазина</title>
<style>
:root{color-scheme:dark;font:15px/1.5 system-ui,sans-serif;color:#e5e0d3;background:#111214}*{box-sizing:border-box}body{margin:0}main{max-width:1280px;margin:auto;padding:32px 24px 64px}h1{font-size:clamp(25px,4vw,38px);line-height:1.2;margin:5px 0 14px}h2{font-size:23px;margin:38px 0 8px}p{max-width:900px;color:#b9b7b0}a{color:#e6be79;text-underline-offset:3px}header{border-bottom:1px solid #363638;padding-bottom:24px}.eyebrow{font-size:12px;letter-spacing:2px;color:#b9b7b0}.links{display:flex;flex-wrap:wrap;gap:12px 24px;margin-top:22px}.zip{display:inline-block;padding:9px 15px;border:1px solid #7c6747;border-radius:5px;text-decoration:none}.summary{display:flex;flex-wrap:wrap;gap:8px 24px;color:#ddd2bd;font-size:14px;margin-top:18px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:16px}.card{margin:0;background:#1b1c1f;border:1px solid #39393d;border-radius:6px;overflow:hidden}.card h3{font-size:16px;font-weight:550;margin:14px 15px 5px}.id{font:12px ui-monospace,monospace;color:#b2a890;margin-right:7px}.pictures{height:166px;display:flex;align-items:center;justify-content:center;gap:17px;padding:12px;background:repeating-conic-gradient(#25272b 0% 25%,#1e2023 0% 50%) 50%/16px 16px}.pictures img{image-rendering:pixelated;object-fit:contain;flex:none}.portrait{width:192px;height:112px}.icon{width:64px;height:48px}.card .pictures{flex-direction:column;height:198px;gap:10px}.card .files{display:flex;gap:16px;margin:12px 15px 14px;font-size:13px}.dims{font:12px ui-monospace,monospace;color:#aaa;margin:0 15px 12px}.filters{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.filters button{border:1px solid #4d4d50;background:#202126;color:#c4c2ba;border-radius:4px;font:inherit;padding:7px 12px;cursor:pointer}.filters button[aria-pressed=true]{background:#53432c;color:#fff4dd;border-color:#997d50}.ui .pictures{height:180px;flex-direction:row}.ui img{max-width:100%;max-height:156px;width:auto;height:auto;image-rendering:pixelated}.ui .files{margin-top:4px}.ui h3{min-height:48px;font-size:14px}.ui .dims{margin-bottom:5px}details{border:1px solid #39393d;border-radius:6px;padding:12px 16px;margin-top:22px}summary{cursor:pointer}#status{color:#c9ae80}footer{margin-top:40px;border-top:1px solid #363638;padding-top:15px;color:#aaa;font-size:13px}@media(max-width:600px){main{padding:24px 14px}.grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}.pictures{gap:10px}}
</style></head><body><main>
<header><div class="eyebrow">DUNE · SEGA GENESIS · USA</div><h1>Оригинальная графика магазина</h1>
<p>Детали для будущего динамического интерфейса: исходные изображения зданий, кнопки, рамки и панели. Здесь нет перерисовки или улучшения графики. Изображения зданий в обзоре увеличены вдвое; PNG сохраняют родное разрешение.</p>
<div class="links"><a class="zip" href="dune-shop-ui-kit.zip" download>Скачать весь набор ZIP</a><a href="#buildings">Здания</a><a href="#ui">Детали интерфейса</a><a href="/" target="_blank">Открыть игру</a></div>
<div class="summary" id="summary"></div><p id="status" role="status">Загрузка каталога…</p></header>
<h2 id="buildings">Здания</h2><p>Для каждого из 19 игровых ID: иконка кнопки 32×24 и большая иллюстрация 96×56. У некоторых зданий исходная игра использует общую картинку.</p><div class="grid" id="building-grid"></div>
<h2 id="ui">Детали интерфейса</h2><p>Исходные состояния кнопок, показатели, части корпуса и рамки. Красная рамка строительного меню и зелёная рамка Starport сохранены в родных цветах. Палитра UI проверена для Atreides; покрытие каждого элемента указано в manifest.</p><div class="filters" id="filters" aria-label="Категории деталей"></div><div class="grid ui" id="ui-grid"></div>
<details><summary>Полные исходные экраны для сверки</summary><div class="grid ui" id="references"></div></details>
<details><summary>Что сохраняем при сборке нового магазина</summary><p>Внешний вид можно собирать из этих деталей, а доступность, цены и действия получать из оригинальной игры. Первое нажатие выбирает товар и показывает сведения, второе подтверждает покупку. Изображения монитора — статичные исходные ресурсы; мерцания, цифры и прочие эффекты интерфейса нужно подключать отдельными слоями.</p></details>
<footer><a href="data/building-assets/manifest.json">Manifest зданий</a> · <a href="data/shop-ui-assets/manifest.json">Manifest интерфейса</a> · <a href="README.md">Состав набора и воспроизведение</a>. Карта, мировые спрайты, направления турелей и анимации строительства в этот набор не входят.</footer>
<output id="library-state" hidden></output>
</main><script type="module">
const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const link=(label,path)=>{const a=el('a','',label);a.href=path;a.target='_blank';return a;};
function image(path,width,height,cls,label){const img=el('img',cls);img.src=path;img.width=width;img.height=height;img.alt=label;img.addEventListener('error',()=>{$('status').textContent='Не удалось загрузить '+path;});return img;}
const labels={buttons:'Кнопки',chrome:'Корпус и края',icons:'Показатели',panels:'Панели',selection:'Рамки',all:'Все детали'};
const category=a=>a.path.split('/')[0];
function uiCard(a){const c=el('article','card'),pictures=el('div','pictures');const scale=Math.min(4,Math.max(1,Math.floor(Math.min(216/a.width,156/a.height))));const img=image('data/shop-ui-assets/'+a.path,a.width,a.height,'',a.label||a.id);img.style.width=(a.width*scale)+'px';img.style.height=(a.height*scale)+'px';pictures.append(img);c.append(pictures,el('h3','',a.label||a.id),el('p','dims',`${a.width}×${a.height} · ${a.transparent?'RGBA':'родной фон'}`));const f=el('div','files');f.append(link('Открыть PNG','data/shop-ui-assets/'+a.path));c.append(f);return c;}
try{
 const [buildings,ui]=await Promise.all([fetch('data/building-assets/manifest.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json();}),fetch('data/shop-ui-assets/manifest.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json();})]);
 for(const b of buildings.buildings){const c=el('article','card'),title=el('h3');title.append(el('span','id',String(b.id).padStart(2,'0')),document.createTextNode(b.name));const p=el('div','pictures');p.append(image('data/building-assets/'+b.illustrations[0],96,56,'portrait',b.name+' — иллюстрация'),image('data/building-assets/'+b.icons[0],32,24,'icon',b.name+' — иконка'));const f=el('div','files');f.append(link('Иллюстрация','data/building-assets/'+b.illustrations[0]),link('Иконка','data/building-assets/'+b.icons[0]));c.append(title,p,f);$('building-grid').append(c);}
 const pieces=ui.assets.filter(a=>a.kind!=='reference-frame'),references=ui.assets.filter(a=>a.kind==='reference-frame');let selected='all';
 function render(){ $('ui-grid').replaceChildren(...pieces.filter(a=>selected==='all'||category(a)===selected).map(uiCard));for(const b of $('filters').children)b.setAttribute('aria-pressed',String(b.dataset.category===selected));$('library-state').textContent=JSON.stringify({loaded:true,buildings:buildings.buildings.length,buildingImages:buildings.buildings.reduce((n,b)=>n+b.icons.length+b.illustrations.length,0),uiAssets:ui.assets.length,visiblePieces:$('ui-grid').children.length,category:selected,romSha256:buildings.source.romSha256});}
 for(const key of ['all',...new Set(pieces.map(category))]){const b=el('button','',labels[key]||key);b.type='button';b.dataset.category=key;b.addEventListener('click',()=>{selected=key;render();});$('filters').append(b);}
 for(const a of references)$('references').append(uiCard(a));render();
 for(const text of [`${buildings.buildings.length} типов зданий`,`${buildings.buildings.length*2} изображений зданий`,`${ui.assets.length} элементов и кадров UI`])$('summary').append(el('span','',text));
 $('status').textContent='Каталог загружен. Каждый PNG можно открыть отдельно; полный набор — в ZIP.';
}catch(e){$('status').textContent='Не удалось открыть каталог: '+e.message;$('library-state').textContent=JSON.stringify({loaded:false,error:e.message});}
</script></body></html>'''


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name in PACKAGES:
        source = ROOT / 'data' / name
        manifest = json.loads((source / 'manifest.json').read_text())
        if name == 'building-assets':
            assert len(manifest['buildings']) == 19
            assets = [(a, b[k]['sha256']) for b in manifest['buildings']
                      for plural, k in [('icons', 'icon'), ('illustrations', 'illustration')]
                      for a in b[plural]]
        else:
            assets = [(a['path'], a['sha256']) for a in manifest['assets']]
        for relative, expected in assets:
            assert hashlib.sha256((source / relative).read_bytes()).hexdigest() == expected, relative
        shutil.copytree(source, OUT / 'data' / name, dirs_exist_ok=True)
    (OUT / 'index.html').write_text(HTML)
    (OUT / 'README.md').write_text(GUIDE)
    archive = ROOT / 'data/dune-shop-ui-kit.zip'
    tools = ['extract_building_assets.py', 'extract_building_assets_native.c',
             'extract_shop_ui.c', 'extract_shop_ui.py']
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.writestr('README.md', GUIDE)
        for name in PACKAGES:
            source = ROOT / 'data' / name
            for p in sorted(source.rglob('*')):
                if p.is_file():
                    z.write(p, str(Path(name) / p.relative_to(source)))
        for name in tools:
            z.write(ROOT / 'tools' / name, 'tools/' + name)
        assert z.testzip() is None
    shutil.copy2(archive, OUT / archive.name)
    print(f'Prepared 19-building graphics library, UI parts and verified ZIP: {archive.stat().st_size} bytes')


if __name__ == '__main__':
    main()
