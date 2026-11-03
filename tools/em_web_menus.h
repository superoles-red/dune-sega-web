/* Pointer-to-controller adapter for original native menus. Include immediately
   before dune_mouse_observe(), after dune_mouse_pop(). Call this hook at the
   beginning of dune_mouse_observe(); return when it returns 1. No menu state,
   row cursor, game flag, native code or drawing is overwritten. */
#ifndef DUNE_EM_WEB_MENUS_H
#define DUNE_EM_WEB_MENUS_H
static uint32_t em_web_menu_release_source;
static int em_web_menu_release_pending;

static int em_web_options_row(int x,int y,int in_game) {
    static const int top[8]={36,52,68,84,100,132,148,164};
    if(x<24||x>=312)return -1;
    for(int row=0;row<(in_game?8:6);++row)if(y>=top[row]&&y<top[row]+16)return row;
    return -1;
}

static int em_web_menus_observe(DuneMouse *m,CPU *c) {
    if(!m->enabled||c->pc!=0x4d4e)return 0;
    unsigned sp=c->a[7]&65535;
    if(sp>65532)return 0;
    uint32_t source=dune_long(c,sp);
    if(source!=0x20f24&&source!=0x21660&&source!=0x21ae6)return 0;
    uint32_t callback=dune_long(c,0xe002);
    if(m->front_kind!=4||m->front_source!=source||m->front_callback!=callback){
        dune_mouse_reset(m);m->context=4;
        em_web_menu_release_pending=0;
    }
    m->front_kind=4;m->front_source=source;m->front_callback=callback;
    m->front_frame=c->vdp.frames;
    if(c->pad_buttons[0]){dune_mouse_reset(m);return 1;}
    if(em_web_menu_release_pending&&em_web_menu_release_source==source){
        c->d[0]&=~65535u;em_web_menu_release_pending=0;return 1;
    }
    if(!m->dirty&&!m->count)return 1;
    int x=m->count?m->queue[m->head].x:m->x;
    int y=m->count?m->queue[m->head].y:m->y;
    unsigned key=0;
    if(source==0x21ae6) {
        if(x<96||x>=224||y<124||y>=152){m->dirty=0;if(m->count)dune_mouse_pop(m);return 1;}
        unsigned target=x<160?112:180,current=dune_word(c,0xdbf0);
        if(dune_word(c,0xdbfa))key=0;
        else if(current!=target){key=current>target?PAD_LEFT:PAD_RIGHT;++m->moves;}
        else {
            m->dirty=0;
            if(m->count){key=PAD_C;dune_mouse_pop(m);dune_mouse_reset(m);m->cooldown=c->vdp.frames+20;}
        }
    }else if(y>=188&&y<212&&x>=48&&x<280) {
        m->dirty=0;
        if(m->count){key=PAD_START;dune_mouse_pop(m);dune_mouse_reset(m);}
    }else if(source==0x21660) {
        if(x<84||x>=244||y<52||y>=100){m->dirty=0;if(m->count)dune_mouse_pop(m);return 1;}
        unsigned target_x=84+16*((x-84)/16),target_y=52+16*((y-52)/16);
        if(target_y==84&&target_x>=212)target_x=212; /* original wide END cell */
        unsigned current_x=dune_word(c,0xdbf0),current_y=dune_word(c,0xdbf2);
        if(dune_word(c,0xdbf8)||dune_word(c,0xdbfa))key=0;
        else if(current_y!=target_y){key=current_y>target_y?PAD_UP:PAD_DOWN;++m->moves;}
        else if(current_x!=target_x){key=current_x>target_x?PAD_LEFT:PAD_RIGHT;++m->moves;}
        else {
            m->dirty=0;
            if(m->count){key=PAD_C;dune_mouse_pop(m);dune_mouse_reset(m);m->cooldown=c->vdp.frames+4;}
        }
    }else {
        int target=em_web_options_row(x,y,!!(c->a[4]&65535));
        if(target<0){m->dirty=0;if(m->count)dune_mouse_pop(m);return 1;}
        unsigned current=dune_word(c,0xdbfc),animating=dune_word(c,0xdbf8);
        if(animating)key=0;
        else if(current!=(unsigned)target){key=current>(unsigned)target?PAD_UP:PAD_DOWN;++m->moves;}
        else {
            m->dirty=0;
            if(m->count){
                /* Test labels play their current sample; clicking their value
                   uses the original Right command to cycle its native list. */
                key=(target==3||target==4)&&x>=168?PAD_RIGHT:PAD_C;
                dune_mouse_pop(m);dune_mouse_reset(m);m->cooldown=c->vdp.frames+20;
            }
        }
    }
    c->d[0]=(c->d[0]&~65535u)|key;
    if(key==PAD_UP||key==PAD_DOWN||key==PAD_LEFT||key==PAD_RIGHT){
        em_web_menu_release_source=source;em_web_menu_release_pending=1;
    }
    return 1;
}
#endif
