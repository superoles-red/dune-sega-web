/* Browser host only. Original translated game, CPU/device clocks, menus,
   animation, AI, pathfinding and audio logic remain untouched.

   Include after `static CPU em_cpu; static SDLHost em_host; static int em_window;`
   in the web fork's generated C. Register em_web_main_loop_iter instead of its
   old em_main_loop_iter. Define EM_WEB_CLOCK_ONLY for the native clock tests.
*/
#ifndef DUNE_EM_WEB_HOST_H
#define DUNE_EM_WEB_HOST_H
#include <stdint.h>
#include <math.h>

typedef struct {
    double last_ms;
    double credit_cycles;
    int initialized;
} EmWebClock;

static void em_web_clock_reset(EmWebClock *clock, double now_ms) {
    clock->last_ms=now_ms;
    clock->credit_cycles=0.0;
    clock->initialized=1;
}

/* Keep fractional master clocks between browser callbacks. A 120 Hz screen
   gets half as much work per callback as a 60 Hz screen; no simulated frame
   count, instruction timing or game clock is tied to requestAnimationFrame.
   A visibility handler resets the clock explicitly. The one-second guard is
   only for suspended/debugger/system discontinuities, never normal 30 Hz play. */
static uint64_t em_web_clock_due(EmWebClock *clock, double now_ms,
                                 uint32_t master_hz, int paused) {
    if(!isfinite(now_ms))return 0;
    if(!clock->initialized || paused) {
        em_web_clock_reset(clock,now_ms);
        return 0;
    }
    double elapsed=now_ms-clock->last_ms;
    clock->last_ms=now_ms;
    if(elapsed<0.0 || elapsed>1000.0) {
        clock->credit_cycles=0.0;
        return 0;
    }
    clock->credit_cycles+=elapsed*(double)master_hz/1000.0;
    return clock->credit_cycles>=1.0?(uint64_t)clock->credit_cycles:0;
}

/* Actual instruction-boundary execution can exceed its target by one
   instruction; carry that small negative balance into the next callback. */
static void em_web_clock_consume(EmWebClock *clock,uint64_t executed) {
    clock->credit_cycles-=(double)executed;
}

#ifndef EM_WEB_CLOCK_ONLY
#ifndef EM_WEB_HOST_NATIVE_TEST
#include <emscripten.h>
#endif

static EmWebClock em_web_clock;
static int em_web_hidden;
static int em_web_canvas_visible_flag=1;
static int em_web_canvas_deferred;
static int em_web_canvas_presentable(void){return em_web_canvas_visible_flag&&!em_web_canvas_deferred;}
EMSCRIPTEN_KEEPALIVE void dune_web_canvas_visible(int visible){int was=em_web_canvas_visible_flag;em_web_canvas_visible_flag=!!visible;if(em_window&&!was&&visible)em_host.last_frame=UINT64_MAX;}
static uint64_t em_web_callbacks,em_web_advanced_callbacks;
static uint64_t em_web_service_calls,em_web_presentations,em_web_host_audio_discarded,em_web_host_audio_resets;
static double em_web_service_ms,em_web_step_ms,em_web_callback_ms,em_web_callback_max_ms,em_web_callback_total_ms;
static unsigned em_web_audio_peak_frames;
/* Optional external output route. The native synthesizer and its clock are
 * shared with SDL; only the consumer of already generated PCM changes. */
