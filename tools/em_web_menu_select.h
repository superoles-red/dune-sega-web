/* Direct pointer intent for original production/Starport menus. A purchase or
 * paid Upgrade requires two distinct queued taps: preview, then native A.
 * Commands still execute native A immediately. Native item validation, details,
 * production, prices, stock and action guards remain original game code. */
#ifndef DUNE_EM_WEB_MENU_SELECT_H
#define DUNE_EM_WEB_MENU_SELECT_H
#include <stdint.h>
#include <stdio.h>
#include <string.h>

typedef struct {
    CPU *cpu;
    DuneMouse *mouse;
    int context,interpolation_pending,armed,armed_cell,armed_item,command_feedback_pending;
    uint32_t producer;
    uint64_t picks,first_selections,confirmations,last_steps,last_cycles,last_frames,sound_requests;
} EmWebMenuSelect;
static EmWebMenuSelect em_web_menu_select;
enum { EM_WEB_MENU_SELECT_STAGE=3,EM_WEB_MENU_COMMAND_FEEDBACK_STAGE=4 };

static void em_web_menu_select_disarm(EmWebMenuSelect *s,DuneMouse *m){
    s->armed=0;s->armed_cell=s->armed_item=-1;
    (void)m; /* Hover/SDL LEAVE may reset mouse intent, not a purchase preview. */
}
static int em_web_menu_select_item(const CPU *c,int context,int col,int row){
    if(col<0 || col>=3 || row<0 || row>=(context==3?4:6))return -999;
    unsigned raw=c->ram[(context==3?0xbfcc:0xbf8e)+row*3+col];
    return context==3?(int)raw:(int)(int8_t)raw;
}
static int em_web_menu_select_purchase(const CPU *c,int context,int item){
    if(context==2){
        /* C618 is19 for Yard and27 for unit factories; the boundary cell is
         * paid Upgrade. A zero C61C identifies menus without a product table. */
        return dune_long(c,0xc61c)!=0 && item>=0 && item<=(int)c->ram[0xc618];
    }
    if(context!=3 || item<0 || item>=27)return 0;
    for(unsigned i=0;i<9;++i)if(dune_word(c,0xc2d8+i*12)==(unsigned)item)return 1;
    return 0; /* Starport28..32 are commands;255 is the native empty sentinel. */
}
static void em_web_menu_select_reset_state(void){
    EmWebMenuSelect *s=&em_web_menu_select;
    if(s->mouse && (s->mouse->stage==EM_WEB_MENU_SELECT_STAGE || s->mouse->stage==EM_WEB_MENU_COMMAND_FEEDBACK_STAGE))s->mouse->stage=0;
    memset(s,0,sizeof *s);s->armed_cell=s->armed_item=-1;
}
#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE void dune_web_menu_select_reset(void){em_web_menu_select_reset_state();}
#endif

