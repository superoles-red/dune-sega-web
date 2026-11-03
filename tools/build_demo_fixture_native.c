/* Offline authored demonstration fixture. Original ROM instructions only.
 * This program is never linked into the browser game. */
#define GENESIS_NO_MAIN
#define GENESIS_AUDIO
#include "../.local/source/build/dune-base.c"
#include "em_web_menu_select.h"
#define EM_WEB_BUILDING_UI_NO_EXPORTS
#include "em_web_building_ui.h"
#include <sys/stat.h>
static CPU c,registers_saved,base,test_saved;
#define em_cpu c
#define em_window 1
#define EMSCRIPTEN_KEEPALIVE
#include "../.local/demo-save-serializer.inc"
#undef em_cpu
#undef em_window
static DuneMouse mouse;
static unsigned calls,created;
static unsigned authored[96],authored_type[96],authored_tile[96],authored_n;
static unsigned player_house,original_enemy_count,source_yard_tile;
static uint8_t base_ym[2048];static size_t base_ym_n;
static uint64_t pcm_frames,pcm_nonzero;
static unsigned char original_rock[4096];
static const char *outdir;
static void check(int ok,const char *s){if(!ok){fprintf(stderr,"FAIL %s pc=%06x fault=%d %s\n",s,c.pc,c.fault,c.reason?c.reason:"");exit(1);}}
static unsigned rp(unsigned a){return read_mem(&c,a,4)&65535;}
static unsigned record(unsigned i){return rp(0x4a71e + i*4);}
static int active(unsigned p){return (dune_word(&c,p+4)&7)==3;}
/* Call an original routine with its original 68k C stack ABI. Retain its RAM,
 * VRAM and device effects, restoring only scratch stack/register continuation. */
