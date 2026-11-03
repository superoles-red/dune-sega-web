/* Presentation-only ready-yard regression against the original sprite creator
 * and blink traversal. The paid fixture is produced by native production in
 * test_em_web_selection.c. No gameplay routine or source CPU is modified by
 * the presentation adapter under test.
 *
 * clang -std=c11 -O1 tools/test_em_web_ready.c -o .local/test-ready -lm
 * .local/test-ready .local/qa-ready-yard.cpu.bin
 */
#define GENESIS_NO_MAIN
#ifndef ORACLE_SOURCE
#define ORACLE_SOURCE "../.local/source/build/dune-base.c"
#endif
#include ORACLE_SOURCE
#include "em_web_ready.h"

static CPU fixture,source,before,shadow,clock_cpu,register_save;
static unsigned yard;

static void require(int okay,const char *message){
    if(okay)return;
    fprintf(stderr,"FAIL %s sourcePC=%06x sourceFrame=%llu shadowPC=%06x fault=%s\n",
            message,source.pc,(unsigned long long)source.vdp.frames,shadow.pc,
            shadow.reason?shadow.reason:"none");
    exit(1);
}
static void repair(CPU *c){
    c->rom=rom_data;c->rom_size=sizeof rom_data;c->reason=NULL;
    c->pad_buttons[0]=0;c->audio_mode=AUDIO_STUB;
}
static unsigned list_count(const CPU *c,unsigned mapping,unsigned position){
    unsigned count=0,at=dune_word(c,0xf3ac),steps=0;
    while(at && steps++<512){
        require(at<=65520,"native sprite node is within RAM");
        if(dune_long(c,at+8)==mapping && dune_long(c,at)==position)++count;
        at=dune_word(c,at+14);
    }
    require(!at,"native sprite list is acyclic and bounded");
    return count;
}
/* Native helper calls are independent test oracles. Preserve the caller's
 * register context and temporary stack while retaining original RAM effects. */
static int run_native(CPU *c,unsigned pc,unsigned arg0,unsigned arg1,unsigned node){
    register_save=*c;unsigned stack=0xef00,low=stack,visible=0;
    c->pc=pc;c->sr=0x2700;c->a[7]=0xff0000+stack;
    if(pc==0x1088)c->a[0]=(uint32_t)(int32_t)(int16_t)node;
    write_mem(c,c->a[7],4,0xdead00);
    write_mem(c,c->a[7]+4,4,arg0);write_mem(c,c->a[7]+8,2,arg1);
    unsigned n=0;
    while(!c->fault && c->pc!=0xdead00 && n++<500000){
        if((c->a[7]&65535)<low)low=c->a[7]&65535;
        if(c->pc==0x1124 && (c->a[2]&65535)==node)visible=1;
        translated_step(c);
    }
    require(!c->fault && c->pc==0xdead00,"original native sprite helper returns safely");
    memcpy(c->ram+low,register_save.ram+low,stack+16-low);
    memcpy(c->d,register_save.d,sizeof c->d);memcpy(c->a,register_save.a,sizeof c->a);
    c->pc=register_save.pc;c->sr=register_save.sr;
    c->usp=register_save.usp;c->ssp=register_save.ssp;
    return visible;
}
static int native_draw(CPU *c,unsigned node){
    unsigned next=dune_word(c,node+14);
    write_mem(c,0xff0000+node+14,2,0); /* One node isolates the native blink gate. */
    int visible=run_native(c,0x1088,0,0,node);
    write_mem(c,0xff0000+node+14,2,next);
    return visible;
}
static void paid_unchanged(const CPU *a,const CPU *b){
    require(dune_word(a,yard+4)==dune_word(b,yard+4) &&
            dune_word(a,yard+6)==dune_word(b,yard+6) &&
            dune_word(a,yard+18)==dune_word(b,yard+18) &&
            dune_word(a,yard+82)==dune_word(b,yard+82) && a->ram[yard+3]==b->ram[yard+3],
            "overlay preserves yard identity, paid flags, HP, product and paid index");
    require(!memcmp(a->ram+0x7d9c,b->ram+0x7d9c,4096*4),"overlay preserves all original map cells");
    unsigned house=dune_long(a,0xc278)&65535;
    require(house<65536-70 && !memcmp(a->ram+house,b->ram+house,70),
            "overlay preserves the original player-house economy record");
    require(dune_word(a,0xbf60)==dune_word(b,0xbf60),"overlay preserves the original BF60 order marker");
}
static void reset_source(void){source=fixture;repair(&source);before=source;shadow=source;}

