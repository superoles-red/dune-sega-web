/* Real native PCM differential: external output is only a consumer. Reuse the
 * genuine CPU+YMFM fixture and deterministic SDL stand-in of the batching test. */
#include <stdint.h>
static int external_push(const int16_t*,unsigned);
static void external_flush(uint32_t);
static void external_playing(int);
#define EM_WEB_AUDIO_PUSH_PCM(p,n) external_push(p,n)
#define EM_WEB_AUDIO_FLUSH_OUTPUT(e) external_flush(e)
#define EM_WEB_AUDIO_PLAYING_OUTPUT(p) external_playing(p)
#define main legacy_host_audio_main
#include "test_em_web_host_audio.c"
#undef main
static unsigned packets,flushes,playing_changes,last_epoch;
static int sink_playing,fail_packet;
static uint64_t external_frames;
static int external_push(const int16_t*p,unsigned n){
 if(fail_packet){fail_packet=0;return 0;}
 const uint8_t*b=(const uint8_t*)p;for(unsigned i=0;i<n*4;++i)pcm_hash=(pcm_hash^b[i])*1099511628211ull;
 pcm_frames+=n;external_frames+=n;++packets;return 1;
}
static void external_flush(uint32_t epoch){last_epoch=epoch;++flushes;}
static void external_playing(int p){sink_playing=p;++playing_changes;}
int main(void){
 uint64_t wanted_hash=0,wanted_frames=0;uint8_t expected_ym[2048],actual_ym[2048];size_t ym_n=0;
 for(unsigned mode=0;mode<2;++mode){
  em_web_audio_external=0;em_web_audio_playing=-1;em_web_hidden=0;external_frames=packets=0;load();
  if(mode)check(dune_web_audio_worklet(1),"enable external consumer");
  for(unsigned i=1;i<=120;++i){queued_frames=queued_frames>800?queued_frames-800:0;now_ms=(double)i*1000/60;em_web_main_loop_iter();check(!em_cpu.fault,"genuine native audio execution");}
  if(!mode){reference=em_cpu;normalize(&reference);wanted_hash=pcm_hash;wanted_frames=pcm_frames;ym_n=genesis_ymfm_state_size(em_cpu.audio.fm);check(ym_n<=sizeof expected_ym&&genesis_ymfm_save_state(em_cpu.audio.fm,expected_ym,ym_n),"save reference YMFM");}
  else{
   CPU actual=em_cpu;normalize(&actual);check(!memcmp(&actual,&reference,sizeof actual),"whole original CPU/device state identical with external output");
   check(genesis_ymfm_save_state(em_cpu.audio.fm,actual_ym,ym_n)&&!memcmp(actual_ym,expected_ym,ym_n),"real YMFM chip byte-identical");
   check(pcm_hash==wanted_hash&&pcm_frames==wanted_frames&&external_frames==wanted_frames,"every original stereo S16 PCM byte transferred exactly once");
   check(!queued_frames&&!em_web_host_audio_discarded&&!em_web_host_audio_resets,"external output bypasses96ms SDL resets and duplicate queue");
   check(packets==120&&sink_playing,"one handoff per native batch, playing");
   printf("PASS external route: all%llu frames/%llu PCM bytes, CPU391624B and real YMFM%zuB identical;120packets/0SDLframes/0discard\n",(unsigned long long)wanted_frames,(unsigned long long)wanted_frames*4,ym_n);
   unsigned before=flushes,epoch=last_epoch;em_host.paused=1;check(em_web_audio_service(&em_host,&em_cpu)&&flushes==before+1&&last_epoch!=epoch&&!sink_playing&&!em_cpu.audio.count,"manual pause flushes epoch once");
   check(em_web_audio_service(&em_host,&em_cpu)&&flushes==before+1,"paused polling does not repeatedly flush");
   em_host.paused=0;check(em_web_audio_service(&em_host,&em_cpu)&&sink_playing,"resume remains same native chip");
   before=flushes;dune_web_set_hidden(1);check(flushes==before+1&&!sink_playing,"existing explicit hidden pause flushes output");dune_web_set_hidden(0);
   before=flushes;em_web_audio_flush();check(flushes==before+1,"successful-load hook flushes output epoch without chip mutation");
   puts("PASS explicit pause/hidden/load output epochs; no repeated paused flush");
  }
  genesis_ymfm_destroy(em_cpu.audio.fm);em_cpu.audio.fm=NULL;
 }
 /* A synchronous failed worklet handoff falls back without losing that packet. */
 memset(&em_cpu.audio,0,sizeof em_cpu.audio);em_cpu.audio.playback=1;em_cpu.audio.count=800;em_cpu.audio.read=0;for(unsigned i=0;i<1600;++i)em_cpu.audio.ring[i]=(int16_t)i;
 em_host.paused=0;em_web_hidden=0;em_host.audio_running=0;queued_frames=0;pcm_frames=0;fail_packet=1;
 check(em_web_audio_service(&em_host,&em_cpu)&&!em_web_audio_external&&queued_frames==800&&pcm_frames==800,"failed packet queued to SDL exactly once");
 puts("PASS worklet failure recovers same800 PCM frames to existing SDL fallback");
 return 0;
}
