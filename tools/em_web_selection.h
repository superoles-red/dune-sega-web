/* Single-selection UI intent only. Include after em_cpu/em_host/em_window and
 * em_web_camera.h. Observe before original dune_mouse_observe per instruction.
 * Original A/B, placement validation, production and unit logic remain intact. */
#ifndef DUNE_EM_WEB_SELECTION_H
#define DUNE_EM_WEB_SELECTION_H
#include <math.h>
#include <stdint.h>
#include <stdio.h>

enum {EM_ACTION_IDLE,EM_ACTION_CLEAR,EM_ACTION_B,EM_ACTION_PLACE_SELECT,
      EM_ACTION_PLACE_DRAG,EM_ACTION_PLACE_COMMIT,EM_ACTION_SELF,EM_ACTION_RESELECT};
enum {EM_PHASE_IDLE,EM_PHASE_CLEAR,EM_PHASE_B,EM_PHASE_SELECT,EM_PHASE_PLACE,EM_PHASE_CANCEL_SPECIAL,EM_PHASE_SELF,EM_PHASE_RESELECT};
enum {EM_B_NONE,EM_B_REPEAT,EM_B_DEVASTATOR,EM_B_MCV,EM_B_TIMER};
enum {EM_PLACE_NONE,EM_PLACE_PLACED,EM_PLACE_REJECTED,EM_PLACE_CANCELLED};
typedef struct {
    unsigned operation,phase,b_kind;
    int clear_requested,finish_requested,pointer_valid,placement_result;
    uint32_t action_pointer,yard,deferred_yard_clear;
    unsigned yard_id,product,paid_index,house,campaign,target_tile,outcome;
    double world_x,world_y;
    uint64_t pointer_frame,clear_requests,native_clears,b_requests,native_bs;
    uint64_t placement_starts,placement_attempts,placement_successes,placement_rejections;
    /* Read-only observations at original contextual-A commit checkpoints. */
    uint64_t order_seq,special_cancels;
    unsigned order_kind,order_action,order_tile,order_source,order_actor,order_target,order_target_kind;
    int select_unit_after_clear;
    double select_unit_x,select_unit_y;
    uint32_t self_pointer;
    uint64_t self_requests,native_selfs,self_selections,self_clicks_before;
    unsigned self_followup,self_armed_before,self_result;
} EmWebSelection;
static EmWebSelection em_web_selection;

