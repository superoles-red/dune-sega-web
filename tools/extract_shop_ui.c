/* Offline extraction only: original USA instructions/VRAM, never web runtime.
 * clang -std=c11 -O1 tools/extract_shop_ui.c -o .local/extract-shop-ui -lm
 * .local/extract-shop-ui ORIGINAL_CPU_SNAPSHOT OUTPUT_RAW_DIRECTORY
 */
#define GENESIS_NO_MAIN
#ifndef ORACLE_SOURCE
#define ORACLE_SOURCE "../.local/source/build/dune-base.c"
#endif
#define dune_mouse_observe original_mouse_observe
#include ORACLE_SOURCE
#undef dune_mouse_observe
#include "em_web_menu_select.h"
#include <sys/stat.h>

static CPU core,baseline,shadow,saved_regs;
static DuneMouse pointer;
static unsigned open_producer;
static const char *output;

static void check(int yes,const char *why){if(!yes){fprintf(stderr,"Extraction failed: %s PC=%06x %s\n",why,core.pc,core.reason?core.reason:"");exit(1);}}
static void observe(void){
    if(open_producer && core.pc==0x27d3c){
        write_mem(&core,0xffc578,4,0xff0000+open_producer);
        write_mem(&core,0xff0000+open_producer+6,2,dune_word(&core,open_producer+6)|0x8000);
        open_producer=0;
    }
    if(!em_web_menu_select_observe(&pointer,&core))original_mouse_observe(&pointer,&core);
}
static void frames(unsigned n){uint64_t end=core.vdp.frames+n;while(!core.fault&&core.vdp.frames<end){observe();machine_step(&core);}check(!core.fault,"native execution");}
static void restore(void){core=baseline;core.rom=rom_data;core.rom_size=sizeof rom_data;core.reason=NULL;core.fault=0;core.audio_mode=AUDIO_MUTE;core.pad_buttons[0]=0;memset(&pointer,0,sizeof pointer);pointer.enabled=1;em_web_menu_select_reset_state();open_producer=0;}
static void world(int x,int y){dune_mouse_world_click(&pointer,&core,x,y,DUNE_CLICK_SELECT);frames(40);}
static void open_at(int x,int y,int context){for(unsigned i=0;i<4&&dune_mouse_context(&core)!=context;++i)world(x,y);frames(40);check(dune_mouse_context(&core)==context,"native building menu entry");}
static void cell(int col,int row){dune_mouse_click(&pointer,&core,48+32*col,60+24*row,DUNE_CLICK_SELECT);frames(12);}
static unsigned building(unsigned index,unsigned type,unsigned tile){
    saved_regs=core;unsigned stack=0xef00,low=stack;
    core.pc=0xe584;core.sr=0x2700;core.a[7]=0xff0000+stack;
    write_mem(&core,core.a[7],4,0xdead00);write_mem(&core,core.a[7]+4,2,index);
    write_mem(&core,core.a[7]+6,2,type);write_mem(&core,core.a[7]+8,2,1);write_mem(&core,core.a[7]+10,2,tile);
    unsigned steps=0;while(!core.fault&&core.pc!=0xdead00&&steps++<5000000){if((core.a[7]&65535)<low)low=core.a[7]&65535;translated_step(&core);}
    unsigned p=core.a[0]&0xffffff;check(!core.fault&&core.pc==0xdead00&&p,"original Building_Create");
    memcpy(core.ram+low,saved_regs.ram+low,stack+20-low);memcpy(core.d,saved_regs.d,sizeof core.d);memcpy(core.a,saved_regs.a,sizeof core.a);
    core.pc=saved_regs.pc;core.sr=saved_regs.sr;core.usp=saved_regs.usp;core.ssp=saved_regs.ssp;return p&65535;
}
static FILE *file(const char *name,const char *suffix){char path[4096];snprintf(path,sizeof path,"%s/%s.%s",output,name,suffix);FILE*f=fopen(path,"wb");check(f!=NULL,"output file");return f;}
static void write_bytes(const char *name,const char *suffix,const void *p,size_t size){FILE*f=file(name,suffix);check(fwrite(p,1,size,f)==size,"write output");fclose(f);}
/* mode0: all original menu sprites; mode1: only focus hidden; mode2: focus
 * isolated. Both passes begin from the identical CPU. Native alpha is retained
 * as indexed sprite nibbles, rather than inferred from an RGB colour key. */
