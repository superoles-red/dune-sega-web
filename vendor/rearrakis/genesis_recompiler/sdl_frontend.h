/* SDL2 presents the existing RGB renderer and supplies three-button pad input. */
#ifndef GENESIS_SDL_FRONTEND_H
#define GENESIS_SDL_FRONTEND_H
#ifdef GENESIS_SDL2
#include <SDL.h>

#ifndef GENESIS_WINDOW_TITLE
#define GENESIS_WINDOW_TITLE "ReArrakis"
#endif
typedef struct {
    SDL_Window *window;
#ifdef GENESIS_DUNE_MOUSE
    DuneMouse dune_mouse;
    DuneView dune_view;
    SDL_Texture *dune_world,*dune_hud;
    unsigned dune_width,dune_height;
    int dune_window_width,dune_window_height;
    int dune_volume;
    int dune_cpu_overlay,dune_cpu_sample_valid;
    unsigned dune_cpu_percent;
    uint64_t dune_cpu_cycles,dune_cpu_idle,dune_cpu_frame;
#endif
    SDL_Renderer *renderer;
    SDL_Texture *texture;
    SDL_AudioDeviceID audio_device;
    int audio_running;
    unsigned width, height;
    uint64_t last_frame, next_service, origin_master;
    Uint64 origin_counter, frequency;
    int paused, stopped, fast_forward, no_throttle, error;
} SDLHost;

