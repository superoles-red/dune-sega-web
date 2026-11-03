/* Frozen transition must preserve corrected Upgrade RGB, including context0. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_menu_select.h"
#include "em_web_frame.h"
#define EM_WEB_BUILDING_UI_NO_EXPORTS
#include "em_web_building_ui.h"
static CPU c,before,fixture;static uint8_t expected[320*224*3];
static void okay(int yes,const char*why){if(!yes){fprintf(stderr,"FAIL %s\n",why);exit(1);}}
int main(int argc,char**argv){if(argc!=2)return 2;FILE*f=fopen(argv[1],"rb");okay(f&&fread(&c,sizeof c,1,f)==1,"actual native Upgrade fixture");fclose(f);c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=0;fixture=c;before=c;
 const uint8_t*p=em_bui_present_frame_for(&c);okay(p&&!memcmp(&c,&before,sizeof c),"published corrected frame remains whole-CPU read-only");memcpy(expected,p,sizeof expected);okay(memcmp(p,c.vdp.frame,sizeof expected),"source Upgrade strip really requires its original-ROM repair");
 em_web_frame_hold_begin(&c);memset(c.vdp.frame,0,sizeof expected);c.vdp.cram[17]^=2;before=c;p=em_bui_present_frame_for(&c);okay(p&&!memcmp(p,expected,sizeof expected)&&!memcmp(&c,&before,sizeof c),"native fade holds last corrected RGB without CPU changes");
 write_mem(&c,0xffe002,4,0);before=c;p=em_bui_present_frame_for(&c);okay(p&&!memcmp(p,expected,sizeof expected)&&!memcmp(&c,&before,sizeof c),"context0 still holds corrected native building presentation");
 em_web_frame_hold_end(&c);okay(!em_bui_present_frame_for(&c),"acknowledged nonbuilding context publishes no BUI frame");
 c=fixture;write_mem(&c,0xffc274,2,0);em_web_frame_hold_begin(&c);p=em_bui_present_frame_for(&c);okay(p==em_web_frame_present(&c),"another house cannot reuse the old published BUI cache");em_web_frame_hold_end(&c);puts("PASS corrected Upgrade hold/native fade/context0/ack/house isolation; getter whole-CPU read-only");return 0;}
