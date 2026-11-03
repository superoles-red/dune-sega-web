/* Browser camera/input adapter only; no native game-state or instruction edits.
   Include after em_web_host.h, before em_web_selection.h. */
#ifndef DUNE_EM_WEB_CAMERA_H
#define DUNE_EM_WEB_CAMERA_H
#include <math.h>
#include <stdint.h>

typedef struct {
    double css_width,css_height,output_width,output_height;
    double left,top,scale;
} EmWebCameraProjection;

static double em_camera_clamp(double value,double low,double high) {
    if(low>high)return (low+high)*0.5;
    return value<low?low:value>high?high:value;
}
static int em_camera_project(const EmWebCameraProjection *p,double x,double y,
                             double *wx,double *wy) {
    if(!isfinite(x)||!isfinite(y)||p->css_width<=0||p->css_height<=0||p->scale<=0||
       x<0||y<0||x>=p->css_width||y>=p->css_height)return 0;
    *wx=p->left+x*p->output_width/p->css_width/p->scale;
    *wy=p->top+y*p->output_height/p->css_height/p->scale;
    return 1;
}
static double em_camera_pan_axis(double camera,double delta_css,double css_size,
                                 double output_size,double scale,double low,double high) {
    if(css_size<=0||scale<=0||!isfinite(delta_css))return camera;
    return em_camera_clamp(camera-delta_css*output_size/css_size/scale,low,high);
}
static double em_camera_anchor_shift(double drawable_anchor,double old_left,double old_scale,
                                     double next_left,double next_scale) {
    return old_left+drawable_anchor/old_scale-next_left-drawable_anchor/next_scale;
}
/* Native bounds are for a 320x224 viewport; keep the expanded presentation
   inside that same mission rectangle. When the view is larger, centre it. */
static void em_camera_bounds(double native_min,double native_max,int native_size,
                              int world_size,double *low,double *high) {
    int half=world_size/2;
    *low=native_min+half-native_size/2;
    *high=native_max+native_size/2-(world_size-half);
    if(*low>*high)*low=*high=(*low+*high)*0.5;
}

#ifndef EM_WEB_CAMERA_ONLY
#define EM_WEB_WORLD_INTENT_REBASE_TOKEN ((uint64_t)em_host.origin_counter)
#include "em_web_world_intent.h"
#include <emscripten.h>
#include <emscripten/html5.h>
static double em_camera_x,em_camera_y,em_camera_zoom;
static int em_camera_valid,em_camera_last_x,em_camera_last_y,em_camera_last_zoom;
static int em_camera_drag_world,em_camera_minimap_active;
static double em_camera_query_x,em_camera_query_y;

static int em_web_camera_geometry(EmWebCameraProjection *projection,DuneLayout *layout,
                                  int *window_w,int *window_h) {
    if(!em_window||!em_host.window||!em_host.renderer||!em_cpu.vdp.frame_width||!em_cpu.vdp.frame_height)return 0;
    int w,h;SDL_GetWindowSize(em_host.window,window_w,window_h);
    if(*window_w<=0||*window_h<=0||SDL_GetRendererOutputSize(em_host.renderer,&w,&h)||w<=0||h<=0)return 0;
    double css_w=0,css_h=0;
    if(emscripten_get_element_css_size("#canvas",&css_w,&css_h)!=EMSCRIPTEN_RESULT_SUCCESS||css_w<=0||css_h<=0){css_w=*window_w;css_h=*window_h;}
    *layout=dune_view_map(&em_cpu)?dune_view_host_layout(&em_host,&em_cpu,w,h):
        dune_view_layout(&em_cpu,w,h,em_host.dune_view.zoom?em_host.dune_view.zoom:100);
    *projection=(EmWebCameraProjection){css_w,css_h,w,h,layout->left,layout->top,layout->world_scale};
    return 1;
}

/* CSS-local coordinates. Return 1 world, 2 native UI/menu, 0 outside/invalid.
   Classification reuses the native HUD alpha hit test; it queues no input. */
static int em_web_camera_query(double x,double y,double *world_x,double *world_y,
                               int *native_x,int *native_y) {
    EmWebCameraProjection projection;DuneLayout layout;int ww,wh;
    if(!em_web_camera_geometry(&projection,&layout,&ww,&wh)||!isfinite(x)||!isfinite(y)||
       x<0||y<0||x>=projection.css_width||y>=projection.css_height)return 0;
    int world=0;
    int mx=(int)(x*ww/projection.css_width),my=(int)(y*wh/projection.css_height);
    if(!dune_view_mouse(&em_host,&em_cpu,mx,my,native_x,native_y,&world))return 0;
    if(!world)return 2;
    if(!em_camera_project(&projection,x,y,world_x,world_y))return 0;
    return *world_x>=0&&*world_y>=0&&*world_x<2048&&*world_y<2048?1:0;
}