typedef struct {uint32_t pointer;unsigned kind,id,type,owner,hp,max_hp,product,b_kind,ready;} EmWebActionContext;
static int em_web_selection_pointer(uint32_t p){
    return p>=0xff1000 && p<0xff47c8 && (p-0xff1000)%140u==0;
}
static int em_web_selection_building_pointer(uint32_t p){
    return p>=0xff4eb8 && p<0xff6aaa && (p-0xff4eb8)%98u==0;
}
static int em_web_selection_map(void){
    unsigned mode=dune_word(&em_cpu,0xc264);
    return em_window && !em_cpu.fault && !em_host.paused && !em_host.stopped &&
           dune_mouse_context(&em_cpu)==1 && (mode==3 || mode==4);
}
static int em_web_action_live(uint32_t p,int building){
    if(building?!em_web_selection_building_pointer(p):!em_web_selection_pointer(p))return 0;
    unsigned a=p&65535,flags=dune_word(&em_cpu,a+4);
    return (flags&3)==3 && !(flags&4) && dune_word(&em_cpu,a+18)>0 &&
           dune_word(&em_cpu,a)==(building?(a-0x4eb8)/98u:(a-0x1000)/140u);
}
static EmWebActionContext em_web_action_context(void){
    EmWebActionContext c={0};c.product=65535;
    uint32_t u=dune_long(&em_cpu,0xc25c),b=dune_long(&em_cpu,0xc578);
    if(em_web_action_live(u,0)){c.kind=1;c.pointer=u;}
    else if(em_web_action_live(b,1) && (dune_word(&em_cpu,(b&65535)+6)&0x8000)){c.kind=2;c.pointer=b;}
    if(!c.kind)return c;
    unsigned a=c.pointer&65535,flags=dune_word(&em_cpu,a+6);
    c.id=dune_word(&em_cpu,a);c.type=em_cpu.ram[a+2];c.owner=em_cpu.ram[a+8];c.hp=dune_word(&em_cpu,a+18);
    unsigned info=read_mem(&em_cpu,(c.kind==1?0x6c5bc:0x6b954)+c.type*4,4);
    c.max_hp=read_mem(&em_cpu,info+16,2);
    if(c.kind==1){
        /* Original unit B$284F4 checks bit7 only, even for an inspected
         * enemy. Its zeroing of byte15 completes an existing native timer. */
        if(flags&0x80)c.b_kind=c.type==11?EM_B_DEVASTATOR:c.type==17?EM_B_MCV:EM_B_TIMER;
    }else{
        if(c.owner!=dune_word(&em_cpu,0xc274))return c;
        c.product=dune_word(&em_cpu,a+82);
        c.ready=c.type==8 && (flags&0x2000) && c.product<19 && em_cpu.ram[a+3]!=255;
        /* Exact preconditions of original B $283AA..$28490. FA88 still owns
         * allocation/prerequisites and may reject an otherwise available B. */
        if((read_mem(&em_cpu,info+12,2)&2) && !(flags&0x6000) &&
           !(dune_word(&em_cpu,a+4)&0x2000) && !(flags&2) &&
           ((c.type==8 && (c.product==1 || c.product==14)) || !dune_word(&em_cpu,0xc724)) &&
           c.product<(c.type==8?19u:27u) && em_cpu.ram[a+3]==255)c.b_kind=EM_B_REPEAT;
    }
    return c;
}
static unsigned em_web_palace_power(unsigned house){
    return house<3?read_mem(&em_cpu,0x6c76c+house*30,2):0;
}
static int em_web_palace_ready(EmWebActionContext c){
    if(c.kind!=2||c.type!=2||c.owner!=dune_word(&em_cpu,0xc274))return 0;
    unsigned a=c.pointer&65535,flags=dune_word(&em_cpu,a+6);
    /* Exact original self-A and target-A guards $27CFA..$27D28/$27E6A. */
    return (flags&0x80)&&!(flags&0x100)&&!dune_word(&em_cpu,a+86);
}
static void em_web_order_observe(void){
    EmWebSelection *s=&em_web_selection;
    if(em_cpu.pc==0x281bc){
        unsigned actor=em_cpu.a[2]&0xffffff,a=actor&65535;
        if(!em_web_action_live(actor,0)||em_cpu.ram[a+8]!=dune_word(&em_cpu,0xc274))return;
        unsigned action=em_cpu.d[4]&65535,target=em_cpu.a[4]&0xffffff,target_kind=2;
        if(!em_web_action_live(target,1)){target=em_cpu.a[3]&0xffffff;target_kind=1;if(!em_web_action_live(target,0)){target=0;target_kind=0;}}
        s->order_kind=action==0?2:1;s->order_action=action;s->order_tile=em_cpu.d[3]&4095;
        s->order_actor=actor;s->order_target=target;s->order_target_kind=target_kind;s->order_source=em_cpu.pc;++s->order_seq;
    }else if(em_cpu.pc==0x27ea6&&(em_cpu.d[0]&65535)==1){
        /* Original Palace activation returned success; no invented power or
         * timing. C1A8 is also used by Fremen/Saboteur's native target orders. */
        s->order_kind=3;s->order_action=em_web_palace_power(em_cpu.ram[(em_cpu.a[3]&65535)+8]);
        s->order_tile=dune_word(&em_cpu,0xc1a8)&4095;s->order_actor=em_cpu.a[3]&0xffffff;
        s->order_target=s->order_target_kind=0;s->order_source=em_cpu.pc;++s->order_seq;
    }
}
static void em_web_selection_drop_mouse_queue(void){
#ifdef DUNE_EM_WEB_WORLD_INTENT_H
    em_web_world_intent_cancel();
#endif
    DuneMouse *m=&em_host.dune_mouse;m->head=m->count=m->stage=m->dirty=m->tile_valid=0;
}
static unsigned em_web_selection_building_at(double x,double y){
    if(!isfinite(x)||!isfinite(y)||x<0||y<0||x>=2048||y>=2048)return 0;
    unsigned tile=(unsigned)y/32*64+(unsigned)x/32,a=0x7d9c+tile*4;
    if(!(em_cpu.ram[a+2]&32) || !em_cpu.ram[a+3])return 0;
    unsigned index=em_cpu.ram[a+3]-1u;
    if(index>=73)return 0;
    return 0xff4eb8u+index*98u;
}
static int em_web_placement_identity(void){
    EmWebSelection *s=&em_web_selection;unsigned a=s->yard&65535;
    return em_web_action_live(s->yard,1) && em_cpu.ram[a+2]==8 && dune_word(&em_cpu,a)==s->yard_id &&
           em_cpu.ram[a+8]==s->house && s->house==dune_word(&em_cpu,0xc274) &&
           s->campaign==dune_word(&em_cpu,0xc050) && (dune_word(&em_cpu,a+6)&0x2000) &&
           dune_word(&em_cpu,a+82)==s->product && em_cpu.ram[a+3]==s->paid_index;
}
static void em_web_selection_request_clear(void){
    EmWebSelection *s=&em_web_selection;s->clear_requested=1;s->operation=EM_ACTION_CLEAR;
    s->finish_requested=s->pointer_valid=s->select_unit_after_clear=s->self_followup=0;em_web_selection_drop_mouse_queue();
}
static void em_web_placement_abort(unsigned outcome){
    EmWebSelection *s=&em_web_selection;s->outcome=outcome;
    /* Never clear a new unit or a different building selected by native UI. */
    if(s->phase==EM_PHASE_SELECT || (!dune_long(&em_cpu,0xc25c) && dune_long(&em_cpu,0xc578)==s->yard))em_web_selection_request_clear();
    else{s->operation=EM_ACTION_IDLE;s->finish_requested=s->pointer_valid=0;}
}
static void em_web_selection_reenter(void){
    if(em_web_selection_map() && !em_cpu.pad_buttons[0])em_cpu.pc=0xe26a;
}
static int em_web_unit_self_available(EmWebActionContext c){
    return c.kind==1&&c.owner==dune_word(&em_cpu,0xc274)&&(c.type==11||c.type==17);
}
/* Pick the real map entry for the original actor, including its moving-tile
 * transition. An A intent must never become a move to its old coordinates. */
