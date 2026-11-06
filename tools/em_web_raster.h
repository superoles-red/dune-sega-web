/* Read-only VDP snapshot compositor. Reuse one original name-table entry for
 * each tile run; never cache VRAM, palette or scroll state across renders.
 * vdp_render_pixels_reference is the unchanged original pixel renderer.
 * Original machine instructions, VDP timing and sprite traversal are intact. */
#ifndef DUNE_EM_WEB_RASTER_H
#define DUNE_EM_WEB_RASTER_H
#include "em_web_tile_row.h"
typedef struct {
    unsigned columns,x_mask,y_mask,base,scroll_base,scroll_mode,column_scroll;
} EmWebRasterPlane;
static EmWebRasterPlane em_web_raster_plane(const VDP*v,unsigned plane){
    unsigned wm=v->registers[16]&3,hm=(v->registers[16]>>4)&3;
    unsigned columns=32u<<(wm==3?2:wm),rows=32u<<(hm==3?2:hm);
    return (EmWebRasterPlane){columns,columns*8-1,rows*8-1,
        plane?(v->registers[4]&7)<<13:(v->registers[2]&0x38)<<10,
        ((v->registers[13]&0x3f)<<10)+plane*2,
        v->registers[11]&3,v->registers[11]&4};
}
static void em_web_raster_plane_row(const VDP*v,const EmWebRasterPlane*p,
                                   unsigned plane,unsigned y,unsigned first,
                                   unsigned end,uint8_t*out){
    unsigned row=p->scroll_mode==3?y:p->scroll_mode==2?y&~7u:0;
    unsigned hscroll=vdp_word(v,p->scroll_base+row*4)&0x3ff;
    unsigned fixed_sy=(y+(v->vsram[plane]&0x7ff))&p->y_mask;
    for(unsigned x=first;x<end;){
        unsigned sy=fixed_sy;
        if(p->column_scroll){
            unsigned column=(x/16)*2+plane;
            sy=(y+(column<40?v->vsram[column]&0x7ff:0))&p->y_mask;
        }
        unsigned sx=(x-hscroll)&p->x_mask;
        unsigned at=p->base+((sy/8)*p->columns+sx/8)*2;
        unsigned entry=vdp_word(v,at),run=8-(sx&7);
        if(p->column_scroll&&run>16-(x&15))run=16-(x&15);
        if(run>end-x)run=end-x;
        EmWebTileRow tile=em_web_tile_row(v,entry,sy&7);
        for(unsigned i=0;i<run;++i)
            out[x+i]=(uint8_t)em_web_row_pixel(&tile,(sx+i)&7);
        x+=run;
    }
}
static void em_web_raster_window_row(const VDP*v,unsigned y,unsigned first,
                                    unsigned end,int h40,uint8_t*out){
    unsigned base=(v->registers[3]&(h40?0x3c:0x3e))<<10;
    unsigned row=(y/8)*(h40?64:32);
    for(unsigned x=first;x<end;){
        unsigned entry=vdp_word(v,base+(row+x/8)*2),run=8-(x&7);
        if(run>end-x)run=end-x;
        EmWebTileRow tile=em_web_tile_row(v,entry,y&7);
        for(unsigned i=0;i<run;++i)
            out[x+i]=(uint8_t)em_web_row_pixel(&tile,(x+i)&7);
        x+=run;
    }
}
static void vdp_render_pixels(VDP*v,unsigned width,unsigned height,
                               const uint8_t*sprites,uint8_t*frame){
    /* The native video path is H32/H40. Keep the complete original behavior
     * for any wider diagnostic caller without increasing the row buffers. */
    if(width>320){vdp_render_pixels_reference(v,width,height,sprites,frame);return;}
    uint8_t palette[3][64][3],a_row[320],b_row[320];
    for(unsigned intensity=0;intensity<3;++intensity)for(unsigned color=0;color<64;++color){
        unsigned rgb=v->cram[color];
        palette[intensity][color][0]=vdp_channel((rgb>>1)&7,intensity);
        palette[intensity][color][1]=vdp_channel((rgb>>5)&7,intensity);
        palette[intensity][color][2]=vdp_channel((rgb>>9)&7,intensity);
    }
    unsigned backdrop=v->registers[7]&63;
    int enabled=v->registers[1]&0x40,shadow=v->registers[12]&8,h40=width==320;
    EmWebRasterPlane a=em_web_raster_plane(v,0),b=em_web_raster_plane(v,1);
    unsigned horizontal=(v->registers[17]&31)*16,vertical=(v->registers[18]&31)*8;
    unsigned split=horizontal<width?horizontal:width;
    for(unsigned y=0;y<height;++y){
        if(enabled){
            em_web_raster_plane_row(v,&b,1,y,0,width,b_row);
            int window_y=(v->registers[18]&0x80)?y>=vertical:y<vertical;
            if(window_y)em_web_raster_window_row(v,y,0,width,h40,a_row);
            else if(v->registers[17]&0x80){
                em_web_raster_plane_row(v,&a,0,y,0,split,a_row);
                em_web_raster_window_row(v,y,split,width,h40,a_row);
            }else{
                em_web_raster_window_row(v,y,0,split,h40,a_row);
                em_web_raster_plane_row(v,&a,0,y,split,width,a_row);
            }
        }
        for(unsigned x=0;x<width;++x){
            unsigned color=backdrop,intensity=1;
            if(enabled){
                unsigned ap=a_row[x],bp=b_row[x],sp=sprites[(size_t)y*width+x];
                if(shadow){unsigned mixed=vdp_shadow_pixel(ap,bp,sp,color);color=mixed&63;intensity=mixed>>6;}
                else{
                    if(bp&&!(bp&128))color=bp&63;
                    if(ap&&!(ap&128))color=ap&63;
                    if(sp&&!(sp&128))color=sp&63;
                    if(bp&128)color=bp&63;
                    if(ap&128)color=ap&63;
                    if(sp&128)color=sp&63;
                }
            }
            const uint8_t*rgb=palette[intensity][color];size_t offset=((size_t)y*width+x)*3;
            frame[offset]=rgb[0];frame[offset+1]=rgb[1];frame[offset+2]=rgb[2];
        }
    }
}
#endif
