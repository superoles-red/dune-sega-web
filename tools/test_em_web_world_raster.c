/* Exact RGB/opaque-alpha oracle for expanded-map presentation. The pinned terrain/color/sprite
 * routines remain the reference; no SDL, browser, WASM or private fixture is
 * required for the deterministic synthetic cases. Optional CPU paths add
 * complete genuine expanded-world comparisons with original sprite replay. */
#define GENESIS_NO_MAIN
#include "../vendor/rearrakis/build/dune-base.c"
#include "em_web_world_raster.h"
#include <time.h>
static CPU source,before_source;
static VDP palette_vdp,before_palette;
static uint8_t synthetic_rom[0x60000];
static uint32_t seed=0x1d532cb9u;
static unsigned comparisons,genuine_images,sprite_mode;
static uint32_t random_word(void){seed^=seed<<13;seed^=seed>>17;seed^=seed<<5;return seed;}
static void require(int ok,const char *message){if(!ok){fprintf(stderr,"FAIL %s case%u seed%08x\n",message,comparisons,seed);exit(1);}}
static void put16(uint8_t *data,unsigned at,unsigned value){data[at]=(uint8_t)(value>>8);data[at+1]=(uint8_t)value;}
static void original_chunk(const CPU*c,const VDP*palette,int left,int top,
                            unsigned width,unsigned height,const uint8_t*sprites,
                            size_t sprite_stride,uint8_t*pixels,size_t pixel_stride){
    for(unsigned y=0;y<height;++y)for(unsigned x=0;x<width;++x){
        int wx=left+(int)x,wy=top+(int)y;unsigned a,b;
        dune_view_terrain(c,wx,wy,&a,&b);uint8_t*out=pixels+(size_t)y*pixel_stride+x*4;
        if(wx<0||wy<0||wx>=2048||wy>=2048)memset(out,0,3);
        else dune_view_rgb(palette,a,b,sprites[(size_t)y*sprite_stride+x],out);out[3]=255;
    }
}
static void compare_chunk(int left,int top,unsigned width,unsigned height){
    size_t pitch=(size_t)width*4+17,sprite_pitch=width+11,n=pitch*height+32,sn=sprite_pitch*height+32;
    uint8_t*reference=malloc(n),*actual=malloc(n),*sprites=malloc(sn),*sprite_before=malloc(sn);
    require(reference&&actual&&sprites&&sprite_before,"allocate guarded chunk");
    memset(reference,0xa5,n);memset(actual,0xa5,n);
    for(size_t i=0;i<sn;++i)sprites[i]=sprite_mode==1?0:sprite_mode==2?(i%17?0:(uint8_t)random_word()):(uint8_t)random_word();memcpy(sprite_before,sprites,sn);
    before_source=source;before_palette=palette_vdp;
    original_chunk(&source,&palette_vdp,left,top,width,height,sprites+16,sprite_pitch,reference+16,pitch);
    require(!memcmp(&source,&before_source,sizeof source)&&!memcmp(&palette_vdp,&before_palette,sizeof palette_vdp),"original chunk mutates no CPU/VDP input bytes");
    em_web_world_raster_chunk(&source,&palette_vdp,left,top,width,height,sprites+16,sprite_pitch,actual+16,pitch);
    if(memcmp(reference,actual,n)){
        for(size_t i=0;i<n;++i)if(reference[i]!=actual[i]){fprintf(stderr,"RGB mismatch offset%zu reference%u actual%u x%d y%d size%ux%u sourceShadow%d paletteShadow%d\n",i,reference[i],actual[i],left,top,width,height,!!(source.vdp.registers[12]&8),!!(palette_vdp.registers[12]&8));break;}
        require(0,"all chunk RGB bytes, row padding and output guards identical");
    }
    require(!memcmp(&source,&before_source,sizeof source)&&!memcmp(&palette_vdp,&before_palette,sizeof palette_vdp),"optimized chunk mutates no CPU/VDP input bytes");
    require(!memcmp(sprites,sprite_before,sn),"sprite input and guards unchanged");
    ++comparisons;free(reference);free(actual);free(sprites);free(sprite_before);
}
static void randomize(void){
    memset(&source,0,sizeof source);source.rom=synthetic_rom;source.rom_size=sizeof synthetic_rom;
    for(unsigned i=0;i<sizeof source.ram;++i)source.ram[i]=(uint8_t)random_word();
    for(unsigned i=0;i<sizeof source.vdp.vram;++i)source.vdp.vram[i]=(uint8_t)random_word();
    for(unsigned i=0;i<sizeof synthetic_rom;++i)synthetic_rom[i]=(uint8_t)random_word();
    for(unsigned i=0;i<64;++i){source.vdp.cram[i]=(uint16_t)random_word();palette_vdp.cram[i]=(uint16_t)random_word();}
    source.vdp.registers[12]=(uint8_t)random_word();palette_vdp.registers[12]=(uint8_t)random_word();palette_vdp.registers[7]=(uint8_t)random_word();
}
static void synthetic(void){
    const int xs[]={-33,-8,-1,0,1,7,8,15,31,32,33,2040,2047,2048,2055};
    const int ys[]={-9,-1,0,1,7,8,31,32,2040,2047,2048};
    const unsigned widths[]={0,1,7,8,9,15,16,31,32,33,255,256,257,511,1025};
    for(unsigned house=0;house<3;++house){
        randomize();
        // Three distinct channel-dominant banks, with all original 3-bit levels.
        for(unsigned color=0;color<64;++color)palette_vdp.cram[color]=(uint16_t)(((color%8)*2)<<(house==0?0:house==1?8:4));
        for(unsigned shadow=0;shadow<4;++shadow){
            source.vdp.registers[12]=(uint8_t)((shadow&1)?8:0);palette_vdp.registers[12]=(uint8_t)((shadow&2)?8:0);
            source.ram[0xc198]=(uint8_t)(shadow&1);
            for(unsigned i=0;i<sizeof xs/sizeof xs[0];++i)for(unsigned j=0;j<sizeof widths/sizeof widths[0];++j)
                compare_chunk(xs[i],ys[(i+j)%11],widths[j],j%3==0?0:j%3==1?1:9);
        }
    }
    puts("PASS map edges/negative coordinates, unaligned 8px/32px boundaries, widths0..1025, empty chunks, source/shadow palette independence and guarded strides");
    for(unsigned flip=0;flip<4;++flip)for(unsigned priority=0;priority<4;++priority)for(unsigned shadow=0;shadow<4;++shadow)for(unsigned fog=0;fog<2;++fog){
        memset(source.ram,0,sizeof source.ram);memset(source.vdp.vram,0,sizeof source.vdp.vram);memset(synthetic_rom,0,sizeof synthetic_rom);
        source.vdp.registers[12]=(uint8_t)((shadow&1)?8:0);palette_vdp.registers[12]=(uint8_t)((shadow&2)?8:0);source.ram[0xc198]=(uint8_t)fog;
        for(unsigned i=0;i<4096;++i)put16(source.ram,0x7d9c+i*4,0x6801);
        unsigned ae=1|(flip<<11)|((priority&1)?0x8000:0)|0x6000;
        unsigned be=2|((3-flip)<<11)|((priority&2)?0x8000:0)|0x4000;
        for(unsigned cell=0;cell<32;cell+=2){put16(synthetic_rom,0x4adf0+0x68*16+cell,ae);put16(synthetic_rom,0x4adf0+cell,ae^0x2000);put16(synthetic_rom,0x4adf0+32+cell,be);}
        for(unsigned i=0;i<32;++i){source.vdp.vram[32+i]=(uint8_t)(i%3?0x1e + i:0);source.vdp.vram[64+i]=(uint8_t)(i%4?i*11:0);}
        compare_chunk(3,5,257,9);sprite_mode=1;compare_chunk(3,5,257,9);sprite_mode=0;
    }
    puts("PASS explicit X/Y flips, plane/sprite priority, transparent high-priority tiles, shadow/highlight and C198 overlay suppression");
    randomize();for(unsigned i=0;i<128;++i)compare_chunk((int)(random_word()%2200)-80,(int)(random_word()%2200)-80,random_word()%600,random_word()%17);
    puts("PASS deterministic random source maps, ROM descriptors, VRAM patterns, separate CRAM and sprite encodings");
    // Exercise persistent RGB-row reuse with the same inputs, then vary every
    // relevant pattern/attribute/palette source while the cache remains alive.
    randomize();sprite_mode=1;
    compare_chunk(0,0,256,32);compare_chunk(0,0,256,32);
    for(unsigned i=0;i<64;++i){
        unsigned at=random_word()%sizeof source.vdp.vram;
        source.vdp.vram[at]^=(uint8_t)(1u<<(i&7));
        put16(source.ram,0x7d9c+(i%8)*4,random_word());
        source.ram[0xc198]^=1;source.vdp.registers[12]^=8;
        palette_vdp.cram[i]^=(uint16_t)(0xeee>>(i%3));
        palette_vdp.registers[7]=(uint8_t)i;palette_vdp.registers[12]^=8;
        compare_chunk((int)(i%8),0,257,33);
        sprite_mode=2;compare_chunk((int)(i%8),0,257,33);sprite_mode=1;
    }
    sprite_mode=0;
    puts("PASS repeated sprite-free row-cache hits, mixed sprite rows, live VRAM/map/C198/attribute changes, all palette levels/backdrops and shadow-mode invalidation");
    randomize();memset(source.ram,0,sizeof source.ram);memset(synthetic_rom,0,sizeof synthetic_rom);memset(source.vdp.vram,0,sizeof source.vdp.vram);
    for(unsigned i=0;i<4096;++i)put16(source.ram,0x7d9c+i*4,1);
    for(unsigned cell=0;cell<32;cell+=2){put16(synthetic_rom,0x4adf0+cell,0xa001);put16(synthetic_rom,0x4adf0+32+cell,0x4002);}
    memset(source.vdp.vram+32,0x11,32);memset(source.vdp.vram+64,0x22,32);sprite_mode=1;
    source.vdp.registers[12]=0;palette_vdp.registers[12]=0;
    compare_chunk(0,0,256,32);compare_chunk(0,0,256,32);
    source.vdp.vram[32]=0x78;compare_chunk(0,0,256,32);
    put16(synthetic_rom,0x4adf0,0xe801);compare_chunk(0,0,256,32);
    source.vdp.registers[12]=8;source.vdp.vram[32]=0;palette_vdp.registers[12]=8;compare_chunk(0,0,256,32);
    for(unsigned i=0;i<64;++i){palette_vdp.cram[i]^=0xeee;palette_vdp.registers[7]=(uint8_t)i;compare_chunk(0,0,256,32);}
    sprite_mode=2;compare_chunk(0,0,256,32);sprite_mode=0;
    puts("PASS guaranteed repeated identical terrain rows, changed referenced pattern bytes/descriptor attributes, transparent priority and every changed CRAM entry");
}
static void release_view(DuneView*v){free(v->pixels);free(v->ui);free(v->shadow);memset(v,0,sizeof *v);}
/* Only the world presentation buffer is widened. Keep the pinned original
 * outer composition as the independent RGB oracle, including all HUD bytes
 * and the rare completed-native-frame overlay when the free cursor is shown. */
