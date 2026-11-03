/* Short real-YMFM regression through the exact current browser v2 loader.
 * No new sound routine/driver reset is introduced in runtime or this test. */
#define GENESIS_NO_MAIN
#define GENESIS_AUDIO
#include "../.local/source/build/dune-base.c"
#include "em_web_menu_select.h"
#define EM_WEB_BUILDING_UI_NO_EXPORTS
#include "em_web_building_ui.h"
#include "em_web_campaign.h"
#define EMSCRIPTEN_KEEPALIVE
static CPU em_cpu;static int em_window=1;
static struct {DuneMouse dune_mouse;struct{int camera_valid;uint64_t frame;}dune_view;uint64_t next_service,last_frame;int stopped,audio_device,audio_running;}em_host;
static void sdl_host_rebase(void*h,const CPU*c){(void)h;(void)c;}
static void SDL_ClearQueuedAudio(int device){(void)device;}
static void em_web_audio_flush(void){}
#include "../.local/campaign-analysis/native-state-api.inc"
static void check(int ok,const char*m){if(!ok){fprintf(stderr,"FAIL %s pc%x zpc%x frames%llu %s\n",m,em_cpu.pc,em_cpu.z80_cpu.pc,(unsigned long long)em_cpu.vdp.frames,em_cpu.reason?em_cpu.reason:"");exit(1);}}
static void load(const char*p){FILE*f=fopen(p,"rb");check(f!=NULL,"payload");size_t n=fread(g_dune_state_buffer,1,sizeof g_dune_state_buffer,f);fclose(f);DuneSaveState*s=(DuneSaveState*)g_dune_state_buffer;check(s->ym_size>0&&s->version==2&&s->total_size==n,"payload contains actual portable chip state");check(dune_load_state_from_buffer(n),"actual browser loader");check(!memcmp(em_cpu.ram,s->ram,sizeof em_cpu.ram),"v2 load preserves all original authored/world RAM");}
int main(int argc,char**argv){check(argc>=2,"usage FULL_YM_V2...");em_cpu.rom=rom_data;em_cpu.rom_size=sizeof rom_data;em_cpu.audio_mode=AUDIO_ON;check(audio_init(&em_cpu,NULL),"real chip");em_cpu.audio.playback=1;em_host.dune_mouse.enabled=1;
 for(int i=1;i<argc;i++){load(argv[i]);em_web_campaign.frontend_hold=1;uint64_t writes=em_cpu.ym2612_stub.writes,generated=em_cpu.audio.frames,end=em_cpu.vdp.frames+300,pcm_n=0,nonzero=0,dropped=em_cpu.audio.dropped;
  while(em_cpu.vdp.frames<end){if(!em_web_campaign_observe(&em_cpu))dune_mouse_observe(&em_host.dune_mouse,&em_cpu);machine_step(&em_cpu);check(!em_cpu.fault,"actual audio continuation");int16_t pcm[2048];unsigned n;while((n=audio_pop(&em_cpu,pcm,1024))){pcm_n+=n;for(unsigned j=0;j<n;j++)nonzero+=pcm[j*2]!=0||pcm[j*2+1]!=0;}}
  check(em_cpu.ym2612_stub.writes>writes+100&&nonzero>100&&em_cpu.audio.frames>generated+200000&&em_cpu.audio.dropped==dropped,"native register stream, clocks and nonzero PCM advance after actual load");printf("PASS v2AUDIO_ON %s frames300 YMwrites+%llu PCM%llu nonzero%llu nativeDroppedDelta0 zpc%x fault0\n",argv[i],(unsigned long long)(em_cpu.ym2612_stub.writes-writes),(unsigned long long)pcm_n,(unsigned long long)nonzero,em_cpu.z80_cpu.pc);
 }
 audio_finish(&em_cpu);return 0;}
