/* Exact-pixel expanded-map compositor. The original sprite replay still runs
 * once for each 256x192 chunk, before this helper. Tile descriptors are reused
 * only until the next 8px world boundary; no VRAM/RAM/CRAM survives a chunk.
 * dune_view_terrain and dune_view_rgb remain the unchanged reference oracle. */
#ifndef DUNE_EM_WEB_WORLD_RASTER_H
#define DUNE_EM_WEB_WORLD_RASTER_H
typedef struct {
    uint8_t rgb[3][64][3];
    unsigned backdrop;
    int shadow;
} EmWebWorldPalette;

static void em_web_world_palette(EmWebWorldPalette *palette,const VDP *v){
    palette->backdrop=v->registers[7]&63;
    palette->shadow=!!(v->registers[12]&8);
    for(unsigned intensity=0;intensity<3;++intensity)for(unsigned color=0;color<64;++color){
        unsigned rgb=v->cram[color];
        palette->rgb[intensity][color][0]=vdp_channel((rgb>>1)&7,intensity);
        palette->rgb[intensity][color][1]=vdp_channel((rgb>>5)&7,intensity);
        palette->rgb[intensity][color][2]=vdp_channel((rgb>>9)&7,intensity);
    }
}

static void em_web_world_row(const CPU *c,const EmWebWorldPalette *palette,
                             int left,int wy,unsigned width,
                             const uint8_t *sprites,uint8_t *pixels){
    if(wy<0||wy>=2048){memset(pixels,0,(size_t)width*3);return;}
    for(unsigned x=0;x<width;){
        int64_t wx=(int64_t)left+x;
        if(wx<0){
            uint64_t distance=(uint64_t)-wx;
            unsigned count=distance<width-x?(unsigned)distance:width-x;
            memset(pixels+(size_t)x*3,0,(size_t)count*3);x+=count;continue;
        }
        if(wx>=2048){memset(pixels+(size_t)x*3,0,(size_t)(width-x)*3);return;}
        unsigned sx=(unsigned)wx;
        unsigned map=0x7d9c+(((unsigned)wy/32)*64+sx/32)*4,word=dune_word(c,map);
        unsigned cell=(((unsigned)wy&31)/8)*8+((sx&31)/8)*2,overlay=(word>>8)&254;
        if(c->ram[0xc198]&&overlay>=0x67)overlay=0;
        unsigned ae=dune_view_rom_word(c,0x4adf0+overlay*16+cell);
        unsigned be=dune_view_rom_word(c,0x4adf0+(word&511)*32+cell);
        unsigned count=8-(sx&7);if(count>width-x)count=width-x;
        for(unsigned i=0;i<count;++i){
            unsigned a=vdp_tile_pixel(&c->vdp,ae,(sx+i)&7,(unsigned)wy&7);
            unsigned b=vdp_tile_pixel(&c->vdp,be,(sx+i)&7,(unsigned)wy&7);
            unsigned s=sprites[x+i],color=palette->backdrop,intensity=1;
            if(palette->shadow){unsigned mixed=vdp_shadow_pixel(a,b,s,color);color=mixed&63;intensity=mixed>>6;}
            else{
                if(b&&!(b&128))color=b&63;if(a&&!(a&128))color=a&63;
                if(s&&!(s&128))color=s&63;if(b&128)color=b&63;
                if(a&128)color=a&63;if(s&128)color=s&63;
            }
            const uint8_t *rgb=palette->rgb[intensity][color];
            size_t at=(size_t)(x+i)*3;
            pixels[at]=rgb[0];pixels[at+1]=rgb[1];pixels[at+2]=rgb[2];
        }
        x+=count;
    }
}

static void em_web_world_raster_chunk(const CPU *c,const VDP *shadow,
                                     int left,int top,unsigned width,unsigned height,
                                     const uint8_t *sprites,size_t sprite_stride,
                                     uint8_t *pixels,size_t pixel_stride){
    EmWebWorldPalette palette;em_web_world_palette(&palette,shadow);
    for(unsigned y=0;y<height;++y)
        em_web_world_row(c,&palette,left,top+(int)y,width,
                         sprites+(size_t)y*sprite_stride,pixels+(size_t)y*pixel_stride);
}
#endif