static int em_web_camera_screen_world(double x,double y,double *wx,double *wy) {
    int nx,ny;return em_web_camera_query(x,y,wx,wy,&nx,&ny)==1;
}

EMSCRIPTEN_KEEPALIVE int dune_web_gesture_query(double x,double y) {
    int nx,ny;double wx=NAN,wy=NAN;
    int context=em_web_camera_query(x,y,&wx,&wy,&nx,&ny);
    em_camera_query_x=context==1?wx:NAN;em_camera_query_y=context==1?wy:NAN;
    return context;
}
EMSCRIPTEN_KEEPALIVE double dune_web_world_x(void) {return em_camera_query_x;}
EMSCRIPTEN_KEEPALIVE double dune_web_world_y(void) {return em_camera_query_y;}

static void em_web_camera_sync(void) {
    DuneView *v=&em_host.dune_view;
    if(!v->camera_valid) {
        v->camera_x=dune_word(&em_cpu,0xe3ec);v->camera_y=dune_word(&em_cpu,0xe3ee);
        v->camera_valid=1;
        em_camera_valid=0;
    }
    if(!em_camera_valid||v->camera_x!=em_camera_last_x||v->camera_y!=em_camera_last_y||
       (int)v->zoom!=em_camera_last_zoom) {
        em_camera_x=v->camera_x;em_camera_y=v->camera_y;
        em_camera_zoom=v->zoom?v->zoom:100;em_camera_valid=1;
    }
}
static void em_web_camera_publish(double x,double y,const DuneLayout *layout) {
    double minx,maxx,miny,maxy;
    em_camera_bounds(dune_word(&em_cpu,0xe400),dune_word(&em_cpu,0xe402),320,layout->world_width,&minx,&maxx);
    em_camera_bounds(dune_word(&em_cpu,0xe3fc),dune_word(&em_cpu,0xe3fe),224,layout->world_height,&miny,&maxy);
    em_camera_x=em_camera_clamp(x,minx,maxx);em_camera_y=em_camera_clamp(y,miny,maxy);
    DuneView *v=&em_host.dune_view;
    v->camera_x=(int)lround(em_camera_x);v->camera_y=(int)lround(em_camera_y);
    v->camera_valid=1;v->last_camera_x=dune_word(&em_cpu,0xe3ec);v->last_camera_y=dune_word(&em_cpu,0xe3ee);
    v->pointer_valid=0;v->frame=UINT64_MAX;v->pan_frame=em_cpu.vdp.rendered_frames;
    em_host.dune_mouse.camera_hold=1;em_host.dune_mouse.pan_x=em_host.dune_mouse.pan_y=0;
    em_camera_last_x=v->camera_x;em_camera_last_y=v->camera_y;em_camera_last_zoom=v->zoom;
    em_host.last_frame=UINT64_MAX;
}

/* Begin/pan/end never enqueue A/B/C. The JS gesture recognizer calls tap only
   after a short release; dragging a unit therefore cannot issue an order. */
EMSCRIPTEN_KEEPALIVE int dune_web_begin(double x,double y) {
    em_camera_drag_world=0;
    if(em_host.paused||em_host.stopped||!dune_view_map(&em_cpu))return 0;
    double wx,wy;if(!em_web_camera_screen_world(x,y,&wx,&wy))return 0;
    em_web_camera_sync();em_camera_drag_world=1;
    em_host.dune_mouse.camera_hold=1;em_host.dune_mouse.pan_x=em_host.dune_mouse.pan_y=0;
    em_host.dune_view.pointer_valid=0;
    return 1;
}
EMSCRIPTEN_KEEPALIVE void dune_web_end(void) {em_camera_drag_world=0;em_camera_minimap_active=0;}

EMSCRIPTEN_KEEPALIVE int dune_web_pan(double dx,double dy) {
    if(!em_camera_drag_world||em_host.paused||em_host.stopped||!dune_view_map(&em_cpu))return 0;
    EmWebCameraProjection p;DuneLayout layout;int ww,wh;
    if(!em_web_camera_geometry(&p,&layout,&ww,&wh))return 0;
    em_web_camera_sync();
    double x=em_camera_pan_axis(em_camera_x,dx,p.css_width,p.output_width,p.scale,-1e9,1e9);
    double y=em_camera_pan_axis(em_camera_y,dy,p.css_height,p.output_height,p.scale,-1e9,1e9);
    em_web_camera_publish(x,y,&layout);return 1;
}

/* factor is incremental pinch distance ratio or wheel scale multiplier.
   The drawable point under anchor stays fixed except at mission bounds. */