static int em_web_menu_select_observe(DuneMouse *m,CPU *c){
    EmWebMenuSelect *s=&em_web_menu_select;
    int context=dune_mouse_context(c);
    uint32_t producer=(context==2 || context==3)?dune_long(c,0xc578):0;
    int changed=s->cpu!=c || s->mouse!=m || context!=s->context || producer!=s->producer ||
        c->fault || c->steps<s->last_steps || c->master_cycles<s->last_cycles || c->vdp.frames<s->last_frames;
    if(changed){
        em_web_menu_select_disarm(s,m);s->interpolation_pending=0;
        s->command_feedback_pending=0;
        if(m->stage==EM_WEB_MENU_COMMAND_FEEDBACK_STAGE)m->stage=0;
        s->cpu=c;s->mouse=m;s->context=context;s->producer=producer;
    }
    s->last_steps=c->steps;s->last_cycles=c->master_cycles;s->last_frames=c->vdp.frames;
    if(!m->enabled || (context!=2 && context!=3)){
        em_web_menu_select_disarm(s,m);s->interpolation_pending=0;s->command_feedback_pending=0;return 0;
    }
    int starport=context==3;
    unsigned current_col=dune_word(c,starport?0xbfc8:0xbf8a);
    unsigned current_row=dune_word(c,starport?0xbfca:0xbf8c);
    int current_item=em_web_menu_select_item(c,context,(int)current_col,(int)current_row);
    /* Preview belongs to the menu/item, not mouse focus. Load/reset explicitly
     * calls em_web_menu_select_reset_state(); benign LEAVE/blur may reset mouse
     * intent while the same selected purchase must remain confirmable. */
    if(s->armed && ((int)(current_row*3+current_col)!=s->armed_cell ||
       current_item!=s->armed_item || c->pad_buttons[0]))
        em_web_menu_select_disarm(s,m);
    if(s->command_feedback_pending && (m->stage!=EM_WEB_MENU_COMMAND_FEEDBACK_STAGE || !m->count))s->command_feedback_pending=0;
    if(s->interpolation_pending && m->stage!=EM_WEB_MENU_SELECT_STAGE)s->interpolation_pending=0;
    if(s->interpolation_pending && c->pc==(starport?0x921e:0x852a)){
        /* Native validation and item details are committed already. Finish its
         * original coordinate stores without controller-walk interpolation. */
        c->pc=starport?0x9260:0x856c;s->interpolation_pending=0;m->stage=0;return 1;
    }
    if(c->pc!=(starport?0x9188:0x847e) && c->pc!=(starport?0x28ac0:0x28884))return 0;
    if(c->pad_buttons[0]){s->interpolation_pending=0;s->command_feedback_pending=0;em_web_menu_select_disarm(s,m);dune_mouse_reset(m);return 1;}
    if(!m->dirty && !m->count)return 1;
    if(m->context!=context){em_web_menu_select_disarm(s,m);dune_mouse_reset(m);m->context=context;return 1;}
    int x=m->count?m->queue[m->head].x:m->x;
    int y=m->count?m->queue[m->head].y:m->y;
    if(m->count && m->queue[m->head].action!=DUNE_CLICK_SELECT){x=48;y=60;}
    int col,row;
    if(!dune_mouse_cell(c,x,y,&col,&row)){
        /* Dirty alone can be hover over the info panel. Only a real queued
         * invalid event cancels preview; upstream-dropped clicks are no event. */
        if(m->count){em_web_menu_select_disarm(s,m);dune_mouse_pop(m);}
        m->dirty=0;return 1;
    }
    if(c->pc==(starport?0x9188:0x847e)){
        m->dirty=0;
        if(current_col!=(unsigned)col || current_row!=(unsigned)row){
            em_web_menu_select_disarm(s,m);
            /* Only target coordinates replace a directional pad step. Native
             * access checks, item text and final-coordinate stores still run. */
            c->d[0]=(c->d[0]&0xffff0000u)|(unsigned)col;
            c->d[1]=(c->d[1]&0xffff0000u)|(unsigned)row;
            c->a[1]=0;c->pc=starport?0x91d6:0x84cc;
            s->interpolation_pending=1;m->stage=EM_WEB_MENU_SELECT_STAGE;
            ++s->picks;++m->moves;
        }
    }else if(m->count && current_col==(unsigned)col && current_row==(unsigned)row){
        int item=em_web_menu_select_item(c,context,col,row),cell=row*3+col;
        int purchase=em_web_menu_select_purchase(c,context,item);
        if(!purchase && !s->command_feedback_pending){
            /* BF2B=$FF is the original navigation-feedback request. The
             * native caller plays SFX25 through $02DDB6/$001664, respecting
             * the game's sound option. Retain this one queued command for
             * its native A on the next normal poll, after that feedback. */
            em_web_menu_select_disarm(s,m);s->command_feedback_pending=1;
            m->stage=EM_WEB_MENU_COMMAND_FEEDBACK_STAGE;m->dirty=0;
            c->d[0]&=0xffff0000u;c->ram[0xbf2b]=0xff;++s->sound_requests;
            return 1;
        }
        int confirm=!purchase || (s->armed && s->armed_cell==cell && s->armed_item==item);
        /* Pop this exact event before arming. It cannot later confirm itself;
         * the second A requires a separately queued tap, without any delay. */
        dune_mouse_pop(m);m->dirty=0;
        if(confirm){
            s->command_feedback_pending=0;
            em_web_menu_select_disarm(s,m);c->d[0]=(c->d[0]&0xffff0000u)|'A';c->ram[0xbf2b]='A';++s->confirmations;
        }else{
            c->d[0]&=0xffff0000u;c->ram[0xbf2b]=0xff;++s->sound_requests;
            s->armed=1;s->armed_cell=cell;s->armed_item=item;++s->first_selections;
        }
    }
    return 1;
}
#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE const char *dune_web_menu_select_debug(void){
    static char report[640];EmWebMenuSelect *s=&em_web_menu_select;CPU *c=&em_cpu;
    int context=dune_mouse_context(c),starport=context==3;
    unsigned col=dune_word(c,starport?0xbfc8:0xbf8a),row=dune_word(c,starport?0xbfca:0xbf8c);
    int item=context==2?(int)(int8_t)c->ram[0xbfa1]:context==3?em_web_menu_select_item(c,context,(int)col,(int)row):-999;
    uint32_t producer=dune_long(c,0xc578),house=dune_long(c,0xc278);
    unsigned credits=house>=0xff0000 && house<=0xffffe9?dune_long(c,(house&65535)+18):0;
    unsigned product=producer>=0xff4eb8 && producer<0xff6aaa?dune_word(c,(producer&65535)+82):65535;
    int armed=s->armed && s->cpu==c && s->context==context && s->producer==producer &&
        s->mouse && s->armed_cell==(int)(row*3+col) && s->armed_item==item;
    snprintf(report,sizeof report,"{\"context\":%d,\"col\":%u,\"row\":%u,\"item\":%d,\"credits\":%u,\"product\":%u,\"previewArmed\":%d,\"armedItem\":%d,\"armedCell\":%d,\"firstSelections\":%llu,\"confirmations\":%llu,\"producer\":%u,\"picks\":%llu,\"mapInputReady\":%d,\"selectionSoundRequests\":%llu}",context,col,row,item,credits,product,armed,armed?s->armed_item:-1,armed?s->armed_cell:-1,(unsigned long long)s->first_selections,(unsigned long long)s->confirmations,producer,(unsigned long long)s->picks,context==1 && !c->ram[0xbe9c],(unsigned long long)s->sound_requests);
    return report;
}
#endif
#endif
