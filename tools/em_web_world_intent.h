/* A world A is an input edge plus a target, not a transient hover. Preserve
 * only host mouse intent until original $27B80 consumes the edge/target pair.
 * No CPU/game fields, instruction flow or native action guards are changed. */
#ifndef DUNE_EM_WEB_WORLD_INTENT_H
#define DUNE_EM_WEB_WORLD_INTENT_H
#ifndef EM_WEB_WORLD_INTENT_REBASE_TOKEN
#define EM_WEB_WORLD_INTENT_REBASE_TOKEN 0u
#endif
typedef struct {
    const CPU *owner;
    int active,wx,wy;
    uint64_t clicks,steps,cycles,rebase;
} EmWebWorldIntent;
static EmWebWorldIntent em_web_world_intent;
static void em_web_world_intent_cancel(void){em_web_world_intent.active=0;}
static int em_web_world_intent_queue(DuneMouse*m,CPU*c,int wx,int wy){
    if(em_web_world_intent.active||m->count||m->stage||!m->enabled||c->fault||
       c->pad_buttons[0]||dune_mouse_context(c)!=1||wx<0||wy<0||wx>=2048||wy>=2048)return 0;
    unsigned count=m->count;uint64_t clicks=m->clicks;
    dune_mouse_world_click(m,c,wx,wy,DUNE_CLICK_SELECT);
    if(m->count!=count+1)return 0;
    em_web_world_intent=(EmWebWorldIntent){c,1,wx,wy,clicks,c->steps,c->master_cycles,(uint64_t)EM_WEB_WORLD_INTENT_REBASE_TOKEN};return 1;
}
static void em_web_world_intent_observe(DuneMouse*m,CPU*c){
    EmWebWorldIntent*s=&em_web_world_intent;if(!s->active)return;
    if(s->owner!=c||c->fault||!m->enabled||c->pad_buttons[0]||dune_mouse_context(c)!=1||
       c->steps<s->steps||c->master_cycles<s->cycles||m->clicks<s->clicks||
       (uint64_t)EM_WEB_WORLD_INTENT_REBASE_TOKEN!=s->rebase||
       (!m->count&&m->clicks==s->clicks)){s->active=0;return;}
    s->steps=c->steps;s->cycles=c->master_cycles;
    /* The original main task can consume A several VBlanks after the mouse
     * edge was popped. Its free cursor otherwise auto-centers and silently
     * changes C240 in the meantime. Release only at actual native A entry. */
    if(c->pc==0x27b80&&m->clicks>s->clicks){s->active=0;return;}
    m->point_world=1;m->wx=s->wx;m->wy=s->wy;m->dirty=1;
    if(m->tile_valid){m->tile_wx=s->wx;m->tile_wy=s->wy;}
    if(m->count){DuneClick*q=&m->queue[m->head];q->world=1;q->wx=s->wx;q->wy=s->wy;}
}
#endif