static void sdl_host_close(SDLHost *h) {
#ifdef GENESIS_DUNE_MOUSE
    free(h->dune_view.shadow);free(h->dune_view.pixels);free(h->dune_view.ui);
    SDL_DestroyTexture(h->dune_world);SDL_DestroyTexture(h->dune_hud);
#endif
    if(h->audio_device)SDL_CloseAudioDevice(h->audio_device);
    h->audio_device=0;h->audio_running=0;
    SDL_DestroyTexture(h->texture);
    SDL_DestroyRenderer(h->renderer);
    SDL_DestroyWindow(h->window);
    h->texture=NULL; h->renderer=NULL; h->window=NULL;
    SDL_Quit();
}
static int sdl_host_error(SDLHost *h, const char *operation) {
    fprintf(stderr,"SDL2 %s: %s\n",operation,SDL_GetError());
    h->error=1; return 0;
}
#include "dune_audio.h"
#include "dune_view_sdl.h"
static int sdl_host_open(SDLHost *h) {
#ifdef GENESIS_DUNE_MOUSE
    h->dune_mouse.enabled=1;h->dune_view.zoom=100;
    h->dune_volume=dune_audio_volume(getenv("DUNE_VOLUME"));
#endif
    if (SDL_Init(SDL_INIT_VIDEO|SDL_INIT_EVENTS)) return sdl_host_error(h,"initialization failed");
    SDL_SetHint(SDL_HINT_RENDER_SCALE_QUALITY,"nearest");
    int initial_width=960,initial_height=672;
#ifdef GENESIS_DUNE_MOUSE
    SDL_Rect usable;
    if(!SDL_GetDisplayUsableBounds(0,&usable)){
        if(initial_width>usable.w-32)initial_width=usable.w-32;
        if(initial_height>usable.h-64)initial_height=usable.h-64;
        if(initial_width<320)initial_width=320;if(initial_height<224)initial_height=224;
    }
#endif
    h->window=SDL_CreateWindow(GENESIS_WINDOW_TITLE,SDL_WINDOWPOS_CENTERED,SDL_WINDOWPOS_CENTERED,
        initial_width,initial_height,SDL_WINDOW_RESIZABLE|SDL_WINDOW_ALLOW_HIGHDPI);
    if (!h->window) return sdl_host_error(h,"window creation failed");
    h->renderer=SDL_CreateRenderer(h->window,-1,SDL_RENDERER_ACCELERATED);
    if (!h->renderer) h->renderer=SDL_CreateRenderer(h->window,-1,SDL_RENDERER_SOFTWARE);
    if (!h->renderer) return sdl_host_error(h,"renderer creation failed");
    SDL_SetRenderDrawColor(h->renderer,0,0,0,255);
    if (SDL_RenderClear(h->renderer)) return sdl_host_error(h,"clear failed");
    SDL_RenderPresent(h->renderer);
    h->frequency=SDL_GetPerformanceFrequency(); h->origin_counter=SDL_GetPerformanceCounter();
    return 1;
}
static void sdl_host_audio_open(SDLHost *h,CPU *c) {
    if(SDL_InitSubSystem(SDL_INIT_AUDIO)) {
        fprintf(stderr,"SDL2 audio unavailable: %s; video continues\n",SDL_GetError());return;
    }
    SDL_AudioSpec desired={0},obtained={0};
#ifdef __EMSCRIPTEN__
    desired.samples=2048;
#else
    desired.samples=512;
#endif
    desired.freq=AUDIO_RATE;desired.format=AUDIO_S16SYS;desired.channels=2;
    h->audio_device=SDL_OpenAudioDevice(NULL,0,&desired,&obtained,0);
    if(!h->audio_device) {
        fprintf(stderr,"SDL2 audio device unavailable: %s; video continues\n",SDL_GetError());return;
    }
    c->audio.playback=1;
}
static int sdl_host_audio_service(SDLHost *h,CPU *c) {
    if(!h->audio_device)return 1;
    int playing=!h->paused && !h->stopped && !c->fault && !h->fast_forward && !h->no_throttle;
    c->audio.playback=playing;
    if(!playing) {
        SDL_PauseAudioDevice(h->audio_device,1);SDL_ClearQueuedAudio(h->audio_device);
        h->audio_running=0;c->audio.read=0;c->audio.count=0;return 1;
    }
    // Bound latency even when a host cannot keep up. Never change chip clocks.
    Uint32 queued=SDL_GetQueuedAudioSize(h->audio_device);
#ifdef __EMSCRIPTEN__
    if(queued>AUDIO_RATE*4/2){
        c->audio.dropped+=queued/4;SDL_ClearQueuedAudio(h->audio_device);h->audio_running=0;
    }
#else
    if(queued>AUDIO_RATE*4/10){
        c->audio.dropped+=queued/4;SDL_ClearQueuedAudio(h->audio_device);h->audio_running=0;
    }
#endif
    int16_t buffer[1024*2];unsigned count;
    while((count=audio_pop(c,buffer,1024))!=0) {
#ifdef GENESIS_DUNE_MOUSE
        for(unsigned i=0;i<count*2;++i)buffer[i]=dune_audio_scale(buffer[i],h->dune_volume);
#endif
        if(SDL_QueueAudio(h->audio_device,buffer,count*4))return sdl_host_error(h,"audio queue failed");
    }
    // A small preroll keeps the first callback from immediately underrunning.
    if(!h->audio_running && SDL_GetQueuedAudioSize(h->audio_device)>=AUDIO_RATE*4/50) {
        SDL_PauseAudioDevice(h->audio_device,0);h->audio_running=1;
    }
    return 1;
}
static uint8_t sdl_pad_key(SDL_Keycode key) {
    switch (key) {
        case SDLK_UP: return PAD_UP; case SDLK_DOWN: return PAD_DOWN;
        case SDLK_LEFT: return PAD_LEFT; case SDLK_RIGHT: return PAD_RIGHT;
        case SDLK_z: return PAD_A; case SDLK_x: return PAD_B; case SDLK_c: return PAD_C;
        case SDLK_RETURN: return PAD_START;
        default: return 0;
    }
}
#include "dune_mouse_sdl.h"
static void sdl_host_rebase(SDLHost *h, const CPU *c) {
    h->origin_counter=SDL_GetPerformanceCounter(); h->origin_master=c->master_cycles;
}
static int sdl_host_draw(SDLHost *h, const VDP *v) {
    if (!v->rendered_frames) {
        return 1;
    }
    unsigned presentation_width=v->frame_width;
    int texture_changed=!h->texture || h->width!=presentation_width || h->height!=v->frame_height;
    if (texture_changed) {
        SDL_DestroyTexture(h->texture);
        h->texture=SDL_CreateTexture(h->renderer,SDL_PIXELFORMAT_RGB24,SDL_TEXTUREACCESS_STREAMING,
            presentation_width,v->frame_height);
        if (!h->texture) return sdl_host_error(h,"texture creation failed");
        h->width=presentation_width; h->height=v->frame_height;
        if (SDL_RenderSetLogicalSize(h->renderer,(int)h->width,(int)h->height))
            return sdl_host_error(h,"logical size failed");
    }
    int upload=texture_changed || h->last_frame!=v->rendered_frames;
    if (upload) {
        const uint8_t *pixels=v->frame;
        if (SDL_UpdateTexture(h->texture,NULL,pixels,presentation_width*3))
            return sdl_host_error(h,"texture upload failed");
        h->last_frame=v->rendered_frames;
    }
    if (SDL_RenderSetLogicalSize(h->renderer,(int)h->width,(int)h->height) ||
        SDL_RenderClear(h->renderer) || SDL_RenderCopy(h->renderer,h->texture,NULL,NULL))
        return sdl_host_error(h,"presentation failed");
    SDL_RenderPresent(h->renderer); return 1;
}
static void sdl_host_stop(SDLHost *h, const CPU *c) {
    if (h->stopped) return;
    h->stopped=1;
    char title[256];
    if (c->fault) {
        snprintf(title,sizeof title,GENESIS_WINDOW_TITLE " - stopped: %s",c->reason);
        fprintf(stderr,"execution stopped at %06" PRIx32 ": %s\n",c->fault_address,c->reason);
    } else snprintf(title,sizeof title,GENESIS_WINDOW_TITLE " - CPU halted");
    SDL_SetWindowTitle(h->window,title);
}
static int sdl_host_service(SDLHost *h, CPU *c) {
    int redraw=0;
    SDL_Event event;
    while (SDL_PollEvent(&event)) {
#ifdef GENESIS_DUNE_MOUSE
        if(dune_view_event(h,c,&event)){redraw=1;continue;}
        dune_mouse_event(h,c,&event);
#endif
        if (event.type==SDL_QUIT) return 0;
        if (event.type==SDL_WINDOWEVENT) {
            if (event.window.event==SDL_WINDOWEVENT_CLOSE) return 0;
            if (event.window.event==SDL_WINDOWEVENT_FOCUS_LOST) {
                c->pad_buttons[0]=0; h->fast_forward=0; sdl_host_rebase(h,c);
            }
            if (event.window.event==SDL_WINDOWEVENT_EXPOSED || event.window.event==SDL_WINDOWEVENT_SIZE_CHANGED)
                redraw=1;
        }
        if (event.type==SDL_KEYDOWN || event.type==SDL_KEYUP) {
            int down=event.type==SDL_KEYDOWN;
            SDL_Keycode key=event.key.keysym.sym;
            if (down && key==SDLK_ESCAPE) {
                return 0;
            }
            uint8_t button=sdl_pad_key(key);
            if (down) c->pad_buttons[0]|=button; else c->pad_buttons[0]&=(uint8_t)~button;
            if (key==SDLK_TAB) { h->fast_forward=down; sdl_host_rebase(h,c); }
            if (down && !event.key.repeat && key==SDLK_SPACE && !h->stopped) {
                h->paused=!h->paused; sdl_host_rebase(h,c);
                SDL_SetWindowTitle(h->window,h->paused ? GENESIS_WINDOW_TITLE " - paused":GENESIS_WINDOW_TITLE);
            }
        }
    }
    if (redraw || h->last_frame!=c->vdp.rendered_frames){
        if(!sdl_host_audio_service(h,c))return 0;
#ifdef GENESIS_DUNE_MOUSE
        if(!dune_view_draw(h,c))return 0;
#else
        if (!sdl_host_draw(h,&c->vdp)) return 0;
#endif
    }
    if(!sdl_host_audio_service(h,c))return 0;
    /* Service input every ~1 ms of modeled console time, even before video is enabled.
       Throttling uses emulated clocks, never changing the CPU/device scheduling. */
    h->next_service=c->master_cycles+vdp_master_frequency(&c->vdp)/1000;
    if (!h->paused && !h->stopped && !h->fast_forward && !h->no_throttle
    ) {
        double simulated_ms=(double)(c->master_cycles-h->origin_master)*1000.0/vdp_master_frequency(&c->vdp);
        double elapsed_ms=(double)(SDL_GetPerformanceCounter()-h->origin_counter)*1000.0/(double)h->frequency;
        double ahead=simulated_ms-elapsed_ms;
#ifdef __EMSCRIPTEN__
        SDL_Delay(ahead >= 1.0 ? (Uint32)(ahead > 10.0 ? 10.0 : ahead) : 1);
#else
        if (ahead>=1.0) SDL_Delay((Uint32)(ahead>10.0 ? 10.0:ahead));
#endif
    }
    return 1;
}
#endif
#endif
