/* Native menu intent / outcome edge regression; offline fixtures only. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_campaign.h"
static CPU c,baseline,before;
static DuneMouse mouse;
static unsigned consumed;
static void check(int ok,const char*msg){if(!ok){fprintf(stderr,"FAIL %s %s reason=%s\n",msg,em_web_campaign_report(&c),c.reason?c.reason:"");exit(1);}}
static void reset(void){c=baseline;c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.audio_mode=AUDIO_MUTE;c.pad_buttons[0]=0;memset(&mouse,0,sizeof mouse);mouse.enabled=1;memset(&em_web_campaign,0,sizeof em_web_campaign);em_web_campaign_after_load(&c);consumed=0;}
static void step(void){uint64_t seq=em_web_campaign.input_seq;if(!em_web_campaign_observe(&c))dune_mouse_observe(&mouse,&c);consumed+=(unsigned)(em_web_campaign.input_seq-seq);machine_step(&c);}
static void frames(unsigned n){uint64_t end=c.vdp.frames+n;while(!c.fault&&c.vdp.frames<end)step();check(!c.fault,"native machine healthy");}
static void until_input(unsigned max){uint64_t end=c.vdp.frames+max;while(!c.fault&&em_web_campaign.input_pending&&c.vdp.frames<end)step();check(!c.fault&&!em_web_campaign.input_pending,"native queued input consumed");}
static void original_win_fixture(void){unsigned house=dune_long(&c,0xc278)&65535;write_mem(&c,0xff0000+house+18,4,1200);write_mem(&c,0xffc058,4,1200);}
int main(int argc,char**argv){check(argc==2,"map CPU snapshot required");FILE*f=fopen(argv[1],"rb");check(f&&fread(&baseline,sizeof baseline,1,f)==1,"snapshot read");fclose(f);reset();
 before=c;const char*json=em_web_campaign_report(&c);check(strstr(json,"\"houseId\":1")!=NULL,"getter native house");check(!memcmp(&c,&before,sizeof c),"getter whole CPU immutable");
 check(!em_web_campaign_request(&c,-1,1)&&!em_web_campaign_request(&c,0,0)&&!em_web_campaign_request(&c,3,9)&&!em_web_campaign_request(&c,1,10),"reject invalid house/mission");check(!memcmp(&c,&before,sizeof c),"invalid start never mutates CPU/save");
 check(em_web_campaign_input_request(&c,0,PAD_START),"queue native Start");check(!memcmp(&c,&before,sizeof c),"queue Start never mutates CPU/save");until_input(15);frames(130);check(em_web_campaign.poll_source==0x20f24,"original Start opens pause/options");
 unsigned sound=c.ram[0xdc51],music=c.ram[0xdc50];check(em_web_campaign_input_request(&c,1,1),"queue native sound row");until_input(90);frames(4);check(c.ram[0xdc51]!=sound&&c.ram[0xdc50]==music,"original sound handler toggles only sound");check(consumed==2,"Start and sound each one final native intent");
 unsigned oldsong=em_web_campaign.options_music_test;check(em_web_campaign_input_request(&c,2,3),"queue native music test Right");until_input(90);frames(5);check(em_web_campaign.options_music_test!=oldsong,"original music test selection changes by native Right");
 check(em_web_campaign_input_request(&c,1,6),"open original Restart confirmation");until_input(90);frames(80);check(em_web_campaign.poll_source==0x21ae6,"original horizontal confirmation ready");check(strstr(em_web_campaign_report(&c),"horizontal")&&strstr(em_web_campaign_report(&c),"ARE YOU SURE?"),"native confirm style and original message exposed");
 check(em_web_campaign_input_request(&c,5,1),"queue original No");until_input(90);frames(80);check(em_web_campaign.poll_source==0x20f24&&!dune_word(&c,0xc14c),"original No returns options without restart");
 check(!em_web_campaign_input_request(&c,1,5),"password row is absent");
 check(em_web_campaign_input_request(&c,0,PAD_START),"queue one native Resume");until_input(15);frames(120);check(dune_mouse_context(&c)==1,"original Resume returns map");check(consumed==6,"six queued operations consumed once");check(!em_web_campaign.outcome_seq,"native options/resume cannot win");puts("PASS original pause/music/sound/Resume one-shot input without RAM-option writes");
 /* A save restoration itself is not a completion event, even at a win edge. */
 before=c;uint64_t seq=em_web_campaign.outcome_seq;c.pc=0x22afc;em_web_campaign_after_load(&c);em_web_campaign_observe(&c);check(em_web_campaign.outcome_seq==seq,"loaded arbitrary victory PC is not a native checked win");c=before;em_web_campaign_after_load(&c);
 original_win_fixture();uint64_t end=c.vdp.frames+2400;while(!c.fault&&!em_web_campaign.outcome_seq&&c.vdp.frames<end)step();check(em_web_campaign.outcome_seq==1&&em_web_campaign.outcome==1&&em_web_campaign.outcome_house==1&&em_web_campaign.outcome_mission==1,"original quota conditions produce one verified victory edge");check(c.pc!=0x22afc,"machine executes original outcome path");frames(30);check(em_web_campaign.outcome_seq==1,"victory event is a single edge");puts("PASS real original scenarioFinished/victoryCondition branch produces one checked victory edge");
 reset();/* Offline defeat fixture changes the original existing Yard health;
  * use native destruction routine later rather than fabricate a victory PC. */
 puts("PASS load/reset and invalid requests do not erase save or manufacture victory");return 0;
}