static int em_web_audio_external,em_web_audio_playing=-1;
static uint32_t em_web_audio_epoch;
static uint64_t em_web_audio_external_frames,em_web_audio_external_packets;
#ifdef EM_WEB_HOST_NATIVE_TEST
#ifndef EM_WEB_AUDIO_PUSH_PCM
#define EM_WEB_AUDIO_PUSH_PCM(p,n) 0
#endif
#ifndef EM_WEB_AUDIO_FLUSH_OUTPUT
#define EM_WEB_AUDIO_FLUSH_OUTPUT(epoch) ((void)0)
#endif
#ifndef EM_WEB_AUDIO_PLAYING_OUTPUT
#define EM_WEB_AUDIO_PLAYING_OUTPUT(playing) ((void)0)
#endif
static int em_web_audio_push(const int16_t*p,unsigned n){return EM_WEB_AUDIO_PUSH_PCM(p,n);}
static void em_web_audio_flush_js(uint32_t epoch){EM_WEB_AUDIO_FLUSH_OUTPUT(epoch);}
static void em_web_audio_playing_js(int playing){EM_WEB_AUDIO_PLAYING_OUTPUT(playing);}
#else
EM_JS(int,em_web_audio_push,(const int16_t *p, unsigned n),{
 var b=Module['nativeAudioBridge'];return b&&b.pushPCM?+b.pushPCM(p,n):0;
});
EM_JS(void,em_web_audio_flush_js,(unsigned epoch),{
 var b=Module['nativeAudioBridge'];if(b&&b.flush)b.flush(epoch);
});
EM_JS(void,em_web_audio_playing_js,(int playing),{
 var b=Module['nativeAudioBridge'];if(b&&b.setPlaying)b.setPlaying(!!playing);
});
#endif
static void em_web_audio_flush(void){
 ++em_web_audio_epoch;em_web_audio_playing=-1;
 if(em_web_audio_external)em_web_audio_flush_js(em_web_audio_epoch);
}
EMSCRIPTEN_KEEPALIVE int dune_web_audio_worklet(int enabled){
 if(!em_window||!em_host.audio_device)return 0;
 em_web_audio_external=!!enabled;
 SDL_PauseAudioDevice(em_host.audio_device,1);SDL_ClearQueuedAudio(em_host.audio_device);em_host.audio_running=0;
 em_web_audio_flush();return 1;
}
static int em_web_audio_service(SDLHost*h,CPU*c);

EMSCRIPTEN_KEEPALIVE void dune_web_reset_clock(void) {
    em_web_clock_reset(&em_web_clock,emscripten_get_now());
    if(em_window)sdl_host_rebase(&em_host,&em_cpu);
}

/* JS calls this on visibilitychange; an optional blur/focus handler can use
   the same suspension API. It does not alter the user's manual pause state. */
EMSCRIPTEN_KEEPALIVE void dune_web_set_hidden(int hidden) {
    em_web_hidden=!!hidden;
    dune_web_reset_clock();
    if(!em_window)return;
    if(hidden) {
        em_web_audio_flush();
        if(em_web_audio_external)em_web_audio_playing_js(0);
        memset(em_cpu.pad_buttons,0,sizeof em_cpu.pad_buttons);
        em_host.fast_forward=0;
#ifdef GENESIS_DUNE_MOUSE
        dune_mouse_reset(&em_host.dune_mouse);
        em_host.dune_view.pointer_valid=0;
#endif
        if(em_host.audio_device) {
            SDL_PauseAudioDevice(em_host.audio_device,1);
            SDL_ClearQueuedAudio(em_host.audio_device);
        }
        em_host.audio_running=0;
        em_cpu.audio.read=0;
        em_cpu.audio.count=0;
    }
}

EMSCRIPTEN_KEEPALIVE void dune_web_pause(int paused) {
    if(!em_window)return;
    em_host.paused=!!paused;
    dune_web_reset_clock();
    em_web_audio_service(&em_host,&em_cpu);
}

EMSCRIPTEN_KEEPALIVE void dune_web_set_paused(int paused) {dune_web_pause(paused);}
EMSCRIPTEN_KEEPALIVE void dune_web_rebase(void) {dune_web_reset_clock();}
/* Read-only video routing; legacy comparison can show the native full screen. */
EMSCRIPTEN_KEEPALIVE void dune_web_native_video(int enabled) {
    em_web_original_video=!!enabled;
    if(em_window)em_host.last_frame=UINT64_MAX;
}

/* Same bit mask as the original runtime controller: no synthetic orders,
   coordinate edits, unit behavior or gameplay state changes. */
EMSCRIPTEN_KEEPALIVE void dune_web_pad(int mask,int down) {
    if(!em_window)return;
    uint8_t buttons=(uint8_t)mask;
    if(down)em_cpu.pad_buttons[0]|=buttons;
    else em_cpu.pad_buttons[0]&=(uint8_t)~buttons;
}

