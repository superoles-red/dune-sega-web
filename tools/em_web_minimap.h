/* Shared native minimap geometry. Small scenarios use16 world px per minimap
 * pixel, full maps32, with a mission-specific origin. No game-state writes. */
#ifndef DUNE_EM_WEB_MINIMAP_H
#define DUNE_EM_WEB_MINIMAP_H
#include <math.h>
typedef struct {double origin_x,origin_y,units,x,y;int visible;} EmWebMinimap;
typedef struct {double x,y,w,h;} EmWebMiniRect;
static double em_mini_clamp(double v,double lo,double hi){return v<lo?lo:v>hi?hi:v;}
static EmWebMiniRect em_web_minimap_view(EmWebMinimap m,double left,double top,double width,double height){
    double x1=em_mini_clamp((left-m.origin_x)/m.units,0,64),y1=em_mini_clamp((top-m.origin_y)/m.units,0,64);
    double x2=em_mini_clamp((left+width-m.origin_x)/m.units,0,64),y2=em_mini_clamp((top+height-m.origin_y)/m.units,0,64);
    return (EmWebMiniRect){x1,y1,x2-x1,y2-y1};
}
static int em_web_minimap_world(EmWebMinimap m,double nx,double ny,int clamp,double *wx,double *wy){
    if(!m.visible || !isfinite(nx)||!isfinite(ny)||m.units<=0)return 0;
    double x=nx-m.x,y=ny-m.y;
    if(!clamp&&(x<0||x>=64||y<0||y>=64))return 0;
    x=em_mini_clamp(x,0,63.999);y=em_mini_clamp(y,0,63.999);
    *wx=m.origin_x+x*m.units;*wy=m.origin_y+y*m.units;return 1;
}
#endif
