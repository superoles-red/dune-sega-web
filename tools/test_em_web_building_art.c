/* Full native monitor-art regression. Genuine menus and first preview taps;
 * each picture is independently decoded by original ROM routine$0C32.
 * The runtime getter remains read-only and changes no pixels outside96x56. */
#define GENESIS_NO_MAIN
#ifndef ORACLE_SOURCE
#define ORACLE_SOURCE "../.local/source/build/dune-base.c"
#endif
#include ORACLE_SOURCE
#include "em_web_menu_select.h"
#define EM_WEB_BUILDING_UI_NO_EXPORTS
#include "em_web_building_ui.h"
static CPU cpu,before,base,oracle,picture_continuation;
static DuneMouse mouse;
static unsigned checks,repaired,changed,original_record;
static unsigned records[64],record_count;
static void check(int okay,const char*why){if(!okay){fprintf(stderr,"FAIL %s pc%06x context%d raw%d record%x\n",why,cpu.pc,dune_mouse_context(&cpu),(int8_t)cpu.ram[0xbfa1],original_record);exit(1);}}
static void frames(unsigned n){uint64_t end=cpu.vdp.frames+n;while(!cpu.fault&&cpu.vdp.frames<end){if(cpu.pc==0x8360||cpu.pc==0x9072)original_record=cpu.a[2];if(!em_web_menu_select_observe(&mouse,&cpu))dune_mouse_observe(&mouse,&cpu);machine_step(&cpu);}check(!cpu.fault,"original menu execution healthy");}
static void reset(const CPU*c){cpu=*c;cpu.rom=rom_data;cpu.rom_size=sizeof rom_data;cpu.reason=NULL;cpu.audio_mode=AUDIO_MUTE;memset(&mouse,0,sizeof mouse);mouse.enabled=1;memset(&em_web_menu_select,0,sizeof em_web_menu_select);original_record=0;}
static unsigned decode_native(unsigned record,uint8_t*out){
 oracle=cpu;oracle.pc=0xc32;oracle.sr=0x2700;oracle.a[7]=0xffef00;oracle.a[0]=record+202;oracle.a[1]=0xff0000;oracle.d[0]=em_bui_rom_word(&cpu,record+200);write_mem(&oracle,oracle.a[7],4,0xdead00);unsigned length=0,steps=0;
 while(!oracle.fault&&oracle.pc!=0xdead00&&steps++<1000000){if(oracle.pc==0xcca)length=oracle.a[3]&65535;translated_step(&oracle);}
 check(!oracle.fault&&oracle.pc==0xdead00&&length&&length<=4096,"original LCW decoder completed");memcpy(out,oracle.ram,length);return length;
}
static void compare(unsigned record){
 uint8_t patterns[4096],portable[4096];unsigned length=decode_native(record,patterns);check(length==em_bui_monitor_patterns(&cpu,record,portable)&&!memcmp(patterns,portable,length),"portable full LCW bytes match original decoder exactly");
 before=cpu;const uint8_t*out=em_bui_frame_rgb_for(&cpu);check(!memcmp(&cpu,&before,sizeof cpu),"whole CPU byte-identical after native RGB getter");check(out!=NULL,"settled original menu frame published");unsigned differences=0;
 for(unsigned y=0;y<224;y++)for(unsigned x=0;x<320;x++){
  unsigned p=(y*320+x)*3;int inside=x>=160&&x<256&&y>=40&&y<96;
  if(!inside){check(!memcmp(out+p,cpu.vdp.frame+p,3),"repair affects no chrome/focus/counter pixels outside monitor");continue;}
  unsigned xx=x-160,yy=y-40,e=em_bui_rom_word(&cpu,record+32+((yy/8)*12+xx/8)*2),px=e&0x800?7-(xx&7):xx&7,py=e&0x1000?7-(yy&7):yy&7,at=(e&2047)*32+py*4+px/2;
  check(at<length,"original mapping within complete LCW data");unsigned nib=px&1?patterns[at]&15:patterns[at]>>4,color=cpu.vdp.cram[nib];
  if(!(out[p]==vdp_channel((color>>1)&7,1)&&out[p+1]==vdp_channel((color>>5)&7,1)&&out[p+2]==vdp_channel((color>>9)&7,1))){fprintf(stderr,"pixel %u,%u actual %u,%u,%u expected color %x nib%u outNative%d vramEqual%d chosen%x expected%x\n",x,y,out[p],out[p+1],out[p+2],color,nib,out==cpu.vdp.frame,!memcmp(cpu.vdp.vram+0x7000,patterns,length),em_bui_monitor_record(&cpu),record);check(0,"every monitor pixel equals original resource/map/flips/current CRAM");}
  if(memcmp(out+p,cpu.vdp.frame+p,3))differences++;
 }
 checks++;changed+=differences;repaired+=differences>0;unsigned i=0;while(i<record_count&&records[i]!=record)i++;if(i==record_count)records[record_count++]=record;
}
static void load(const char*directory,const char*stem){char path[4096];snprintf(path,sizeof path,"%s/%s.cpu.bin",directory,stem);FILE*f=fopen(path,"rb");check(f&&fread(&base,sizeof base,1,f)==1&&fgetc(f)==EOF,"native fixture ABI");fclose(f);reset(&base);}
static void previews(void){
 int context=dune_mouse_context(&cpu),n=context==3?12:18;CPU menu=cpu;
 for(int index=0;index<n;index++){
  reset(&menu);int raw=em_web_menu_select_item(&cpu,context,index%3,index/3);if(!em_web_menu_select_purchase(&cpu,context,raw))continue;
  uint32_t house=dune_long(&cpu,0xc278)&65535,bank=dune_long(&cpu,house+18),producer=dune_long(&cpu,0xc578)&65535;unsigned paid=cpu.ram[producer+3],product=dune_word(&cpu,producer+82);
  check(em_web_building_ui_tap_for(&cpu,&mouse,context,dune_long(&cpu,0xc578),index%3,index/3),"actual original first preview tap accepted");frames(30);
  check(em_web_menu_select.armed&&dune_long(&cpu,house+18)==bank&&cpu.ram[producer+3]==paid&&dune_word(&cpu,producer+82)==product,"preview never pays or starts production");
  check(original_record&&original_record!=0x95cd8,"native preview loader reports its actual resource");check(em_bui_monitor_record(&cpu)==original_record,"read-only resource choice matches actual native loader");compare(original_record);
 }
}
/* These are isolated presentation-oracle cases, not reachable shop catalogues:
 * arrange only displayed-item metadata on a real native menu, invoke original
 * image loader$8306, and render with the original VDP. No purchase or world
 * state is asserted from this arrangement. It covers even unused IX/slab1 art. */