EMSCRIPTEN_KEEPALIVE int dune_web_resize(int width,int height) {
    if(!em_window || !em_host.window || width<1 || height<1)return 0;
    if(width>8192)width=8192;if(height>8192)height=8192;
    SDL_SetWindowSize(em_host.window,width,height);
    em_host.last_frame=UINT64_MAX;
#ifdef GENESIS_DUNE_MOUSE
    em_host.dune_view.frame=UINT64_MAX;
#endif
    return 1;
}

/* Read-only access to the last complete original video frame for responsive
   non-battle screens. No replay, palette rewriting or game-state mutation. */
EMSCRIPTEN_KEEPALIVE const uint8_t *dune_web_frame_rgb(void) {return em_web_frame_present(&em_cpu);}
EMSCRIPTEN_KEEPALIVE uint32_t dune_web_frame_serial(void) {return (uint32_t)em_cpu.vdp.rendered_frames;}
EMSCRIPTEN_KEEPALIVE int dune_web_frame_width(void) {return em_cpu.vdp.frame_width;}
EMSCRIPTEN_KEEPALIVE int dune_web_frame_height(void) {return em_cpu.vdp.frame_height;}

EMSCRIPTEN_KEEPALIVE const char *dune_web_debug(void) {
    static char report[2304];
    char z80_head[33];
    for(unsigned i=0;i<16;++i)snprintf(z80_head+i*2,3,"%02x",em_cpu.z80_bus.ram[i]);
    snprintf(report,sizeof report,
        "{\"masterCycles\":%llu,\"masterHz\":%u,\"frames\":%llu,"
        "\"renderedFrames\":%llu,\"instructions\":%llu,\"pc\":%u,"
        "\"paused\":%d,\"manualPaused\":%d,\"hidden\":%d,\"fault\":%d,"
        "\"callbacks\":%llu,\"advancedCallbacks\":%llu,\"cycleCredit\":%.6f,"
        "\"frameWidth\":%u,\"frameHeight\":%u,\"soundSamples\":%llu,"
        "\"audioDropped\":%llu,\"ymWrites\":%llu,\"z80Pc\":%u,"
        "\"z80Head\":\"%s\",\"z80BusRequested\":%u,\"z80ResetReleased\":%u,\"hostCanvasVisible\":%d,\"hostServiceCalls\":%llu,\"hostServiceMs\":%.3f,\"hostStepMs\":%.3f,\"hostCallbackMs\":%.3f,\"hostCallbackMaxMs\":%.3f,\"hostCallbackTotalMs\":%.3f,\"hostPresentations\":%llu,\"hostAudioQueuedMs\":%.3f,\"hostAudioRingMs\":%.3f,\"hostAudioPeakMs\":%.3f,\"hostAudioDiscardedFrames\":%llu,\"hostAudioResets\":%llu,\"hostAudioExternal\":%d,\"hostAudioEpoch\":%u,\"hostAudioExternalFrames\":%llu,\"hostAudioExternalPackets\":%llu}",
        (unsigned long long)em_cpu.master_cycles,vdp_master_frequency(&em_cpu.vdp),
        (unsigned long long)em_cpu.vdp.frames,(unsigned long long)em_cpu.vdp.rendered_frames,
        (unsigned long long)em_cpu.steps,em_cpu.pc,!!(em_host.paused||em_web_hidden),
        !!em_host.paused,!!em_web_hidden,!!em_cpu.fault,
        (unsigned long long)em_web_callbacks,(unsigned long long)em_web_advanced_callbacks,
        em_web_clock.credit_cycles,em_cpu.vdp.frame_width,em_cpu.vdp.frame_height,
        (unsigned long long)em_cpu.audio.frames,(unsigned long long)em_cpu.audio.dropped,
        (unsigned long long)em_cpu.ym2612_stub.writes,em_cpu.z80_cpu.pc,z80_head,
        em_cpu.z80_bus.requested,em_cpu.z80_bus.reset_released,
        em_web_canvas_visible_flag,(unsigned long long)em_web_service_calls,em_web_service_ms,em_web_step_ms,em_web_callback_ms,em_web_callback_max_ms,em_web_callback_total_ms,
        (unsigned long long)em_web_presentations,em_host.audio_device?1000.0*SDL_GetQueuedAudioSize(em_host.audio_device)/(AUDIO_RATE*4):0.0,
        1000.0*em_cpu.audio.count/AUDIO_RATE,1000.0*em_web_audio_peak_frames/AUDIO_RATE,
        (unsigned long long)em_web_host_audio_discarded,(unsigned long long)em_web_host_audio_resets,em_web_audio_external,em_web_audio_epoch,(unsigned long long)em_web_audio_external_frames,(unsigned long long)em_web_audio_external_packets);
    return report;
}

