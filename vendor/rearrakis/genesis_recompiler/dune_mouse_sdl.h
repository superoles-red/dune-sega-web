#ifndef GENESIS_DUNE_MOUSE_SDL_H
#define GENESIS_DUNE_MOUSE_SDL_H
#if defined(GENESIS_DUNE_MOUSE) && defined(GENESIS_SDL2)
static void dune_mouse_event(SDLHost *h,CPU *c,const SDL_Event *e) {
    DuneMouse *m=&h->dune_mouse;
    if(h->paused || h->stopped) {dune_mouse_reset(m);return;}
    /* Dune uses drawable pixels for its adaptive world and a fixed HUD. */
    if(e->type==SDL_MOUSEMOTION) {
        h->dune_view.pointer_valid=1;h->dune_view.pointer_x=e->motion.x;h->dune_view.pointer_y=e->motion.y;
        int x,y,world;
        if(!dune_view_mouse(h,c,e->motion.x,e->motion.y,&x,&y,&world) ||
           !(world?dune_mouse_world_point(m,c,x,y):dune_mouse_point(m,c,x,y))){
            dune_mouse_reset(m);
            h->dune_view.pointer_valid=0;m->pan_x=0;m->pan_y=0;
            if(dune_view_map(c))m->camera_hold=1;
        }
        dune_view_pointer(h,c);
    } else if(e->type==SDL_MOUSEBUTTONDOWN) {
        h->dune_view.pointer_valid=1;h->dune_view.pointer_x=e->button.x;h->dune_view.pointer_y=e->button.y;
        int action=e->button.button==SDL_BUTTON_LEFT ? DUNE_CLICK_SELECT:
                   e->button.button==SDL_BUTTON_RIGHT ? DUNE_CLICK_ORDER:
                   e->button.button==SDL_BUTTON_MIDDLE ? DUNE_CLICK_CANCEL:0;
        int x,y,world;
        if(action && dune_view_mouse(h,c,e->button.x,e->button.y,&x,&y,&world)){
            if(world)dune_mouse_world_click(m,c,x,y,action);
            else dune_mouse_click(m,c,x,y,action);
        }
        dune_view_pointer(h,c);
    } else if((e->type==SDL_WINDOWEVENT &&
               (e->window.event==SDL_WINDOWEVENT_FOCUS_LOST ||
                e->window.event==SDL_WINDOWEVENT_LEAVE)) ||
              (e->type==SDL_KEYDOWN && sdl_pad_key(e->key.keysym.sym))) {
        h->dune_view.pointer_valid=0;m->pan_x=0;m->pan_y=0;dune_mouse_reset(m);
        if(dune_view_map(c)){
            m->camera_hold=1;
            c->ram[0xbf12]=0;c->ram[0xbf13]=160;c->ram[0xbf14]=0;c->ram[0xbf15]=112;
            memset(c->ram+0xbf0e,0,4);
        }
    }
}
#endif
#endif
