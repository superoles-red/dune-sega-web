/* Offline original-code fixture. Compile with -DORACLE_SOURCE='".../dune-base.c"'
   and pass a native stable first-mission CPU snapshot. Never shipped to web. */
#define GENESIS_NO_MAIN
#define dune_mouse_observe em_native_mouse_observe
#include ORACLE_SOURCE
#undef dune_mouse_observe
#include "em_web_menus.h"
#include <assert.h>
static CPU c,baseline;
static DuneMouse mouse;
static void observe(void){if(!em_web_menus_observe(&mouse,&c))em_native_mouse_observe(&mouse,&c);}
static void frames(unsigned count){uint64_t end=c.vdp.frames+count;while(!c.fault&&c.vdp.frames<end){observe();machine_step(&c);}assert(!c.fault);}
static void click(int x,int y,unsigned wait){dune_mouse_click(&mouse,&c,x,y,DUNE_CLICK_SELECT);frames(wait);}
static void start_menu(void){c=baseline;memset(&mouse,0,sizeof mouse);mouse.enabled=1;c.pad_buttons[0]=PAD_START;frames(8);c.pad_buttons[0]=0;frames(120);assert(mouse.front_source==0x20f24);}
int main(int argc,char**argv){
    assert(argc==2);FILE*f=fopen(argv[1],"rb");assert(f&&fread(&baseline,sizeof baseline,1,f)==1);fclose(f);
    baseline.rom=rom_data;baseline.rom_size=sizeof rom_data;baseline.reason=NULL;baseline.fault=0;baseline.audio_mode=AUDIO_MUTE;baseline.pad_buttons[0]=0;
    start_menu();unsigned sound=c.ram[0xdc51];click(100,60,100);assert(dune_word(&c,0xdbfc)==1&&c.ram[0xdc51]!=sound);puts("PASS native Options row navigation and sound toggle");
    start_menu();click(100,140,240);assert(mouse.front_source==0x21660);click(108,60,60);
    unsigned text=(c.a[6]-47)&65535;
    if(c.ram[text]!='B'){fprintf(stderr,"password frame A6=%x text=%04x bytes=%02x %02x\n",c.a[6],text,c.ram[text],c.ram[text+1]);return 1;}
    click(172,92,60);assert(c.ram[text]=='B'&&c.ram[text+1]=='Z');
    click(188,92,60);click(156,92,60);assert(c.ram[text]=='B'&&c.ram[text+1]=='Y');puts("PASS native password B/Z entry, left edit cursor and Y replacement");
    click(160,196,240);assert(mouse.front_source==0x20f24);puts("PASS native password Start exit returns to Options");
    start_menu();click(100,156,240);assert(mouse.front_source==0x21ae6);
    click(196,140,240);assert(mouse.front_source==0x20f24);puts("PASS native restart confirmation NO returns without restarting");
    click(160,196,240);assert(dune_mouse_context(&c)==1);puts("PASS native Options Start exit returns to original map");
    return 0;
}
