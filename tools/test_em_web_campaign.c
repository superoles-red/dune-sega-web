/* Campaign adapter regression against the pinned USA original native CPU. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_campaign.h"
static CPU c,baseline;
static DuneMouse mouse;
static void require(int ok,const char*msg){if(!ok){fprintf(stderr,"FAIL %s %s reason=%s\n",msg,em_web_campaign_report(&c),c.reason?c.reason:"");exit(1);}}
static void reset(void){c=baseline;c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.audio_mode=AUDIO_MUTE;c.pad_buttons[0]=0;memset(&mouse,0,sizeof mouse);mouse.enabled=1;memset(&em_web_campaign,0,sizeof em_web_campaign);em_web_campaign_after_load(&c);}
static void run_frames(unsigned n,int skip){uint64_t end=c.vdp.frames+n;while(!c.fault&&c.vdp.frames<end){
 /* Test driver supplies original pad presses only to dismiss original briefing
  * screens. The campaign adapter itself never skips a requested briefing. */
 c.pad_buttons[0]=skip&&em_web_campaign.stage==4&&c.vdp.frames%90<5?PAD_C:0;
 if(!em_web_campaign_observe(&c))dune_mouse_observe(&mouse,&c);
 machine_step(&c);
 }require(!c.fault,"original native machine healthy");}
static void dump(const char*dir,const char*name,const void*data,size_t len){char path[4096];snprintf(path,sizeof path,"%s/%s",dir,name);FILE*f=fopen(path,"wb");require(f!=NULL,"fixture output");require(fwrite(data,1,len,f)==len,"fixture bytes");fclose(f);}
int main(int argc,char**argv){require(argc>=2,"CPU snapshot path required");FILE*f=fopen(argv[1],"rb");require(f&&fread(&baseline,sizeof baseline,1,f)==1,"snapshot read");fclose(f);
 for(int h=0;h<3;h++)for(int m=1;m<=9;m++){
 reset();require(em_web_campaign_request(&c,h,m),"valid campaign request");unsigned budget=0;
 while(em_web_campaign.pending&&budget++<5000)run_frames(1,1);
 require(!em_web_campaign.pending&&em_web_campaign.stage==0&&em_web_campaign.starts==1,"original campaign start reaches map");
 require(em_web_campaign_house(&c)==h&&em_web_campaign_mission(&c)==m&&dune_word(&c,0xc04c)==m,"original house/mission selectors");
 require(dune_mouse_context(&c)==1&&em_web_campaign.armed,"native map active and genuine outcome armed");
 require(!em_web_campaign.outcome_seq&&!em_web_campaign.outcome,"start and scene transitions cannot manufacture victory");
 unsigned house=dune_long(&c,0xc278)&65535;unsigned buildings=0,units=0;
 for(unsigned i=0;i<73;i++){unsigned p=read_mem(&c,0x4a71e + i*4,4)&65535;buildings+=(dune_word(&c,p+4)&3)==3;}
 for(unsigned i=0;i<102;i++){unsigned p=read_mem(&c,0x4a85a + i*4,4)&65535;units+=(dune_word(&c,p+4)&3)==3;}
 printf("START h=%d mission=%d region=%d frames=%u credits=%u quota=%u units=%u buildings=%u\n",h,m,em_web_campaign_region(h,m),budget,dune_long(&c,house+18),dune_word(&c,house+32),units,buildings);fflush(stdout);
 if(argc>=3){char name[128];snprintf(name,sizeof name,"house%d-mission%02d.cpu.bin",h,m);dump(argv[2],name,&c,sizeof c);run_frames(40,0);snprintf(name,sizeof name,"house%d-mission%02d.rgb",h,m);dump(argv[2],name,c.vdp.frame,320*224*3);}
 }
 puts("PASS all27 native campaign starts and zero false victory edges");return 0;
}
