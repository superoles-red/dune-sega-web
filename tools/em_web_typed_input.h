/* Browser input vocabulary only: SELECT is never a contextual unit order.
 * Every change of native selection still executes original clear/A code. A
 * command ticket restores its original, still-live actor through the same A
 * selector before the unchanged original contextual-A command is executed.
 * No unit order, economy, ability/timer or entity field is written here. */
#ifndef DUNE_EM_WEB_TYPED_INPUT_H
#define DUNE_EM_WEB_TYPED_INPUT_H
#ifndef EM_WEB_WORLD_INTENT_REBASE_TOKEN
#define EM_WEB_WORLD_INTENT_REBASE_TOKEN 0u
#endif
enum {EM_TYPED_NONE,EM_TYPED_SELECT,EM_TYPED_COMMAND};
enum {EM_TYPED_WAIT,EM_TYPED_SELECTING,EM_TYPED_ARMING,EM_TYPED_EXECUTING};
typedef struct {
    unsigned token,valid,armed,house,campaign;
    EmWebActionContext actor;
    uint64_t steps,cycles,frame,rebase;
} EmWebActorTicket;
typedef struct {
    unsigned kind,phase,armed;
    EmWebActionContext actor,target;
    double wx,wy;
    uint64_t steps,cycles,rebase;
} EmWebTypedIntent;
static EmWebActorTicket em_web_actor_tickets[8];
static unsigned em_web_actor_serial,em_web_actor_mask;
static EmWebTypedIntent em_web_typed;
static int em_web_typed_busy(void){return em_web_typed.kind!=EM_TYPED_NONE;}
static void em_web_typed_reset(void){
    memset(em_web_actor_tickets,0,sizeof em_web_actor_tickets);
    em_web_actor_mask=0;
    memset(&em_web_typed,0,sizeof em_web_typed);
    /* Serial deliberately survives state loads. Old browser tokens cannot
     * acquire a newly restored entity merely because a slot was reused. */
}
static EmWebActionContext em_web_typed_context(uint32_t p,unsigned kind){
    EmWebActionContext c={0};c.product=65535;
    if(!em_web_action_live(p,kind==2))return c;
    unsigned a=p&65535;c.pointer=p;c.kind=kind;c.id=dune_word(&em_cpu,a);
    c.type=em_cpu.ram[a+2];c.owner=em_cpu.ram[a+8];c.hp=dune_word(&em_cpu,a+18);
    if(kind==2){unsigned flags=dune_word(&em_cpu,a+6);c.product=dune_word(&em_cpu,a+82);
        c.ready=c.type==8&&(flags&0x2000)&&c.product<19&&em_cpu.ram[a+3]!=255;}
    return c;
}
static int em_web_typed_identity(EmWebActionContext c){
    if(!c.kind||!em_web_action_live(c.pointer,c.kind==2))return 0;
    unsigned a=c.pointer&65535;
    return dune_word(&em_cpu,a)==c.id&&em_cpu.ram[a+2]==c.type&&em_cpu.ram[a+8]==c.owner;
}
static EmWebActionContext em_web_input_actor(void){
    EmWebActionContext c=em_web_typed.kind==EM_TYPED_SELECT?em_web_typed.target:em_web_action_context();
    return em_web_typed_identity(c)?c:(EmWebActionContext){0};
}
static int em_web_input_actor_armed(EmWebActionContext actor,EmWebActionContext current){
    return actor.kind==2&&actor.pointer==current.pointer&&em_web_palace_ready(current)&&!!dune_word(&em_cpu,0xdc4c);
}
static int em_web_typed_world_legal(double wx,double wy){
    /* Same native mission rectangle used by the pre-existing world-intent
     * adapter. Browser letterboxing must never expose extra command cells. */
    return isfinite(wx)&&isfinite(wy)&&wx>=0&&wy>=0&&wx<2048&&wy<2048&&
        wx>=dune_word(&em_cpu,0xe3d2)&&wx<dune_word(&em_cpu,0xe3d4)+em_cpu.vdp.frame_width&&
        wy>=dune_word(&em_cpu,0xe3ce)&&wy<dune_word(&em_cpu,0xe3d0)+em_cpu.vdp.frame_height;
}
static EmWebActionContext em_web_target_world(double wx,double wy){
    EmWebActionContext none={0};none.product=65535;
    if(!isfinite(wx)||!isfinite(wy)||wx<0||wy<0||wx>=2048||wy>=2048)return none;
    /* Original A resolves a building first ($1A972), then a unit.
     * Use the same native occupancy flags/index; never rectangular hitboxes. */
    uint32_t b=em_web_selection_building_at(wx,wy);
    if(em_web_action_live(b,1))return em_web_typed_context(b,2);
    unsigned tile=(unsigned)wy/32*64+(unsigned)wx/32,a=0x7d9c+tile*4;
    if((em_cpu.ram[a+2]&16)&&em_cpu.ram[a+3]){
        unsigned id=em_cpu.ram[a+3]-1u;
        if(id<102)return em_web_typed_context(0xff1000u+id*140u,1);
    }
    return none;
}
static int em_web_typed_tile(EmWebActionContext c,unsigned*out){
    if(!em_web_typed_identity(c))return 0;
    if(c.kind==1)return em_web_self_tile(c.pointer,out);
    unsigned a=c.pointer&65535,tile=dune_word(&em_cpu,a+10)/256*64+dune_word(&em_cpu,a+12)/256;
    if(tile>=4096)return 0;
    unsigned at=0x7d9c+tile*4;
    if((em_cpu.ram[at+2]&32)&&em_cpu.ram[at+3]==c.id+1){*out=tile;return 1;}
    return 0;
}
static void em_web_typed_validate(void){
    if(!em_web_actor_mask&&!em_web_typed.kind)return;
    uint64_t rebase=(uint64_t)EM_WEB_WORLD_INTENT_REBASE_TOKEN;
    for(unsigned i=0;i<8;i++){
        if(!(em_web_actor_mask&(1u<<i)))continue;EmWebActorTicket*t=&em_web_actor_tickets[i];
        if(!em_window||em_cpu.fault||dune_mouse_context(&em_cpu)!=1||
           t->house!=dune_word(&em_cpu,0xc274)||t->campaign!=dune_word(&em_cpu,0xc050)||
           em_cpu.steps<t->steps||em_cpu.master_cycles<t->cycles||em_cpu.vdp.frames<t->frame||
           em_cpu.vdp.frames-t->frame>90||t->rebase!=rebase||!em_web_typed_identity(t->actor)){
            t->valid=0;em_web_actor_mask&=~(1u<<i);}
    }
    EmWebTypedIntent*t=&em_web_typed;
    if(t->kind&&(em_cpu.fault||dune_mouse_context(&em_cpu)!=1||
       em_cpu.steps<t->steps||em_cpu.master_cycles<t->cycles||t->rebase!=rebase||
       (t->kind==EM_TYPED_COMMAND&&(!em_web_typed_identity(t->actor)||t->actor.owner!=dune_word(&em_cpu,0xc274)))))memset(t,0,sizeof *t);
}
EMSCRIPTEN_KEEPALIVE int dune_web_actor_capture(void){
    em_web_typed_validate();if(!em_web_selection_map())return 0;
    EmWebActionContext current=em_web_action_context(),c=em_web_input_actor();
    /* A fresh capture belongs after the most recently accepted SELECT, even
     * while its original clear/A is pending. A touch double tap retains its
     * separately captured BEFORE-SELECT ticket, which is not changed here. */
    if(!c.kind||c.owner!=dune_word(&em_cpu,0xc274))return 0;
    unsigned token=(++em_web_actor_serial)&0x7fffffffu;if(!token)token=(++em_web_actor_serial)&0x7fffffffu;
    EmWebActorTicket*t=&em_web_actor_tickets[token%8];
    *t=(EmWebActorTicket){token,1,em_web_input_actor_armed(c,current),
        dune_word(&em_cpu,0xc274),dune_word(&em_cpu,0xc050),c,em_cpu.steps,em_cpu.master_cycles,
        em_cpu.vdp.frames,(uint64_t)EM_WEB_WORLD_INTENT_REBASE_TOKEN};
    em_web_actor_mask|=1u<<(token%8);
    return (int)token;
}
static int em_web_select_world(double wx,double wy){
    if(!em_web_selection_map()||!em_host.dune_mouse.enabled||!em_web_typed_world_legal(wx,wy))return 0;
    if(em_web_selection.operation||em_web_selection.phase||em_web_typed.kind)return 0;
    EmWebActionContext target=em_web_target_world(wx,wy),current=em_web_action_context();
    if(target.kind&&target.pointer==current.pointer){
        if(target.kind==1||target.ready)return 1; /* no self order or paid placement */
        /* A repeated single enters the original screen or arms a ready Palace.
         * The JS command-pair window defers an armed own-building SINGLE, so
         * an explicit double COMMAND can take priority over this info entry. */
    }
    em_web_selection_drop_mouse_queue();
    em_web_typed=(EmWebTypedIntent){EM_TYPED_SELECT,EM_TYPED_WAIT,0,{0},target,wx,wy,
        em_cpu.steps,em_cpu.master_cycles,(uint64_t)EM_WEB_WORLD_INTENT_REBASE_TOKEN};
    if(!target.kind||target.pointer!=current.pointer){
        if(current.kind||dune_word(&em_cpu,0xdc4c))em_web_selection_request_clear();
        else if(!target.kind)memset(&em_web_typed,0,sizeof em_web_typed);
    }
    return 1;
}
static int em_web_command_world(double wx,double wy,unsigned token){
    em_web_typed_validate();EmWebActorTicket*t=&em_web_actor_tickets[token%8];
    if(!token||!t->valid||t->token!=token||!em_web_selection_map()||!em_host.dune_mouse.enabled||
       !em_web_typed_world_legal(wx,wy))return 0;
    EmWebActionContext target=em_web_target_world(wx,wy);
    if(t->actor.kind==2&&!t->armed&&target.pointer!=t->actor.pointer)return 0;
    if(t->actor.kind==2&&t->actor.ready)return 0; /* paid product is drag-only */
    if(t->armed&&!em_web_palace_ready(t->actor))return 0;
    /* A double tap may arrive before the first SELECT's original clear/A.
     * Replace only that host intent. An already executing original selector
     * is allowed to finish; it began with no actor and cannot issue an order. */
    if(em_web_typed.kind==EM_TYPED_COMMAND||
       ((em_web_selection.operation||em_web_selection.phase)&&
        em_web_selection.operation!=EM_ACTION_CLEAR&&em_web_selection.phase!=EM_PHASE_CLEAR&&
        em_web_selection.phase!=EM_PHASE_CANCEL_SPECIAL))return 0;
    unsigned native_phase=em_web_typed.phase;
    em_web_selection_drop_mouse_queue();
    em_web_typed=(EmWebTypedIntent){EM_TYPED_COMMAND,native_phase==EM_TYPED_SELECTING?EM_TYPED_SELECTING:EM_TYPED_WAIT,
        t->armed,t->actor,target,wx,wy,em_cpu.steps,em_cpu.master_cycles,(uint64_t)EM_WEB_WORLD_INTENT_REBASE_TOKEN};
    t->valid=0;em_web_actor_mask&=~(1u<<(token%8));return 1;
}
static void em_web_typed_dispatch(unsigned tile,unsigned phase){
    em_web_typed.phase=phase;
    write_mem(&em_cpu,0xffc240,2,tile);em_cpu.d[3]=(em_cpu.d[3]&0xffff0000u)|tile;
    em_cpu.pc=0x27b80; /* complete, unchanged original contextual A */
}
static void em_web_typed_observe(void){
    em_web_typed_validate();EmWebTypedIntent*t=&em_web_typed;if(!t->kind)return;
    if(t->phase){
        /* Original A gives an armed Palace priority over another building,
         * but a same-Palace hit chooses its info screen at $27BCE instead.
         * Explicit COMMAND identifies a target, including that same footprint:
         * choose the EXISTING $27BEC input-classification instruction. Every
         * original selected/type/ready/cooldown/disabled/armed guard then runs
         * at $27D60..$27E96, followed by unchanged house/resource/weapon code.
         * SELECT and unarmed A retain their complete original routing. */
        if(t->kind==EM_TYPED_COMMAND&&t->phase==EM_TYPED_EXECUTING&&t->armed&&
           t->actor.kind==2&&t->actor.type==2&&em_cpu.pc==0x27bce&&
           em_cpu.a[3]==t->actor.pointer&&em_cpu.a[0]==t->actor.pointer&&
           dune_long(&em_cpu,0xc578)==t->actor.pointer&&!dune_long(&em_cpu,0xc25c)){
            em_cpu.pc=0x27bec;return;
        }
        if(em_cpu.pc!=0xe57a)return;
        unsigned phase=t->phase;t->phase=EM_TYPED_WAIT;
        if(phase==EM_TYPED_EXECUTING||t->kind==EM_TYPED_SELECT){memset(t,0,sizeof *t);return;}
        if(phase==EM_TYPED_ARMING&&!dune_word(&em_cpu,0xdc4c)){memset(t,0,sizeof *t);return;}
    }
    if(em_web_selection.operation||em_web_selection.phase||em_web_selection.clear_requested||
       em_cpu.pc!=0x27b5e||!em_web_selection_map()||em_cpu.pad_buttons[0])return;
    unsigned sp=em_cpu.a[7]&65535;if(sp>65500||dune_long(&em_cpu,sp+32)!=0xe270)return;
    EmWebActionContext current=em_web_action_context();unsigned tile;
    if(t->kind==EM_TYPED_SELECT){
        if(!t->target.kind){memset(t,0,sizeof *t);return;}
        if(!em_web_typed_tile(t->target,&tile)){memset(t,0,sizeof *t);return;}
        /* Only an intended repeated building tap may carry an actor into A. */
        if(current.kind&&!(current.kind==2&&current.pointer==t->target.pointer)){
            em_web_selection_request_clear();return;}
        em_web_typed_dispatch(tile,EM_TYPED_SELECTING);return;
    }
    if(current.pointer!=t->actor.pointer||current.kind!=t->actor.kind){
        if(current.kind||dune_word(&em_cpu,0xdc4c)){em_web_selection_request_clear();return;}
        if(!em_web_typed_tile(t->actor,&tile)){memset(t,0,sizeof *t);return;}
        em_web_typed_dispatch(tile,EM_TYPED_SELECTING);return;
    }
    if(t->armed){
        if(!em_web_palace_ready(current)){memset(t,0,sizeof *t);return;}
        if(!dune_word(&em_cpu,0xdc4c)){
            if(!em_web_typed_tile(t->actor,&tile)){memset(t,0,sizeof *t);return;}
            em_web_typed_dispatch(tile,EM_TYPED_ARMING);return;
        }
    }
    tile=(unsigned)t->wy/32*64+(unsigned)t->wx/32;
    if(current.kind==1&&t->target.pointer==current.pointer&&em_web_unit_self_available(current)){
        memset(t,0,sizeof *t);dune_web_action_self();return;
    }
    em_web_typed_dispatch(tile,EM_TYPED_EXECUTING);
}
static const char*em_web_target_report(int context,double wx,double wy){
    static char json[1000];
    EmWebActionContext t=context==1?em_web_target_world(wx,wy):(EmWebActionContext){0},c=em_web_action_context(),actor=em_web_input_actor();
    snprintf(json,sizeof json,"{\"context\":%d,\"worldX\":%.3f,\"worldY\":%.3f,\"tile\":%u,\"busy\":%s,\"target\":{\"kind\":\"%s\",\"pointer\":%u,\"id\":%u,\"type\":%u,\"owner\":%u,\"own\":%s},\"selected\":{\"kind\":\"%s\",\"pointer\":%u,\"id\":%u,\"type\":%u,\"owner\":%u,\"own\":%s},\"inputActor\":{\"kind\":\"%s\",\"pointer\":%u,\"id\":%u,\"type\":%u,\"own\":%s,\"powerArmed\":%s}}",context,wx,wy,context==1?(unsigned)wy/32*64+(unsigned)wx/32:0,
        em_web_typed.kind||em_web_selection.operation||em_web_selection.phase?"true":"false",
        t.kind==1?"unit":t.kind==2?"building":"none",t.pointer,t.id,t.type,t.owner,t.kind&&t.owner==dune_word(&em_cpu,0xc274)?"true":"false",
        c.kind==1?"unit":c.kind==2?"building":"none",c.pointer,c.id,c.type,c.owner,c.kind&&c.owner==dune_word(&em_cpu,0xc274)?"true":"false",
        actor.kind==1?"unit":actor.kind==2?"building":"none",actor.pointer,actor.id,actor.type,actor.kind&&actor.owner==dune_word(&em_cpu,0xc274)?"true":"false",em_web_input_actor_armed(actor,c)?"true":"false");return json;
}
#ifndef EM_WEB_SELECTION_NO_SCREEN
EMSCRIPTEN_KEEPALIVE int dune_web_select_screen(double x,double y){
    double wx,wy;int nx,ny;int context=em_web_camera_query(x,y,&wx,&wy,&nx,&ny);
    return context==1?em_web_select_world(wx,wy):context==2?dune_web_tap_screen(x,y):0;
}
EMSCRIPTEN_KEEPALIVE int dune_web_command_screen(double x,double y,unsigned token){
    double wx,wy;return em_web_camera_screen_world(x,y,&wx,&wy)?em_web_command_world(wx,wy,token):0;
}
EMSCRIPTEN_KEEPALIVE const char*dune_web_target_screen(double x,double y){
    double wx=0,wy=0;int nx,ny;int context=em_web_camera_query(x,y,&wx,&wy,&nx,&ny);
    return em_web_target_report(context,wx,wy);
}
#endif
#endif