EMSCRIPTEN_KEEPALIVE int dune_web_zoom(double factor,double anchor_x,double anchor_y) {
    if(!isfinite(factor)||factor<=0||em_host.paused||em_host.stopped||!dune_view_map(&em_cpu))return 0;
    double wx,wy;if(!em_web_camera_screen_world(anchor_x,anchor_y,&wx,&wy))return 0;
    EmWebCameraProjection old;DuneLayout before;int ww,wh;
    if(!em_web_camera_geometry(&old,&before,&ww,&wh))return 0;
    em_web_camera_sync();em_camera_zoom=em_camera_clamp(em_camera_zoom*factor,50,100);
    int zoom=(int)lround(em_camera_zoom);
    if(zoom==(int)em_host.dune_view.zoom)return zoom;
    em_host.dune_view.zoom=(unsigned)zoom;
    DuneLayout next=dune_view_host_layout(&em_host,&em_cpu,(int)old.output_width,(int)old.output_height);
    double px=anchor_x*old.output_width/old.css_width,py=anchor_y*old.output_height/old.css_height;
    double dx=em_camera_anchor_shift(px,before.left,before.world_scale,next.left,next.world_scale);
    double dy=em_camera_anchor_shift(py,before.top,before.world_scale,next.top,next.world_scale);
    em_web_camera_publish(em_camera_x+dx,em_camera_y+dy,&next);return zoom;
}

static int em_web_minimap_center(double nx,double ny,int clamp){
    double wx,wy;EmWebMinimap m=em_web_native_minimap(&em_cpu);
    if(!em_web_minimap_world(m,nx,ny,clamp,&wx,&wy))return 0;
    EmWebCameraProjection p;DuneLayout l;int w,h;
    if(!em_web_camera_geometry(&p,&l,&w,&h))return 0;
    em_web_camera_sync();em_web_camera_publish(wx-160,wy-112,&l);return 1;
}
EMSCRIPTEN_KEEPALIVE int dune_web_minimap_begin(double x,double y){
    em_camera_minimap_active=0;
    if(!dune_view_map(&em_cpu)||em_host.paused||em_host.stopped)return 0;
    int nx,ny;double wx,wy;
    if(em_web_camera_query(x,y,&wx,&wy,&nx,&ny)!=2||!em_web_minimap_center(nx,ny,0))return 0;
    em_camera_minimap_active=1;return 1;
}
EMSCRIPTEN_KEEPALIVE int dune_web_minimap_move(double x,double y){
    if(!em_camera_minimap_active||!dune_view_map(&em_cpu)||em_host.paused||em_host.stopped)return 0;
    EmWebCameraProjection p;DuneLayout l;int w,h;
    if(!em_web_camera_geometry(&p,&l,&w,&h))return 0;
    double px=x*p.output_width/p.css_width,py=y*p.output_height/p.css_height;
    double nx=(px-(p.output_width-320*l.ui_scale))/l.ui_scale;
    double ny=(py-(p.output_height-224*l.ui_scale))/l.ui_scale;
    return em_web_minimap_center(nx,ny,1);
}

EMSCRIPTEN_KEEPALIVE int dune_web_tap_screen(double x,double y) {
    if(!em_window||em_host.paused||em_host.stopped)return 0;
    int nx,ny;double wx,wy;int context=em_web_camera_query(x,y,&wx,&wy,&nx,&ny);
    if(!context)return 0;
    if(context==2 && dune_view_map(&em_cpu) && em_web_minimap_center(nx,ny,0))return 3;
    em_host.dune_view.pointer_valid=0;
    em_host.dune_mouse.pan_x=em_host.dune_mouse.pan_y=0;
    if(context==1){if(!em_web_world_intent_queue(&em_host.dune_mouse,&em_cpu,(int)wx,(int)wy))return 0;}
    else dune_mouse_click(&em_host.dune_mouse,&em_cpu,nx,ny,DUNE_CLICK_SELECT);
    em_host.dune_mouse.camera_hold=1;
    return context;
}

/* Pointer positioning only: the original placement preview/menu highlight is
   updated through its existing adapter, with no A/B/C edge or queued click. */
