/* Approximate original 68000 occupancy, excluding Dune's VBlank wait loop.
   This measures console cycle use, not host CPU use or rendering speed. */
#ifndef GENESIS_DUNE_CPU_SDL_H
#define GENESIS_DUNE_CPU_SDL_H
#if defined(GENESIS_DUNE_MOUSE) && defined(GENESIS_SDL2)
static void dune_cpu_sample(SDLHost *h,const CPU *c){
    if(!h->dune_cpu_sample_valid || c->cycles<h->dune_cpu_cycles ||
       c->dune_wait_cycles<h->dune_cpu_idle || c->vdp.frames<h->dune_cpu_frame){
        h->dune_cpu_cycles=c->cycles;h->dune_cpu_idle=c->dune_wait_cycles;
        h->dune_cpu_frame=c->vdp.frames;h->dune_cpu_sample_valid=1;h->dune_cpu_percent=0;return;
    }
    if(c->vdp.frames-h->dune_cpu_frame<15)return;
    uint64_t total=c->cycles-h->dune_cpu_cycles,idle=c->dune_wait_cycles-h->dune_cpu_idle;
    if(idle>total)idle=total;
    h->dune_cpu_percent=total?(unsigned)(((total-idle)*100+total/2)/total):0;
    h->dune_cpu_cycles=c->cycles;h->dune_cpu_idle=c->dune_wait_cycles;h->dune_cpu_frame=c->vdp.frames;
}
static int dune_cpu_text(SDL_Renderer *r,const char *text,int x,int y){
    static const uint8_t digits[10][5]={{7,5,5,5,7},{2,6,2,2,7},{7,1,7,4,7},{7,1,7,1,7},{5,5,7,1,1},{7,4,7,1,7},{7,4,7,5,7},{7,1,1,1,1},{7,5,7,5,7},{7,5,7,1,7}};
    static const uint8_t k[5]={5,5,6,5,5},colon[5]={0,2,0,2,0},percent[5]={5,1,2,4,5};
    for(;*text;++text,x+=8){
        const uint8_t *glyph=*text>='0' && *text<='9'?digits[*text-'0']:*text=='K'?k:*text==':'?colon:*text=='%'?percent:NULL;
        if(!glyph)continue;
        for(int row=0;row<5;++row)for(int col=0;col<3;++col)if(glyph[row]&(4>>col)){
            SDL_Rect pixel={x+col*2,y+row*2,2,2};if(SDL_RenderFillRect(r,&pixel))return 0;
        }
    }
    return 1;
}
static int dune_cpu_draw(SDLHost *h,const CPU *c){
    if(!h->dune_cpu_overlay)return 1;
    dune_cpu_sample(h,c);
    SDL_BlendMode blend;Uint8 r,g,b,a;
    if(SDL_GetRenderDrawBlendMode(h->renderer,&blend) || SDL_GetRenderDrawColor(h->renderer,&r,&g,&b,&a))return 0;
    SDL_Rect panel={8,8,112,34},bar={12,26,100,8};
    int ok=!SDL_SetRenderDrawBlendMode(h->renderer,SDL_BLENDMODE_BLEND) &&
           !SDL_SetRenderDrawColor(h->renderer,0,0,0,200) && !SDL_RenderFillRect(h->renderer,&panel) &&
           !SDL_SetRenderDrawColor(h->renderer,240,240,240,255);
    char label[16];snprintf(label,sizeof label,"68K: %u%%",h->dune_cpu_percent);
    if(ok)ok=dune_cpu_text(h->renderer,label,12,12) && !SDL_RenderDrawRect(h->renderer,&bar);
    bar.x++;bar.y++;bar.h-=2;bar.w=(int)(98*h->dune_cpu_percent/100);
    if(ok)ok=!SDL_SetRenderDrawColor(h->renderer,h->dune_cpu_percent>=80?255:64,h->dune_cpu_percent>=95?72:220,64,255);
    if(ok && bar.w)ok=!SDL_RenderFillRect(h->renderer,&bar);
    if(SDL_SetRenderDrawBlendMode(h->renderer,blend) || SDL_SetRenderDrawColor(h->renderer,r,g,b,a))ok=0;
    return ok;
}
#endif
#endif