static int em_web_self_tile(uint32_t pointer,unsigned*out){
    if(!em_web_action_live(pointer,0))return 0;
    unsigned a=pointer&65535,id=dune_word(&em_cpu,a)+1,tile=dune_word(&em_cpu,a+10)/256*64+dune_word(&em_cpu,a+12)/256;
    if(tile<4096){unsigned at=0x7d9c+tile*4;if((em_cpu.ram[at+2]&16)&&em_cpu.ram[at+3]==id){*out=tile;return 1;}}
    for(tile=0;tile<4096;tile++){unsigned at=0x7d9c+tile*4;if((em_cpu.ram[at+2]&16)&&em_cpu.ram[at+3]==id){*out=tile;return 1;}}return 0;
}
static int em_web_queue_self_pointer(void){
    EmWebSelection*s=&em_web_selection;unsigned tile;if(!em_web_self_tile(s->self_pointer,&tile))return 0;
    em_web_selection_drop_mouse_queue();DuneMouse*m=&em_host.dune_mouse;s->self_clicks_before=m->clicks;
    dune_mouse_world_click(m,&em_cpu,(tile&63)*32+16,(tile/64)*32+16,DUNE_CLICK_SELECT);return m->count!=0;
}
static void em_web_typed_observe(void);
static void em_web_typed_reset(void);
static int em_web_typed_busy(void);
static void em_web_selection_observe(void){
    EmWebSelection *s=&em_web_selection;
    if(!em_window || em_cpu.fault)return;
#ifdef DUNE_EM_WEB_WORLD_INTENT_H
    em_web_world_intent_observe(&em_host.dune_mouse,&em_cpu);
#endif
    em_web_order_observe();
    em_web_typed_observe();
    if((s->operation || s->phase || s->clear_requested) && dune_mouse_context(&em_cpu)!=1){
        if((s->operation>=EM_ACTION_PLACE_SELECT&&s->operation<=EM_ACTION_PLACE_COMMIT) || s->phase==EM_PHASE_SELECT || s->phase==EM_PHASE_PLACE){
            s->deferred_yard_clear=s->yard;s->outcome=EM_PLACE_CANCELLED;
        }
        s->operation=s->phase=0;s->clear_requested=s->finish_requested=s->pointer_valid=s->select_unit_after_clear=s->self_followup=0;
        return; /* Native menus own their live stack; clear only after return. */
    }
    if(s->deferred_yard_clear && em_web_selection_map()){
        uint32_t yard=s->deferred_yard_clear;s->deferred_yard_clear=0;
        if(!dune_long(&em_cpu,0xc25c) && dune_long(&em_cpu,0xc578)==yard && em_web_placement_identity())em_web_selection_request_clear();
    }
    if(!s->phase&&(s->operation==EM_ACTION_SELF||s->operation==EM_ACTION_RESELECT)){
        unsigned tile;uint32_t selected=dune_long(&em_cpu,0xc25c);DuneMouse*m=&em_host.dune_mouse;
        if(!em_web_self_tile(s->self_pointer,&tile)||em_cpu.pad_buttons[0]||
           (s->operation==EM_ACTION_SELF?selected!=s->self_pointer:selected!=0)){
            em_web_selection_drop_mouse_queue();s->operation=EM_ACTION_IDLE;s->self_followup=0;return;
        }
        /* A rendered pointer hover can arrive after the queued edge was
         * popped but before the original map dispatcher consumes it. Keep
         * this explicit self intent authoritative through that interval;
         * ordinary hover must not turn ARM into a move to the old pointer. */
        int wx=(tile&63)*32+16,wy=(tile/64)*32+16;
        m->point_world=1;m->wx=wx;m->wy=wy;m->dirty=1;
        if(m->tile_valid){m->tile_wx=wx;m->tile_wy=wy;}
        if(m->count){DuneClick*q=&m->queue[m->head];q->world=1;q->wx=wx;q->wy=wy;}
        else if(m->clicks==s->self_clicks_before){s->operation=EM_ACTION_IDLE;s->self_followup=0;return;}
        if(em_cpu.pc==0x27b80&&m->clicks>s->self_clicks_before)s->phase=s->operation==EM_ACTION_SELF?EM_PHASE_SELF:EM_PHASE_RESELECT;
    }
    if(s->phase){
        if(s->phase==EM_PHASE_CLEAR && em_cpu.pc==0x28530 && em_web_selection_building_pointer(em_cpu.a[3]))em_cpu.pc=0x2840e;
        if(s->phase==EM_PHASE_PLACE && em_cpu.pc==0xe41e)s->placement_result=(em_cpu.d[0]&65535)!=0;
        if(em_cpu.pc!=0xe57a)return;
        unsigned phase=s->phase;s->phase=0;
        if(phase==EM_PHASE_CLEAR){++s->native_clears;s->operation=EM_ACTION_IDLE;
            if(s->select_unit_after_clear){s->select_unit_after_clear=0;
                if(s->self_followup){if(em_web_queue_self_pointer())s->operation=EM_ACTION_RESELECT;else s->self_followup=0;}
                else dune_mouse_world_click(&em_host.dune_mouse,&em_cpu,(int)s->select_unit_x,(int)s->select_unit_y,DUNE_CLICK_SELECT);}}
        else if(phase==EM_PHASE_CANCEL_SPECIAL){++s->special_cancels;s->clear_requested=1;s->operation=EM_ACTION_CLEAR;}
        else if(phase==EM_PHASE_B){++s->native_bs;if(s->operation==EM_ACTION_B)s->operation=EM_ACTION_IDLE;}
        else if(phase==EM_PHASE_SELF){
            ++s->native_selfs;s->operation=EM_ACTION_IDLE;int live=em_web_action_live(s->self_pointer,0),armed=live&&(dune_word(&em_cpu,(s->self_pointer&65535)+6)&0x80);
            s->self_result=armed&&!s->self_armed_before?1:!armed&&s->self_armed_before?2:3;
            /* The original command deselects. A real additional A selects
             * the same stopped unit, keeping its contextual B reachable.
             * Never set C25C or ability/timer/HP bytes from the adapter. */
            if(!s->clear_requested&&live&&!dune_long(&em_cpu,0xc25c)){
                if(em_web_selection_building_pointer(dune_long(&em_cpu,0xc578))){em_web_selection_request_clear();s->select_unit_after_clear=1;s->self_followup=1;}
                else if(em_web_queue_self_pointer()){s->operation=EM_ACTION_RESELECT;s->self_followup=1;}
            }
        }else if(phase==EM_PHASE_RESELECT){if(dune_long(&em_cpu,0xc25c)==s->self_pointer)++s->self_selections;s->self_followup=0;s->operation=EM_ACTION_IDLE;}
        else if(phase==EM_PHASE_SELECT && !s->clear_requested){
            EmWebActionContext c=em_web_action_context();
            if(c.kind==2 && c.pointer==s->yard && c.ready && em_web_placement_identity())s->operation=EM_ACTION_PLACE_DRAG;
            else em_web_placement_abort(EM_PLACE_CANCELLED);
        }else if(phase==EM_PHASE_PLACE){
            if(s->placement_result){s->outcome=EM_PLACE_PLACED;++s->placement_successes;}
            else{s->outcome=EM_PLACE_REJECTED;++s->placement_rejections;}
            em_web_selection_request_clear();
        }
        if(s->clear_requested || s->operation==EM_ACTION_PLACE_DRAG)em_web_selection_reenter();
        return;
    }
    if(s->operation==EM_ACTION_PLACE_DRAG){
        EmWebActionContext c=em_web_action_context();
        if(!em_web_placement_identity() || c.kind!=2 || c.pointer!=s->yard){em_web_placement_abort(EM_PLACE_CANCELLED);}
        else if(s->finish_requested)s->operation=EM_ACTION_PLACE_COMMIT;
        else if(s->pointer_valid){
            if(s->pointer_frame!=em_cpu.vdp.frames){
                s->pointer_frame=em_cpu.vdp.frames;
                dune_mouse_world_point(&em_host.dune_mouse,&em_cpu,(int)s->world_x,(int)s->world_y);
            }
            /* Same cursor/tile safepoint as upstream intent. A large browser
             * viewport may show a cell outside the native 320x224 cursor box. */
            if(em_cpu.pc==0x6486 || em_cpu.pc==0x701c){
                em_host.dune_mouse.tile_valid=1;em_host.dune_mouse.tile_wx=(int)s->world_x;em_host.dune_mouse.tile_wy=(int)s->world_y;
            }
        }
    }
    if(em_cpu.pc!=0x27b5e || !em_web_selection_map() || em_cpu.pad_buttons[0])return;
    unsigned sp=em_cpu.a[7]&65535;
    if(sp>65500 || dune_long(&em_cpu,sp+32)!=0xe270)return;
    if(s->clear_requested){
        s->clear_requested=0;
        uint32_t unit=dune_long(&em_cpu,0xc25c),building=dune_long(&em_cpu,0xc578);
        if(em_web_selection_pointer(unit)){
            em_cpu.a[2]=unit;em_cpu.a[3]=em_web_selection_building_pointer(building)?building:0;
            em_cpu.pc=0x2851c;s->phase=EM_PHASE_CLEAR;return;
        }
        if(em_web_selection_building_pointer(building)){
            EmWebActionContext context=em_web_action_context();
            if(em_web_palace_ready(context)&&dune_word(&em_cpu,0xdc4c)){
                /* Native B disarms DC4C first; then the ordinary pure-clear
                 * continuation removes only the building selection. */
                em_cpu.pc=0x28392;s->phase=EM_PHASE_CANCEL_SPECIAL;return;
            }
            em_cpu.a[3]=building;em_cpu.pc=0x2840e;s->phase=EM_PHASE_CLEAR;return;
        }
        s->operation=EM_ACTION_IDLE;return;
    }
    if(s->operation==EM_ACTION_B){
        EmWebActionContext c=em_web_action_context();
        if(c.pointer!=s->action_pointer || c.b_kind!=s->b_kind || !c.b_kind){s->operation=EM_ACTION_IDLE;return;}
        em_cpu.pc=0x28392;s->phase=EM_PHASE_B;return; /* full original B; no cursor warp */
    }
    if(s->operation==EM_ACTION_PLACE_SELECT || s->operation==EM_ACTION_PLACE_COMMIT){
        if(!em_web_placement_identity() || dune_long(&em_cpu,0xc25c)){em_web_placement_abort(EM_PLACE_CANCELLED);return;}
        unsigned tile=s->target_tile;
        if(s->operation==EM_ACTION_PLACE_SELECT){
            unsigned a=s->yard&65535;tile=(dune_word(&em_cpu,a+10)/256)*64+dune_word(&em_cpu,a+12)/256;
            s->phase=EM_PHASE_SELECT;
        }else{
            EmWebActionContext c=em_web_action_context();
            if(c.kind!=2 || c.pointer!=s->yard || !c.ready){em_web_placement_abort(EM_PLACE_CANCELLED);return;}
            s->phase=EM_PHASE_PLACE;s->placement_result=0;++s->placement_attempts;
        }
        write_mem(&em_cpu,0xffc240,2,tile);em_cpu.d[3]=(em_cpu.d[3]&0xffff0000u)|tile;
        em_cpu.pc=0x27b80; /* complete original contextual A */
    }
}
EMSCRIPTEN_KEEPALIVE int dune_web_clear_selection(void){
    EmWebSelection *s=&em_web_selection;
    if(!em_web_selection_map())return 0;
    em_web_typed_reset();++s->clear_requests;em_web_selection_request_clear();return 1;
}
EMSCRIPTEN_KEEPALIVE int dune_web_action_b(void){
    EmWebSelection *s=&em_web_selection;if(!em_web_selection_map() || s->operation || s->phase || em_web_typed_busy())return 0;
    EmWebActionContext c=em_web_action_context();if(!c.b_kind)return 0;
    em_web_selection_drop_mouse_queue();s->action_pointer=c.pointer;s->b_kind=c.b_kind;
    s->operation=EM_ACTION_B;++s->b_requests;return 1;
}
EMSCRIPTEN_KEEPALIVE int dune_web_action_self(void){
    EmWebSelection*s=&em_web_selection;if(!em_web_selection_map()||s->operation||s->phase||!em_host.dune_mouse.enabled)return 0;
    EmWebActionContext c=em_web_action_context();if(!em_web_unit_self_available(c))return 0;
    s->self_pointer=c.pointer;s->self_armed_before=!!(dune_word(&em_cpu,(c.pointer&65535)+6)&0x80);s->self_result=0;
    if(!em_web_queue_self_pointer())return 0;s->operation=EM_ACTION_SELF;++s->self_requests;return 1;
}
EMSCRIPTEN_KEEPALIVE void dune_web_selection_reset(void){
#ifdef DUNE_EM_WEB_WORLD_INTENT_H
    em_web_world_intent_cancel();
#endif
    memset(&em_web_selection,0,sizeof em_web_selection);
    em_web_typed_reset();
}
static int em_web_placement_begin_world(double wx,double wy){
    EmWebSelection *s=&em_web_selection;
    if(!em_web_selection_map() || s->phase || s->operation || em_web_typed_busy() || dune_long(&em_cpu,0xc25c))return 0;
    uint32_t b=em_web_selection_building_at(wx,wy);if(!em_web_action_live(b,1))return 0;
    unsigned a=b&65535,product=dune_word(&em_cpu,a+82);
    if(em_cpu.ram[a+2]!=8 || em_cpu.ram[a+8]!=dune_word(&em_cpu,0xc274) ||
       !(dune_word(&em_cpu,a+6)&0x2000) || product>=19 || em_cpu.ram[a+3]==255)return 0;
    em_web_selection_drop_mouse_queue();
    s->yard=b;s->yard_id=dune_word(&em_cpu,a);s->product=product;s->paid_index=em_cpu.ram[a+3];
    s->house=dune_word(&em_cpu,0xc274);s->campaign=dune_word(&em_cpu,0xc050);
    s->world_x=wx;s->world_y=wy;s->pointer_valid=1;s->pointer_frame=UINT64_MAX;
    s->finish_requested=0;s->outcome=EM_PLACE_NONE;++s->placement_starts;
    s->operation=dune_long(&em_cpu,0xc578)==b && (dune_word(&em_cpu,a+6)&0x8000)?EM_ACTION_PLACE_DRAG:EM_ACTION_PLACE_SELECT;
    return 1;
}
static int em_web_placement_move_world(double wx,double wy){
    EmWebSelection *s=&em_web_selection;
    if((s->operation!=EM_ACTION_PLACE_DRAG && s->operation!=EM_ACTION_PLACE_SELECT) || !isfinite(wx)||!isfinite(wy)||wx<0||wy<0||wx>=2048||wy>=2048)return 0;
    s->world_x=wx;s->world_y=wy;s->pointer_valid=1;s->pointer_frame=UINT64_MAX;return 1;
}
EMSCRIPTEN_KEEPALIVE int dune_web_placement_cancel(void){
    EmWebSelection *s=&em_web_selection;
    if(s->operation!=EM_ACTION_PLACE_DRAG && s->operation!=EM_ACTION_PLACE_SELECT && s->operation!=EM_ACTION_PLACE_COMMIT)return 0;
    em_web_placement_abort(EM_PLACE_CANCELLED);return 1;
}
static int em_web_placement_end_world(double wx,double wy){
    EmWebSelection *s=&em_web_selection;
    if((s->operation!=EM_ACTION_PLACE_DRAG && s->operation!=EM_ACTION_PLACE_SELECT) || s->finish_requested)return 0;
    if(!em_web_placement_move_world(wx,wy))return dune_web_placement_cancel();
    if(em_web_selection_building_at(wx,wy)==s->yard)return dune_web_placement_cancel();
    s->target_tile=(unsigned)wy/32*64+(unsigned)wx/32;s->finish_requested=1;
    if(s->operation==EM_ACTION_PLACE_DRAG)s->operation=EM_ACTION_PLACE_COMMIT;
    em_web_selection_drop_mouse_queue();return 1;
}
EMSCRIPTEN_KEEPALIVE int dune_web_placement_active(void){
    unsigned op=em_web_selection.operation;return op==EM_ACTION_PLACE_SELECT || op==EM_ACTION_PLACE_DRAG || op==EM_ACTION_PLACE_COMMIT || em_web_selection.phase==EM_PHASE_PLACE;
}
/* Presentation bridge: the gesture has crossed its drag threshold and the
 * pointer is still held. Waiting ready state and released/pending native A are
 * deliberately excluded. This predicate never changes native ready/selection. */
