#include "em_web_minimap.h"
#include <assert.h>
#include <stdio.h>
static int near(double a,double b){return fabs(a-b)<.00001;}
int main(void){
 EmWebMinimap small={512,512,16,240,144,1};double x,y;
 assert(em_web_minimap_world(small,256,183,0,&x,&y)&&near(x,768)&&near(y,1136));
 EmWebMiniRect v=em_web_minimap_view(small,608,1031,399,224);
 assert(near(v.x,6)&&near(v.y,32.4375)&&near(v.w,24.9375)&&near(v.h,14));
 EmWebMiniRect moved=em_web_minimap_view(small,672,999,399,224);assert(near(moved.x-v.x,4)&&near(moved.y-v.y,-2));
 EmWebMinimap full={0,0,32,240,144,1};assert(em_web_minimap_world(full,264,179,0,&x,&y)&&near(x,768)&&near(y,1120));
 assert(!em_web_minimap_world(small,239,170,0,&x,&y));assert(em_web_minimap_world(small,100,300,1,&x,&y)&&near(x,512)&&y<1536);
 v=em_web_minimap_view(small,400,400,1300,1300);assert(near(v.x,0)&&near(v.y,0)&&near(v.w,64)&&near(v.h,64));
 small.visible=0;assert(!em_web_minimap_world(small,256,183,0,&x,&y));
 puts("PASS minimap native mission origins,16/32 scale, view rectangles, clipped dragging, invisible map");return 0;
}
