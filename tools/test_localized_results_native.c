/* Offline native Results proof. Natural advisor->Results progression; an
 * explicit test-only second run supplies nonzero original Stats arguments at
 * the native271E2 call boundary to exercise all six original count-up routines.
 * No instructions/PC jumps, no adapter/gameplay writes during presentation. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_world_intent.h"
#include "em_web_frame.h"
#include "em_web_campaign.h"
static CPU c,before,palette_fixture;
static unsigned checked,numeric_frames,changed_frames,early_rank,ink_frames,scroll_frames;
static unsigned nonzero_counters,ink_levels[256];static int have_palette_fixture;
static unsigned credit_frames,credit_changed,credit_partial,credit_seen;
static const char*const credit_roles[]={"The End","Executive producer","Producers","Product Coordinators","Designers","Programmers","Writer","Artists","Music and Sound","Voices","Frank Klepacki - House voices","Glenn Sperry - Units","Quality Assurance","Special thanks to","Thank you for playing"};
static const unsigned digits[8][4]={{72,24,40,8},{240,24,40,8},{256,104,40,8},{256,112,40,8},{256,144,40,8},{256,152,40,8},{256,184,40,8},{256,192,40,8}};
static void check(int ok,const char*message){if(!ok){fprintf(stderr,"FAIL %s pc=%06x scene=%s phase=%s frame=%llu\n",message,c.pc,em_web_campaign.scene?em_web_campaign.scene:"?",em_web_campaign.presentation_phase?em_web_campaign.presentation_phase:"?",(unsigned long long)c.vdp.frames);exit(1);}}
static int in_rect(unsigned x,unsigned y,const unsigned*r){return x>=r[0]&&x<r[0]+r[2]&&y>=r[1]&&y<r[1]+r[3];}
static void verify_frame(void){
 int active=em_web_campaign.presentation_phase&&!strncmp(em_web_campaign.presentation_phase,"results",7);
 before=c;em_web_frame_capture(&c);const uint8_t*clean=em_web_frame_textless(&c,active?5:0);check(clean!=NULL,"completed readonly result frame");
 unsigned mask=active?em_web_frame_results_label_mask(&c):0;char rank[41];uint8_t ink[3],yellow[3];em_web_frame_results_rank(&c,rank);em_web_frame_results_ink(&c,61,ink);em_web_frame_results_ink(&c,40,yellow);
 check(!memcmp(&c,&before,sizeof c),"whole CPU immutable including RAM/VRAM/CRAM/stack/audio/timers");
 unsigned changed=0,numeric=0;
 for(unsigned y=0;y<224;y++)for(unsigned x=0;x<320;x++){
  unsigned at=(y*320+x)*3,entry=vdp_word(&em_web_frame_vdp,em_web_frame_a_address(&em_web_frame_vdp,x,y));
  int differs=memcmp(clean+at,c.vdp.frame+at,3)!=0;
  if(differs){int label=0;for(unsigned i=0;i<12;i++){const uint16_t*r=em_web_frame_results_labels[i];label|=x>=r[0]&&x<r[0]+r[2]&&y>=r[1]&&y<r[1]+r[3];}check(label||(y>=56&&y<64),"no artwork changed outside exact label/rank rows");++changed;}
  for(unsigned i=0;i<8;i++)if(in_rect(x,y,digits[i])){check(!differs,"every original score/clock/count-up pixel byte-identical");if((entry&2047)>=0x530&&(entry&2047)<=0x539)numeric=1;}
 }
 if(changed)++changed_frames;if(numeric)++numeric_frames;
 if(active&&mask==4095&&!have_palette_fixture){palette_fixture=c;have_palette_fixture=1;}
 for(unsigned i=0;i<6;i++)for(unsigned x=256;x<296;x+=8){unsigned tile=vdp_word(&em_web_frame_vdp,em_web_frame_a_address(&em_web_frame_vdp,x,digits[i+2][1]))&2047;if(tile>=0x531&&tile<=0x539)nonzero_counters|=1u<<i;}
 if(rank[0]&&em_web_campaign.poll_source!=0x272d2)++early_rank;
 if(mask&1){
  unsigned entry=vdp_word(&em_web_frame_vdp,em_web_frame_a_address(&em_web_frame_vdp,24,24));int found=0;
  for(unsigned yy=0;yy<8;yy++)for(unsigned xx=0;xx<8;xx++)if(vdp_pattern(&em_web_frame_vdp,entry&2047,xx,yy)==13){unsigned at=((24+yy)*320+24+xx)*3;check(!memcmp(ink,c.vdp.frame+at,3),"white-label ink matches actual completed native fade palette");found=1;}
  if(found){++ink_frames;ink_levels[ink[0]]=1;}
 }
 if(em_web_campaign.presentation_phase&&!strcmp(em_web_campaign.presentation_phase,"password_scroll"))++scroll_frames;
 ++checked;
}
static void run(const char*path,int controlled){
 FILE*f=fopen(path,"rb");check(f&&fread(&c,sizeof c,1,f)==1&&fgetc(f)==EOF,"native advisor fixture ABI");fclose(f);c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.audio_mode=AUDIO_MUTE;
 memset(&em_web_campaign,0,sizeof em_web_campaign);em_web_campaign_after_load(&c);em_web_frame_invalidate(&c);
 uint64_t first=c.vdp.frames,last_render=c.vdp.rendered_frames;int injected=0,saw_results=0;unsigned waits=0;
 while(!c.fault&&c.vdp.frames<first+1500){
  c.pad_buttons[0]=c.vdp.frames%60<4?PAD_C:0;
  if(controlled&&!injected&&c.pc==0x271e2){unsigned sp=c.a[7];write_mem(&c,sp+8,4,1234);for(unsigned i=0;i<6;i++)write_mem(&c,sp+12+i*2,2,17-i*2);injected=1;}
  em_web_campaign_observe(&c);if(em_web_campaign.scene&&!strcmp(em_web_campaign.scene,"results"))saw_results=1;
  if(saw_results&&(em_web_campaign.poll_source==0x272d2||em_web_campaign.poll_source==0x272fa))++waits;
  machine_step(&c);
  if(c.vdp.rendered_frames!=last_render){last_render=c.vdp.rendered_frames;if(saw_results)verify_frame();}
  if(saw_results&&em_web_campaign.scene&&!strcmp(em_web_campaign.scene,"password_display"))break;
 }
 check(!c.fault,"original native scene execution healthy");check(saw_results&&waits,"natural native Results reached and completed");if(controlled)check(injected,"nonzero test-only count-up arguments supplied at real native entry");
}
static void verify_credits(void){
 before=c;em_web_frame_capture(&c);EmWebLocalizedLine lines[29];unsigned count=em_web_frame_credit_lines(&c,lines,29);const uint8_t*clean=em_web_frame_textless(&c,6);check(clean!=NULL,"completed readonly credits frame");check(!memcmp(&c,&before,sizeof c),"credits wholeCPU immutable");
 for(unsigned i=0;i<count;i++){
  for(unsigned r=0;r<15;r++)if(!strcmp(lines[i].text,credit_roles[r]))credit_seen|=1u<<r;if(lines[i].y<0||lines[i].y>216)++credit_partial;
  int found=0;for(int y=lines[i].y<0?0:lines[i].y;y<lines[i].y+8&&y<224&&!found;y++)for(int x=lines[i].x;x<lines[i].x+lines[i].width&&!found;x++){
   unsigned sx,sy,at=vdp_plane_address(&em_web_frame_vdp,0,(unsigned)x,(unsigned)y,&sx,&sy),entry=vdp_word(&em_web_frame_vdp,at);
   if(vdp_pattern(&em_web_frame_vdp,entry&2047,sx&7,sy&7)==13){check(!memcmp(lines[i].ink,c.vdp.frame+(y*320+x)*3,3),"each scrolling role uses its exact native palette ink (yellow lane2/white lane3)");found=1;}
  }
 }
 unsigned changed=0;
 for(unsigned y=0;y<224;y++)for(unsigned x=0;x<320;x++){
  unsigned at=(y*320+x)*3;int differs=memcmp(clean+at,c.vdp.frame+at,3)!=0;if(!differs)continue;
  int allowed=0;for(unsigned i=0;i<count;i++){EmWebLocalizedLine*r=&lines[i];allowed|=(int)x>=r->x&&(int)x<r->x+r->width&&(int)y>=r->y&&(int)y<r->y+8;}
  check(allowed,"all proper author names, legal notices, planet/artwork untouched outside whitelisted roles");++changed;
 }
 if(changed)++credit_changed;++credit_frames;
}
static void run_credits(const char*path){
 FILE*f=fopen(path,"rb");check(f&&fread(&c,sizeof c,1,f)==1&&fgetc(f)==EOF,"native ending fixture ABI");fclose(f);c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.audio_mode=AUDIO_MUTE;c.pad_buttons[0]=0;em_web_frame_invalidate(&c);verify_credits();
 uint64_t first=c.vdp.frames,last=c.vdp.rendered_frames;
 while(!c.fault&&c.vdp.frames<first+6500){machine_step(&c);if(last!=c.vdp.rendered_frames){last=c.vdp.rendered_frames;if(c.vdp.frames%3==0)verify_credits();}}
 check(!c.fault,"original credits stream healthy");fprintf(stderr,"credits coverage mask=%u frames=%u changed=%u partial=%u\n",credit_seen,credit_frames,credit_changed,credit_partial);for(unsigned i=0;i<15;i++)if(!(credit_seen&(1u<<i)))fprintf(stderr,"not yet observed: %s\n",credit_roles[i]);check(credit_seen==32767&&credit_changed>100&&credit_partial,"all15 source roles/TheEnd observed through native fractional scrolling");
 printf("PASS native ending/credits: %u completed source frames, %u localized-role frames, all15 source roles/TheEnd, %u partially clipped row observations; names/legal/artwork retained, wholeCPU immutable\n",credit_frames,credit_changed,credit_partial);
}
int main(int argc,char**argv){
 check(argc==2||argc==3,"advisor CPU fixture argument, optional ending fixture");run(argv[1],0);run(argv[1],1);unsigned levels=0;for(unsigned i=0;i<256;i++)levels+=ink_levels[i];
 check(checked>100&&numeric_frames>50&&changed_frames>50&&early_rank&&ink_frames>50,"meaningful completed-frame/count-up/early-rank coverage");check(nonzero_counters==63&&have_palette_fixture,"all six genuine native nonzero count-ups observed");
 printf("PASS native stream: %u completed frames, %u numeric frames unchanged, %u localized-label frames, %u early native-rank frames, %u exact native-ink frames/%u observed ink levels, %u native password-scroll frames; all6 nonzero counters; wholeCPU immutable\n",checked,numeric_frames,changed_frames,early_rank,ink_frames,levels,scroll_frames);
 /* Separate explicitly controlled palette matrix, not a claim that a native
  * fade happened in these two streams (their static-label white stays255).
  * All original VDP pixels are rendered by the original renderer each time. */
 for(unsigned level=0;level<8;level++){
  c=palette_fixture;c.vdp.cram[61]=(uint16_t)((level<<1)|(level<<5)|(level<<9));c.vdp.cram[40]=(uint16_t)((level<<1)|(level<<5));vdp_render(&c);em_web_campaign.scene="results";em_web_campaign.presentation_phase="results_counting";em_web_frame_invalidate(&c);verify_frame();
 }
 puts("PASS controlled native VDP palette matrix: all8 hardware white/yellow intensity levels, exact source ink, all numeric pixels and wholeCPU unchanged by readonly getters");if(argc==3)run_credits(argv[2]);return 0;
}
