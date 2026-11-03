/* Presentation only. Never changes the live cursor, selection or placement. */
#ifndef DUNE_EM_WEB_PRESENT_H
#define DUNE_EM_WEB_PRESENT_H
#include "em_web_minimap.h"
#ifdef __EMSCRIPTEN__
int dune_web_placement_preview_active(void);
#else
static int em_web_present_native_drag;
#endif
static EmWebMinimap em_web_native_minimap(const CPU *c){
    return (EmWebMinimap){dune_word(c,0xbf54),dune_word(c,0xbf56),c->ram[0xbf51]?16:32,dune_word(c,0xbf76),dune_word(c,0xbf78),c->ram[0xbf7c] && dune_word(c,0xbf58)};
}
/* The ordinary BF18 cursor is never a selection marker. BF60 remains native.
   Only an actual carried building may use BF18's original coloured footprint. */
static int em_web_cursor_kind(const CPU *c){
    if(dune_mouse_context(c)!=1)return 0;
#ifdef __EMSCRIPTEN__
    return dune_web_placement_preview_active()?2:0;
#else
    return em_web_present_native_drag?2:0;
#endif
}
static int em_web_cursor_preview(const CPU *c){return em_web_cursor_kind(c)==2;}
#endif
