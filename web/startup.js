// This tiny classic script is embedded in the first HTML response. It does not
// wait for modules, game code, network fonts or the original engine to run.
(()=>{
 const panel=document.getElementById('launch'),label=document.getElementById('boot-label'),heading=document.getElementById('boot-heading'),text=document.getElementById('boot-text'),canvas=document.getElementById('boot-bitmap'),bar=document.getElementById('boot-progress'),fill=document.getElementById('boot-fill'),retry=document.getElementById('boot-retry');
 if(!panel||!text)return;
 panel.dataset.startedMs=String(Math.round(window.performance?.now?.()||0));
 let russian=false;try{russian=localStorage.getItem('dune-sega-language-v1')==='ru';}catch{}
 const words=russian?{loading:'ЗАГРУЗКА DUNE',catalogue:'ПОДГОТОВКА ГРАФИКИ',interface:'ПОДГОТОВКА ИНТЕРФЕЙСА',graphics:'ГРАФИКА',engine:'ПОДГОТОВКА ИГРЫ',error:'НЕ УДАЛОСЬ ЗАГРУЗИТЬ ИГРУ',retry:'ПОВТОРИТЬ',connection:'ПРОВЕРЬТЕ ПОДКЛЮЧЕНИЕ И ПОВТОРИТЕ ПОПЫТКУ'}:{loading:'LOADING DUNE',catalogue:'PREPARING GRAPHICS',interface:'PREPARING INTERFACE',graphics:'GRAPHICS',engine:'PREPARING GAME',error:'COULD NOT LOAD THE GAME',retry:'TRY AGAIN',connection:'CHECK YOUR CONNECTION AND TRY AGAIN'};
 const font=JSON.parse(document.getElementById('startup-font').textContent),images={};
 let complete=false,failed=false,frame=0,last='',styles;
 const line=(target,value)=>{
  if(!target)return;target.width=Math.max(8,value.length*8);target.height=10;target.style.width=Math.min(480,value.length*16)+'px';
  const c=target.getContext('2d');if(!c)return;c.imageSmoothingEnabled=false;
  for(let i=0;i<value.length;i++){
   const code=value.charCodeAt(i),locale=code>126?'ru':'en',g=font[locale]?.glyphs[code]||font.en.glyphs[63];
   if(g&&images[locale])c.drawImage(images[locale],g.x,g.y,8,8,i*8,0,8,8);
  }
  target.hidden=false;
 };
 const draw=()=>{
  frame=0;if(complete||!canvas||!images.en||russian&&!images.ru)return;
  const value=label.textContent+':'+text.textContent;if(value===last)return;last=value;
  line(heading,label.textContent);line(canvas,text.textContent);label.classList.add('boot-accessible');text.classList.add('boot-accessible');
 };
 const paint=()=>{if(!frame)frame=requestAnimationFrame(draw);};
 const set=value=>{if(complete)return;text.textContent=value;paint();};
 label.textContent=words.loading;retry.textContent=words.retry;set(words.catalogue);
 for(const locale of ['en','ru']){const image=new Image();image.onload=()=>{images[locale]=image;last='';paint();};image.src=font[locale].image;}
 retry.addEventListener('click',()=>location.reload());
 const api=window.duneStartup={
  stylesReady(){
   if(styles)return styles;
   const links=[...document.querySelectorAll('link[data-ui-style]')];
   if(!failed&&links.some(link=>link.dataset.uiStyle==='pending'))set(words.interface);
   styles=new Promise((resolve,reject)=>{
    let done=false,timer;
    const finish=error=>{if(done)return;done=true;if(timer)clearTimeout(timer);for(const link of links){link.removeEventListener('load',check);link.removeEventListener('error',check);}if(error){api.fail();reject(error);}else resolve();};
    const check=()=>{
     if(links.some(link=>link.dataset.uiStyle==='error'))return finish(Error('Interface stylesheet failed to load'));
     if(links.every(link=>link.dataset.uiStyle==='ready'))finish();
    };
    for(const link of links){link.addEventListener('load',check);link.addEventListener('error',check);}
    check();if(!done)timer=setTimeout(()=>finish(Error('Interface stylesheet load timed out')),15000);
   });
   return styles;
  },
  progress({stage,loaded=0,total=0}={}){
   if(complete||failed)return;
   set(stage==='graphics'&&total?words.graphics+' '+loaded+' / '+total:words.catalogue);
   if(total){bar.setAttribute('aria-valuenow',String(loaded));bar.setAttribute('aria-valuemax',String(total));fill.style.width=(loaded/total*100)+'%';bar.classList.remove('boot-indeterminate');}
  },
  engine(){if(!complete&&!failed&&bar.classList.contains('boot-indeterminate'))set(words.engine);},
  finish(){if(failed)return;complete=true;panel.dataset.readyMs=String(Math.round(window.performance?.now?.()||0));if(frame)cancelAnimationFrame(frame);frame=0;panel.hidden=true;},
  fail(){if(complete)return;failed=true;panel.dataset.bootState='error';label.textContent=words.error;set(words.connection);bar.hidden=true;retry.hidden=false;},
 };
 window.addEventListener('error',event=>{if(!complete&&(event.target?.tagName==='SCRIPT'||event.target?.tagName==='LINK'&&event.target.getAttribute('data-ui-style')!==null||event.filename?.includes('shell.js')))api.fail();},true);
 if(new URLSearchParams(location.search).has('legacy')){panel.dataset.bootState='legacy';document.getElementById('start').hidden=false;bar.hidden=true;complete=true;canvas.hidden=true;text.classList.remove('boot-accessible');text.textContent='SEGA GENESIS · USA';}
})();
