/* Completed native palette/read-only Upgrade monitor repair regression. */
#define GENESIS_NO_MAIN
#ifndef ORACLE_SOURCE
#define ORACLE_SOURCE "../.local/source/build/dune-base.c"
#endif
#include ORACLE_SOURCE
#include "em_web_menu_select.h"
#define EM_WEB_BUILDING_UI_NO_EXPORTS
#include "em_web_building_ui.h"
static CPU cpu,before;
static void check(int okay,const char*why){if(!okay){fprintf(stderr,"FAIL %s pc%06x\n",why,cpu.pc);exit(1);}}
int main(int argc,char**argv){if(argc<2||argc>3)return 2;unsigned frames=0,repaired=0,changed=0,exit_fades=0;const unsigned types[]={2,3,4,5,7,8,9,10,11,12,13,15,16,17,18};
 for(unsigned h=0;h<3;h++)for(unsigned n=0;n<20;n++){
  char path[4096],stem[128];if(n<15)snprintf(stem,sizeof stem,"house%u-building%02u",h,types[n]);else snprintf(stem,sizeof stem,"house%u-%s",h,n==15?"windtrap-preview":n==16?"upgrade-preview":n==17?"repair-ready":n==18?"starport-preview":"starport-purchased");snprintf(path,sizeof path,"%s/%s.cpu.bin",argv[1],stem);FILE*f=fopen(path,"rb");check(f&&fread(&cpu,sizeof cpu,1,f)==1&&fgetc(f)==EOF,"native fixture ABI");fclose(f);cpu.rom=rom_data;cpu.rom_size=sizeof rom_data;cpu.reason=0;before=cpu;
  const uint8_t*out=em_bui_frame_rgb_for(&cpu);check(!memcmp(&cpu,&before,sizeof cpu),"whole CPU byte-identical after native RGB getter");
  if(n==19){check(!out,"outgoing native Starport fade not published over full-color fixed chrome");exit_fades++;continue;}
  check(out!=NULL,"settled original menu frame published");frames++;
  if(n==16){unsigned record=em_bui_upgrade_monitor_record(&cpu);check(record!=0&&out!=cpu.vdp.frame,"Upgrade uses exact original monitor resource");uint8_t patterns[4096];unsigned length=em_bui_monitor_patterns(&cpu,record,patterns);check(length>0,"original bounded LCW resource decoded");
   for(unsigned y=0;y<224;y++)for(unsigned x=0;x<320;x++){unsigned p=(y*320+x)*3;int inside=x>=160&&x<256&&y>=40&&y<96;if(!inside){check(!memcmp(out+p,cpu.vdp.frame+p,3),"repair affects only monitor picture rectangle");continue;}unsigned xx=x-160,yy=y-40,e=em_bui_rom_word(&cpu,record+32+((yy/8)*12+xx/8)*2),px=e&0x800?7-(xx&7):xx&7,py=e&0x1000?7-(yy&7):yy&7,at=(e&2047)*32+py*4+px/2;check(at<length,"native mapping within decoded pattern data");unsigned nib=px&1?patterns[at]&15:patterns[at]>>4,color=cpu.vdp.cram[nib];check(out[p]==vdp_channel((color>>1)&7,1)&&out[p+1]==vdp_channel((color>>5)&7,1)&&out[p+2]==vdp_channel((color>>9)&7,1),"Upgrade RGB matches original patterns/map/current CRAM");if(memcmp(out+p,cpu.vdp.frame+p,3))changed++;}
   if(argc==3&&h==1){FILE*proof=fopen(argv[2],"wb");check(proof&&fwrite(out,320*224*3,1,proof)==1,"read-only corrected native frame proof output");fclose(proof);}repaired++;
  }else check(out==cpu.vdp.frame,"all non-Upgrade pixels remain the actual native completed frame");
 }
 check(frames==57&&repaired==3&&exit_fades==3&&changed>0,"complete all-house menu/Upgrade/fade coverage");before=cpu;cpu.vdp.cram[17]^=2;CPU altered=cpu;check(!em_bui_frame_rgb_for(&cpu),"incomplete original UI palette is not presentation-ready");check(!memcmp(&cpu,&altered,sizeof cpu),"palette readiness remains read-only");
 printf("PASS %u settled menus, %u original Upgrade repairs (%u corrected pixels), %u outgoing native fades, wholeCPU/no-other-pixel changes\n",frames,repaired,changed,exit_fades);return 0;}