static int rgba_world_build(DuneView *v,const CPU *c,const DuneLayout *p){
    if(!p->world_width || !p->world_height)return 0;
    if(!v->shadow)v->shadow=malloc(sizeof *v->shadow);
    if(!v->shadow)return 0;
    if(v->width!=(unsigned)p->world_width || v->height!=(unsigned)p->world_height){
        size_t size=(size_t)p->world_width*p->world_height*4;
        uint8_t *pixels=realloc(v->pixels,size);if(!pixels)return 0;
        v->pixels=pixels;v->width=p->world_width;v->height=p->world_height;
    }
    uint8_t sprites[320*224];
    for(unsigned by=0;by<v->height;by+=192)for(unsigned bx=0;bx<v->width;bx+=256){
        if(!dune_view_sprites(v,c,p->left+(int)bx-32,p->top+(int)by-16,sprites,0))return 0;
        unsigned bw=v->width-bx<256?v->width-bx:256,bh=v->height-by<192?v->height-by:192;
        em_web_world_raster_chunk(c,&v->shadow->vdp,
            p->left+(int)bx,p->top+(int)by,bw,bh,
            sprites+16*320+32,320,v->pixels+((size_t)by*v->width+bx)*4,(size_t)v->width*4);
    }
    if(!v->ui)v->ui=malloc(320*224*4);
    if(!v->ui || !dune_view_sprites(v,c,dune_word(c,0xe3ec),dune_word(c,0xe3ee),sprites,1))return 0;
    /* Alpha alone cannot isolate the HUD: the live framebuffer already has
       the world cursor/placement preview over its opaque minimap pixels. */
    uint8_t clean_ui[320*224*3];
    vdp_render_pixels(&v->shadow->vdp,320,224,sprites,clean_ui);
    int minimap_visible=0;
    for(unsigned y=144;y<208;++y)for(unsigned x=240;x<304;++x)minimap_visible|=sprites[y*320+x]!=0;
    for(unsigned y=0;y<224;++y)for(unsigned x=0;x<320;++x){
        unsigned at=y*320+x;
        memcpy(v->ui+at*4,clean_ui+at*3,3);
        int minimap=minimap_visible && x>=240 && x<304 && y>=144 && y<208;
        v->ui[at*4+3]=(minimap || sprites[at])?255:0;
        /* Keep the original frame pixel-exact in its central world area.
           A virtual cursor outside that area needs the replayed world layer. */
        int xx=(int)dune_word(c,0xe3ec)+(int)x-p->left;
        int yy=(int)dune_word(c,0xe3ee)+(int)y-p->top;
        if(!v->cursor_valid && !v->cursor_hidden && !v->ui[at*4+3] && xx>=0 && yy>=0 && xx<(int)v->width && yy<(int)v->height)
            {uint8_t *out=v->pixels+((unsigned)yy*v->width+(unsigned)xx)*4;memcpy(out,c->vdp.frame+at*3,3);out[3]=255;}
    }
    v->left=p->left;v->top=p->top;v->frame=c->vdp.rendered_frames;return 1;
}
static void genuine(const char*path){
    FILE*f=fopen(path,"rb");require(f&&fread(&source,sizeof source,1,f)==1&&fgetc(f)==EOF,"load genuine CPU fixture");fclose(f);
    source.rom=rom_data;source.rom_size=sizeof rom_data;source.reason=NULL;source.fault=0;source.audio_mode=AUDIO_MUTE;source.audio.fm=NULL;source.audio.wav=NULL;
    for(unsigned mode=0;mode<5;++mode){
        DuneLayout p=dune_view_layout(&source,mode==0?320:412,mode==0?224:915,mode==2?50:100);
        p.left=mode==1?-17:mode==2?2031:(int)dune_word(&source,0xe3ec);p.top=mode==1?-9:mode==2?2039:(int)dune_word(&source,0xe3ee);
        DuneView reference={0},fast={0};reference.cursor_hidden=fast.cursor_hidden=mode!=3;
        if(mode==4){reference.cursor_valid=fast.cursor_valid=1;reference.cursor_x=fast.cursor_x=p.left+30;reference.cursor_y=fast.cursor_y=p.top+30;}
        before_source=source;require(dune_view_build(&reference,&source,&p),"RGB reference full genuine world builds");
        require(rgba_world_build(&fast,&source,&p),"RGBA candidate full genuine world builds");
        require(!memcmp(&source,&before_source,sizeof source),"neither renderer mutates any source CPU/device byte");
        require(!memcmp(reference.shadow,fast.shadow,sizeof source),"both renderers replay identical original sprite CPU/device state");
        require(reference.width==fast.width&&reference.height==fast.height&&reference.left==fast.left&&reference.top==fast.top&&reference.frame==fast.frame,"same dimensions, camera and original native frame serial");
        for(size_t i=0;i<(size_t)reference.width*reference.height;++i){require(!memcmp(reference.pixels+i*3,fast.pixels+i*4,3),"every full world RGB byte identical after alpha deinterleave");require(fast.pixels[i*4+3]==255,"every full world pixel has opaque alpha");}
        require(!memcmp(reference.ui,fast.ui,320*224*4),"entire original recomposed HUD RGBA including transparent RGB is identical");
        ++genuine_images;release_view(&reference);release_view(&fast);
    }
    printf("PASS genuine full RGBA/RGB world + full HUD + shadowCPU + central-overlay/placement modes: %s\n",path);
}

int main(int argc,char**argv){synthetic();for(int i=1;i<argc;++i)genuine(argv[i]);printf("PASS expanded-world oracle chunks%u genuineFullImages%u CPU%zuB seed%08x\n",comparisons,genuine_images,sizeof source,seed);return 0;}
