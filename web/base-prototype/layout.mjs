// Presentation geometry only. The native six-by-three order stays intact.
export const GRID_ROWS=6;
export const GRID_COLUMNS=3;

export function layoutFor(width,height,count=18,cssScale=2,minRows=GRID_ROWS){
 const W=Math.round(width),H=Math.round(height),wide=W/H>1.15;
 const monitor={x:8,y:24,w:112,h:72};
 const title={x:8,y:96,w:112,h:16};
 const titleText={x:title.x+8,y:title.y,w:title.w-16,h:8};
 const resources=Array.from({length:3},(_,i)=>wide?
  {x:8,y:120+i*32,w:112,h:24}:{x:W-88,y:24+i*32,w:80,h:24});
 const cabinet=wide?{x:128,y:24,w:W-128,h:H-24}:{x:0,y:120,w:W,h:H-120};
 const gridViewport={x:cabinet.x+8,y:cabinet.y+8,w:cabinet.w-16,h:cabinet.h-16};
 const rows=Math.max(minRows,Math.ceil(count/GRID_COLUMNS)),gapX=4,gapY=2;
 const cellW=Math.floor((gridViewport.w-gapX*(GRID_COLUMNS-1))/GRID_COLUMNS);
 // Keep fingers useful targets in short windows; only the purchases scroll.
 const cellH=Math.max(24,Math.ceil(44/cssScale),Math.floor((gridViewport.h-gapY*(rows-1))/rows));
 const contentHeight=rows*cellH+(rows-1)*gapY;
 const scrollLimit=Math.max(0,contentHeight-gridViewport.h);
 const x0=gridViewport.x+Math.floor((gridViewport.w-(cellW*GRID_COLUMNS+gapX*(GRID_COLUMNS-1)))/2);
 const cells=Array.from({length:count},(_,i)=>{
  const x=x0+(i%GRID_COLUMNS)*(cellW+gapX),y=gridViewport.y+Math.floor(i/GRID_COLUMNS)*(cellH+gapY);
  // Half steps remain uniform on the four-pixel export lattice, without cropping.
  const scale=Math.max(1,Math.min(3,Math.floor(Math.min(cellW/32,cellH/24)*2)/2));
  return {x,y,w:cellW,h:cellH,scale,art:{x:x+(cellW-32*scale)/2,y:y+(cellH-24*scale)/2,w:32*scale,h:24*scale}};
 });
 return {W,H,wide,monitor,title,titleText,resources,cabinet,gridViewport,cells,rows,contentHeight,scrollLimit,cash:{x:W-88,y:10,w:80,h:12}};
}
export function clampScroll(layout,value){return Math.max(0,Math.min(layout.scrollLimit,value));}
export function cellAt(layout,x,y,scrollY=0){
 const v=layout.gridViewport;
 if(x<v.x||x>=v.x+v.w||y<v.y||y>=v.y+v.h)return -1;
 const yy=y+clampScroll(layout,scrollY);
 return layout.cells.findIndex(r=>x>=r.x&&x<r.x+r.w&&yy>=r.y&&yy<r.y+r.h);
}
export function nativeSizeForRatio(ratio){
 if(ratio>1.15){
  const height=Math.max(216,Math.ceil(360/ratio));
  return {width:Math.round(height*ratio),height};
 }
 if(ratio>=9/16)return {width:Math.max(216,Math.round(384*ratio)),height:384};
 return {width:216,height:Math.max(384,Math.round(216/ratio))};
}
