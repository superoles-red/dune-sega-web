/* Read-only original briefing -> PROCEED frame projection regression.
 * This does not create/alter scenario actors or any native state. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_frame.h"
#include "em_web_campaign.h"
#include <sys/stat.h>
static CPU c,before;
static DuneMouse mouse;
static uint64_t rendered;
static unsigned audited,story_frames,exit_frames,glyph_pixels,choice_pixels,choice_mask_difference,map_frames;
static void check(int ok,const char *msg){if(ok)return;fprintf(stderr,"FAIL %s pc=%06x %s\n",msg,c.pc,em_web_campaign_report(&c));exit(1);}
static int in_choices(unsigned x,unsigned y){return em_web_frame_rect(x,y,184,164,96,24)||em_web_frame_rect(x,y,184,188,96,28);}
static void audit(int mode){
 before=c;
 const uint8_t *clean=em_web_frame_textless(&c,mode);
 check(clean&&!memcmp(&before,&c,sizeof c),"frame projection is whole-CPU immutable");
 static uint8_t result[320*224*3],sprites[320*224];
 memcpy(result,clean,sizeof result);memset(sprites,0,sizeof sprites);
 VDP *v=&em_web_frame_vdp;if(v->registers[1]&0x40)vdp_sprites(v,320,224,sprites);
 unsigned changed=0,visible_choices=0;
 for(unsigned y=0;y<224;y++)for(unsigned x=0;x<320;x++){
  unsigned p=(y*320+x)*3,at=em_web_frame_a_address(v,x,y),entry=vdp_word(v,at),tile=entry&2047;
  int glyph=mode==4&&em_web_frame_rect(x,y,16,16,288,40)&&(entry&0xf800)==0xc000&&tile>=0x480&&tile<=0x4de;
  if(glyph){uint8_t expected[3];em_web_frame_pixel(v,0,vdp_plane_pixel(v,1,x,y),sprites[y*320+x],expected);check(!memcmp(result+p,expected,3),"only glyph plane contribution removed, native sprites preserved");}
  else check(!memcmp(result+p,c.vdp.frame+p,3),"all pixels outside actual glyph cells unchanged");
  if(memcmp(result+p,c.vdp.frame+p,3)){check(glyph,"changed pixel belongs to original story glyph cell");++changed;}
  if(in_choices(x,y)&&sprites[y*320+x]){check(!memcmp(result+p,c.vdp.frame+p,3),"PROCEED/ADVICE sprites remain original pixels");++visible_choices;}
 }
 if(mode==4){glyph_pixels+=changed;choice_pixels+=visible_choices;
  /* Mode1 intentionally masks native choice sprites; mode4 must retain them. */
  const uint8_t *old=em_web_frame_textless(&c,1);check(old&&!memcmp(&before,&c,sizeof c),"legacy projection is also whole-CPU immutable");
  for(unsigned y=164;y<216;y++)for(unsigned x=184;x<280;x++){unsigned p=(y*320+x)*3;if(memcmp(old+p,result+p,3))++choice_mask_difference;}
 }
 ++audited;
}
static void step(void){if(!em_web_campaign_observe(&c))dune_mouse_observe(&mouse,&c);machine_step(&c);check(!c.fault,"original continuous briefing execution healthy");if(c.vdp.rendered_frames!=rendered){rendered=c.vdp.rendered_frames;em_web_frame_capture(&c);int exiting=em_web_campaign.presentation_phase&&!strcmp(em_web_campaign.presentation_phase,"briefing_exit");if(exiting){++exit_frames;audit(4);}else if(em_web_campaign.scene&&(!strcmp(em_web_campaign.scene,"briefing")||!strcmp(em_web_campaign.scene,"house_briefing"))){++story_frames;audit(4);}else if(dune_mouse_context(&c)==1){++map_frames;audit(0);}}}
int main(int argc,char **argv){
 const char *path=argc>1?argv[1]:".local/campaign-scenes/campaign-briefing.cpu.bin";FILE*f=fopen(path,"rb");check(f&&fread(&c,sizeof c,1,f)==1,"actual native briefing fixture");fclose(f);c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.audio_mode=AUDIO_MUTE;memset(c.pad_buttons,0,sizeof c.pad_buttons);memset(&mouse,0,sizeof mouse);mouse.enabled=1;em_web_campaign_after_load(&c);rendered=c.vdp.rendered_frames;
 uint64_t end=c.vdp.frames+4000,next=c.vdp.frames+20;
 while(c.vdp.frames<end&&map_frames<8){step();if(c.vdp.frames<next||em_web_campaign.input_pending||em_web_campaign.poll_frame+3<c.vdp.frames)continue;
  if(em_web_campaign.poll_pc==0x25cb2){check(em_web_campaign_input_request(&c,5,0),"native PROCEED/Yes input queued");next=c.vdp.frames+45;}
  else if(em_web_campaign.poll_source==0x1fa44){check(em_web_campaign_input_request(&c,0,PAD_A),"native paragraph continue input queued");next=c.vdp.frames+45;}
 }
 check(story_frames>0&&glyph_pixels>0,"genuine native story glyph pixels removed");check(exit_frames>0,"original PROCEED continuation entered briefing_exit");check(choice_pixels>0&&choice_mask_difference>0,"mode4 preserves real native choice sprites that mode1 masks");check(map_frames==8,"genuine native map remains exact raw frame after exit");
 printf("PASS briefing_exit mode4: %u completed frames audited, %u story/%u exit/%u map; %u original glyph pixels removed; %u choice-sprite pixels preserved (%u differ from mode1); all391624 CPU bytes immutable per projection; every outside-glyph/map pixel identical\n",audited,story_frames,exit_frames,map_frames,glyph_pixels,choice_pixels,choice_mask_difference);return 0;
}
