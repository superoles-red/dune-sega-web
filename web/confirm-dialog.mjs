// Real HTML controls drawn with the original game's panel, glyphs and button PNGs.
export class NativeConfirmation {
 constructor({art,feedback=()=>{}}){
  this.art=art;this.feedback=feedback;this.active=false;this.views=[];
  this.element=document.createElement('section');this.element.id='native-confirmation';this.element.hidden=true;
  this.element.setAttribute('role','dialog');this.element.setAttribute('aria-modal','true');
  this.panel=document.createElement('div');this.panel.className='confirmation-panel';
  this.background=document.createElement('canvas');this.background.className='confirmation-background';this.background.setAttribute('aria-hidden','true');
  this.text=document.createElement('canvas');this.text.className='confirmation-text';this.text.setAttribute('role','heading');this.text.setAttribute('aria-level','2');
  this.actions=document.createElement('div');this.actions.className='confirmation-actions';
  this.panel.append(this.background,this.text,this.actions);this.element.append(this.panel);document.body.append(this.element);
  this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(this.panel);
 }
 ask({title,lines=[],confirm='CONTINUE',cancel='CANCEL',danger=false,confirmFeedback=true}){
  if(this.active)this.close(false);this.active=true;this.deciding=false;this.choiceVersion=(this.choiceVersion||0)+1;this.element.classList?.remove?.('accepting','cancelling');this.title=title;this.lines=lines;const local=value=>this.art.displayText?.(value)||value;this.text.setAttribute('aria-label',local(title));this.element.setAttribute('aria-label',[title,...lines].map(local).join('. '));
  this.previousFocus=document.activeElement;this.inert=[];
  for(const id of ['scene-ui','building-screen','native-menu','context-actions','demo-launch']){const e=document.getElementById(id);if(e){this.inert.push([e,e.inert]);e.inert=true;}}
  this.actions.replaceChildren();this.views=[];
  for(const [label,value] of [[confirm,true],[cancel,false]]){
   const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);this.actions.append(b);
   const view=this.art.decorate(b,label,{ariaLabel:label});this.views.push(view);
   b.addEventListener('click',e=>{e.stopPropagation();if(this.deciding)return;this.deciding=true;const version=this.choiceVersion;view.pulse?.();if(!value||confirmFeedback)this.feedback();this.element.classList?.add?.(value?'accepting':'cancelling');setTimeout(()=>{if(this.active&&this.choiceVersion===version)this.close(value);},140);});
  }
  this.element.dataset.danger=String(danger);this.element.hidden=false;this.draw();
  this.actions.firstElementChild?.focus({preventScroll:true});
  return new Promise(resolve=>{this.resolve=resolve;});
 }
 close(value=false){
  if(!this.active)return;this.active=false;this.choiceVersion=(this.choiceVersion||0)+1;this.element.hidden=true;
  for(const [e,was] of this.inert||[])e.inert=was;for(const v of this.views)v.dispose();this.views=[];
  if(this.previousFocus?.isConnected)this.previousFocus.focus?.({preventScroll:true});
  const resolve=this.resolve;this.resolve=null;resolve?.(value);
 }
 draw(){
  if(!this.active||!this.art.ready)return;
  const width=Math.max(180,Math.floor(this.panel.clientWidth)),d=Math.min(devicePixelRatio||1,3),scale=width<360?1.5:2,cols=Math.floor((width-40)/(8*scale));
  const rows=[];
  for(const source of [this.title,'',...this.lines]){const paragraph=this.art.displayText?.(source)||source;let row='';for(const word of paragraph.split(/\s+/)){if(row&&(row.length+1+word.length)>cols){rows.push(row);row='';}row+=(row?' ':'')+word;}rows.push(row);}
  const height=32+rows.length*(8*scale+6);this.text.width=width*d;this.text.height=height*d;this.text.style.height=height+'px';
  const ctx=this.text.getContext('2d');ctx.scale(d,d);ctx.imageSmoothingEnabled=false;rows.forEach((line,i)=>this.art.text(ctx,line,width/2,16+i*(8*scale+6),{scale,align:'center',shadow:true}));
  const box=this.panel.getBoundingClientRect();this.background.width=Math.ceil(width*d);this.background.height=Math.ceil(box.height*d);const bg=this.background.getContext('2d');bg.scale(d,d);bg.imageSmoothingEnabled=false;this.art.frame(bg,'dialog-frame',0,0,width,box.height,{group:'screen',unit:2,fill:true});
 }
}
