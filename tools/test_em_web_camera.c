#define EM_WEB_CAMERA_ONLY
#include "em_web_camera.h"
#include <assert.h>
#include <stdio.h>

static int near(double a,double b){return fabs(a-b)<1e-8;}
int main(void) {
    for(int dpi=1;dpi<=3;++dpi) {
        EmWebCameraProjection p={800,600,800*dpi,600*dpi,512,512,2*dpi};
        double x,y;assert(em_camera_project(&p,200,150,&x,&y));
        assert(near(x,612)&&near(y,587));
        assert(near(em_camera_pan_axis(800,30,800,800*dpi,2*dpi,512,1216),785));
        assert(!em_camera_project(&p,-1,150,&x,&y));
        assert(!em_camera_project(&p,800,150,&x,&y));
    }
    double lo,hi;em_camera_bounds(512,1216,320,400,&lo,&hi);
    assert(near(lo,552)&&near(hi,1176));
    em_camera_bounds(512,1216,320,1024,&lo,&hi);assert(near(lo,864)&&near(hi,864));
    em_camera_bounds(512,1216,320,1200,&lo,&hi);assert(near(lo,864)&&near(hi,864));
    assert(near(em_camera_pan_axis(800,10000,800,1600,4,552,1176),552));
    assert(near(em_camera_pan_axis(800,-10000,800,1600,4,552,1176),1176));
    /* An off-centre anchor is preserved, including when integer world-size
       rounding changes the next layout's left/top. */
    double old_left=603,next_left=541,anchor=721,old_scale=3.0,next_scale=2.25;
    double shift=em_camera_anchor_shift(anchor,old_left,old_scale,next_left,next_scale);
    assert(near(old_left+anchor/old_scale,next_left+shift+anchor/next_scale));
    double camera=800;for(int i=0;i<30;++i)camera=em_camera_pan_axis(camera,1,900,1800,6,512,1216);
    assert(near(camera,790)); /* no lost sub-world-pixel drags */
    puts("PASS camera bounds, DPI1/2/3, finger-following pan, fractional drags and anchored zoom");
    return 0;
}