EMSCRIPTEN_KEEPALIVE int dune_web_hover_screen(double x,double y) {
    if(!em_window||em_host.paused||em_host.stopped||em_camera_drag_world)return 0;
    int nx,ny;double wx,wy;int context=em_web_camera_query(x,y,&wx,&wy,&nx,&ny);
    if(!context)return 0;
    EmWebCameraProjection p;DuneLayout layout;int ww,wh;
    if(!em_web_camera_geometry(&p,&layout,&ww,&wh))return 0;
    em_host.dune_view.pointer_valid=1;
    em_host.dune_view.pointer_x=(int)(x*ww/p.css_width);
    em_host.dune_view.pointer_y=(int)(y*wh/p.css_height);
    if(context==1)dune_mouse_world_point(&em_host.dune_mouse,&em_cpu,(int)wx,(int)wy);
    else dune_mouse_point(&em_host.dune_mouse,&em_cpu,nx,ny);
    em_host.dune_mouse.camera_hold=1;
    em_host.dune_mouse.pan_x=em_host.dune_mouse.pan_y=0;
    return context;
}

EMSCRIPTEN_KEEPALIVE const char *dune_web_portrait_debug(void){
    static char report[1600];EmWebCameraProjection p;DuneLayout l;int w,h;
    if(!em_web_camera_geometry(&p,&l,&w,&h))return "{}";
    EmWebPortraitLayout portrait;
    if(!em_web_portrait_layout(dune_mouse_context(&em_cpu),p.css_width,p.css_height,p.output_width,p.output_height,&portrait))return "{\"active\":false}";
    int n=snprintf(report,sizeof report,"{\"active\":true,\"regions\":[");
    for(int i=0;i<portrait.count;++i){EmWebPortraitRegion *r=&portrait.regions[i];n+=snprintf(report+n,sizeof(report)-n,"%s{\"nativeX\":%d,\"nativeY\":%d,\"nativeWidth\":%d,\"nativeHeight\":%d,\"x\":%.4f,\"y\":%.4f,\"width\":%.4f,\"height\":%.4f,\"scale\":%.6f}",i?",":"",r->src.x,r->src.y,r->src.w,r->src.h,r->css.x,r->css.y,r->css.w,r->css.h,r->scale);}
    snprintf(report+n,sizeof(report)-n,"]}");return report;
}

EMSCRIPTEN_KEEPALIVE const char *dune_web_camera_debug(void) {
    static char report[1800];EmWebCameraProjection p;DuneLayout layout;int ww,wh;
    if(!em_web_camera_geometry(&p,&layout,&ww,&wh))return "{}";
    EmWebMinimap m=em_web_native_minimap(&em_cpu);
    EmWebMiniRect r=em_web_minimap_view(m,layout.left,layout.top,layout.world_width,layout.world_height);
    double sx=p.css_width/p.output_width,sy=p.css_height/p.output_height;
    double mx=(p.output_width-320*layout.ui_scale+m.x*layout.ui_scale)*sx;
    double my=(p.output_height-224*layout.ui_scale+m.y*layout.ui_scale)*sy;
    double msx=layout.ui_scale*sx,msy=layout.ui_scale*sy;
    snprintf(report,sizeof report,"{\"cameraX\":%d,\"cameraY\":%d,\"nativeCameraX\":%u,\"nativeCameraY\":%u,\"zoom\":%u,\"left\":%d,\"top\":%d,\"worldWidth\":%d,\"worldHeight\":%d,\"scale\":%.8f,\"scaleY\":%.8f,\"drawableScale\":%.8f,\"width\":%.3f,\"height\":%.3f,\"cssWidth\":%.3f,\"cssHeight\":%.3f,\"outputWidth\":%.3f,\"outputHeight\":%.3f,\"map\":%d,\"context\":%d,\"queuedClicks\":%u,\"uiX\":%.4f,\"uiY\":%.4f,\"uiScale\":%.6f,\"cursorHidden\":%d,\"minimap\":{\"visible\":%d,\"x\":%.4f,\"y\":%.4f,\"width\":%.4f,\"height\":%.4f,\"viewX\":%.4f,\"viewY\":%.4f,\"viewWidth\":%.4f,\"viewHeight\":%.4f,\"originX\":%.1f,\"originY\":%.1f,\"units\":%.1f}}",em_host.dune_view.camera_x,em_host.dune_view.camera_y,dune_word(&em_cpu,0xe3ec),dune_word(&em_cpu,0xe3ee),em_host.dune_view.zoom,layout.left,layout.top,layout.world_width,layout.world_height,p.scale*sx,p.scale*sy,p.scale,p.css_width,p.css_height,p.css_width,p.css_height,p.output_width,p.output_height,!!dune_view_map(&em_cpu),dune_mouse_active(&em_host.dune_mouse,&em_cpu),em_host.dune_mouse.count,layout.ui_x*sx,layout.ui_y*sy,msx,em_host.dune_view.cursor_hidden,!!(dune_view_map(&em_cpu)&&m.visible),mx,my,64*msx,64*msy,mx+r.x*msx,my+r.y*msy,r.w*msx,r.h*msy,m.origin_x,m.origin_y,m.units);
    return report;
}
#endif
#endif