static void all_record_oracles(const char*directory){
 unsigned building_cases=0,unit_cases=0;
 for(int building=0;building<=1;building++)for(unsigned id=0;id<(building?19u:18u);id++){
  unsigned record=em_bui_rom_long(&cpu,(building?0x882a4:0x8f1d0)+id*4);if(!record||record==0x95cd8)continue;
  load(directory,building?"house0-building08":"house0-building10");
  cpu.ram[0xc614]=(uint8_t)building;cpu.ram[0xbfa1]=(uint8_t)id;picture_continuation=cpu;
  cpu.pc=0x8306;cpu.d[0]=id;cpu.d[1]=1;cpu.sr=0x2000;cpu.a[7]=0xffef00;write_mem(&cpu,cpu.a[7],4,0xdead00);
  unsigned steps=0;while(!cpu.fault&&cpu.pc!=0xdead00&&steps++<5000000)machine_step(&cpu);
  check(!cpu.fault&&cpu.pc==0xdead00,"original monitor loader completes on isolated presentation fixture");
  memcpy(cpu.ram+0xed00,picture_continuation.ram+0xed00,0x300);memcpy(cpu.d,picture_continuation.d,sizeof cpu.d);memcpy(cpu.a,picture_continuation.a,sizeof cpu.a);cpu.pc=picture_continuation.pc;cpu.sr=picture_continuation.sr;cpu.usp=picture_continuation.usp;cpu.ssp=picture_continuation.ssp;frames(6);
  check(em_bui_monitor_record(&cpu)==record,"all-record native displayed item selects exact original resource");compare(record);
  if(building)building_cases++;else unit_cases++;
 }
 check(building_cases==19&&unit_cases==17,"all19 building and17 actual unit monitor resources covered");
 puts("PASS19 building and17 unit original image-loader oracle cases (arranged display metadata; no purchases)");
}
int main(int argc,char**argv){
 if(argc<2||argc>4)return 2;if(argc==3&&!strcmp(argv[2],"--oracles")){load(argv[1],"house0-building08");all_record_oracles(argv[1]);return 0;}unsigned exit_fades=0;const unsigned types[]={2,3,4,5,7,8,9,10,11,12,13,15,16,17,18};
 for(unsigned h=0;h<3;h++)for(unsigned n=0;n<20;n++){
  char stem[128];if(n<15)snprintf(stem,sizeof stem,"house%u-building%02u",h,types[n]);else snprintf(stem,sizeof stem,"house%u-%s",h,n==15?"windtrap-preview":n==16?"upgrade-preview":n==17?"repair-ready":n==18?"starport-preview":"starport-purchased");load(argv[1],stem);
  if(n==19){before=cpu;check(!em_bui_frame_rgb_for(&cpu)&&!memcmp(&cpu,&before,sizeof cpu),"outgoing native Starport fade remains unpublished/read-only");exit_fades++;continue;}
  unsigned record=n<15?em_bui_rom_long(&cpu,0x882a4+types[n]*4):n==15||n==17?em_bui_rom_long(&cpu,0x882a4+9*4):n==16?em_bui_rom_long(&cpu,(cpu.ram[0xc614]?0x882a4:0x8f1d0)+cpu.ram[0xbfa0]*4):em_bui_rom_long(&cpu,0x8f1d0+17*4);
  check(em_bui_monitor_record(&cpu)==record,"native entered/previewed picture identity matches original definition");compare(record);
  if(argc>=3&&n==16&&h==1){const uint8_t*out=em_bui_frame_rgb_for(&cpu);FILE*f=fopen(argv[2],"wb");check(f&&fwrite(out,320*224*3,1,f)==1,"corrected frame proof output");fclose(f);}
  if(n<15)previews();
 }
 check(exit_fades==3&&repaired>=6&&changed>0,"all-house Refinery and Upgrade are actually repaired");
 before=cpu;cpu.vdp.cram[17]^=2;CPU altered=cpu;check(!em_bui_frame_rgb_for(&cpu)&&!memcmp(&cpu,&altered,sizeof cpu),"incomplete UI palette remains unpublished and read-only");cpu=before;
 if(argc==4){ /* Existing authored demonstration has all real producer types. */
  FILE*f=fopen(argv[3],"rb");check(f&&fread(&base,sizeof base,1,f)==1,"authored demo CPU source");fclose(f);
  for(unsigned t=0;t<sizeof types/sizeof*types;t++){
   reset(&base);unsigned producer=0;
   for(unsigned i=0;i<73;i++){unsigned p=em_bui_rom_long(&cpu,0x4a71e + i*4)&65535;if((dune_word(&cpu,p+4)&7)==3&&cpu.ram[p+2]==types[t]&&cpu.ram[p+8]==dune_word(&cpu,0xc274)){producer=0xff0000+p;break;}}
   check(producer,"authored demo contains each real producer");unsigned p=producer&65535;int wx=dune_word(&cpu,p+12)/8+8,wy=dune_word(&cpu,p+10)/8+8;
   for(unsigned i=0;i<8&&dune_mouse_context(&cpu)!=2&&dune_mouse_context(&cpu)!=3;i++){dune_mouse_world_click(&mouse,&cpu,wx,wy,DUNE_CLICK_SELECT);frames(60);}frames(40);
   check(dune_long(&cpu,0xc578)==producer&&em_bui_presentation_ready(&cpu),"authored demo original menu opens");
   if(types[t]==8){FILE*out=fopen(".local/shop-all-items.cpu.bin","wb");check(out&&fwrite(&cpu,sizeof cpu,1,out)==1,"private actual Yard fixture export");fclose(out);out=fopen(".local/shop-all-items.json","wb");const char*j=em_web_building_ui_json_for(&cpu,&em_web_menu_select);check(out&&fwrite(j,strlen(j),1,out)==1,"private actual Yard report");fclose(out);}
   previews();
  }
 }
 unsigned actual_checks=checks;all_record_oracles(argv[1]);
 /* Current native palette changes invalidate only the presentation cache. */
 picture_continuation=cpu;cpu.vdp.cram[1]^=2;compare(em_bui_monitor_record(&cpu));cpu=picture_continuation;
 /* A name-table transition cannot publish another item's artwork early. */
 unsigned sx,sy,at=vdp_plane_address(&cpu.vdp,0,160,40,&sx,&sy);if(vdp_window_at(&cpu.vdp,160,40))at=((cpu.vdp.registers[3]&0x3c)<<10)+(5*64+20)*2;
 cpu.vdp.vram[at+1]^=1;before=cpu;check(em_bui_frame_rgb_for(&cpu)==cpu.vdp.frame&&!memcmp(&cpu,&before,sizeof cpu),"nonmatching native map remains raw and read-only");
 printf("PASS %u actual entered/previewed monitor frames + %u isolated display cases (36 original loaders + current-CRAM cache refresh), %u repaired (%u corrected pixels), %u unique ROM resources, %u native fades; wholeCPU and all outside pixels unchanged\n",actual_checks,checks-actual_checks,repaired,changed,record_count,exit_fades);return 0;
}
