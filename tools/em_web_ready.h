/* Original ready-OK art on a presentation CPU copy. No live CPU, selection,
 * paid product, timer, native instruction or ROM data is changed. Include after
 * CPU/translated_step/dune_word declarations, before dune_view_sprites. */
#ifndef DUNE_EM_WEB_READY_H
#define DUNE_EM_WEB_READY_H
#include <stdint.h>
#include <string.h>

static int em_web_ready_building(uint32_t p){
    return p>=0xff4eb8 && p<0xff6aaa && (p-0xff4eb8)%98u==0;
}
static int em_web_ready_sprite(unsigned p){return p && p<=65520u;}

/* Original $DCAA hides OK when selectedbit15 is set, while the browser keeps
 * real selection and presents a waiting product separately from a drag. Reuse
 * $9A66(building,3) on the clone to attach its exact original OK mapping657AC.
 * Return 0 only if original sprite allocation/execution fails on the clone. */
static int em_web_ready_overlay(CPU *shadow,const CPU *source,int dragging){
    if(!shadow || !source || shadow==source)return 0;
    if(dune_mouse_context(source)!=1 || dune_long(source,0xc25c))return 1;
    uint32_t building=dune_long(source,0xc578);
    if(!em_web_ready_building(building))return 1;
    unsigned a=building&65535,flags=dune_word(source,a+6);
    if(source->ram[a+2]!=8 || source->ram[a+8]!=dune_word(source,0xc274) ||
       (dune_word(source,a+4)&7)!=3 || !dune_word(source,a+18) ||
       (flags&0xa000)!=0xa000 || dune_word(source,a+82)>=19 || source->ram[a+3]==255)return 1;
    unsigned node=dune_word(shadow,a+16);
    if(dragging){
        /* A previous native OK node can linger until the next building pass.
         * Hide only this selected Yard's marker during its actual drag. */
        if(em_web_ready_sprite(node))shadow->ram[node+7]|=0x80;
        return 1;
    }
    if(em_web_ready_sprite(node) && dune_long(shadow,node+8)==0x657ac &&
       dune_long(shadow,node)==building+10)return 1; /* exact native node exists */
    uint32_t saved_d[8],saved_a[8];
    memcpy(saved_d,shadow->d,sizeof saved_d);memcpy(saved_a,shadow->a,sizeof saved_a);
    uint32_t pc=shadow->pc,usp=shadow->usp,ssp=shadow->ssp;
    uint16_t sr=shadow->sr;
    shadow->pc=0x9a66;shadow->sr=0x2700;shadow->a[7]=0xffef00;
    write_mem(shadow,0xffef00,4,0xdead00);
    write_mem(shadow,0xffef04,4,building);
    write_mem(shadow,0xffef08,2,3);
    unsigned steps=0;
    while(!shadow->fault && shadow->pc!=0xdead00 && steps++<100000)translated_step(shadow);
    int valid=!shadow->fault && shadow->pc==0xdead00;
    memcpy(shadow->d,saved_d,sizeof saved_d);memcpy(shadow->a,saved_a,sizeof saved_a);
    shadow->pc=pc;shadow->sr=sr;shadow->usp=usp;shadow->ssp=ssp;
    node=dune_word(shadow,a+16);
    return valid && em_web_ready_sprite(node) && dune_long(shadow,node+8)==0x657ac &&
           dune_long(shadow,node)==building+10;
}

/* The source has ALREADY rendered its native frame. A nonautomatic blink node
 * reloads period at its blank transition: period6=blank; counters5..0=visible
 * for bit4=0. Automatic bit3 updates bit4 at that transition, so post-frame bit4
 * already gives its visibility. Freeze the resulting phase, rather than forcing
 * every counter to2 (which erases the native ready-OK blank frame).
 * A newly synthesized OK has no live countdown; keep its original six-visible,
 * one-blank cadence on the native VDP clock, identical for every replay chunk. */
static void em_web_ready_freeze_sprite(CPU *shadow,const CPU *source,unsigned at){
    if(!shadow || !source || !em_web_ready_sprite(at))return;
    unsigned flags=shadow->ram[at+7],period=shadow->ram[at+5];
    if(!(flags&0x20) || !period){shadow->ram[at+4]=2;return;}
    int same=dune_long(shadow,at)==dune_long(source,at) &&
             dune_long(shadow,at+8)==dune_long(source,at+8) &&
             (source->ram[at+7]&0x20) && source->ram[at+5]==period;
    if(dune_long(shadow,at+8)==0x657ac){
        uint32_t object=dune_long(shadow,at)-10u;
        if(em_web_ready_building(object))same=same && dune_word(source,(object&65535)+16)==at;
    }
    int visible;
    if(same){
        unsigned native_flags=source->ram[at+7];
        visible=(native_flags&8)?!(native_flags&16):
            ((source->ram[at+4]!=period)!=!!(native_flags&16));
    }else visible=source->vdp.frames%(period+1u)!=0;
    shadow->ram[at+4]=2;
    shadow->ram[at+7]=(uint8_t)((flags&~0x18u)|(visible?0:0x10u));
}
#endif