EMSCRIPTEN_KEEPALIVE int dune_web_placement_preview_active(void){
    EmWebSelection *s=&em_web_selection;
    if(!em_web_selection_map() || !s->pointer_valid || s->finish_requested ||
       s->clear_requested || s->operation!=EM_ACTION_PLACE_DRAG ||
       !em_web_placement_identity() || dune_long(&em_cpu,0xc25c) ||
       dune_long(&em_cpu,0xc578)!=s->yard || !(dune_word(&em_cpu,(s->yard&65535)+6)&0x8000))return 0;
    /* Native selection returns before its next idle callback builds a footprint.
     * Gate both the cursor ID and committed mapping so a paused instruction
     * boundary inside $4B38 cannot expose the old ordinary cursor for one frame. */
    unsigned info=read_mem(&em_cpu,0x6b954+s->product*4,4),layout=read_mem(&em_cpu,info+60,2);
    if(layout>=7)return 0;
    unsigned cursor=dune_word(&em_cpu,0xbf62);
    int penalty=(int16_t)dune_word(&em_cpu,0xc258);
    if(cursor!=read_mem(&em_cpu,0xc7f3e + layout*2,2) &&
       cursor!=read_mem(&em_cpu,0xc7f3e + (layout+7)*2,2) &&
       !(penalty>=0 && cursor==(uint16_t)-(penalty+1)))return 0;
    unsigned node=dune_word(&em_cpu,0xbf18);if(!node || node>65520)return 0;
    int id=(int16_t)cursor;
    unsigned mapping=read_mem(&em_cpu,id<0?0x64fea+((unsigned)-id-1)*4:0x60e8c+(unsigned)id*8+4,4);
    return dune_long(&em_cpu,node+8)==mapping && !dune_long(&em_cpu,0xbf04);
}
/* A paid ready product belongs to drag placement. A repeated short tap on
 * its already selected source Yard must not reopen the production menu. The
 * first selecting tap and every active-unit target retain native A priority. */
