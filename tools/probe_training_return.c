/* Continuous original-program training probe; no runtime/gameplay patch. */
#define main archived_demo_probe_main
#include "build_demo_fixture_native.c"
#undef main
#define EM_WEB_TRAINING_NO_EXPORTS
#include "em_web_training.h"
static unsigned tank=0xff2784,harv=0xff2810,enemy=0xff289c,refinery,yard;
static void snap(const char*label){unsigned a=harv&65535,b=refinery&65535,h=dune_long(&c,0xc278)&65535,pool=dune_long(&c,0xdc24)&65535,canonical=pool+dune_word(&c,0xc274)*70;
 printf("%s frame%llu Harv %u,%u HP%u cargo%u action%u flags4=%04x flags6=%04x move92=%04x attack90=%04x link3=%u RefHP%u flags4=%04x flags6=%04x link3=%u credits%u canonical%u display%u counter%u houseptr%04x canonicalptr%04x\n",label,(unsigned long long)c.vdp.frames,dune_word(&c,a+12)/8,dune_word(&c,a+10)/8,dune_word(&c,a+18),c.ram[a+94],c.ram[a+84],dune_word(&c,a+4),dune_word(&c,a+6),dune_word(&c,a+92),dune_word(&c,a+90),c.ram[a+3],dune_word(&c,b+18),dune_word(&c,b+4),dune_word(&c,b+6),c.ram[b+3],dune_long(&c,h+18),dune_long(&c,canonical+18),dune_long(&c,0xc058),dune_long(&c,0xd6c0),h,canonical);fflush(stdout);
}
static void step_probe(void){if(!em_web_menu_select_observe(&mouse,&c))dune_mouse_observe(&mouse,&c);if(c.pc==0x281bc)printf("NATIVE A actor%06x action%u tile%u targetB%06x\n",c.a[2]&0xffffff,c.d[4]&65535,c.d[3]&4095,c.a[4]&0xffffff);machine_step(&c);check(!c.fault,"healthy original continuous probe");}
static void pf(unsigned n){uint64_t end=c.vdp.frames+n;while(c.vdp.frames<end)step_probe();}
static void click(unsigned x,unsigned y,unsigned button){uint64_t clicks=mouse.clicks,end=c.vdp.frames+180;if(dune_mouse_context(&c)==1)dune_mouse_world_click(&mouse,&c,x,y,button);else dune_mouse_click(&mouse,&c,x,y,button);while(mouse.clicks==clicks&&c.vdp.frames<end)step_probe();check(mouse.clicks==clicks+1,"one native probe click");pf(12);}
static void actor(unsigned p){unsigned a=p&65535;click(dune_word(&c,a+12)/8+8,dune_word(&c,a+10)/8+8,1);}
static void clear(void){click(dune_word(&c,0xe3ec)+160,dune_word(&c,0xe3ee)+112,3);}
int main(int argc,char**argv){if(argc<2)return 2;load(argv[1]);refinery=0xff0000+own_type(12);yard=0xff0000+own_type(8);check(refinery&&yard,"training native producers");snap("START");
 actor(tank);actor(enemy);uint64_t end=c.vdp.frames+6000;while(active(enemy&65535)&&c.vdp.frames<end)pf(1);check(!active(enemy&65535),"native attack destroys fullHP target");clear();snap("AFTER ATTACK");
 if(argc>2){actor(tank);actor(refinery);end=c.vdp.frames+9000;while(dune_word(&c,(refinery&65535)+18)>558&&c.vdp.frames<end)pf(1);check(dune_word(&c,(refinery&65535)+18)>400,"original friendly attack leaves alive damaged Refinery");actor(tank);click(688,1040,1);pf(300);clear();snap("AFTER DAMAGE");}
 open(yard&65535);int cell=-1;for(int i=0;i<18;i++)if(em_web_menu_select_item(&c,2,i%3,i/3)==1)cell=i;check(cell>=0,"Concrete4 native purchase");click(48+32*(cell%3),60+24*(cell/3),1);click(48+32*(cell%3),60+24*(cell/3),1);end=c.vdp.frames+3000;while(!(dune_word(&c,(yard&65535)+6)&0x2000)&&c.vdp.frames<end)pf(1);clear();actor(yard);click(16*32+16,34*32+16,1);check(!(dune_word(&c,(yard&65535)+6)&0x2000),"actual Concrete4 placement16,34");clear();snap("AFTER CONCRETE");
 actor(harv);click(12*32+16,20*32+16,1);end=c.vdp.frames+18000;while(c.ram[(harv&65535)+94]<100&&c.vdp.frames<end)pf(1);check(c.ram[(harv&65535)+94]==100,"full actual native100cargo");snap("FULL");clear();actor(harv);click(432,1040,1);snap("A REFINERY TOP");for(unsigned i=0;i<20;i++){pf(300);snap("RETURN TOP");if(!(dune_word(&c,(harv&65535)+4)&2))break;}
 clear();actor(harv);click(464,1072,1);snap("A REFINERY BOTTOM");for(unsigned i=0;i<20;i++){pf(300);snap("RETURN BOTTOM");if(!c.ram[(harv&65535)+94])break;}
 return 0;
}
