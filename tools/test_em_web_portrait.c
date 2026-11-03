/* Portable geometry regression; no SDL, browser, ROM or generated art. */
#include "em_web_portrait.h"
#include <assert.h>
#include <stdio.h>

static int close_to(double a,double b){return fabs(a-b)<1e-7;}
static void phone(double width,double height,double dpr_x,double dpr_y) {
    for(int context=2;context<=3;++context) {
        EmWebPortraitLayout p;
        assert(em_web_portrait_layout(context,width,height,width*dpr_x,height*dpr_y,&p));
        assert(p.active&&p.count==3&&p.gap==0);
        const EmWebPortraitRegion *resources=&p.regions[EM_WEB_PORTRAIT_RESOURCES];
        const EmWebPortraitRegion *screen=&p.regions[EM_WEB_PORTRAIT_SCREEN];
        const EmWebPortraitRegion *bottom=&p.regions[EM_WEB_PORTRAIT_COMMANDS];
        assert(resources->src.x==136&&resources->src.y==116&&resources->src.w==184&&resources->src.h==108);
        assert(screen->src.x==136&&screen->src.y==0&&screen->src.w==184&&screen->src.h==120);
        assert(bottom->src.x==24&&bottom->src.y==40&&bottom->src.w==112&&bottom->src.h==160);
        assert(close_to(bottom->css.y+bottom->css.h,height));
        assert(resources->css.x>=0&&resources->css.y>=0&&bottom->css.x>=0);
        assert(close_to(resources->css.y,screen->css.y)&&close_to(resources->css.h,screen->css.h));
        assert(close_to(resources->css.x+resources->css.w,screen->css.x));
        assert(close_to(resources->css.x,bottom->css.x));
        assert(close_to(screen->css.x+screen->css.w,bottom->css.x+bottom->css.w));
        assert(close_to(resources->css.y+resources->css.h,bottom->css.y));
        assert(close_to(screen->css.y+screen->css.h,bottom->css.y));
        assert(close_to(resources->css.w/resources->src.w,resources->css.h/resources->src.h));
        assert(close_to(screen->css.w/screen->src.w,screen->css.h/screen->src.h));
        assert(close_to(bottom->css.w/bottom->src.w,bottom->css.h/bottom->src.h));
        assert(24*bottom->scale>=40-1e-7&&32*bottom->scale>=40-1e-7);
        assert(close_to(screen->dst.w/screen->css.w,dpr_x)&&close_to(screen->dst.h/screen->css.h,dpr_y));
        /* Every cell of the original 3x6 production grid (or 3x4 Starport)
         * reaches its original row/column, independently of screen density.
         */
        for(int row=0;row<(context==3?4:6);++row)for(int col=0;col<3;++col) {
            int native_x=48+32*col,native_y=60+24*row,x=-1,y=-1;
            double sx=bottom->css.x+(native_x-bottom->src.x+0.5)*bottom->scale;
            double sy=bottom->css.y+(native_y-bottom->src.y+0.5)*bottom->scale;
            assert(em_web_portrait_css_hit(&p,sx,sy,&x,&y));
            assert(x==native_x&&y==native_y&&(x-32)/32==col&&(y-48)/24==row);
            assert(em_web_portrait_hit(&p,sx*dpr_x,sy*dpr_y,&x,&y));
            assert(x==native_x&&y==native_y);
        }
        /* Every icon/bar/knob, including the rightmost decorations, remains
         * present. Picture, title and credits use the separate right panel.
         */
        const int points[][3]={{EM_WEB_PORTRAIT_SCREEN,272,24},{EM_WEB_PORTRAIT_SCREEN,200,64},
            {EM_WEB_PORTRAIT_SCREEN,200,108},{EM_WEB_PORTRAIT_SCREEN,260,116},
            {EM_WEB_PORTRAIT_RESOURCES,200,132},{EM_WEB_PORTRAIT_RESOURCES,200,164},
            {EM_WEB_PORTRAIT_RESOURCES,200,196},{EM_WEB_PORTRAIT_RESOURCES,140,128},
            {EM_WEB_PORTRAIT_RESOURCES,264,196},{EM_WEB_PORTRAIT_RESOURCES,296,192}};
        for(unsigned i=0;i<sizeof points/sizeof points[0];++i) {
            const EmWebPortraitRegion *top=&p.regions[points[i][0]];
            int x,y;
            double sx=top->css.x+(points[i][1]-top->src.x+0.5)*top->scale;
            double sy=top->css.y+(points[i][2]-top->src.y+0.5)*top->scale;
            assert(em_web_portrait_css_hit(&p,sx,sy,&x,&y));
            assert(x==points[i][1]&&y==points[i][2]);
        }
        int x,y;
        if(resources->css.y>1)
            assert(!em_web_portrait_css_hit(&p,width/2,resources->css.y/2,&x,&y));
        assert(!em_web_portrait_css_hit(&p,-1,0,&x,&y));
        assert(!em_web_portrait_css_hit(&p,width,height,&x,&y));
        assert(!em_web_portrait_css_hit(&p,NAN,5,&x,&y));
        if(bottom->css.x>1)assert(!em_web_portrait_css_hit(&p,0,height-1,&x,&y));
        assert(!em_web_portrait_css_hit(&p,bottom->css.x+bottom->css.w,height-1,&x,&y));
    }
}
int main(void) {
    const double sizes[][2]={{320,480},{320,568},{375,667},{390,844},{430,932},{768,1024},{820,1180}};
    for(unsigned i=0;i<sizeof sizes/sizeof sizes[0];++i)
        for(int dpi=1;dpi<=3;++dpi)phone(sizes[i][0],sizes[i][1],dpi,dpi);
    phone(393.5,852.25,2.625,2.625);
    phone(375,667,2,3); /* Output density need not be assumed uniform. */
    EmWebPortraitLayout p;
    assert(!em_web_portrait_layout(2,844,390,1688,780,&p)); /* landscape untouched */
    assert(!em_web_portrait_layout(3,800,800,1600,1600,&p));
    for(int context=0;context<=7;++context)if(context!=2&&context!=3)
        assert(!em_web_portrait_layout(context,390,844,1170,2532,&p));
    assert(!em_web_portrait_layout(2,180,320,360,640,&p));
    assert(!em_web_portrait_layout(2,200,270,400,540,&p));
    assert(!em_web_portrait_layout(2,NAN,667,750,1334,&p));
    assert(!em_web_portrait_layout(2,375,667,0,1334,&p));
    assert(em_web_portrait_layout(2,375,667,750,1334,&p));
    assert(em_web_portrait_layout(2,390,844,1170,2532,&p));
    assert(close_to(p.regions[EM_WEB_PORTRAIT_COMMANDS].css.w,390));
    assert(p.regions[EM_WEB_PORTRAIT_COMMANDS].css.w>237);
    assert(close_to(p.regions[EM_WEB_PORTRAIT_COMMANDS].css.h,390.0*160/112));
    puts("PASS three native regions, equal-height aligned top row, contiguous bottom frame, full icons/bars/knobs, six command rows, larger390px command frame, DPR1/2/3, fractional/nonuniform density, context/landscape guards");
    return 0;
}