static int em_web_ready_yard_self_tap(double wx,double wy){
    if(!em_web_selection_map() || dune_long(&em_cpu,0xc25c))return 0;
    EmWebActionContext c=em_web_action_context();
    return c.kind==2 && c.ready && em_web_selection_building_at(wx,wy)==c.pointer;
}
/* A modern short tap on a visible own unit means select, while the paid ready
 * Yard's actual placement remains a drag from its OK source. Execute the same
 * native clear then original A a user could issue manually, without an order,
 * construction attempt, paid-product mutation or fabricated unit selection. */
static int em_web_ready_yard_unit_tap(double wx,double wy){
    EmWebSelection *s=&em_web_selection;
    if(!em_web_selection_map()||s->operation||s->phase||dune_long(&em_cpu,0xc25c)||!isfinite(wx)||!isfinite(wy)||wx<0||wy<0||wx>=2048||wy>=2048)return 0;
    EmWebActionContext c=em_web_action_context();if(c.kind!=2||!c.ready)return 0;
    unsigned tile=(unsigned)wy/32*64+(unsigned)wx/32,at=0x7d9c+tile*4;
    if(!(em_cpu.ram[at+2]&16)||!em_cpu.ram[at+3])return 0;
    unsigned unit=0xff1000+(em_cpu.ram[at+3]-1u)*140,a=unit&65535;
    if(!em_web_action_live(unit,0)||em_cpu.ram[a+8]!=dune_word(&em_cpu,0xc274))return 0;
    em_web_selection_request_clear();s->select_unit_after_clear=1;s->select_unit_x=wx;s->select_unit_y=wy;return 1;
}
#include "em_web_typed_input.h"
#ifndef EM_WEB_SELECTION_NO_SCREEN
EMSCRIPTEN_KEEPALIVE int dune_web_placement_begin(double x,double y){
    double wx,wy;return em_web_camera_screen_world(x,y,&wx,&wy)?em_web_placement_begin_world(wx,wy):0;
}
EMSCRIPTEN_KEEPALIVE int dune_web_placement_move(double x,double y){
    EmWebCameraProjection p;DuneLayout l;int w,h;double wx,wy;
    if(!em_web_camera_geometry(&p,&l,&w,&h) || !em_camera_project(&p,x,y,&wx,&wy))return 0;
    return em_web_placement_move_world(wx,wy);
}
EMSCRIPTEN_KEEPALIVE int dune_web_placement_end(double x,double y){
    double wx,wy;if(!em_web_camera_screen_world(x,y,&wx,&wy))return dune_web_placement_cancel();
    return em_web_placement_end_world(wx,wy);
}
EMSCRIPTEN_KEEPALIVE int dune_web_selection_tap_screen(double x,double y){
    if(em_web_selection.operation || em_web_selection.phase)return 0;
    double wx,wy;
    if(em_web_camera_screen_world(x,y,&wx,&wy) && (em_web_ready_yard_unit_tap(wx,wy)||em_web_ready_yard_self_tap(wx,wy)))return 1;
    return dune_web_tap_screen(x,y);
}
#endif
EMSCRIPTEN_KEEPALIVE const char *dune_web_actions_debug(void){
    static char report[3000];EmWebSelection *s=&em_web_selection;EmWebActionContext c=em_web_action_context();
    const char *kind=c.kind==1?"unit":c.kind==2?"building":"none";
    const char *b=c.b_kind==EM_B_REPEAT?"repeat":c.b_kind==EM_B_DEVASTATOR?"confirm-devastator":c.b_kind==EM_B_MCV?"confirm-mcv":c.b_kind==EM_B_TIMER?"confirm-native":"none";
    const char *outcome=s->outcome==EM_PLACE_PLACED?"placed":s->outcome==EM_PLACE_REJECTED?"rejected":s->outcome==EM_PLACE_CANCELLED?"cancelled":"none";
    int available=em_web_selection_map() && !s->operation && !s->phase && !em_web_typed_busy() && c.b_kind;
    snprintf(report,sizeof report,"{\"selected\":{\"kind\":\"%s\",\"pointer\":%u,\"id\":%u,\"type\":%u,\"owner\":%u,\"own\":%d,\"hp\":%u,\"maxHp\":%u,\"product\":%u},\"bAvailable\":%d,\"bKind\":\"%s\",\"readyYard\":%d,\"placementActive\":%d,\"placementPhase\":%u,\"lastPlacementOutcome\":\"%s\",\"operation\":%u,\"phase\":%u,\"selectedNative\":%u,\"producerNative\":%u,\"clearRequests\":%llu,\"nativeClears\":%llu,\"nativeBCount\":%llu,\"placementStarts\":%llu,\"placementAttempts\":%llu,\"placementSuccesses\":%llu,\"placementRejections\":%llu}",
        kind,c.pointer,c.id,c.type,c.owner,c.kind && c.owner==dune_word(&em_cpu,0xc274),c.hp,c.max_hp,c.product,available,b,c.ready,!!dune_web_placement_active(),s->operation,outcome,s->operation,s->phase,dune_long(&em_cpu,0xc25c),dune_long(&em_cpu,0xc578),(unsigned long long)s->clear_requests,(unsigned long long)s->native_clears,(unsigned long long)s->native_bs,(unsigned long long)s->placement_starts,(unsigned long long)s->placement_attempts,(unsigned long long)s->placement_successes,(unsigned long long)s->placement_rejections);
    size_t n=strlen(report);if(n&&report[n-1]=='}')report[--n]=0;
    unsigned power=em_web_palace_power(c.owner),special_ready=em_web_palace_ready(c);
    snprintf(report+n,sizeof report-n,",\"special\":{\"ready\":%s,\"armed\":%s,\"house\":%u,\"power\":%u,\"key\":\"%s\",\"targetsCell\":true,\"cursorId\":5,\"cooldown\":%u,\"nativeArmed\":%u,\"cancels\":%llu},\"lastOrder\":{\"seq\":%llu,\"kind\":\"%s\",\"action\":%u,\"tile\":%u,\"worldX\":%u,\"worldY\":%u,\"actor\":%u,\"target\":%u,\"targetKind\":\"%s\",\"sourcePc\":%u}}",special_ready?"true":"false",special_ready&&dune_word(&em_cpu,0xdc4c)?"true":"false",c.owner,power,power==1?"death-hand":power==2?"fremen":power==3?"saboteur":"none",c.kind==2&&c.type==2?dune_word(&em_cpu,(c.pointer&65535)+86):0,dune_word(&em_cpu,0xdc4c),(unsigned long long)s->special_cancels,(unsigned long long)s->order_seq,s->order_kind==2?"attack":s->order_kind==3?"special":s->order_kind==1?"move":"none",s->order_action,s->order_tile,(s->order_tile%64)*32+16,(s->order_tile/64)*32+16,s->order_actor,s->order_target,s->order_target_kind==1?"unit":s->order_target_kind==2?"building":"none",s->order_source);
    n=strlen(report);if(n&&report[n-1]=='}')report[--n]=0;
    int self_available=em_web_selection_map()&&!s->operation&&!s->phase&&!em_web_typed_busy()&&em_host.dune_mouse.enabled&&em_web_unit_self_available(c);
    int unit_special=c.kind==1&&(c.type==11||c.type==17),armed=c.kind==1&&(dune_word(&em_cpu,(c.pointer&65535)+6)&0x80);
    const char*self_kind=em_web_unit_self_available(c)?c.type==11?"devastator":"mcv":"none";
    snprintf(report+n,sizeof report-n,",\"selfAvailable\":%s,\"selfKind\":\"%s\",\"selfPending\":%s,\"selfPointer\":%u,\"selfRequests\":%llu,\"nativeSelfCount\":%llu,\"nativeSelfSelections\":%llu,\"selfResult\":\"%s\",\"unitSpecial\":{\"kind\":\"%s\",\"armed\":%s,\"countdownRaw\":%u,\"selfAction\":\"%s\",\"bAction\":\"%s\"}}",self_available?"true":"false",self_kind,(s->operation==EM_ACTION_SELF||s->operation==EM_ACTION_RESELECT||s->self_followup||s->phase==EM_PHASE_SELF||s->phase==EM_PHASE_RESELECT)?"true":"false",s->self_pointer,(unsigned long long)s->self_requests,(unsigned long long)s->native_selfs,(unsigned long long)s->self_selections,s->self_result==1?"armed":s->self_result==2?"cancelled":s->self_result==3?"native-rejected":"none",unit_special?c.type==11?"devastator":"mcv":"none",armed?"true":"false",c.kind==1?em_cpu.ram[(c.pointer&65535)+15]:0,unit_special?(armed?"cancel-countdown":"arm-countdown"):"none",armed?"complete-countdown":"deselect");
    return report;
}
/* Read-only compatibility for save/debug tooling; no group API remains. */
EMSCRIPTEN_KEEPALIVE const char *dune_web_selection_debug(void){return dune_web_actions_debug();}
#endif
