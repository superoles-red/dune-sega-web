/* Controlled offline native scene fixtures. No shipping game/source edits. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_campaign.h"
static CPU c,saved_registers;static DuneMouse mouse;static const char*outdir;static uint64_t next_input;
static void check(int ok,const char*msg){if(!ok){fprintf(stderr,"FAIL %s %s reason=%s\n",msg,em_web_campaign_report(&c),c.reason?c.reason:"");exit(1);}}
static void load(const char*path){FILE*f=fopen(path,"rb");check(f&&fread(&c,sizeof c,1,f)==1,"native fixture read");fclose(f);c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.audio_mode=AUDIO_MUTE;c.pad_buttons[0]=0;memset(&mouse,0,sizeof mouse);mouse.enabled=1;memset(&em_web_campaign,0,sizeof em_web_campaign);em_web_campaign_after_load(&c);next_input=c.vdp.frames+30;}
static void step(void){if(!em_web_campaign_observe(&c))dune_mouse_observe(&mouse,&c);machine_step(&c);check(!c.fault,"native execution");}
static void settle(unsigned frames){uint64_t end=c.vdp.frames+frames;c.pad_buttons[0]=0;while(!c.fault&&c.vdp.frames<end)machine_step(&c);check(!c.fault,"native settle without input");}
static void dump(const char*id,const char*ext,const void*data,size_t len){char path[4096];snprintf(path,sizeof path,"%s/%s.%s",outdir,id,ext);FILE*f=fopen(path,"wb");check(f!=NULL,"output");check(fwrite(data,1,len,f)==len,"output bytes");fclose(f);}
static void capture(const char*id){settle(32);dump(id,"cpu.bin",&c,sizeof c);dump(id,"rgb",c.vdp.frame,320*224*3);const char*j=em_web_campaign_report(&c);dump(id,"json",j,strlen(j));printf("CAPTURE %s frame=%llu pc=%06x\n",id,(unsigned long long)c.vdp.frames,c.pc);fflush(stdout);}
static void drive(void){
 if(c.vdp.frames<next_input||em_web_campaign.input_pending)return;
 if(em_web_campaign.poll_frame+3<c.vdp.frames)return;
 unsigned source=em_web_campaign.poll_source;
 if(source==0x1293a||source==0x12a22||source==0x1fa44||source==0x1f56a||source==0x1f5f2||source==0x272d2||source==0x272fa||source==0x11850){em_web_campaign_input_request(&c,0,PAD_A);next_input=c.vdp.frames+45;}
 else if(em_web_campaign.poll_pc==0x25cb2){em_web_campaign_input_request(&c,5,0);next_input=c.vdp.frames+45;}
}
static void original_free(unsigned pointer){
 saved_registers=c;unsigned stack=0xee00,low=stack;c.pc=0xba56;c.sr=0x2700;c.a[7]=0xff0000+stack;
 write_mem(&c,c.a[7],4,0xdead00);write_mem(&c,c.a[7]+4,4,0xff0000+pointer);
 unsigned steps=0;while(!c.fault&&c.pc!=0xdead00&&steps++<5000000){if((c.a[7]&65535)<low)low=c.a[7]&65535;translated_step(&c);}
 check(!c.fault&&c.pc==0xdead00,"original Building_Free completes controlled outcome fixture");
 memcpy(c.ram+low,saved_registers.ram+low,stack+12-low);memcpy(c.d,saved_registers.d,sizeof c.d);memcpy(c.a,saved_registers.a,sizeof c.a);c.pc=saved_registers.pc;c.sr=saved_registers.sr;c.usp=saved_registers.usp;c.ssp=saved_registers.ssp;
}
static void scenario_outcome(const char*path,int house,int mission,int win){
 load(path);
 /* Explicitly controlled fixture, not user-earned completion: deactivate the
  * losing side's buildings via original Building_Free. Native Building_Loop recounts them; native
  * scenarioFinished and victoryCondition must still choose the outcome.
  */
 if(win&&mission==1){unsigned h=dune_long(&c,0xc278)&65535;write_mem(&c,0xff0000+h+18,4,1200);write_mem(&c,0xffc058,4,1200);}
 else for(unsigned i=0;i<73;i++){unsigned p=read_mem(&c,0x4a71e + i*4,4)&65535;int owner=c.ram[p+8];if((dune_word(&c,p+4)&3)==3&&((win&&owner!=house)||(!win&&owner==house)))original_free(p);}
 uint64_t limit=c.vdp.frames+10000;int edge=0,movie=0,story=0,result=0,password=0,ending=0,credits=0;char id[96];
 while(!c.fault&&c.vdp.frames<limit){
  if(!edge&&em_web_campaign.outcome_seq){check(em_web_campaign.outcome==(win?1:2),"native genuine win/defeat matches fixture");check(em_web_campaign.outcome_house==house&&em_web_campaign.outcome_mission==mission,"outcome identity");edge=1;printf("OUTCOME h=%d m=%d %s seq=%llu\n",house,mission,win?"win":"defeat",(unsigned long long)em_web_campaign.outcome_seq);}
  if(edge&&!movie&&c.pc==0x4d4e&&dune_long(&c,c.a[7]&65535)==(win?0x1293a:0x12a22)){snprintf(id,sizeof id,"house%d-mission%02d-%s-movie",house,mission,win?"victory":"defeat");capture(id);movie=1;}
  if(edge&&!story&&c.pc==0x4d4e&&dune_long(&c,c.a[7]&65535)==(win?0x1f56a:0x1f5f2)){snprintf(id,sizeof id,"house%d-mission%02d-%s",house,mission,win?"victory":"defeat");capture(id);story=1;}
  if(edge&&!result&&c.pc==0x272d2){snprintf(id,sizeof id,"house%d-mission%02d-%s-results",house,mission,win?"victory":"defeat");capture(id);result=1;}
  if(edge&&!password&&c.pc==0x272fa){snprintf(id,sizeof id,"house%d-mission%02d-next-password",house,mission);capture(id);password=1;}
  if(edge&&mission==9&&win&&!ending&&c.pc==0x117b8){snprintf(id,sizeof id,"house%d-ending",house);capture(id);ending=1;}
  if(ending&&!credits&&c.pc==0x4d4e&&dune_long(&c,c.a[7]&65535)==0x11850){snprintf(id,sizeof id,"house%d-credits",house);capture(id);credits=1;break;}
  if(result&&(mission!=9||!win)&&c.pc==0x1253e)break;
  drive();step();
 }
 check(edge&&story&&result,"native outcome and results captured");if(mission==9&&win)check(ending&&credits,"native ninth victory reaches ending and credits");
}
int main(int argc,char**argv){check(argc==4,"usage BASELINE OUTDIR FIXTURE_DIR");outdir=argv[2];load(argv[1]);check(em_web_campaign_request(&c,0,1),"start Harkonnen1");int house=0,confirm=0,brief=0;uint64_t end=c.vdp.frames+7000;
 while(!c.fault&&em_web_campaign.pending&&c.vdp.frames<end){
  if(!house&&c.pc==0x4938){capture("house-picker");house=1;}
  if(c.pc==0x25cb2){if(!confirm){capture("house-confirm");confirm=1;}else if(em_web_campaign.stage==4&&!brief){capture("campaign-briefing");brief=1;}}
  drive();step();
 }
 check(house&&confirm&&brief&&!em_web_campaign.pending,"house and native campaign briefing captures");char path[4096];
 snprintf(path,sizeof path,"%s/house1-mission01.cpu.bin",argv[3]);scenario_outcome(path,1,1,1);scenario_outcome(path,1,1,0);
 for(int h=0;h<3;h++){snprintf(path,sizeof path,"%s/house%d-mission09.cpu.bin",argv[3],h);scenario_outcome(path,h,9,1);}
 puts("PASS all native scene fixtures, genuine outcome branches and final house endings");return 0;
}
