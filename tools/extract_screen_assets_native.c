/* Offline original-machine screen recorder. No runtime patches or rendering
 * replay. Every RGB file is the last completed original core.vdp.frame.
 * clang -std=c11 -O1 tools/extract_screen_assets_native.c -o .local/extract-screen-assets -lm
 * .local/extract-screen-assets --boot OUT_DIR [nativeframes=6000] [stride=60]
 * .local/extract-screen-assets --fixture CPU OUT_DIR PREFIX [nativeframes=1] [stride=1]
 */
#define GENESIS_NO_MAIN
#ifndef ORACLE_SOURCE
#define ORACLE_SOURCE "../.local/source/build/dune-base.c"
#endif
#include ORACLE_SOURCE
#include <sys/stat.h>
#include "em_web_menus.h"
static CPU screen_cpu;
static const char *screen_output;
static DuneMouse screen_pointer;
static CPU screen_baseline;
static int screen_asset_descriptor=-1;
static void screen_check(int ok,const char *why){if(!ok){fprintf(stderr,"%s pc=%06x frame=%llu reason=%s\n",why,screen_cpu.pc,(unsigned long long)screen_cpu.vdp.frames,screen_cpu.reason?screen_cpu.reason:"");exit(1);}}
static void screen_write(const char *name,const char *suffix,const void *data,size_t n){char path[4096];snprintf(path,sizeof path,"%s/%s.%s",screen_output,name,suffix);FILE*f=fopen(path,"wb");screen_check(f&&fwrite(data,1,n,f)==n,"write screen capture");fclose(f);}
static void screen_capture(const char *name,int cpu){
    CPU*c=&screen_cpu;unsigned w=c->vdp.frame_width,h=c->vdp.frame_height;screen_check(w==320&&h==224,"expected settled native320x224 completed frame");
    screen_write(name,"rgb",c->vdp.frame,w*h*3);screen_write(name,"vram.bin",c->vdp.vram,sizeof c->vdp.vram);screen_write(name,"registers.bin",c->vdp.registers,sizeof c->vdp.registers);
    uint8_t pal[192];for(unsigned i=0;i<64;++i){unsigned col=c->vdp.cram[i];pal[i*3]=vdp_channel((col>>1)&7,1);pal[i*3+1]=vdp_channel((col>>5)&7,1);pal[i*3+2]=vdp_channel((col>>9)&7,1);}screen_write(name,"palette.rgb",pal,sizeof pal);
    uint8_t vsram[80];for(unsigned i=0;i<40;++i){vsram[i*2]=c->vdp.vsram[i]>>8;vsram[i*2+1]=c->vdp.vsram[i]&255;}screen_write(name,"vsram.bin",vsram,sizeof vsram);
    static uint8_t sprites[320*224],plane[320*224],recomposed[320*224*3];memset(sprites,0,sizeof sprites);vdp_sprites(&c->vdp,w,h,sprites);screen_write(name,"sprites.indices",sprites,sizeof sprites);
    for(unsigned layer=0;layer<3;++layer){for(unsigned yy=0;yy<h;++yy)for(unsigned xx=0;xx<w;++xx)plane[yy*w+xx]=layer==2?vdp_window_pixel(&c->vdp,xx,yy,1):vdp_plane_pixel(&c->vdp,layer,xx,yy);screen_write(name,layer==0?"plane-a.indices":layer==1?"plane-b.indices":"window.indices",plane,sizeof plane);}
    vdp_render_pixels(&c->vdp,w,h,sprites,recomposed);unsigned mismatch=0;for(unsigned i=0;i<w*h*3;++i)mismatch+=recomposed[i]!=c->vdp.frame[i];
    if(cpu)screen_write(name,"cpu.bin",c,sizeof *c);
    char path[4096];snprintf(path,sizeof path,"%s/%s.json",screen_output,name);FILE*f=fopen(path,"w");screen_check(f!=NULL,"capture metadata");
    unsigned sp=c->a[7]&65535;unsigned from=sp<=65532?dune_long(c,sp):0;
    fprintf(f,"{\"id\":\"%s\",\"width\":%u,\"height\":%u,\"frame\":%llu,\"renderedFrames\":%llu,\"pc\":%u,\"stackReturn\":%u,\"callback\":%u,\"house\":%u,\"campaign\":%u,\"method\":\"%s\",\"pad\":%u,\"romSize\":%zu,\"cpuBytes\":%zu,\"assetDescriptor\":%d,\"currentVdpRgbMismatchBytes\":%u,\"shadowHighlight\":%u}\n",name,w,h,(unsigned long long)c->vdp.frames,(unsigned long long)c->vdp.rendered_frames,c->pc,from,dune_long(c,0xe002),dune_word(c,0xc274),dune_word(c,0xc050),screen_asset_descriptor<0?"Original machine_step; actual completed core.vdp.frame; no replay":"Original C7D68 descriptor loader then original VDP render at return; controlled offline asset extraction, not natural-play scene coverage",c->pad_buttons[0],c->rom_size,sizeof *c,screen_asset_descriptor,mismatch,!!(c->vdp.registers[12]&8));fclose(f);
}
static void screen_observe(void){if(!em_web_menus_observe(&screen_pointer,&screen_cpu))dune_mouse_observe(&screen_pointer,&screen_cpu);}
static void screen_frames(unsigned count){uint64_t end=screen_cpu.vdp.frames+count;while(!screen_cpu.fault&&screen_cpu.vdp.frames<end){screen_observe();machine_step(&screen_cpu);}screen_check(!screen_cpu.fault,"native menu frame");}
static void screen_exact(const char*name){uint64_t rendered=screen_cpu.vdp.rendered_frames;while(!screen_cpu.fault&&screen_cpu.vdp.rendered_frames==rendered){screen_observe();machine_step(&screen_cpu);}screen_check(!screen_cpu.fault,"native menu render");screen_capture(name,1);}
static void screen_click(unsigned x,unsigned y,unsigned count){dune_mouse_click(&screen_pointer,&screen_cpu,x,y,DUNE_CLICK_SELECT);screen_frames(count);}
static void screen_options_start(void){screen_cpu=screen_baseline;screen_cpu.rom=rom_data;screen_cpu.rom_size=sizeof rom_data;screen_cpu.reason=NULL;screen_cpu.fault=0;screen_cpu.audio_mode=AUDIO_MUTE;memset(&screen_pointer,0,sizeof screen_pointer);screen_pointer.enabled=1;screen_cpu.pad_buttons[0]=PAD_START;screen_frames(8);screen_cpu.pad_buttons[0]=0;screen_frames(120);screen_check(screen_pointer.front_source==0x20f24,"native pause Options entry");}
static int screen_options(int argc,char**argv){
    screen_check(argc>=4,"--options CPU OUT arguments");FILE*f=fopen(argv[2],"rb");screen_check(f&&fread(&screen_baseline,sizeof screen_baseline,1,f)==1&&fgetc(f)==EOF,"original Options fixture ABI");fclose(f);screen_output=argv[3];mkdir(screen_output,0755);
    screen_options_start();screen_exact("pause-options");
    screen_click(100,60,100);screen_exact("pause-options-sound-off");
    screen_options_start();screen_click(100,140,240);screen_check(screen_pointer.front_source==0x21660,"native password entry");screen_exact("password");
    screen_options_start();screen_click(100,156,240);screen_check(screen_pointer.front_source==0x21ae6,"native restart confirm");screen_exact("restart-confirm");
    return 0;
}
static int screen_catalog(int argc,char**argv){
    screen_check(argc>=4,"--catalog CPU OUT arguments");FILE*f=fopen(argv[2],"rb");screen_check(f&&fread(&screen_baseline,sizeof screen_baseline,1,f)==1&&fgetc(f)==EOF,"original art fixture ABI");fclose(f);screen_output=argv[3];mkdir(screen_output,0755);
    for(unsigned id=0;id<15;++id){screen_cpu=screen_baseline;screen_cpu.rom=rom_data;screen_cpu.rom_size=sizeof rom_data;screen_cpu.reason=NULL;screen_cpu.fault=0;screen_cpu.audio_mode=AUDIO_MUTE;screen_cpu.pad_buttons[0]=0;screen_cpu.pc=0xc7d68;screen_cpu.sr=0x2000;screen_cpu.a[7]=0xffef00;write_mem(&screen_cpu,0xffef00,4,0xdead00);write_mem(&screen_cpu,0xffef04,2,id);unsigned steps=0;
        while(!screen_cpu.fault&&screen_cpu.pc!=0xdead00&&steps++<30000000)machine_step(&screen_cpu);
        screen_check(!screen_cpu.fault&&screen_cpu.pc==0xdead00,"original scene graphics descriptor loader");
        /* This is an explicitly controlled static asset render at the loader
         * return, not a claim that natural play has reached this scene. */
        vdp_render(&screen_cpu);screen_asset_descriptor=id;char name[128];snprintf(name,sizeof name,"scene-art-%02u",id);screen_capture(name,1);fprintf(stderr,"Extracted original descriptor%u, %u original instructions\n",id,steps);
    }
    return 0;
}
static int screen_houses(int argc,char**argv){
    screen_check(argc>=4,"--houses PICKER_CPU OUT arguments");FILE*f=fopen(argv[2],"rb");screen_check(f&&fread(&screen_baseline,sizeof screen_baseline,1,f)==1&&fgetc(f)==EOF,"natural house picker fixture ABI");fclose(f);screen_output=argv[3];mkdir(screen_output,0755);
    const unsigned positions[3]={248,72,160};
    for(unsigned house=0;house<3;++house){screen_cpu=screen_baseline;screen_cpu.rom=rom_data;screen_cpu.rom_size=sizeof rom_data;screen_cpu.reason=NULL;screen_cpu.fault=0;screen_cpu.audio_mode=AUDIO_MUTE;screen_cpu.pad_buttons[0]=0;memset(&screen_pointer,0,sizeof screen_pointer);screen_pointer.enabled=1;screen_frames(2);screen_check(screen_pointer.front_kind==6,"native house picker");screen_click(positions[house],100,240);screen_check(dune_word(&screen_cpu,0xc274)==house,"native chosen house identity");char name[128];snprintf(name,sizeof name,"house-%u-confirm",house);screen_exact(name);
        screen_click(220,172,240);snprintf(name,sizeof name,"house-%u-briefing",house);screen_exact(name);
        for(unsigned frame=0;frame<64;++frame){snprintf(name,sizeof name,"house-%u-portrait-%03u",house,frame);screen_exact(name);}
        fprintf(stderr,"Captured original house%u portrait via real picker/YES flow\n",house);
    }
    return 0;
}
int main(int argc,char**argv){
    if(argc>1&&!strcmp(argv[1],"--houses"))return screen_houses(argc,argv);
    if(argc>1&&!strcmp(argv[1],"--catalog"))return screen_catalog(argc,argv);
    if(argc>1&&!strcmp(argv[1],"--options"))return screen_options(argc,argv);
    if(argc<3){fprintf(stderr,"Usage: --boot OUT [frames] [stride] | --fixture CPU OUT PREFIX [frames] [stride]\n");return 2;}
    unsigned count=6000,stride=60;const char*prefix="boot";int boot=!strcmp(argv[1],"--boot");
    if(boot){screen_output=argv[2];if(argc>3)count=strtoul(argv[3],NULL,0);if(argc>4)stride=strtoul(argv[4],NULL,0);CPU*c=&screen_cpu;c->rom=rom_data;c->rom_size=sizeof rom_data;c->sr=0x2700;c->io_tx[0]=c->io_tx[1]=0xff;c->io_tx[2]=0xfb;c->audio_mode=AUDIO_MUTE;c->a[7]=read_mem(c,0,4);c->ssp=c->a[7];c->pc=read_mem(c,4,4)&0xffffff;
    }else{screen_check(argc>=5,"fixture arguments");FILE*f=fopen(argv[2],"rb");screen_check(f&&fread(&screen_cpu,sizeof screen_cpu,1,f)==1&&fgetc(f)==EOF,"fixture ABI");fclose(f);screen_cpu.rom=rom_data;screen_cpu.rom_size=sizeof rom_data;screen_cpu.reason=NULL;screen_cpu.fault=0;screen_cpu.audio_mode=AUDIO_MUTE;screen_cpu.pad_buttons[0]=0;screen_output=argv[3];prefix=argv[4];count=argc>5?strtoul(argv[5],NULL,0):1;stride=argc>6?strtoul(argv[6],NULL,0):1;}
    mkdir(screen_output,0755);screen_check(stride>0,"positive capture stride");uint64_t initial=screen_cpu.vdp.frames,last=initial,last_render=screen_cpu.vdp.rendered_frames;uint32_t polls[64]={0};unsigned polls_count=0;
    while(!screen_cpu.fault&&screen_cpu.vdp.frames<initial+count){
        CPU*c=&screen_cpu;unsigned poll=0;
        if(c->pc==0x4938||c->pc==0x4724||c->pc==0x17d22||c->pc==0x17e96||c->pc==0x17ea6||c->pc==0x17eb6)poll=c->pc;
        if(c->pc==0x4d4e){unsigned sp=c->a[7]&65535;if(sp<=65532)poll=dune_long(c,sp);}
        if(poll&&c->vdp.rendered_frames){unsigned seen=0;for(unsigned i=0;i<polls_count;++i)seen|=polls[i]==poll;if(!seen&&polls_count<64){polls[polls_count++]=poll;char name[128];snprintf(name,sizeof name,"%s-poll-%06x",prefix,poll);screen_capture(name,1);fprintf(stderr,"Native poll%06x frame%llu\n",poll,(unsigned long long)c->vdp.frames);}}
        machine_step(c);
        if(c->vdp.rendered_frames!=last_render){last_render=c->vdp.rendered_frames;uint64_t relative=c->vdp.frames-initial;if(relative%stride==0&&relative){char name[128];snprintf(name,sizeof name,"%s-%06llu",prefix,(unsigned long long)relative);screen_capture(name,0);}}
        if(c->vdp.frames!=last){last=c->vdp.frames;if((last-initial)%600==0)fprintf(stderr,"Recorded native frame%llu/%u\n",(unsigned long long)(last-initial),count);}

    }
    screen_check(!screen_cpu.fault,"native capture execution");return 0;
}
