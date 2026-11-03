/* Original production-menu presentation only. No CPU, SDL or game-state writes.
 * The draw pass and pointer pass must use this same geometry. Coordinates in
 * src are native 320x224 pixels; css and dst cover the same visible rectangle
 * in CSS pixels and renderer-output pixels respectively.
 */
#ifndef DUNE_EM_WEB_PORTRAIT_H
#define DUNE_EM_WEB_PORTRAIT_H
#include <math.h>
#include <string.h>

typedef struct {int x,y,w,h;} EmWebPortraitSource;
typedef struct {double x,y,w,h;} EmWebPortraitRect;
typedef struct {
    EmWebPortraitSource src;
    EmWebPortraitRect css,dst;
    double scale; /* CSS pixels / native pixel; equal on both axes. */
} EmWebPortraitRegion;
typedef struct {
    int active,count;
    double css_width,css_height,output_width,output_height,gap;
    EmWebPortraitRegion regions[3];
} EmWebPortraitLayout;
enum { EM_WEB_PORTRAIT_RESOURCES=0,EM_WEB_PORTRAIT_SCREEN=1,EM_WEB_PORTRAIT_COMMANDS=2 };

static double em_web_portrait_min(double a,double b){return a<b?a:b;}
static int em_web_portrait_finite_positive(double a){return isfinite(a)&&a>0;}
static void em_web_portrait_region(EmWebPortraitLayout *p,unsigned index,
                                   EmWebPortraitSource source,EmWebPortraitRect css) {
    EmWebPortraitRegion *r=&p->regions[index];
    r->src=source;r->scale=css.h/source.h;r->css=css;
    double dx=p->output_width/p->css_width,dy=p->output_height/p->css_height;
    r->dst=(EmWebPortraitRect){r->css.x*dx,r->css.y*dy,r->css.w*dx,r->css.h*dy};
}

/* 0 leaves the original landscape/other-menu path in charge. Very small
 * surfaces that cannot contain the native command frame with 40-CSS-pixel
 * row spacing also fall back, rather than clipping reachable commands.
 */
static int em_web_portrait_layout(int context,double css_w,double css_h,
                                  double output_w,double output_h,EmWebPortraitLayout *p) {
    if(!p)return 0;
    memset(p,0,sizeof *p);
    if((context!=2&&context!=3)||!em_web_portrait_finite_positive(css_w)||
       !em_web_portrait_finite_positive(css_h)||!em_web_portrait_finite_positive(output_w)||
       !em_web_portrait_finite_positive(output_h)||css_h<=css_w)return 0;
    /* All three crops come directly from the current native framebuffer.
     * Keep the entire lower cabinet, including its right vent/knobs: the
     * value bars end near x266, but those decorations continue past x304.
     * The four shared source chrome rows retain the screen's lower bevel
     * and the resource knob's top cap; destination regions never overlap.
     * The command crop always contains the complete six-row 3-column grid.
     */
    const EmWebPortraitSource resources={136,116,184,108},screen={136,0,184,120};
    const EmWebPortraitSource commands={24,40,112,160};
    const double minimum_scale=40.0/24.0;
    double top_aspect=(double)resources.w/resources.h+(double)screen.w/screen.h;
    double height_per_width=1/top_aspect+(double)commands.h/commands.w;
    double column_width=em_web_portrait_min(css_w,css_h/height_per_width);
    if(column_width<commands.w*minimum_scale)return 0;
    double command_height=column_width*commands.h/commands.w;
    double top_height=column_width/top_aspect;
    double group_y=css_h-command_height-top_height;
    if(group_y<0)group_y=0; /* Floating point round-off at a height-limited fit. */
    double column_x=(css_w-column_width)/2;
    double resource_width=top_height*resources.w/resources.h;
    double screen_width=column_width-resource_width;
    double commands_y=group_y+top_height;
    p->active=1;p->count=3;p->css_width=css_w;p->css_height=css_h;
    p->output_width=output_w;p->output_height=output_h;
    em_web_portrait_region(p,EM_WEB_PORTRAIT_RESOURCES,resources,
        (EmWebPortraitRect){column_x,group_y,resource_width,top_height});
    em_web_portrait_region(p,EM_WEB_PORTRAIT_SCREEN,screen,
        (EmWebPortraitRect){column_x+resource_width,group_y,screen_width,top_height});
    em_web_portrait_region(p,EM_WEB_PORTRAIT_COMMANDS,commands,
        (EmWebPortraitRect){column_x,commands_y,column_width,command_height});
    p->gap=0;
    return 1;
}

static int em_web_portrait_inside(const EmWebPortraitRect *r,double x,double y) {
    return x>=r->x&&y>=r->y&&x<r->x+r->w&&y<r->y+r->h;
}
/* Renderer-output pixels, after the existing window-to-output conversion.
 * Return 0 for every black gap, border outside the crops or outside canvas.
 * Original dune_mouse_cell() still decides which native points are buttons.
 */
static int em_web_portrait_hit_rects(const EmWebPortraitLayout *p,double x,double y,
                                     int css_coordinates,int *nx,int *ny) {
    if(!p||!p->active||!nx||!ny||!isfinite(x)||!isfinite(y)||
       x<0||y<0||x>=(css_coordinates?p->css_width:p->output_width)||
       y>=(css_coordinates?p->css_height:p->output_height))return 0;
    for(int i=0;i<p->count;++i) {
        const EmWebPortraitRegion *r=&p->regions[i];
        const EmWebPortraitRect *to=css_coordinates?&r->css:&r->dst;
        if(!em_web_portrait_inside(to,x,y))continue;
        *nx=r->src.x+(int)floor((x-to->x)*r->src.w/to->w);
        *ny=r->src.y+(int)floor((y-to->y)*r->src.h/to->h);
        /* Floating point edge rounding must not select a neighbouring crop. */
        if(*nx>=r->src.x+r->src.w)*nx=r->src.x+r->src.w-1;
        if(*ny>=r->src.y+r->src.h)*ny=r->src.y+r->src.h-1;
        return 1;
    }
    return 0;
}
static int em_web_portrait_hit(const EmWebPortraitLayout *p,double x,double y,int *nx,int *ny) {
    return em_web_portrait_hit_rects(p,x,y,0,nx,ny);
}
static int em_web_portrait_css_hit(const EmWebPortraitLayout *p,double x,double y,int *nx,int *ny) {
    return em_web_portrait_hit_rects(p,x,y,1,nx,ny);
}
#endif
