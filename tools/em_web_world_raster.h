/* Exact-pixel expanded-map RGBA compositor. Native VDP RGB exports remain
 * unchanged. Every presentation pixel has the same RGB plus opaque alpha.
 * The original sprite replay still runs
 * once for each 256x192 chunk, before this helper. Tile descriptors are reused
 * only until the next 8px world boundary. A bounded RGB-row cache compares
 * actual pattern bytes/attributes and the full replayed palette, never dirty
 * flags or assumed unchanged map/VRAM state.
 * dune_view_terrain and dune_view_rgb remain the unchanged reference oracle. */
#ifndef DUNE_EM_WEB_WORLD_RASTER_H
#define DUNE_EM_WEB_WORLD_RASTER_H
#include "em_web_tile_row.h"
typedef struct {
    uint32_t rgba[3][64];
    unsigned backdrop;
    int shadow;
} EmWebWorldPalette;

static void em_web_world_palette(EmWebWorldPalette *palette,const VDP *v){
    palette->backdrop=v->registers[7]&63;
    palette->shadow=!!(v->registers[12]&8);
    for(unsigned intensity=0;intensity<3;++intensity)for(unsigned color=0;color<64;++color){
        unsigned rgb=v->cram[color];
        /* Construct RGBA bytes, then copy their native-endian representation.
         * This matches SDL_PIXELFORMAT_RGBA32 without endian assumptions. */
        uint8_t bytes[4]={vdp_channel((rgb>>1)&7,intensity),
            vdp_channel((rgb>>5)&7,intensity),vdp_channel((rgb>>9)&7,intensity),255};
        memcpy(&palette->rgba[intensity][color],bytes,4);
    }
}

typedef struct {
    unsigned a,b,aa,ba;
    uint8_t valid;
    uint32_t rgba[8];
} EmWebTerrainRow;
typedef struct {
    EmWebTerrainRow rows[256];
    EmWebWorldPalette palette;
    int initialized;
} EmWebTerrainCache;
_Static_assert(sizeof(EmWebTerrainCache)<=16384,"bounded presentation row cache");

static EmWebTerrainCache *em_web_terrain_cache(const EmWebWorldPalette *palette){
    static EmWebTerrainCache cache;
    /* Replayed shadow palettes can differ from the live source and between
     * chunks. Compare every RGB level, backdrop and shadow mode before reuse. */
    if(!cache.initialized || cache.palette.backdrop!=palette->backdrop ||
       cache.palette.shadow!=palette->shadow ||
       memcmp(cache.palette.rgba,palette->rgba,sizeof palette->rgba)){
        memset(cache.rows,0,sizeof cache.rows);cache.palette=*palette;cache.initialized=1;
    }
    return &cache;
}
static const uint32_t *em_web_terrain_row(EmWebTerrainCache *cache,
                                       const EmWebWorldPalette *palette,
                                       const EmWebTileRow *a,const EmWebTileRow *b){
    unsigned aa=a->ink|(a->empty<<8)|(a->flip<<16),ba=b->ink|(b->empty<<8)|(b->flip<<16);
    unsigned hash=a->bits^(b->bits*33u)^(aa*65599u)^(ba*31u);
    hash^=hash>>16;hash^=hash>>8;
    EmWebTerrainRow *row=&cache->rows[hash&255];
    if(!row->valid || row->a!=a->bits || row->b!=b->bits || row->aa!=aa || row->ba!=ba){
        row->valid=1;row->a=a->bits;row->b=b->bits;row->aa=aa;row->ba=ba;
        for(unsigned x=0;x<8;++x){
            unsigned ap=em_web_row_pixel(a,x),bp=em_web_row_pixel(b,x);
            unsigned color=palette->backdrop,intensity=1;
            if(palette->shadow){unsigned mix=vdp_shadow_pixel(ap,bp,0,color);color=mix&63;intensity=mix>>6;}
            else{
                if(bp&&!(bp&128))color=bp&63;if(ap&&!(ap&128))color=ap&63;
                if(bp&128)color=bp&63;if(ap&128)color=ap&63;
            }
            row->rgba[x]=palette->rgba[intensity][color];
        }
    }
    return row->rgba;
}

