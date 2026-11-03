/* Separate offline authored tutorial: original helpers and original execution.
 * Never linked into the browser; runtime training observer is read-only. */
#define main archived_demo_fixture_main
#define frames(...) demo_fixture_frames(__VA_ARGS__)
#include "build_demo_fixture_native.c"
#undef main
#undef frames
#define EM_WEB_TRAINING_NO_EXPORTS
#include "em_web_training.h"
static struct{int paused,stopped;DuneMouse dune_mouse;}em_host;
static CPU*training_cpu_pointer=&c;
#define em_cpu (*training_cpu_pointer)
#define em_window 1
#define EMSCRIPTEN_KEEPALIVE
#define EM_WEB_SELECTION_NO_SCREEN
#include "em_web_selection.h"
#undef em_cpu
#undef em_window
static void training_step(void){em_host.dune_mouse=mouse;em_web_selection_observe();mouse=em_host.dune_mouse;if(!em_web_menu_select_observe(&mouse,&c))dune_mouse_observe(&mouse,&c);machine_step(&c);check(!c.fault,"native tutorial scheduler");}
static void frames(unsigned n){uint64_t end=c.vdp.frames+n;while(c.vdp.frames<end)training_step();}
static unsigned training_tank,training_harvester,training_enemy,training_spice,training_yard,training_refinery,training_remote;
static unsigned removed_units,removed_buildings,disabled_waves,disabled_teams;
static void remove_original(unsigned p,int building){unsigned a[]={p},s[]={4};call(building?0xba56:0x43504,a,s,1,0);check(!(dune_word(&c,(p&65535)+4)&1),"original removal frees the native actor");if(building)removed_buildings++;else removed_units++;}
static unsigned unit_site(unsigned cx,unsigned cy,unsigned min_distance,unsigned away){
 unsigned best=0,score=~0u;
 for(unsigned y=2;y<61;y++)for(unsigned x=2;x<61;x++){unsigned tile=y*64+x,a=0x7d9c+tile*4,kind=terrain(tile);if(c.ram[a+2]&48||!(kind==0||kind==1||kind==4||kind==5))continue;int dx=(int)x-(int)cx,dy=(int)y-(int)cy;unsigned d=dx*dx+dy*dy;if(away){int ax=(int)x-(int)(away&63),ay=(int)y-(int)(away/64);if(ax*ax+ay*ay<(int)(min_distance*min_distance))continue;}if(d<score){score=d;best=tile;}}
 check(best,"native passable empty unit site");return best;
}
static unsigned create_unit(unsigned id,unsigned type,unsigned owner,unsigned tile){
 unsigned packed=(((tile/64<<8)|128)<<16)|(((tile&63)<<8)|128),a[]={id,type,owner,packed,128},s[]={2,2,2,4,2};unsigned p=call(0x468ba,a,s,5,1);
 check(p==em_training_unit(id)&&active(p&65535)&&c.ram[(p&65535)+8]==owner,"original Unit_Create exact fixture actor");
 unsigned action[]={p,3},sizes[]={4,2};call(0x436a8,action,sizes,2,0);return p;
}
static void reveal(unsigned tile,unsigned radius){unsigned packed=(((tile/64<<8)|128)<<16)|(((tile&63)<<8)|128),a[]={packed,radius},s[]={4,2};call(0x1a002,a,s,2,0);}
static void training_click(unsigned wx,unsigned wy,unsigned button){
 uint64_t clicks=mouse.clicks,end=c.vdp.frames+180;if(dune_mouse_context(&c)==1)dune_mouse_world_click(&mouse,&c,wx,wy,button);else dune_mouse_click(&mouse,&c,wx,wy,button);
 while(!c.fault&&mouse.clicks==clicks&&c.vdp.frames<end)training_step();check(mouse.clicks==clicks+1&&!c.fault,"one genuine native pointer click consumed");frames(12);
}
static void click_actor(unsigned pointer){unsigned a=pointer&65535;training_click(dune_word(&c,a+12)/8+8,dune_word(&c,a+10)/8+8,DUNE_CLICK_SELECT);}
static void clear_native(void){em_host.dune_mouse=mouse;check(dune_web_clear_selection(),"actual modern pure-Clear request");mouse=em_host.dune_mouse;uint64_t end=c.vdp.frames+180;while(c.vdp.frames<end&&(em_web_selection.operation||em_web_selection.phase||em_web_selection.clear_requested))frames(1);check(!dune_long(&c,0xc25c)&&!dune_long(&c,0xc578)&&!em_web_selection.operation&&!em_web_selection.phase,"native pure clear completes without a repeat-build B");}
static void restore_training(void){c=base;memset(&mouse,0,sizeof mouse);mouse.enabled=1;memset(&em_host,0,sizeof em_host);memset(&em_web_menu_select,0,sizeof em_web_menu_select);dune_web_selection_reset();}
static unsigned concrete_count(void){unsigned n=0;for(unsigned t=0;t<4096;t++)if(em_training_terrain(&c,t)==10)n++;return n;}
static void verify_continuous(void){
 restore_training();unsigned a=training_tank&65535,e=training_enemy&65535;click_actor(training_tank);training_click(17*32+16,31*32+16,1);frames(300);clear_native();click_actor(training_tank);click_actor(training_enemy);uint64_t end=c.vdp.frames+6000;while(active(e)&&c.vdp.frames<end)frames(1);check(!active(e),"continuous native Tank attack destroys the original target");clear_native();click_actor(training_tank);training_click(688,1040,1);frames(500);clear_native();
 open(training_yard&65535);int cell=-1;for(int i=0;i<18;i++)if(em_web_menu_select_item(&c,2,i%3,i/3)==1)cell=i;check(cell>=0,"continuous native Concrete4 catalogue");training_click(48+32*(cell%3),60+24*(cell/3),1);training_click(48+32*(cell%3),60+24*(cell/3),1);a=training_yard&65535;end=c.vdp.frames+3000;while(!(dune_word(&c,a+6)&0x2000)&&c.vdp.frames<end)frames(1);check(dune_word(&c,a+6)&0x2000,"continuous paid Concrete4 completed");clear_native();click_actor(training_yard);unsigned slabs=concrete_count();training_click(16*32+16,34*32+16,1);check(!(dune_word(&c,a+6)&0x2000)&&concrete_count()==slabs+4,"continuous Concrete4 native place at16,34");clear_native();
 a=training_harvester&65535;click_actor(training_harvester);training_click((training_spice&63)*32+16,(training_spice/64)*32+16,1);end=c.vdp.frames+18000;while(c.ram[a+94]<100&&c.vdp.frames<end)frames(1);check(c.ram[a+94]==100,"continuous original gathering reaches full100cargo");clear_native();click_actor(training_harvester);training_click(400,1008,1);end=c.vdp.frames+6000;while(c.vdp.frames<end&&(dune_word(&c,a+12)/8!=400||dune_word(&c,a+10)/8!=1008))frames(1);check(dune_word(&c,a+12)/8==400&&dune_word(&c,a+10)/8==1008,"full Harvester reaches original previously blocked NW approach");
 clear_native();click_actor(training_harvester);unsigned bank=money();training_click(432,1040,1);end=c.vdp.frames+9000;unsigned observed_stored=0;while(c.vdp.frames<end&&c.ram[a+94]){frames(1);if((dune_word(&c,a+4)&7)!=3){observed_stored++;test_saved=c;const char*j=em_web_training_json_for(&c);check(em_training_alive(&c,training_harvester,0)&&strstr(j,"\"stored\":true")&&!memcmp(&c,&test_saved,sizeof c),"native stored Harvester remains alive in read-only observer");}}
 check(!c.ram[a+94]&&money()>bank&&observed_stored,"continuous full cargo enters Refinery and increases actual credits");printf("PASS CONTINUOUS no-restore Tank move/attack -> Concrete4(16,34) -> cargo100 -> waypoint400,1008 -> native Refinery delivery credits%u->%u, storedFrames%u\n",bank,money(),observed_stored);fflush(stdout);restore_training();
}
static void verify_training(void){
 test_saved=c;const char*j=em_web_training_json_for(&c);check(!memcmp(&c,&test_saved,sizeof c)&&strstr(j,"\"active\":true"),"training observer is whole-CPU read-only");
 for(unsigned tile=0;tile<4096;tile++)check(em_training_terrain(&c,tile)==terrain(tile),"pure terrain observer equals original classifier all4096tiles");
 frames(108000);check(dune_mouse_context(&c)==1&&active(training_tank&65535)&&active(training_enemy&65535)&&dune_word(&c,(training_tank&65535)+18)==200&&dune_word(&c,(training_enemy&65535)+18)==20&&c.ram[(training_harvester&65535)+94]==0&&own_type(8)&&own_type(12),"30minute idle keeps base and genuine actors at original fullHP and empty Harvester idle");for(unsigned i=0;i<16;i++)check(dune_word(&c,0xc0a2+i*10)==65535,"original reinforcement consumer keeps empty schedule");check(!dune_word(&c,0xdc5c),"no original scripted Teams remain");puts("PASS original idle108000frames (30minutes), Tank200HP/Soldier20HP/cargo0, Yard+Refinery alive, no future waves/Teams, no runtimeAIpause");fflush(stdout);
 restore_training();unsigned a=training_tank&65535,oldx=dune_word(&c,a+12),oldy=dune_word(&c,a+10),tile=unit_site((oldx/256)+2,oldy/256,0,0);click_actor(training_tank);training_click((tile&63)*32+16,(tile/64)*32+16,DUNE_CLICK_SELECT);uint64_t end=c.vdp.frames+900;while(c.vdp.frames<end&&dune_word(&c,a+12)==oldx&&dune_word(&c,a+10)==oldy)frames(1);check(dune_word(&c,a+12)!=oldx||dune_word(&c,a+10)!=oldy,"native move order changes actual Tank position");clear_native();puts("PASS actual native Tank select/move/position and original B clear");fflush(stdout);
 restore_training();unsigned e=training_enemy&65535,hp=dune_word(&c,e+18);click_actor(training_tank);click_actor(training_enemy);end=c.vdp.frames+6000;while(c.vdp.frames<end&&active(e)&&dune_word(&c,e+18)>=hp)frames(1);check(!active(e)||dune_word(&c,e+18)<hp,"native Tank attack decreases original enemy HP");puts("PASS actual native Tank attack/projectile changes original Soldier HP");fflush(stdout);
 restore_training();a=training_harvester&65535;click_actor(training_harvester);training_click((training_spice&63)*32+16,(training_spice/64)*32+16,DUNE_CLICK_SELECT);end=c.vdp.frames+6000;while(c.vdp.frames<end&&!c.ram[a+94])frames(1);check(c.ram[a+94]>0,"original spice action fills actual Harvester cargo");unsigned cargo=c.ram[a+94],bank=money();clear_native();click_actor(training_harvester);click_actor(training_refinery);end=c.vdp.frames+9000;while(c.vdp.frames<end&&money()<=bank)frames(1);check(money()>bank&&c.ram[a+94]<cargo,"original Refinery return unloads cargo and credits real bank");printf("PASS native harvest cargo%u then actual delivery credits%u->%u cargo%u\n",cargo,bank,money(),c.ram[a+94]);fflush(stdout);
 restore_training();open(training_yard&65535);int chosen=-1;for(int i=0;i<18;i++){int raw=em_web_menu_select_item(&c,2,i%3,i/3);if(raw==0||raw==1){chosen=i;break;}}check(chosen>=0,"original Yard offers native concrete");unsigned bank0=money();training_click(48+32*(chosen%3),60+24*(chosen/3),DUNE_CLICK_SELECT);check(money()==bank0&&em_web_menu_select.armed,"first real shop tap previews only");training_click(48+32*(chosen%3),60+24*(chosen/3),DUNE_CLICK_SELECT);a=training_yard&65535;end=c.vdp.frames+3000;while(c.vdp.frames<end&&!(dune_word(&c,a+6)&0x2000))frames(1);check(money()<bank0&&(dune_word(&c,a+6)&0x2000),"original payment and production reach real ready state");clear_native();click_actor(training_yard);unsigned slabs=concrete_count();for(unsigned radius=1;radius<6&&(dune_word(&c,a+6)&0x2000);radius++)for(unsigned tile=0;tile<4096&&(dune_word(&c,a+6)&0x2000);tile++){int dx=(int)(tile&63)-(int)(source_yard_tile&63),dy=(int)(tile/64)-(int)(source_yard_tile/64);if(abs(dx)+abs(dy)!=(int)radius||!original_rock[tile]||(c.ram[0x7d9c+tile*4+2]&48)||terrain(tile)==10)continue;training_click((tile&63)*32+16,(tile/64)*32+16,DUNE_CLICK_SELECT);}check(!(dune_word(&c,a+6)&0x2000)&&concrete_count()>slabs,"genuine original placement increases native concrete tiles");puts("PASS original shop preview/payment/production and native concrete placement");fflush(stdout);verify_continuous();
}
int main(int argc,char**argv){
 check(argc==3,"usage authenticHarkM9.cpu.bin outputdir");load(argv[1]);check(player_house==0,"training uses actual Harkonnen scenario");outdir=argv[2];mkdir(outdir,0755);training_yard=own_type(8);check(training_yard,"original player Yard");source_yard_tile=dune_word(&c,training_yard+10)/256*64+dune_word(&c,training_yard+12)/256;
 unsigned best=0;for(unsigned i=0;i<73;i++){unsigned p=record(i);if(active(p)&&c.ram[p+8]!=0&&(c.ram[p+2]==9||c.ram[p+2]==17)){int dx=(int)(dune_word(&c,p+12)/256)-(int)(source_yard_tile&63),dy=(int)(dune_word(&c,p+10)/256)-(int)(source_yard_tile/64);unsigned d=dx*dx+dy*dy;if(d>best){best=d;training_remote=0xff0000+p;}}}check(training_remote,"remote original enemy storage/power prevents instant victory");
 /* Authored tutorial scenario has no future reinforcement records. This is
  * the exact empty sentinel used by original scenario init$161CE..161E8.
  * Native runtime$238E6 skips these slots; no AI/gameplay code is patched. */
 dump("reinforcements-before","bin",c.ram+0xc0a2,16*10);
 for(unsigned i=0;i<16;i++){unsigned at=0xc0a2+i*10;if(dune_word(&c,at)!=65535)disabled_waves++;write_mem(&c,0xff0000+at,2,65535);}
 dump("reinforcements-after","bin",c.ram+0xc0a2,16*10);
 for(unsigned i=0;i<102;i++){unsigned p=em_bui_rom_long(&c,0x4a85a+i*4);if(em_training_alive(&c,p,0))remove_original(p,0);}
 disabled_teams=dune_word(&c,0xdc5c);unsigned reset_args[]={0},reset_sizes[]={4};call(0x2de30,reset_args,reset_sizes,1,0);check(!dune_word(&c,0xdc5c),"original Team_Reset removes authored scenario Team scripts");
 for(unsigned i=0;i<73;i++){unsigned p=record(i);if(active(p)&&p!=training_yard&&0xff0000+p!=training_remote)remove_original(0xff0000+p,1);}
 for(unsigned t=0;t<4096;t++){unsigned kind=terrain(t);original_rock[t]=kind==4||kind==5;}
 unsigned mode=dune_word(&c,0xc148);write_mem(&c,0xffc148,2,mode+1);place(9);training_refinery=0xff0000+place(12);unsigned actual_yard=source_yard_tile;source_yard_tile=36*64+6;for(unsigned i=0;i<5;i++)place(17);source_yard_tile=actual_yard;write_mem(&c,0xffc148,2,mode);word_call(0x10490,0);word_call(0x10490,4);
 for(unsigned i=0;i<73;i++){unsigned p=record(i);if(active(p)&&c.ram[p+8]==0){unsigned args[]={0xff0000+p},sizes[]={4};call(0x10870,args,sizes,1,0);}}
 frames(60);for(unsigned i=0;i<102;i++){unsigned p=em_bui_rom_long(&c,0x4a85a+i*4);if(em_training_alive(&c,p,0))remove_original(p,0);}
 unsigned yardx=source_yard_tile&63,yardy=source_yard_tile/64,tanktile=unit_site(yardx+2,yardy+3,0,0),spicedistance=~0u;
 for(unsigned t=65;t<4030;t++){unsigned kind=terrain(t);if(kind==8||kind==9){int dx=(int)(t&63)-(int)yardx,dy=(int)(t/64)-(int)yardy;unsigned d=dx*dx+dy*dy;if(d<spicedistance){spicedistance=d;training_spice=t;}}}check(training_spice,"original scenario has real nearby spice");
 unsigned harvtile=unit_site(training_spice&63,training_spice/64,0,0),enemytile=unit_site(yardx+12,yardy+2,8,tanktile);
 training_tank=create_unit(43,9,0,tanktile);training_harvester=create_unit(44,16,0,harvtile);training_enemy=create_unit(45,4,4,enemytile);reveal(source_yard_tile,16);reveal(training_spice,5);reveal(enemytile,3);
 unsigned h=rp(0xffc278);check(dune_word(&c,h+26)>=dune_word(&c,h+28)&&dune_long(&c,h+22)>=6000,"real training power and storage");write_mem(&c,0xff0000+h+18,4,5000);write_mem(&c,0xffd6c0,4,5000);write_mem(&c,0xffd6bc,4,0);write_mem(&c,0xffc058,4,4999);unsigned ba[]={0,1},bs[]={2,2};call(0x11f38,ba,bs,2,0);frames(4);check(money()==5000&&c.ram[(training_harvester&65535)+94]==0,"initial native bank5000 and actual cargo0");base=c;
 dump("training","cpu.bin",&c,sizeof c);dump("training","rgb",c.vdp.frame,320*224*3);const char*j=em_web_training_json_for(&c);dump("training","json",j,strlen(j));int bytes=dune_save_state_to_buffer();check(bytes>0,"original portable v2 training save");dump("training","state.bin",g_dune_state_buffer,bytes);
 char path[4096];snprintf(path,sizeof path,"%s/setup.json",outdir);FILE*f=fopen(path,"w");check(f!=NULL,"training setup provenance");fprintf(f,"{\"house\":0,\"mission\":9,\"enemyKept\":%u,\"removedUnits\":%u,\"removedBuildings\":%u,\"disabledScheduledWaves\":%u,\"disabledScriptedTeams\":%u,\"tank\":%u,\"harvester\":%u,\"enemy\":%u,\"yard\":%u,\"refinery\":%u,\"spiceTile\":%u,\"tankTile\":%u,\"harvesterTile\":%u,\"enemyTile\":%u,\"originalHelperCalls\":%u}\n",training_remote,removed_units,removed_buildings,disabled_waves,disabled_teams,training_tank,training_harvester,training_enemy,0xff0000+training_yard,training_refinery,training_spice,tanktile,harvtile,enemytile,calls);fclose(f);verify_training();puts("PASS isolated original training fixture and real movement/attack/harvest/unload/construction; observer read-only");return 0;
}
