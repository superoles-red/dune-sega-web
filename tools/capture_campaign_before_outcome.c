/* Controlled test states BEFORE original finish/victory predicates execute.
 * No runtime cheat endpoint. Original scheduler is allowed to reach its own
 * $22AB2 checkpoint naturally; no PC, finish flags or victory result is forged.
 */
#define main campaign_scene_capture_program_main
#include "capture_campaign_scenes.c"
#undef main
static void before_outcome(const char*path,int win){
 load(path);unsigned player=em_web_campaign_house(&c);
 if(win){unsigned house=dune_long(&c,0xc278)&65535;write_mem(&c,0xff0000+house+18,4,1200);write_mem(&c,0xffc058,4,1200);}
 else for(unsigned i=0;i<73;i++){unsigned p=read_mem(&c,0x4a71e + i*4,4)&65535;if((dune_word(&c,p+4)&3)==3&&c.ram[p+8]==player)original_free(p);}
 uint64_t end=c.vdp.frames+10000;int captured=0;char id[96];snprintf(id,sizeof id,"house1-mission01-pre-%s",win?"victory":"defeat");
 while(!c.fault&&c.vdp.frames<end){
  int ready=win?(dune_word(&c,0xdbee)>0&&dune_long(&c,0xc058)>=dune_word(&c,(dune_long(&c,0xc278)&65535)+32)):dune_word(&c,0xdbee)==0;
  if(c.pc==0x22ab2&&dune_mouse_context(&c)==1&&dune_long(&c,0xc598)>=dune_long(&c,0xdc28)&&ready){
   check(!em_web_campaign.outcome_seq&&!em_web_campaign.result_check,"no outcome edge or result predicate entered");
   dump(id,"cpu.bin",&c,sizeof c);dump(id,"rgb",c.vdp.frame,320*224*3);
   const char*report=em_web_campaign_report(&c);char json[8192];size_t n=strlen(report);check(n+600<sizeof json,"metadata capacity");memcpy(json,report,n-1);snprintf(json+n-1,sizeof json-(n-1),",\"controlledOutcomeFixture\":true,\"intendedOutcome\":\"%s\",\"nativeOutcomeEdgeReached\":false,\"nativePredicateEntry\":142002,\"provenance\":\"Controlled offline native quota/Building_Free; original scheduler progressed naturally to $22AB2 before scenarioFinished/victoryCondition. Not user-earned completion.\"}",win?"victory":"defeat");dump(id,"json",json,strlen(json));captured=1;break;
  }
  step();
 }
 check(captured,"natural before-predicate original checkpoint reached");
 end=c.vdp.frames+600;while(!c.fault&&!em_web_campaign.outcome_seq&&c.vdp.frames<end)step();check(em_web_campaign.outcome_seq==1&&em_web_campaign.outcome==(win?1:2),"saved pre-state executes original expected native outcome");
 printf("PASS %s:map context1/fault0/original PC22AB2; executing gives exactly1checked %s edge\n",id,win?"victory":"defeat");fflush(stdout);
}
int main(int argc,char**argv){check(argc==3,"usage MAP_CPU OUTDIR");outdir=argv[2];before_outcome(argv[1],1);before_outcome(argv[1],0);return 0;}