static uint32_t call(unsigned pc,const unsigned *args,const unsigned *sizes,unsigned n,int pointer){
 registers_saved=c;unsigned top=0xef00,low=top,at=top+4;
 c.pc=pc;c.sr=0x2700;c.a[7]=0xff0000+top;write_mem(&c,c.a[7],4,0xdead00);
 for(unsigned i=0;i<n;++i){write_mem(&c,0xff0000+at,sizes[i],args[i]);at+=sizes[i];}
 unsigned steps=0;while(!c.fault&&c.pc!=0xdead00&&steps++<5000000){if((c.a[7]&65535)<low)low=c.a[7]&65535;translated_step(&c);}
 check(!c.fault&&c.pc==0xdead00,"original helper returns");uint32_t result=pointer?c.a[0]:c.d[0];
 memcpy(c.ram+low,registers_saved.ram+low,at-low+16);
 memcpy(c.d,registers_saved.d,sizeof c.d);memcpy(c.a,registers_saved.a,sizeof c.a);
 c.pc=registers_saved.pc;c.sr=registers_saved.sr;c.usp=registers_saved.usp;c.ssp=registers_saved.ssp;++calls;return result;
}
static unsigned word_call(unsigned pc,unsigned arg){unsigned a[]={arg},s[]={2};return call(pc,a,s,1,0)&65535;}
static unsigned terrain(unsigned tile){return word_call(0x57ea,tile);}
static void frames(unsigned n){uint64_t end=c.vdp.frames+n;while(!c.fault&&c.vdp.frames<end){if(!em_web_menu_select_observe(&mouse,&c))dune_mouse_observe(&mouse,&c);machine_step(&c);int16_t pcm[2048];unsigned count;while((count=audio_pop(&c,pcm,1024))){pcm_frames+=count;for(unsigned i=0;i<count;i++)pcm_nonzero+=pcm[i*2]!=0||pcm[i*2+1]!=0;}}check(!c.fault,"native frames");}
static void load(const char *p,const char*ym_path){FILE*f=fopen(p,"rb");check(f&&fread(&c,sizeof c,1,f)==1&&fgetc(f)==EOF,"exact native CPU fixture ABI");fclose(f);c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.pad_buttons[0]=0;c.audio_mode=AUDIO_ON;check(ym_path!=NULL,"demo requires genuine paired YM state");uint8_t ym[2048];FILE*y=fopen(ym_path,"rb");check(y!=NULL,"source YM");size_t n=fread(ym,1,sizeof ym,y);fclose(y);c.audio.fm=genesis_ymfm_load_state(ym,n);check(c.audio.fm!=NULL,"genuine source chip restored");c.audio.wav=NULL;c.audio.wav_count=0;c.audio.read=c.audio.count=0;c.audio.playback=1;mouse.enabled=1;player_house=dune_word(&c,0xc274);check(dune_mouse_context(&c)==1&&player_house<3&&dune_word(&c,0xc050)==8,"authentic requested house mission9 map source");}
static void inspect(void){
 printf("houseptr%04x camera%u,%u bounds%u..%u,%u..%u mode%u credits%u\n",rp(0xffc278),dune_word(&c,0xe3ec),dune_word(&c,0xe3ee),dune_word(&c,0xe400),dune_word(&c,0xe402),dune_word(&c,0xe3fc),dune_word(&c,0xe3fe),dune_word(&c,0xc148),dune_long(&c,rp(0xffc278)+18));
 for(unsigned i=0;i<73;i++){unsigned p=record(i);if(active(p))printf("building slot%u p%04x type%u owner%u tile%u,%u hp%u\n",i,p,c.ram[p+2],c.ram[p+8],dune_word(&c,p+12)/256,dune_word(&c,p+10)/256,dune_word(&c,p+18));}
 for(unsigned y=0;y<64;y++){for(unsigned x=0;x<64;x++){unsigned t=terrain(y*64+x);putchar(t<10?'0'+t:'A'+t-10);}putchar('\n');}
}
static unsigned definition(unsigned type){return read_mem(&c,0x6b954+type*4,4);}
static unsigned offsets(unsigned type,unsigned *out){unsigned layout=read_mem(&c,definition(type)+60,2),n=read_mem(&c,0x6b82e + layout*2,2);check(n&&n<=9,"native footprint has1..9tiles");for(unsigned i=0;i<n;i++)out[i]=read_mem(&c,0x6b740+layout*18+i*2,2);return n;}
static unsigned free_slot(void){for(unsigned i=0;i<73;i++)if(!(dune_word(&c,record(i)+4)&1))return i;check(0,"free native building slot");return 0;}
static unsigned create(unsigned type,unsigned tile,int track){
 unsigned index=free_slot(),a[]={index,type,player_house,tile},s[]={2,2,2,2};unsigned p=call(0xe584,a,s,4,1)&65535;
 if(type!=0&&type!=1&&type!=14){check(p&&active(p)&&c.ram[p+2]==type&&c.ram[p+8]==player_house,"native authored building owns active mapped record");++created;}
 if(track){check(authored_n<96,"bounded authored list");authored[authored_n]=(type==0||type==1||type==14)?0:p;authored_type[authored_n]=type;authored_tile[authored_n++]=tile;}
 return p;
}
static unsigned site(unsigned type){
 unsigned off[9],n=offsets(type,off),best=0,score=~0u;
 /* Fixed original-rock district, immediately beside the original Yard. The
  * source map/host camera rectangle and enemy bases are never rewritten. */
 unsigned cx=player_house==1?43:source_yard_tile&63,cy=player_house==1?43:source_yard_tile/64;
 for(unsigned y=player_house==1?41:1;y<=60;y++)for(unsigned x=player_house==1?39:1;x<=60;x++){
  unsigned tile=y*64+x;int ok=1;
  for(unsigned i=0;i<n;i++){unsigned t=tile+off[i],a=0x7d9c+t*4;if((t&63)<x||t/64>61||!original_rock[t]||(c.ram[a+2]&48))ok=0;}
  /* Leave one original-rock cell between the authored rectangles. */
  for(unsigned j=0;j<authored_n&&ok;j++)if(player_house!=1||(authored_type[j]!=0&&authored_type[j]!=1&&authored_type[j]!=14)){unsigned o[9],m=offsets(authored_type[j],o);for(unsigned i=0;i<n&&ok;i++)for(unsigned k=0;k<m;k++){int dx=(int)((tile+off[i])&63)-(int)((authored_tile[j]+o[k])&63),dy=(int)((tile+off[i])/64)-(int)((authored_tile[j]+o[k])/64);if(abs(dx)<=1&&abs(dy)<=1)ok=0;}}
  int dx=(int)x-(int)cx,dy=(int)y-(int)cy;unsigned distance=dx*dx+dy*dy;if(ok&&distance<score){score=distance;best=tile;}
 }
 check(best,"valid unoccupied original-rock site exists");return best;
}
static unsigned place_at(unsigned type,unsigned tile){
 unsigned off[9],n=offsets(type,off);
 for(unsigned i=0;i<n;i++){unsigned t=tile+off[i],kind=terrain(t),a=0x7d9c+t*4;check((kind==4||kind==5)&&!(c.ram[a+2]&48),"authored site is unoccupied original rock");}
 if(type!=0&&type!=1&&type!=14)for(unsigned i=0;i<n;i++){create(0,tile+off[i],0);check(terrain(tile+off[i])==10,"native concrete foundation on original rock");}
 unsigned p=create(type,tile,1);printf("CREATE type%u at%u,%u ptr%04x\n",type,tile&63,tile/64,p);fflush(stdout);return p;
}
static unsigned place(unsigned type){return place_at(type,site(type));}
static unsigned money(void){return dune_long(&c,rp(0xffc278)+18);}
static void dump(const char *name,const char *ext,const void *p,size_t n){char path[4096];snprintf(path,sizeof path,"%s/%s.%s",outdir,name,ext);FILE*f=fopen(path,"wb");check(f&&fwrite(p,1,n,f)==n,"write demo evidence");fclose(f);}
static unsigned own_type(unsigned type){for(unsigned i=0;i<73;i++){unsigned p=record(i);if(active(p)&&c.ram[p+8]==player_house&&c.ram[p+2]==type)return p;}return 0;}
static void open(unsigned p){
 unsigned producer=0xff0000+p;int wx=(int)dune_word(&c,p+12)/8+8,wy=(int)dune_word(&c,p+10)/8+8;
 for(unsigned i=0;i<12&&dune_mouse_context(&c)!=2&&dune_mouse_context(&c)!=3;i++){dune_mouse_world_click(&mouse,&c,wx,wy,DUNE_CLICK_SELECT);frames(60);}
 frames(25);check((dune_mouse_context(&c)==2||dune_mouse_context(&c)==3)&&dune_long(&c,0xc578)==producer,"native clicks enter intended building interior");
}
static void restore_base(void){if(c.audio.fm)genesis_ymfm_destroy(c.audio.fm);c=base;c.audio.fm=genesis_ymfm_load_state(base_ym,base_ym_n);check(c.audio.fm!=NULL,"clone actual base chip");}
static void verify_menus(void){
 const unsigned types[]={2,3,4,5,7,8,9,10,11,12,13,15,16,17,18};
 for(unsigned i=0;i<sizeof types/sizeof*types;i++){
  restore_base();memset(&mouse,0,sizeof mouse);mouse.enabled=1;memset(&em_web_menu_select,0,sizeof em_web_menu_select);unsigned p=own_type(types[i]);check(p,"every interactive native building present");open(p);
  check(c.ram[0xbf85]==types[i]&&c.ram[p+8]==player_house,"native interior type and actual producer house match");const char *j=em_web_building_ui_json_for(&c,&em_web_menu_select);check(!strstr(j,"json-overflow")&&em_bui_presentation_ready(&c),"native menu JSON complete and completed palette/raster ready");char name[64];snprintf(name,sizeof name,"building-%02u",types[i]);dump(name,"json",j,strlen(j));dump(name,"rgb",c.vdp.frame,320*224*3);printf("INTERIOR PASS type%u context%d\n",types[i],dune_mouse_context(&c));fflush(stdout);
 }
 restore_base();memset(&mouse,0,sizeof mouse);mouse.enabled=1;memset(&em_web_menu_select,0,sizeof em_web_menu_select);
}
static void build(void){
 for(unsigned i=0;i<4096;i++){unsigned kind=terrain(i);original_rock[i]=kind==4||kind==5;}
 for(unsigned i=0;i<73;i++){unsigned p=record(i);if(active(p)&&c.ram[p+8]!=player_house)original_enemy_count++;}
 unsigned starting_yard=own_type(8);check(starting_yard,"original mission has its own Yard");source_yard_tile=dune_word(&c,starting_yard+10)/256*64+dune_word(&c,starting_yard+12)/256;
 unsigned mode=dune_word(&c,0xc148);check(mode==0,"original scenario no longer initializing");write_mem(&c,0xffc148,2,mode+1);
 /* Keep all original buildings, units, native scripts and mission flags.
  * The extra city is authored by exactly the original scenario helper. */
 /* Preserve the accepted city positions and Windtrap/Silo counts while
  * omitting the unused IX definition6 entirely. Its original house mask is0
  * and the Sega Yard explicitly skips it at$FF2E..FF3A. No placeholder is
  * created or destroyed, and its former footprint stays original rock. */
 const unsigned plan[][2]={{0,2731},{1,2797},{2,2989},{3,2985},{4,2799},{5,3178},{7,3245},{9,2803},{10,3239},{11,3185},{12,2996},{13,3435},{14,2794},{15,2730},{16,2732},{17,3432},{18,3439},{9,2806},{9,3189},{9,3442},{9,3627},{9,3000},{17,3624},{17,3630},{17,3381}};
 for(unsigned i=0;i<sizeof plan/sizeof*plan;i++){if(player_house==1)place_at(plan[i][0],plan[i][1]);else place(plan[i][0]);}
 word_call(0x10490,player_house);unsigned h=rp(0xffc278);
 while(dune_word(&c,h+26)<dune_word(&c,h+28)+100){place(9);word_call(0x10490,player_house);}
 while(dune_long(&c,h+22)<5000){place(17);word_call(0x10490,player_house);}
 write_mem(&c,0xffc148,2,mode);word_call(0x10490,player_house);
 check(dune_word(&c,h+26)>=dune_word(&c,h+28)&&dune_long(&c,h+22)>=5000,"native power and native spice capacity suffice");
 /* Demo initial bank is an authored scenario value, not a runtime cheat. */
 write_mem(&c,0xff0000+h+18,4,5000);
 /* Original Building_Unveil helper, same exact routine called by placement. */
 for(unsigned i=0;i<73;i++){unsigned p=record(i);if(active(p)&&c.ram[p+8]==player_house){unsigned a[]={0xff0000+p},s[]={4};call(0x10870,a,s,1,0);}}
 frames(100);check(dune_mouse_context(&c)==1,"authored demo starts on original map");
 /* Centre from a real pointer intent, which uses the original camera code. */
 /* One real empty-rock click pans the original camera towards the city.
  * No active unit is selected, so it cannot issue a gameplay order. */
 if(player_house==1)dune_mouse_world_click(&mouse,&c,1690,1630,DUNE_CLICK_SELECT);
 /* Other original scenarios already start on their own Yard. Retain that
  * native camera rather than emit an unnecessary selection into the city. */
 frames(140);
 check(!dune_long(&c,0xc25c),"camera-start click leaves no unit order armed");
 write_mem(&c,0xff0000+h+18,4,5000);write_mem(&c,0xffd6c0,4,5000);write_mem(&c,0xffd6bc,4,0);
 /* Initial counter position is authored alongside the initial bank. Its
  * original forced-refresh mode1 performs formatting/cache/VRAM writes.
  * A stale previous-display sentinel makes its original dirty guard run. */
 write_mem(&c,0xffc058,4,4999);unsigned bank_args[]={player_house,1},bank_sizes[]={2,2};call(0x11f38,bank_args,bank_sizes,2,0);
 char cash[96];em_bui_text(&c,0xc85a,6,cash);
 check(money()==5000&&!strcmp(cash,"  5000")&&dune_long(&c,0xc058)==5000,"native displayed5000credits and actual bank agree");
 /* Original VBlank must upload its newly formatted glyphs. Four genuine
  * device frames also make the preview the actual completed native frame. */
 frames(4);check(money()==5000,"native bank remains5000afterinitial glyph DMA");base=c;base_ym_n=genesis_ymfm_state_size(c.audio.fm);check(base_ym_n<=sizeof base_ym&&genesis_ymfm_save_state(c.audio.fm,base_ym,base_ym_n),"preserve full base YM state");
 unsigned enemy=0,own=0;for(unsigned i=0;i<73;i++){unsigned p=record(i);if(active(p)){if(c.ram[p+8]==player_house)own++;else enemy++;}}
 check(enemy==original_enemy_count&&own>=16,"all original enemy buildings and authored city remain active");
 for(unsigned type=2;type<19;type++)if(type!=6&&type!=14)check(own_type(type),"all real persistent building types owned");
 check(!own_type(6),"unused IX placeholder is absent");if(player_house==1){unsigned ixoff[9],ixn=offsets(6,ixoff);for(unsigned i=0;i<ixn;i++){unsigned tile=2993+ixoff[i];check(terrain(tile)==5&&!(c.ram[0x7d9c+tile*4+2]&32),"former IX footprint is unoccupied original rock");}}
 for(unsigned i=0;i<authored_n;i++)if(authored_type[i]==0||authored_type[i]==1||authored_type[i]==14){unsigned off[9],n=offsets(authored_type[i],off);for(unsigned j=0;j<n;j++)check(terrain(authored_tile[i]+off[j])==(authored_type[i]==14?11:10),"native concrete/wall feature persists on map");}
 dump("demo","cpu.bin",&c,sizeof c);dump("demo","ym.bin",base_ym,base_ym_n);dump("demo","rgb",c.vdp.frame,320*224*3);int save_bytes=dune_save_state_to_buffer();check(save_bytes>0,"original v2 serializer writes payload");dump("demo","state.bin",g_dune_state_buffer,(size_t)save_bytes);
 char path[4096];snprintf(path,sizeof path,"%s/report.json",outdir);FILE*f=fopen(path,"w");check(f!=NULL,"report output");
 fprintf(f,"{\"house\":%u,\"mission\":9,\"campaignIndex\":8,\"mapContext\":%d,\"credits\":%u,\"nativeSpiceCapacity\":%u,\"nativePowerProduction\":%u,\"nativePowerUsage\":%u,\"ownActiveBuildings\":%u,\"originalEnemyBuildings\":%u,\"sourceEnemyBuildings\":%u,\"sourceYardTile\":%u,\"originalHelperCalls\":%u,\"camera\":[%u,%u],\"created\":[",player_house,dune_mouse_context(&c),money(),dune_long(&c,h+22),dune_word(&c,h+26),dune_word(&c,h+28),own,enemy,original_enemy_count,source_yard_tile,calls,dune_word(&c,0xe3ec),dune_word(&c,0xe3ee));
 for(unsigned i=0;i<authored_n;i++)fprintf(f,"%s{\"type\":%u,\"pointer\":%u,\"tile\":%u}",i?",":"",authored_type[i],authored[i]?0xff0000+authored[i]:0,authored_tile[i]);fprintf(f,"],\"fault\":%d}\n",c.fault);fclose(f);
 verify_menus();uint64_t writes=c.ym2612_stub.writes,nonzero=pcm_nonzero,played=pcm_frames;frames(1800);check(c.ym2612_stub.writes>writes+100&&pcm_nonzero>nonzero&&pcm_frames>played+1000000&&!c.audio.dropped,"real demo audio driver advances and produces nonzero PCM for30sec");char sound[1024];snprintf(sound,sizeof sound,"{\"audioMode\":3,\"ymBytes\":%zu,\"frames\":1800,\"ymWriteDelta\":%llu,\"pcmFrames\":%llu,\"nonzeroPCMFrames\":%llu,\"nativeDropped\":%llu,\"fault\":%d}\n",base_ym_n,(unsigned long long)(c.ym2612_stub.writes-writes),(unsigned long long)(pcm_frames-played),(unsigned long long)(pcm_nonzero-nonzero),(unsigned long long)c.audio.dropped,c.fault);dump("audio-proof","json",sound,strlen(sound));printf("AUDIO PASS30sec YMwrites+%llu PCM%llu nonzero%llu YM%zuB\n",(unsigned long long)(c.ym2612_stub.writes-writes),(unsigned long long)(pcm_frames-played),(unsigned long long)(pcm_nonzero-nonzero),base_ym_n);check(dune_mouse_context(&c)==1,"30second original running demo does not immediately win or lose");check(own_type(8),"native Yard survives30second noinput test");puts("PASS authored original demo and15native interiors; original AI/outcomes remain active");
}
int main(int argc,char**argv){check(argc>=3,"usage source.cpu.bin inspect|outputdir");load(argv[1],argc>3?argv[3]:NULL);if(!strcmp(argv[2],"inspect")){inspect();return 0;}outdir=argv[2];mkdir(outdir,0755);build();audio_finish(&c);return 0;}