/* PCM generation remains wholly native. Only the playback consumer replaces
 * the old half-second SDL backlog policy: stale output must not delay clicks.
 * Trimming never rewinds a chip, skips a machine step or alters native dropped.
 */
static int em_web_audio_service(SDLHost*h,CPU*c){
 if(!h->audio_device)return 1;
 int playing=!h->paused&&!em_web_hidden&&!h->stopped&&!c->fault&&!h->fast_forward&&!h->no_throttle;
 c->audio.playback=playing;
 if(em_web_audio_external){
  if(em_web_audio_playing!=playing){
   if(!playing)em_web_audio_flush();
   em_web_audio_playing=playing;em_web_audio_playing_js(playing);
  }
  if(!playing){h->audio_running=0;c->audio.read=c->audio.count=0;return 1;}
  int16_t packet[1024*2];unsigned n;
  while((n=audio_pop(c,packet,1024))!=0){
#ifdef GENESIS_DUNE_MOUSE
   for(unsigned i=0;i<n*2;++i)packet[i]=dune_audio_scale(packet[i],h->dune_volume);
#endif
   if(em_web_audio_push(packet,n)){em_web_audio_external_frames+=n;++em_web_audio_external_packets;}
   else{
    /* Processor failure restores the existing SDL device; this packet is
     * queued exactly once rather than lost or played by both consumers. */
    em_web_audio_external=0;em_web_audio_playing=-1;
    if(SDL_QueueAudio(h->audio_device,packet,n*4))return sdl_host_error(h,"audio fallback queue failed");
    break;
   }
  }
  if(em_web_audio_external)return 1;
 }
 unsigned queued=SDL_GetQueuedAudioSize(h->audio_device)/4;
 if(queued>em_web_audio_peak_frames)em_web_audio_peak_frames=queued;
 if(!playing){
  if(h->audio_running||queued){SDL_PauseAudioDevice(h->audio_device,1);SDL_ClearQueuedAudio(h->audio_device);}
  h->audio_running=0;c->audio.read=0;c->audio.count=0;return 1;
 }
 unsigned ceiling=AUDIO_RATE*96/1000,keep=AUDIO_RATE*64/1000;
 if(queued+c->audio.count>ceiling){
  em_web_host_audio_discarded+=queued;++em_web_host_audio_resets;
  SDL_PauseAudioDevice(h->audio_device,1);SDL_ClearQueuedAudio(h->audio_device);h->audio_running=0;
  if(c->audio.count>keep){unsigned stale=c->audio.count-keep;c->audio.read=(c->audio.read+stale)%AUDIO_RING_FRAMES;c->audio.count-=stale;em_web_host_audio_discarded+=stale;}
 }
 int16_t buffer[1024*2];unsigned count;
 while((count=audio_pop(c,buffer,1024))!=0){
 #ifdef GENESIS_DUNE_MOUSE
 for(unsigned i=0;i<count*2;++i)buffer[i]=dune_audio_scale(buffer[i],h->dune_volume);
 #endif
 if(SDL_QueueAudio(h->audio_device,buffer,count*4))return sdl_host_error(h,"audio queue failed");
 }
 if(!h->audio_running&&SDL_GetQueuedAudioSize(h->audio_device)>=AUDIO_RATE*4/50){SDL_PauseAudioDevice(h->audio_device,0);h->audio_running=1;}
 return 1;
}
static int em_web_service(void) {
    double start=emscripten_get_now();++em_web_service_calls;
    uint64_t frame=em_host.last_frame;
    /* Hand off fresh PCM before a potentially expensive canvas upload. */
    int live=em_web_audio_service(&em_host,&em_cpu);
    if(!live){em_window=0;emscripten_cancel_main_loop();return 0;}
    /* SDL event/render handling is unchanged. Its legacy queue policy is
     * disabled only during this synchronous call and serviced once below. */
    SDL_AudioDeviceID device=em_host.audio_device;em_host.audio_device=0;
    live=sdl_host_service(&em_host,&em_cpu);em_host.audio_device=device;
    if(frame!=em_host.last_frame)++em_web_presentations;
    if(live)live=em_web_audio_service(&em_host,&em_cpu);
    em_web_service_ms+=emscripten_get_now()-start;
    if(live)return 1;
    em_window=0;emscripten_cancel_main_loop();return 0;
}