int main(int argc,char **argv){
    require(argc==2,"actual paid-ready snapshot path is supplied");
    FILE *f=fopen(argv[1],"rb");
    require(f && fread(&fixture,sizeof fixture,1,f)==1,"actual paid-ready fixture loads");
    fclose(f);repair(&fixture);
    yard=dune_long(&fixture,0xc578)&65535;
    require(yard>=0x4eb8 && yard<0x6aaa && fixture.ram[yard+2]==8 &&
            fixture.ram[yard+8]==dune_word(&fixture,0xc274) &&
            (dune_word(&fixture,yard+6)&0xa000)==0xa000 && fixture.ram[yard+3]!=255,
            "fixture contains an own selected ready yard with a real paid product");
    require(!dune_long(&fixture,0xc25c) && !dune_word(&fixture,yard+16),
            "selected-ready fixture has no unit or existing ready OK node");

    reset_source();
    require(em_web_ready_overlay(&shadow,&source,0)==1,"selected-ready shadow overlay succeeds");
    unsigned node=dune_word(&shadow,yard+16);
    require(node && node<=65520 && dune_long(&shadow,node+8)==0x657ac &&
            dune_long(&shadow,node)==0xff0000+yard+10 && shadow.ram[node+5]==6 &&
            (shadow.ram[node+7]&0x20),"native OK mapping, yard position and six-frame blink period");
    require(list_count(&shadow,0x657ac,0xff0000+yard+10)==1,"selected-ready shadow contains exactly one linked OK node");
    require(!memcmp(&source,&before,sizeof source),"overlay leaves source CPU byte-for-byte unchanged");
    paid_unchanged(&source,&shadow);
    puts("PASS selected-ready overlay creates one original OK node on the CPU copy only");

    /* An original unselected ready yard already has this exact native node.
     * Create it independently through the original creator, then overlay. */
    reset_source();write_mem(&source,0xffc578,4,0);
    write_mem(&source,0xff0000+yard+6,2,dune_word(&source,yard+6)&0x7fff);
    run_native(&source,0x9a66,0xff0000+yard,3,0);
    node=dune_word(&source,yard+16);
    require(node && list_count(&source,0x657ac,0xff0000+yard+10)==1,"independent native creator supplies an existing OK fixture");
    before=source;shadow=source;
    require(em_web_ready_overlay(&shadow,&source,0)==1,"existing native OK overlay succeeds");
    require(dune_word(&shadow,yard+16)==node && list_count(&shadow,0x657ac,0xff0000+yard+10)==1,
            "unselected existing native OK is retained without duplication");
    require(!memcmp(&source,&before,sizeof source),"existing-node overlay leaves source immutable");
    paid_unchanged(&source,&shadow);
    puts("PASS unselected existing original OK remains one node");

    reset_source();
    require(em_web_ready_overlay(&shadow,&source,1)==1,"dragging shadow overlay succeeds");
    require(!dune_word(&shadow,yard+16) && !list_count(&shadow,0x657ac,0xff0000+yard+10),
            "held drag suppresses synthetic OK creation");
    require(!memcmp(&source,&before,sizeof source),"dragging overlay leaves source immutable");
    paid_unchanged(&source,&shadow);
    puts("PASS held drag suppresses synthetic OK and preserves BF60 and paid state");

    /* Compare freeze against the ORIGINAL traversal's actual last draw result,
     * including the off-by-one boundary: the source counter is post-draw. */
    clock_cpu=fixture;write_mem(&clock_cpu,0xffc578,4,0);
    write_mem(&clock_cpu,0xff0000+yard+6,2,dune_word(&clock_cpu,yard+6)&0x7fff);
    run_native(&clock_cpu,0x9a66,0xff0000+yard,3,0);
    node=dune_word(&clock_cpu,yard+16);
    unsigned native_on=0,frozen_on=0;
    for(unsigned phase=0;phase<14;++phase){
        int expected=native_draw(&clock_cpu,node);native_on+=expected;
        source=clock_cpu;before=source;
        for(unsigned chunk=0;chunk<17;++chunk){
            shadow=source;em_web_ready_freeze_sprite(&shadow,&source,node);
            require(!memcmp(&source,&before,sizeof source),"freeze leaves source CPU byte-for-byte unchanged");
            int visible=native_draw(&shadow,node);
            require(visible==expected,"every replay chunk preserves CURRENT original blink visibility");
            if(!chunk)frozen_on+=visible;
        }
        ++clock_cpu.vdp.frames;
    }
    require(native_on==12 && frozen_on==12,"original and frozen OK both blink six on, one off");
    puts("PASS native current blink phase survives seventeen repeated copy traversals per frame (12/14 visible)");

    unsigned synthetic_on=0,synthetic_mask=0;
    for(unsigned phase=0;phase<14;++phase){
        reset_source();source.vdp.frames=phase;before=source;
        int first_visible=-1;
        for(unsigned chunk=0;chunk<17;++chunk){
            shadow=source;
            require(em_web_ready_overlay(&shadow,&source,0)==1,"synthetic blink-phase overlay succeeds");
            node=dune_word(&shadow,yard+16);
            em_web_ready_freeze_sprite(&shadow,&source,node);
            int visible=native_draw(&shadow,node);
            require(!memcmp(&source,&before,sizeof source),"synthetic overlay and freeze preserve source across chunks");
            if(first_visible<0)first_visible=visible;
            require(visible==first_visible,"synthetic selected-ready blink phase is independent of replay chunk count");
        }
        synthetic_on+=(unsigned)first_visible;
        if(first_visible)synthetic_mask|=1u<<phase;
    }
    require(synthetic_on==12 && (synthetic_mask&127)==((synthetic_mask>>7)&127),
            "source-frame-derived selected-ready OK repeats a six-on, one-off seven-frame cycle");
    printf("PASS synthetic OK source-frame phase is stable across chunks: visible%u/14 mask%04x\n",synthetic_on,synthetic_mask);
    return 0;
}