static void em_web_world_black(uint8_t*pixels,unsigned count){
    uint8_t bytes[4]={0,0,0,255};uint32_t black;memcpy(&black,bytes,4);
    for(unsigned x=0;x<count;++x)memcpy(pixels+(size_t)x*4,&black,4);
}
static void em_web_world_row(const CPU *c,const EmWebWorldPalette *palette,EmWebTerrainCache *cache,
                             int left,int wy,unsigned width,
                             const uint8_t *sprites,uint8_t *pixels){
    if(wy<0||wy>=2048){em_web_world_black(pixels,width);return;}
    for(unsigned x=0;x<width;){
        int64_t wx=(int64_t)left+x;
        if(wx<0){
            uint64_t distance=(uint64_t)-wx;
            unsigned count=distance<width-x?(unsigned)distance:width-x;
            em_web_world_black(pixels+(size_t)x*4,count);x+=count;continue;
        }
        if(wx>=2048){em_web_world_black(pixels+(size_t)x*4,width-x);return;}
        unsigned sx=(unsigned)wx;
        unsigned map=0x7d9c+(((unsigned)wy/32)*64+sx/32)*4,word=dune_word(c,map);
        unsigned cell=(((unsigned)wy&31)/8)*8+((sx&31)/8)*2,overlay=(word>>8)&254;
        if(c->ram[0xc198]&&overlay>=0x67)overlay=0;
        unsigned ae=dune_view_rom_word(c,0x4adf0+overlay*16+cell);
        unsigned be=dune_view_rom_word(c,0x4adf0+(word&511)*32+cell);
        unsigned count=8-(sx&7);if(count>width-x)count=width-x;
        EmWebTileRow ar=em_web_tile_row(&c->vdp,ae,(unsigned)wy&7),br=em_web_tile_row(&c->vdp,be,(unsigned)wy&7);
        unsigned any_sprite=0;for(unsigned i=0;i<count;++i)any_sprite|=sprites[x+i];
        if(!any_sprite){
            const uint32_t *rgba=em_web_terrain_row(cache,palette,&ar,&br);
            uint8_t *out=pixels+(size_t)x*4;
            /* Full tile runs dominate the map. A literal 32-byte copy stays
             * inline in WASM; the clipped edge alone needs a variable copy. */
            if(count==8)memcpy(out,rgba,32);
            else memcpy(out,rgba+(sx&7),(size_t)count*4);
            x+=count;continue;
        }
        for(unsigned i=0;i<count;++i){
            unsigned a=em_web_row_pixel(&ar,(sx+i)&7);
            unsigned b=em_web_row_pixel(&br,(sx+i)&7);
            unsigned s=sprites[x+i],color=palette->backdrop,intensity=1;
            if(palette->shadow){unsigned mixed=vdp_shadow_pixel(a,b,s,color);color=mixed&63;intensity=mixed>>6;}
            else{
                if(b&&!(b&128))color=b&63;if(a&&!(a&128))color=a&63;
                if(s&&!(s&128))color=s&63;if(b&128)color=b&63;
                if(a&128)color=a&63;if(s&128)color=s&63;
            }
            uint32_t rgba=palette->rgba[intensity][color];
            memcpy(pixels+(size_t)(x+i)*4,&rgba,4);
        }
        x+=count;
    }
}

static void em_web_world_raster_chunk(const CPU *c,const VDP *shadow,
                                     int left,int top,unsigned width,unsigned height,
                                     const uint8_t *sprites,size_t sprite_stride,
                                     uint8_t *pixels,size_t pixel_stride){
    EmWebWorldPalette palette;em_web_world_palette(&palette,shadow);
    EmWebTerrainCache *cache=em_web_terrain_cache(&palette);
    for(unsigned y=0;y<height;++y)
        em_web_world_row(c,&palette,cache,left,top+(int)y,width,
                         sprites+(size_t)y*sprite_stride,pixels+(size_t)y*pixel_stride);
}
#endif
