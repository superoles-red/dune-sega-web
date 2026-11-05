/* Exact-pixel oracle: the unchanged pinned renderer versus the browser's
 * scanline compositor, on synthetic VDP snapshots and real native frames.
 * Build from the project root; no WASM build or game fixture mutation. */
#define GENESIS_NO_MAIN
#define vdp_render_pixels vdp_render_pixels_reference
#include "../vendor/rearrakis/build/dune-base.c"
#undef vdp_render_pixels
#include "em_web_raster.h"
static VDP sample,before_vdp;
static CPU real_cpu,before_cpu;
static uint8_t sprites[400*240],reference_rgb[400*240*3+32],fast_rgb[400*240*3+32];
static uint32_t seed=0x6c91b347u;
static unsigned comparisons,plane_rows,real_frames;
static uint32_t random_word(void){seed^=seed<<13;seed^=seed>>17;seed^=seed<<5;return seed;}
static void require(int ok,const char*message){if(!ok){fprintf(stderr,"FAIL %s case%u seed%08x\n",message,comparisons,seed);exit(1);}}
static void compare(VDP*v,unsigned width,unsigned height){
    memset(reference_rgb,0xa5,sizeof reference_rgb);memset(fast_rgb,0xa5,sizeof fast_rgb);before_vdp=*v;
    vdp_render_pixels_reference(v,width,height,sprites,reference_rgb+16);
    require(!memcmp(v,&before_vdp,sizeof *v),"original raster input unchanged");
    vdp_render_pixels(v,width,height,sprites,fast_rgb+16);
    require(!memcmp(v,&before_vdp,sizeof *v),"fast raster input unchanged");
    if(memcmp(reference_rgb,fast_rgb,sizeof fast_rgb)){
        for(unsigned i=0;i<sizeof fast_rgb;++i)if(reference_rgb[i]!=fast_rgb[i]){fprintf(stderr,"RGB mismatch offset%u ref%u fast%u dimensions%ux%u regs11=%02x regs16=%02x regs17=%02x regs18=%02x\n",i,reference_rgb[i],fast_rgb[i],width,height,v->registers[11],v->registers[16],v->registers[17],v->registers[18]);break;}
        require(0,"every RGB byte and output guard identical");
    }
    if(width<=320)for(unsigned plane=0;plane<2;++plane)for(unsigned k=0;k<3;++k){
        unsigned y=k==0?0:k==1?height/2:height-1;uint8_t row[320];EmWebRasterPlane p=em_web_raster_plane(v,plane);
        em_web_raster_plane_row(v,&p,plane,y,0,width,row);
        for(unsigned x=0;x<width;++x)require(row[x]==vdp_plane_pixel(v,plane,x,y),"encoded plane pixel/priority/transparency identical");
        ++plane_rows;
    }
    ++comparisons;
}
static void randomize(void){
    uint8_t*p=(uint8_t*)&sample;for(size_t i=0;i<sizeof sample;++i)p[i]=(uint8_t)random_word();
    for(unsigned i=0;i<sizeof sprites;++i)sprites[i]=(uint8_t)random_word();
}
static void synthetic(void){
    const unsigned sizes[]={0,1,3};
    for(unsigned w=0;w<2;++w)for(unsigned h=0;h<2;++h)for(unsigned scroll=0;scroll<4;++scroll)
    for(unsigned columns=0;columns<2;++columns)for(unsigned shadow=0;shadow<2;++shadow)for(unsigned enabled=0;enabled<2;++enabled){
        randomize();sample.registers[1]=(uint8_t)((sample.registers[1]&~0x48u)|(h?8:0)|(enabled?0x40:0));
        sample.registers[11]=(uint8_t)(scroll|(columns?4:0));sample.registers[12]=(uint8_t)((w?1:0)|(shadow?8:0));
        sample.registers[16]=(uint8_t)(sizes[comparisons%3]|(sizes[(comparisons/3)%3]<<4));
        compare(&sample,w?320:256,h?240:224);
    }
    puts("PASS all H32/H40,224/240,scroll0/1/2/3,column/global,shadow/normal,display-enabled/disabled combinations");
    for(unsigned i=0;i<128;++i){
        randomize();sample.registers[1]|=0x40;sample.registers[16]=(uint8_t)(sizes[i%3]|(sizes[(i/3)%3]<<4));
        sample.registers[17]=(uint8_t)((i&1?0x80:0)|(i%32));sample.registers[18]=(uint8_t)((i&2?0x80:0)|((i/4)%32));
        sample.registers[13]=(uint8_t)(i%2?0x3f:0);sample.registers[11]=(uint8_t)(i%8);
        compare(&sample,i&1?320:256,i&2?240:224);
    }
    puts("PASS deterministic random VRAM/CRAM/VSRAM, all plane dimensions, window sides/extremes and wrapped scroll tables");
    for(unsigned flip=0;flip<4;++flip)for(unsigned priority=0;priority<2;++priority)for(unsigned shadow=0;shadow<2;++shadow){
        memset(&sample,0,sizeof sample);sample.registers[1]=0x40;sample.registers[12]=(uint8_t)(1|(shadow?8:0));
        sample.registers[2]=0x30;sample.registers[3]=0x38;sample.registers[4]=5;sample.registers[13]=0x3f;
        for(unsigned color=0;color<64;++color)sample.cram[color]=(uint16_t)(random_word()&0xeee);
        for(unsigned address=0;address<32;++address)sample.vram[32+address]=(uint8_t)(address%3?address*7:0);
        unsigned entry=1|(flip<<11)|(priority<<15)|0x6000;
        for(unsigned address=0xa000;address<0xf000;address+=2){sample.vram[address]=(uint8_t)(entry>>8);sample.vram[address+1]=(uint8_t)entry;}
        for(unsigned x=0;x<320;++x){sprites[x]=(uint8_t)(x%4==0?62:x%4==1?63:x%4==2?0x8e:0);}
        compare(&sample,320,224);
    }
    puts("PASS explicit X/Y flips, transparent high-priority tiles and shadow/highlight sprite colors");
    randomize();compare(&sample,321,4);compare(&sample,0,224);
    puts("PASS wider diagnostic fallback, empty width and untouched output guards");
}
static void genuine(const char*path){
    FILE*f=fopen(path,"rb");require(f&&fread(&real_cpu,sizeof real_cpu,1,f)==1&&fgetc(f)==EOF,"load genuine CPU fixture");fclose(f);
    real_cpu.rom=rom_data;real_cpu.rom_size=sizeof rom_data;real_cpu.reason=NULL;real_cpu.fault=0;real_cpu.audio_mode=AUDIO_MUTE;real_cpu.audio.fm=NULL;real_cpu.audio.wav=NULL;
    uint64_t end=real_cpu.vdp.frames+24,last=real_cpu.vdp.rendered_frames;
    while(real_cpu.vdp.frames<end){
        machine_step(&real_cpu);require(!real_cpu.fault,"genuine original machine healthy");
        if(last==real_cpu.vdp.rendered_frames)continue;last=real_cpu.vdp.rendered_frames;
        unsigned width=real_cpu.vdp.frame_width,height=real_cpu.vdp.frame_height;require(width<=320&&height&&height<=240,"native frame dimensions");
        memset(sprites,0,sizeof sprites);if(real_cpu.vdp.registers[1]&0x40)vdp_sprites(&real_cpu.vdp,width,height,sprites);
        before_cpu=real_cpu;compare(&real_cpu.vdp,width,height);
        require(!memcmp(reference_rgb+16,real_cpu.vdp.frame,(size_t)width*height*3),"genuine completed RGB matches unchanged original oracle");
        require(!memcmp(&before_cpu,&real_cpu,sizeof real_cpu),"full CPU/devices unchanged by both display paths");++real_frames;
    }
    printf("PASS genuine native fixture frames: %s\n",path);
}
int main(int argc,char**argv){synthetic();for(int i=1;i<argc;++i)genuine(argv[i]);printf("PASS raster oracle comparisons%u encodedPlaneRows%u genuineFrames%u seed%08x\n",comparisons,plane_rows,real_frames,seed);return 0;}
