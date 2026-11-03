/* Real YMFM/68000 identity across host-service batching; fake playback device
 * makes stale-output trimming deterministic without changing native samples. */
#define GENESIS_NO_MAIN
#define GENESIS_SDL2
#ifndef GENESIS_AUDIO
#define GENESIS_AUDIO
#endif
#define SDL_GetQueuedAudioSize em_test_queued_size
#define SDL_QueueAudio em_test_queue
#define SDL_ClearQueuedAudio em_test_clear
#define SDL_PauseAudioDevice em_test_pause
#include "../.local/source/build/dune-base.c"
#include "em_web_frame.h"
static CPU em_cpu,reference;static SDLHost em_host;static int em_window=1,em_web_original_video;
static double now_ms;static unsigned queued_frames,services,presents;static uint64_t pcm_hash,pcm_frames;
static double emscripten_get_now(void){return now_ms;}
static void emscripten_cancel_main_loop(void){}
static int em_test_service(SDLHost*h,CPU*c){++services;if(h->last_frame!=c->vdp.rendered_frames){h->last_frame=c->vdp.rendered_frames;++presents;}h->next_service=c->master_cycles+vdp_master_frequency(&c->vdp)/1000;return 1;}
Uint32 em_test_queued_size(SDL_AudioDeviceID d){(void)d;return queued_frames*4;}
int em_test_queue(SDL_AudioDeviceID d,const void*p,Uint32 bytes){(void)d;const uint8_t*b=p;for(unsigned i=0;i<bytes;i++)pcm_hash=(pcm_hash^b[i])*1099511628211ull;queued_frames+=bytes/4;pcm_frames+=bytes/4;return 0;}
void em_test_clear(SDL_AudioDeviceID d){(void)d;queued_frames=0;}
void em_test_pause(SDL_AudioDeviceID d,int paused){(void)d;(void)paused;}
#define EM_WEB_HOST_NATIVE_TEST
#define EMSCRIPTEN_KEEPALIVE
#define sdl_host_service em_test_service
#include "em_web_host.h"
#undef sdl_host_service
static void check(int v,const char*m){if(!v){fprintf(stderr,"FAIL %s pc%x fault%d reason%s\n",m,em_cpu.pc,em_cpu.fault,em_cpu.reason?em_cpu.reason:"");exit(1);}}
static void load(void){FILE*f=fopen(".local/frontend-fixture/frontend.cpu.bin","rb");check(f&&fread(&em_cpu,sizeof em_cpu,1,f)==1,"actual cold Main CPU");fclose(f);uint8_t ym[2048];f=fopen(".local/frontend-fixture/frontend.ym.bin","rb");check(f!=NULL,"real YM payload");size_t n=fread(ym,1,sizeof ym,f);fclose(f);em_cpu.audio.fm=genesis_ymfm_load_state(ym,n);check(em_cpu.audio.fm!=NULL,"restore actual chip");em_cpu.rom=rom_data;em_cpu.rom_size=sizeof rom_data;em_cpu.audio_mode=AUDIO_ON;em_cpu.fault=0;em_cpu.reason=NULL;em_cpu.audio.read=em_cpu.audio.count=0;em_cpu.audio.playback=1;memset(&em_host,0,sizeof em_host);em_host.audio_device=1;em_host.dune_volume=100;em_host.dune_mouse.enabled=1;em_host.last_frame=em_cpu.vdp.rendered_frames;now_ms=0;em_web_clock_reset(&em_web_clock,0);services=presents=queued_frames=0;pcm_hash=1469598103934665603ull;pcm_frames=0;em_web_host_audio_discarded=em_web_host_audio_resets=0;}
static void baseline_service(void){em_test_service(&em_host,&em_cpu);check(sdl_host_audio_service(&em_host,&em_cpu),"legacy audio service");}
static void baseline_callback(void){baseline_service();unsigned hz=vdp_master_frequency(&em_cpu.vdp);uint64_t due=em_web_clock_due(&em_web_clock,now_ms,hz,0),budget=hz/15u;if(due<budget)budget=due;uint64_t start=em_cpu.master_cycles,target=start+budget;while(em_cpu.master_cycles<target){if(em_cpu.master_cycles>=em_host.next_service)baseline_service();dune_mouse_observe(&em_host.dune_mouse,&em_cpu);machine_step(&em_cpu);}em_web_clock_consume(&em_web_clock,em_cpu.master_cycles-start);baseline_service();}
static void normalize(CPU*c){c->audio.fm=NULL;c->audio.read=c->audio.count=0;memset(c->audio.ring,0,sizeof c->audio.ring);}
int main(void){uint64_t hash=0,frames=0;unsigned old_services=0,old_presents=0;uint8_t ym_reference[2048],ym_actual[2048];size_t n=0;for(unsigned mode=0;mode<2;mode++){load();for(unsigned i=1;i<=120;i++){queued_frames=queued_frames>800?queued_frames-800:0;now_ms=(double)i*1000/60;if(mode)em_web_main_loop_iter();else baseline_callback();check(!em_cpu.fault,"native execution");}if(!mode){reference=em_cpu;normalize(&reference);hash=pcm_hash;frames=pcm_frames;old_services=services;old_presents=presents;n=genesis_ymfm_state_size(em_cpu.audio.fm);check(n<=sizeof ym_reference&&genesis_ymfm_save_state(em_cpu.audio.fm,ym_reference,n),"serialize reference chip");}else{CPU actual=em_cpu;normalize(&actual);check(!memcmp(&actual,&reference,sizeof actual),"all native CPU/device state unchanged by host batching");check(pcm_hash==hash&&pcm_frames==frames,"every original scaled stereo PCM byte conserved in ordinary playback");check(genesis_ymfm_save_state(em_cpu.audio.fm,ym_actual,n)&&!memcmp(ym_actual,ym_reference,n),"actual real YMFM state byte-identical");check(!em_web_host_audio_discarded&&services==240&&old_services>services*5,"redundant in-callback services eliminated");printf("PASS native CPU+YMFM state and all%llu PCM frames identical; SDL services%u->%u presents%u->%u\n",(unsigned long long)frames,old_services,services,old_presents,presents);}genesis_ymfm_destroy(em_cpu.audio.fm);em_cpu.audio.fm=NULL;}
 /* A 200ms host stall retains every owed cycle but presents only final RGB. */
 for(unsigned mode=0;mode<2;mode++){load();now_ms=200.0;if(mode)em_web_main_loop_iter();else baseline_callback();check(em_web_clock.credit_cycles>vdp_master_frequency(&em_cpu.vdp)*0.12,"catch-up debt retained, no native ticks dropped");if(!mode){reference=em_cpu;normalize(&reference);old_services=services;old_presents=presents;hash=pcm_hash;frames=pcm_frames;}else{CPU actual=em_cpu;normalize(&actual);check(!memcmp(&actual,&reference,sizeof actual)&&pcm_hash==hash&&pcm_frames==frames,"catch-up original CPU and PCM byte-identical");check(presents==1&&old_presents>=3&&services==2&&old_services>30,"intermediate catch-up SDL presentations removed");printf("PASS200ms host stall: same native clocks/PCM, retained debt%.3fms; services%u->%u presents%u->%u\n",em_web_clock.credit_cycles*1000/vdp_master_frequency(&em_cpu.vdp),old_services,services,old_presents,presents);}genesis_ymfm_destroy(em_cpu.audio.fm);em_cpu.audio.fm=NULL;}
 /* Playback overflow affects host consumers only, and keeps newest samples. */
 memset(&em_cpu.audio,0,sizeof em_cpu.audio);em_host.audio_device=1;em_host.audio_running=1;queued_frames=24000;em_cpu.audio.playback=1;em_cpu.audio.read=4000;em_cpu.audio.count=4096;em_cpu.audio.frames=12345;em_cpu.audio.dropped=7;for(unsigned i=0;i<4096;i++){unsigned a=(em_cpu.audio.read+i)%4096;em_cpu.audio.ring[a*2]=(int16_t)i;em_cpu.audio.ring[a*2+1]=(int16_t)-i;}reference=em_cpu;uint64_t native_frames=em_cpu.audio.frames,drops=em_cpu.audio.dropped;check(em_web_audio_service(&em_host,&em_cpu),"overflow service");check(queued_frames==3072&&em_web_host_audio_discarded==25024&&em_web_host_audio_resets==1,"half-second stale SDL output cleared; newest64ms retained");check(em_cpu.audio.frames==native_frames&&em_cpu.audio.dropped==drops&&!memcmp(em_cpu.ram,reference.ram,sizeof em_cpu.ram),"trim does not alter native generated samples/drop metrics/world");printf("PASS stale playback500ms+ring85ms ->64ms fresh; host discarded25024 separately native drops7\n");
 em_host.paused=1;check(em_web_audio_service(&em_host,&em_cpu)&&!queued_frames&&!em_cpu.audio.count&&!em_cpu.audio.playback,"pause clears output only");check(dune_web_frame_serial()==(uint32_t)em_cpu.vdp.rendered_frames,"cheap completed frame serial");puts("PASS pause output clearing, frame serial, native clocks unchanged");return 0;}
