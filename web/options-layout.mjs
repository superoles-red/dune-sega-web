// The source illustration has its own area above the controls. Its old menu
// letters are not covered by a new button panel on top of the character.
export function optionsSceneLayout(width,height,{imageWidth=320,imageHeight=144}={}){
 const scale=Math.max(0,Math.min(width/imageWidth,height/imageHeight));
 const w=imageWidth*scale,h=imageHeight*scale;
 return {scale,x:(width-w)/2,y:Math.max(0,(height-h)/2),width:w,height:h};
}
export function drawOptionsScene({ctx,art,width,height,state}={}){
 const image=art.part('options-native-full-restored','screen')||art.part('options-native-full-decor','screen')||art.part('options-native-full-source','screen');if(!image)return null;
 const scale=width/320,landscape=width>height,controlsHeight=landscape?(state.scene==='pause'?176:116):state.scene==='pause'?252:180,header=state.scene==='pause'?64:40;
 // Keep the full horizontal composition. In a wide viewport only empty sky
 // and the lowest terrain may leave the screen; the helmet/launcher stay whole.
 const coreY=48,coreHeight=landscape?88:144,top=landscape?Math.max(8,(height-controlsHeight-coreHeight*scale)/2):Math.max(header+8,(header+height-controlsHeight-coreHeight*scale)/2);
 const p={scale,x:0,y:top-coreY*scale,width,height:224*scale};
 const sky=art.part('pause-options-sky-sample','screen');if(sky)art.repeat(ctx,sky,0,0,width,height);
 ctx.drawImage(image,p.x,p.y,p.width,p.height);
 return p;
}