static void compose(unsigned mode,uint8_t *rgb,uint8_t *indexed){
    shadow=core;shadow.audio_mode=AUDIO_STUB;
    unsigned head=dune_word(&shadow,0xf5b4),at=head;
    unsigned focus=dune_word(&shadow,dune_mouse_context(&core)==3?0xbfc6:0xbf86);
    for(unsigned n=0;at&&n<512;++n){check(at<=65520,"valid original menu sprite list");
        if((mode==1&&at==focus)||(mode==2&&at!=focus))shadow.ram[at+7]|=0x80;
        at=dune_word(&shadow,at+14);
    }
    shadow.pc=0x1088;shadow.a[0]=(uint32_t)(int32_t)(int16_t)head;shadow.sr=0x2700;shadow.a[7]=0xffef00;
    write_mem(&shadow,shadow.a[7],4,0xdead00);unsigned steps=0;
    while(!shadow.fault&&shadow.pc!=0xdead00&&steps++<100000)translated_step(&shadow);
    check(!shadow.fault&&shadow.pc==0xdead00,"original menu sprite composition");
    unsigned sat=(shadow.vdp.registers[5]&0x7e)<<9;
    for(unsigned i=0;i<640;++i)shadow.vdp.vram[(sat+i)&65535]=shadow.ram[0xe428+i];
    memset(indexed,0,320*224);vdp_sprites(&shadow.vdp,320,224,indexed);
    if(rgb)vdp_render_pixels(&shadow.vdp,320,224,indexed,rgb);
}
static void capture(const char *name){
    static uint8_t rgb[320*224*3],sprites[320*224];
    int context=dune_mouse_context(&core);check(context==2||context==3,"menu capture context");
    CPU before=core;
    compose(0,rgb,sprites);write_bytes(name,"rgb",rgb,sizeof rgb);
    compose(1,rgb,sprites);write_bytes(name,"clean.rgb",rgb,sizeof rgb);
    compose(2,NULL,sprites);write_bytes(name,"focus.indices",sprites,sizeof sprites);
    /* RGB palette conversion is the same VDP channel function as native draw. */
    uint8_t palette[64*3];for(unsigned i=0;i<64;++i){unsigned c=core.vdp.cram[i];palette[i*3]=vdp_channel((c>>1)&7,1);palette[i*3+1]=vdp_channel((c>>5)&7,1);palette[i*3+2]=vdp_channel((c>>9)&7,1);}
    write_bytes(name,"palette.rgb",palette,sizeof palette);
    check(!memcmp(&before,&core,sizeof core),"all render composition is read-only for source CPU");
    FILE*f=file(name,"json");int rows=context==3?4:6;
    fprintf(f,"{\"id\":\"%s\",\"context\":%d,\"nativeWidth\":320,\"nativeHeight\":224,\"frame\":%llu,\"selectedCol\":%u,\"selectedRow\":%u,\"focusNode\":%u,\"buildingType\":%u,\"cells\":[",name,context,(unsigned long long)core.vdp.frames,dune_word(&core,context==3?0xbfc8:0xbf8a),dune_word(&core,context==3?0xbfca:0xbf8c),dune_word(&core,context==3?0xbfc6:0xbf86),core.ram[0xbf85]);
    for(int i=0;i<rows*3;++i){int value=core.ram[(context==3?0xbfcc:0xbf8e)+i];if(context==2)value=(int8_t)value;fprintf(f,"%s{\"col\":%d,\"row\":%d,\"rawItem\":%d}",i?",":"",i%3,i/3,value);}
    fprintf(f,"]}\n");fclose(f);printf("Captured %s (native type%u context%d)\n",name,core.ram[0xbf85],context);
}
int main(int argc,char **argv){
    if(argc!=3){fprintf(stderr,"Usage: %s CPU_SNAPSHOT OUTPUT_DIRECTORY\n",argv[0]);return 2;}
    FILE*f=fopen(argv[1],"rb");check(f&&fread(&baseline,sizeof baseline,1,f)==1,"original native CPU snapshot");fclose(f);output=argv[2];mkdir(output,0755);
    restore();frames(2);open_at(784,1136,2);capture("yard-idle");
    /* Dirty-only hover uses original item validation/details, without A. */
    dune_mouse_point(&pointer,&core,80,84);frames(12);capture("yard-windtrap-preview");
    restore();write_mem(&core,0xff4eb8+18,2,700);frames(2);open_at(784,1136,2);capture("yard-repair-available");
    restore();frames(2);open_at(784,1136,2);cell(1,1);cell(1,1);frames(150);open_at(784,1136,2);capture("yard-production-stop-available");
    restore();write_mem(&core,0xffc050,2,1);building(1,10,37*64+24);
    unsigned init=dune_word(&core,0xc148);write_mem(&core,0xffc148,2,init+1);building(2,18,37*64+26);write_mem(&core,0xffc148,2,init);
    frames(2);open_at(784,1200,2);capture("factory-upgrade-available");
    restore();unsigned starport=building(1,11,65535);open_producer=starport;frames(2);open_at(784,1136,3);capture("starport-idle");
    restore();starport=building(1,11,65535);write_mem(&core,0xff0000+starport+18,2,500);open_producer=starport;frames(2);open_at(784,1136,3);capture("starport-repair-available");
    cell(1,0);frames(150);open_producer=starport;open_at(784,1136,3);capture("starport-repair-stop-available");
    return 0;
}
