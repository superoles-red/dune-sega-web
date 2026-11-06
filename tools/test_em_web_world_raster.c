/* Exact RGB oracle for expanded-map chunks. The pinned terrain/color/sprite
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
static unsigned comparisons,genuine_images;
static uint32_t random_word(void){seed^=seed<<13;seed^=seed>>17;seed^=seed<<5;return seed;}
static void require(int ok,const char *message){if(!ok){fprintf(stderr,"FAIL %s case%u seed%08x\n",message,comparisons,seed);exit(1);}}
static void put16(uint8_t *data,unsigned at,unsigned value){data[at]=(uint8_t)(value>>8);data[at+1]=(uint8_t)value;}
static void original_chunk(const CPU*c,const VDP*palette,int left,int top,
                            unsigned width,unsigned height,const uint8_t*sprites,
                            size_t sprite_stride,uint8_t*pixels,size_t pixel_stride){
    for(unsigned y=0;y<height;++y)for(unsigned x=0;x<width;++x){
        int wx=left+(int)x,wy=top+(int)y;unsigned a,b;
        dune_view_terrain(c,wx,wy,&a,&b);uint8_t*out=pixels+(size_t)y*pixel_stride+x*3;
        if(wx<0||wy<0||wx>=2048||wy>=2048)memset(out,0,3);
        else dune_view_rgb(palette,a,b,sprites[(size_t)y*sprite_stride+x],out);
    }
}
static void compare_chunk(int left,int top,unsigned width,unsigned height){
    size_t pitch=(size_t)width*3+17,sprite_pitch=width+11,n=pitch*height+32,sn=sprite_pitch*height+32;
    uint8_t*reference=malloc(n),*actual=malloc(n),*sprites=malloc(sn),*sprite_before=malloc(sn);
    require(reference&&actual&&sprites&&sprite_before,"allocate guarded chunk");
    memset(reference,0xa5,n);memset(actual,0xa5,n);
    for(size_t i=0;i<sn;++i)sprites[i]=(uint8_t)random_word();memcpy(sprite_before,sprites,sn);
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
        compare_chunk(3,5,257,9);
    }
    puts("PASS explicit X/Y flips, plane/sprite priority, transparent high-priority tiles, shadow/highlight and C198 overlay suppression");
    randomize();for(unsigned i=0;i<128;++i)compare_chunk((int)(random_word()%2200)-80,(int)(random_word()%2200)-80,random_word()%600,random_word()%17);
    puts("PASS deterministic random source maps, ROM descriptors, VRAM patterns, separate CRAM and sprite encodings");
}
static void release_view(DuneView*v){free(v->pixels);free(v->ui);free(v->shadow);memset(v,0,sizeof *v);}
static void genuine(const char*path){
    FILE*f=fopen(path,"rb");require(f&&fread(&source,sizeof source,1,f)==1&&fgetc(f)==EOF,"load genuine CPU fixture");fclose(f);
    source.rom=rom_data;source.rom_size=sizeof rom_data;source.reason=NULL;source.fault=0;source.audio_mode=AUDIO_MUTE;source.audio.fm=NULL;source.audio.wav=NULL;
    const int lefts[]={0,-17,2031};
    for(unsigned mode=0;mode<3;++mode){
        DuneLayout p=dune_view_layout(&source,mode==0?320:412,mode==0?224:915,mode==2?50:100);
        p.left=mode==0?(int)dune_word(&source,0xe3ec):lefts[mode];p.top=mode==0?(int)dune_word(&source,0xe3ee):mode==1?-9:2039;
        DuneView reference={0},fast={0};reference.cursor_hidden=fast.cursor_hidden=1;
        if(mode==2){reference.cursor_valid=fast.cursor_valid=1;reference.cursor_x=fast.cursor_x=p.left+30;reference.cursor_y=fast.cursor_y=p.top+30;}
        before_source=source;require(dune_view_build(&reference,&source,&p),"original full genuine world builds");
        require(!memcmp(&source,&before_source,sizeof source),"original full world mutates no source CPU/device bytes");
        size_t bytes=(size_t)reference.width*reference.height*3;fast.pixels=malloc(bytes);fast.shadow=malloc(sizeof *fast.shadow);fast.width=reference.width;fast.height=reference.height;
        require(fast.pixels&&fast.shadow,"allocate genuine fast world");memset(fast.pixels,0xa5,bytes);
        uint8_t sprites[320*224];
        for(unsigned by=0;by<fast.height;by+=192)for(unsigned bx=0;bx<fast.width;bx+=256){
            require(dune_view_sprites(&fast,&source,p.left+(int)bx-32,p.top+(int)by-16,sprites,0),"unchanged original genuine sprite replay");
            unsigned bw=fast.width-bx<256?fast.width-bx:256,bh=fast.height-by<192?fast.height-by:192;
            em_web_world_raster_chunk(&source,&fast.shadow->vdp,p.left+(int)bx,p.top+(int)by,bw,bh,sprites+16*320+32,320,fast.pixels+((size_t)by*fast.width+bx)*3,(size_t)fast.width*3);
        }
        require(!memcmp(reference.pixels,fast.pixels,bytes),"every complete genuine expanded-world RGB byte identical");
        require(!memcmp(&source,&before_source,sizeof source),"optimized full world and original replay mutate no source CPU/device bytes");
        ++genuine_images;release_view(&reference);release_view(&fast);
    }
    printf("PASS genuine full expanded world, map edges and visible placement cursor: %s\n",path);
}
int main(int argc,char**argv){synthetic();for(int i=1;i<argc;++i)genuine(argv[i]);printf("PASS expanded-world oracle chunks%u genuineFullImages%u CPU%zuB seed%08x\n",comparisons,genuine_images,sizeof source,seed);return 0;}