static void em_web_main_loop_work(void) {
    ++em_web_callbacks;
    if(!em_window)return;
    double now=emscripten_get_now();
    if(em_web_hidden) {
        em_web_clock_due(&em_web_clock,now,vdp_master_frequency(&em_cpu.vdp),1);
        return;
    }
    /* Poll even with no due cycles: manual pause can always be released and
       120 Hz input is not gated on the next native VBlank. */
    /* A camera change invalidates the expanded map before this callback.
     * Its pre-step raster would be overwritten by the post-step raster in
     * the same synchronous WASM call, before the browser can display it.
     * Keep SDL input/audio polling here; draw that map only once at the end.
     * Non-map native fades/animations retain their existing presentation. */
    int defer_map=!em_host.paused&&!em_host.stopped&&!em_cpu.fault&&dune_view_map(&em_cpu);
    em_web_canvas_deferred=defer_map;
    int live=em_web_service();
    em_web_canvas_deferred=0;
    if(!live)return;
    if(em_cpu.fault || (em_cpu.halted && !machine_can_wake(&em_cpu))) {
        if(defer_map&&!em_web_service())return;
        sdl_host_stop(&em_host,&em_cpu);
        em_web_clock_reset(&em_web_clock,now);
        /* Keep RAF alive so restoring a known good save can recover. */
        return;
    }
    uint32_t hz=vdp_master_frequency(&em_cpu.vdp);
    uint64_t due=em_web_clock_due(&em_web_clock,now,hz,em_host.paused);
    if(em_host.paused || !due){if(defer_map)em_web_service();return;}
    /* Bound one callback's catch-up work to about four native frames. Any
       unfinished cycle debt stays queued; no game-state steps are skipped. */
    uint64_t budget=hz/15u;
    if(due<budget)budget=due;
    ++em_web_advanced_callbacks;
    uint64_t start=em_cpu.master_cycles,target=start+budget;double step_start=emscripten_get_now();
    while(em_cpu.master_cycles<target) {
        /* ASYNCIFY=0: no browser DOM input can arrive while this WASM call
         * runs. Polling every modeled millisecond only repeated SDL/audio work
         * and rendered catch-up frames that the browser could never display. */
        if(em_cpu.fault || (em_cpu.halted && !machine_can_wake(&em_cpu)))break;
#if defined(GENESIS_DUNE_MOUSE) && defined(GENESIS_SDL2)
#ifdef EM_WEB_MODERN_INPUT
        if(!em_web_campaign_observe(&em_cpu)){
          em_web_selection_observe();
          if(!em_web_menus_observe(&em_host.dune_mouse,&em_cpu) &&
             !em_web_menu_select_observe(&em_host.dune_mouse,&em_cpu))
            dune_mouse_observe(&em_host.dune_mouse,&em_cpu);
        }
#else
        dune_mouse_observe(&em_host.dune_mouse,&em_cpu);
#endif
#endif
        machine_step(&em_cpu);
    }
    em_web_step_ms+=emscripten_get_now()-step_start;
    em_web_clock_consume(&em_web_clock,em_cpu.master_cycles-start);
    if(!em_web_service())return;
    if(em_host.paused)em_web_clock_reset(&em_web_clock,emscripten_get_now());
}

static void em_web_main_loop_iter(void){
 double start=emscripten_get_now();em_web_main_loop_work();
 em_web_callback_ms=emscripten_get_now()-start;em_web_callback_total_ms+=em_web_callback_ms;if(em_web_callback_ms>em_web_callback_max_ms)em_web_callback_max_ms=em_web_callback_ms;
}

/* Drop-in registration compatibility with the existing generated web fork. */
static void em_main_loop_iter(void) {em_web_main_loop_iter();}
#endif
#endif
