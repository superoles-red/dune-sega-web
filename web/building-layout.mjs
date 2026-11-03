import {layoutFor} from './base-prototype/layout.mjs';

// Presentation only: preserve every occupied native cell's row/column and all
// internal holes. Empty trailing native capacity does not create huge buttons.
export function occupiedBuildingRows(state){
 const cells=state?.cells||[];let last=-1;
 for(let i=0;i<cells.length;i++)if(cells[i].kind!=='empty'&&cells[i].visible!==false)last=i;
 return Math.max(1,Math.ceil((last+1)/3));
}
export function buildingLayoutFor(width,height,state,cssScale=2){
 const rows=occupiedBuildingRows(state),count=Math.min((state?.cells||[]).length,rows*3);
 const L=layoutFor(width,height,count,cssScale,rows),v=L.gridViewport;
 if(state?.context===3){const b=L.cabinet;Object.assign(v,{x:b.x+20,y:b.y+12,w:b.w-36,h:b.h-32});}
 // Starport's native four-row catalogue has its own compact plate geometry.
 // Fixed maxima are CSS target sizes, rather than a phone/tablet zoom guess.
 const gapX=4,gapY=2,maxW=180/cssScale,maxH=136/cssScale;
 const cellW=Math.floor(Math.min((v.w-gapX*2)/3,maxW));
 const cellH=Math.max(24,Math.ceil(44/cssScale),Math.min(L.cells[0]?.h||24,Math.ceil(cellW*.75),Math.floor(maxH)));
 const x0=v.x+Math.floor((v.w-(cellW*3+gapX*2))/2);
 L.cells=Array.from({length:count},(_,i)=>{
  const x=x0+(i%3)*(cellW+gapX),y=v.y+Math.floor(i/3)*(cellH+gapY);
  const scale=Math.max(1,Math.min(3,Math.floor(Math.min(cellW/32,cellH/24)*2)/2));
  return {x,y,w:cellW,h:cellH,scale,art:{x:x+(cellW-32*scale)/2,y:y+(cellH-24*scale)/2,w:32*scale,h:24*scale}};
 });
 L.gridX=x0-v.x;L.gridWidth=cellW*3+gapX*2;
 L.gridHeight=rows*cellH+(rows-1)*gapY;
 if(state?.context===3){L.cabinet.h=Math.min(L.cabinet.h,L.gridHeight+32);v.h=L.cabinet.h-32;}
 L.contentHeight=L.gridHeight;L.scrollLimit=Math.max(0,L.contentHeight-v.h);
 return L;
}
