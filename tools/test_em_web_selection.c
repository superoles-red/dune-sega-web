/* Native single-selection/action/paid-placement regression. Fixtures choose a
 * previous idle product; allocation, payment, production and placement are all
 * original game code. No coordinates/damage/cargo/placement results are mocked. */
#define GENESIS_NO_MAIN
#ifndef ORACLE_SOURCE
#define ORACLE_SOURCE "../.local/source/build/dune-base.c"
#endif
#include ORACLE_SOURCE
#define EMSCRIPTEN_KEEPALIVE
#define EM_WEB_SELECTION_NO_SCREEN
static CPU em_cpu,baseline,ready,scratch;
static struct {DuneMouse dune_mouse;int paused,stopped;} em_host;
static int em_window=1;
#include "em_web_selection.h"
static unsigned original_orders,invalid_sounds,native_a;
static void require(int ok,const char *message){
    if(!ok){fprintf(stderr,"FAIL %s pc=%06x frame=%llu fault=%s state=%s\n",message,em_cpu.pc,(unsigned long long)em_cpu.vdp.frames,em_cpu.reason?em_cpu.reason:"none",dune_web_actions_debug());exit(1);}
}
static void step(void){
    em_web_selection_observe();dune_mouse_observe(&em_host.dune_mouse,&em_cpu);
    if(em_cpu.pc==0xe396)++original_orders;
    if(em_cpu.pc==0x27b80)++native_a;
    if(em_cpu.pc==0x27e60)++invalid_sounds;
    machine_step(&em_cpu);
}
static void frames(unsigned count){
    uint64_t end=em_cpu.vdp.frames+count;
    while(!em_cpu.fault && em_cpu.vdp.frames<end)step();
    require(!em_cpu.fault,"original execution remains healthy");
}
static void idle(unsigned count){
    uint64_t end=em_cpu.vdp.frames+count;
    do{step();}while(!em_cpu.fault && em_cpu.vdp.frames<end &&
       (em_web_selection.operation || em_web_selection.phase || em_web_selection.clear_requested));
    require(!em_cpu.fault && !em_web_selection.operation && !em_web_selection.phase && !em_web_selection.clear_requested,"native adapter completes once");
}
static void restore(CPU *source){
    em_cpu=*source;em_cpu.rom=rom_data;em_cpu.rom_size=sizeof rom_data;em_cpu.reason=NULL;em_cpu.pad_buttons[0]=0;em_cpu.audio_mode=AUDIO_MUTE;
    memset(&em_host,0,sizeof em_host);em_host.dune_mouse.enabled=1;dune_web_selection_reset();original_orders=invalid_sounds=native_a=0;
}
static void save_fixture(const char *path){
    FILE *f=fopen(path,"wb");require(f && fwrite(&em_cpu,sizeof em_cpu,1,f)==1,"write actual native QA snapshot");fclose(f);
}
static void click(unsigned x,unsigned y){dune_mouse_world_click(&em_host.dune_mouse,&em_cpu,x,y,DUNE_CLICK_SELECT);frames(40);}
/* Read-only native oracle chooses a valid fixture cell; it does not alter the
 * live state or bypass the release's independent original placement check. */
static int native_can_place(unsigned tile,unsigned type){
    scratch=em_cpu;em_cpu.pc=0xf100;em_cpu.sr=0x2700;em_cpu.a[7]=0xffef00;
    write_mem(&em_cpu,0xffef00,4,0xdead00);write_mem(&em_cpu,0xffef04,2,tile);write_mem(&em_cpu,0xffef06,2,type);
    unsigned n=0;while(!em_cpu.fault && em_cpu.pc!=0xdead00 && n++<1000000)translated_step(&em_cpu);
    int result=em_cpu.pc==0xdead00 && !em_cpu.fault && (em_cpu.d[0]&65535);em_cpu=scratch;return result;
}

int main(int argc,char **argv){
    require(argc==2,"snapshot path supplied");FILE *f=fopen(argv[1],"rb");require(f && fread(&baseline,sizeof baseline,1,f)==1,"native baseline loads");fclose(f);
    restore(&baseline);frames(2);save_fixture(".local/qa-baseline.cpu.bin");click(720,1104);
    require(dune_long(&em_cpu,0xc25c)==0xff220c,"original A selects original Soldier");
    click(784,1136);
    require(dune_mouse_context(&em_cpu)==1 && original_orders==1 && !dune_long(&em_cpu,0xc25c),"selected unit original A targets building instead of opening menu");
    puts("PASS single native A unit/target priority");

    restore(&baseline);frames(2);click(784,1136);
    require(em_web_action_context().kind==2,"original A selects yard");
    /* Explicit fixture: remember Windtrap as idle product; B itself executes
     * all original affordability/allocation/production handling. */
    write_mem(&em_cpu,0xff4eb8+82,2,9);
    require(em_web_action_context().b_kind==EM_B_REPEAT,"idle own yard exposes native Repeat");
    require(dune_web_action_b()==1 && dune_web_action_b()==0,"only one native B queued");idle(120);
    uint64_t limit=em_cpu.vdp.frames+4000;
    while(!em_cpu.fault && em_cpu.vdp.frames<limit && !(dune_word(&em_cpu,0x4ebe)&0x2000))step();
    require(!em_cpu.fault && (dune_word(&em_cpu,0x4ebe)&0x2000),"original paid Windtrap production completes");
    require(dune_word(&em_cpu,0x4eb8+82)==9 && em_cpu.ram[0x4eb8+3]!=255,"real paid Windtrap waits in yard");
    require(em_web_action_context().ready && !em_web_action_context().b_kind,"ready Yard does not mislabel native B as repeat");
    require(!dune_web_placement_preview_active() && dune_long(&em_cpu,0xc578)==0xff4eb8,
            "completed production keeps native selection/paid state without a drag preview");
    require(em_web_selection.native_bs==1,"native B handler executes once");
    ready=em_cpu;save_fixture(".local/qa-ready-yard.cpu.bin");unsigned paid=em_cpu.ram[0x4eb8+3];unsigned pending=0x4eb8+paid*98;
    printf("PASS native B repeat and original completed production paidSlot=%u frames=%llu\n",paid,(unsigned long long)em_cpu.vdp.frames);

    restore(&ready);require(dune_web_clear_selection()==1,"clear ready yard before first short tap");idle(120);
    require(!em_web_ready_yard_self_tap(784,1136),"first short tap on unselected ready yard keeps native A");
    unsigned ok_node=0;uint64_t ok_limit=em_cpu.vdp.frames+120;
    while(!ok_node && em_cpu.vdp.frames<ok_limit){step();ok_node=dune_word(&em_cpu,0x4eb8+16);}
    require(ok_node && dune_long(&em_cpu,ok_node+8)==0x657ac &&
            dune_long(&em_cpu,ok_node)==0xff4ec2 && (em_cpu.ram[ok_node+7]&0x20) && em_cpu.ram[ok_node+5]==6,
            "original unselected ready Yard creates its own OK sprite with native blink period");
    unsigned timer_seen=0;
    for(unsigned i=0;i<21;++i){frames(1);unsigned timer=em_cpu.ram[ok_node+4];if(timer<8)timer_seen|=1u<<timer;}
    require((timer_seen&(timer_seen-1))!=0 && !dune_long(&em_cpu,0xc578) && !dune_web_placement_preview_active() && em_cpu.ram[0x4eb8+3]==paid,
            "native OK countdown advances while paid Yard waits without selection/preview");
    puts("PASS original ready OK sprite and blink run with no selected Yard");
    click(784,1136);
    require(em_web_action_context().ready && dune_long(&em_cpu,0xc578)==0xff4eb8 && !dune_web_placement_preview_active(),"first original A selects ready yard without enabling drag preview");
    unsigned before_a=native_a;
    for(unsigned i=0;i<3;++i){
        require(em_web_ready_yard_self_tap(784,1136),"selected ready yard consumes repeated short tap");
        frames(40); /* The screen wrapper consumes this intent without queuing A. */
    }
    require(native_a==before_a && dune_mouse_context(&em_cpu)==1 && !dune_long(&em_cpu,0xc174) &&
            em_cpu.ram[0x4eb8+3]==paid && (dune_word(&em_cpu,0x4ebe)&0x2000) &&
            !em_web_selection.placement_starts && !em_web_selection.placement_attempts,
            "ready-yard self taps neither open production nor start placement or lose the paid product");
    require(!em_web_ready_yard_self_tap(528,528),"other map points retain original A");
    puts("PASS ready-yard repeated short taps keep paid building waiting for drag");
    restore(&ready);

    require(em_web_placement_begin_world(784,1136)==1,"actual ready Yard drag begins");
    uint64_t preview_limit=em_cpu.vdp.frames+120;
    while(!dune_web_placement_preview_active() && em_cpu.vdp.frames<preview_limit)step();
    require(dune_web_placement_preview_active(),"actual held drag waits for original footprint mapping");
    require(em_web_placement_move_world(528,528)==1 && em_web_placement_end_world(528,528)==1 && !dune_web_placement_preview_active(),"release hides preview before original A validates the invalid map cell");idle(120);
    require(em_web_selection.outcome==EM_PLACE_REJECTED && em_web_selection.placement_attempts==1 && invalid_sounds==1,"original validator rejects once and plays native error");
    require(!dune_long(&em_cpu,0xc578) && !dune_long(&em_cpu,0xc25c) && (dune_word(&em_cpu,0x4ebe)&0x2000) && em_cpu.ram[0x4eb8+3]==paid,"invalid release clears preview while keeping paid product");
    puts("PASS invalid original placement error then pure clear without product loss");

    restore(&ready);
    unsigned valid_tile=0;
    for(unsigned y=31;y<39 && !valid_tile;++y)for(unsigned x=20;x<30;++x)if(native_can_place(y*64+x,9)){valid_tile=y*64+x;break;}
    require(valid_tile!=0,"native placement oracle finds a legal release cell");
    unsigned vx=(valid_tile%64)*32+16,vy=(valid_tile/64)*32+16;
    printf("native legal placement tile=%u,%u\n",valid_tile%64,valid_tile/64);
    require(dune_web_clear_selection()==1,"clear ready yard before held drag");idle(120);
    require(em_web_placement_begin_world(784,1136)==1 && !dune_web_placement_preview_active(),"unselected held drag hides old cursor until native selection/preview");
    require(em_web_placement_move_world(vx,vy)==1,"held drag supplies current native footprint position");
    preview_limit=em_cpu.vdp.frames+120;
    while(!dune_web_placement_preview_active() && em_cpu.vdp.frames<preview_limit){
        if(em_web_selection.operation==EM_ACTION_PLACE_SELECT)require(!dune_web_placement_preview_active(),"native select phase never reveals ordinary cursor");
        step();
    }
    require(dune_web_placement_preview_active() && dune_long(&em_cpu,0xc578)==0xff4eb8 && !dune_long(&em_cpu,0xc25c),"held drag reveals only the committed native footprint after real selection");
    require(dune_web_placement_cancel()==1 && !dune_web_placement_preview_active(),"held drag cancellation hides the footprint immediately");idle(120);
    puts("PASS unselected held drag waits for native footprint before revealing cursor sprite");
    restore(&ready);
    require(dune_web_clear_selection()==1,"clear ready yard before rapid drag");idle(120);
    require(em_web_placement_begin_world(784,1136)==1,"unselected ready yard begins native select");
    require(!dune_web_placement_preview_active(),"pending native select cannot expose the old ordinary cursor");
    require(em_web_placement_end_world(vx,vy)==1 && !dune_web_placement_preview_active(),"fast release before native selection is deferred without retained preview");
    /* Duplicate release must neither enqueue a second A nor cancel the first. */
    require(em_web_placement_end_world(vx,vy)==0,"duplicate release is ignored");idle(180);
    require(em_web_selection.outcome==EM_PLACE_PLACED && em_web_selection.placement_attempts==1 && em_web_selection.placement_successes==1,"exactly one original placement succeeds");
    require(em_cpu.ram[pending+2]==9 && !(dune_word(&em_cpu,pending+4)&4) && dune_word(&em_cpu,pending+10)==(valid_tile/64)*256 && dune_word(&em_cpu,pending+12)==(valid_tile%64)*256,"original Windtrap is mapped at exact released tile");
    require(!dune_long(&em_cpu,0xc578) && !dune_long(&em_cpu,0xc25c),"successful drag ends with pureclear");
    puts("PASS fast release selects then natively places paid Windtrap exactly once");

    restore(&ready);require(em_web_placement_begin_world(784,1136)==1,"same-yard cancel starts");
    require(em_web_placement_end_world(784,1136)==1,"release on source yard cancels");idle(120);
    require(em_web_selection.outcome==EM_PLACE_CANCELLED && em_web_selection.placement_attempts==0 && em_cpu.ram[0x4eb8+3]==paid && !dune_long(&em_cpu,0xc578),"same-yard cancel does not open menu or lose product");
    puts("PASS source-yard drag cancellation preserves paid construction");

    restore(&ready);require(dune_web_clear_selection()==1,"clear before cancelled pending select");idle(120);
    require(em_web_placement_begin_world(784,1136)==1 && dune_web_placement_cancel()==1 && !dune_web_placement_preview_active(),"cancel pending native select immediately hides preview");idle(120);
    require(em_web_selection.outcome==EM_PLACE_CANCELLED && em_web_selection.placement_attempts==0 && !dune_long(&em_cpu,0xc578) && em_cpu.ram[0x4eb8+3]==paid,"early cancel remains cancelled");
    puts("PASS early pending-selection cancel never commits");
    restore(&ready);require(dune_web_clear_selection()==1,"clear before in-flight cancel");idle(120);
    require(em_web_placement_begin_world(784,1136)==1,"start in-flight select");
    uint64_t cancel_limit=em_cpu.vdp.frames+60;
    while(!em_web_selection.phase && em_cpu.vdp.frames<cancel_limit)step();
    require(em_web_selection.phase==EM_PHASE_SELECT && dune_web_placement_cancel()==1,"cancel after original A selection has begun");idle(120);
    require(em_web_selection.outcome==EM_PLACE_CANCELLED && !dune_long(&em_cpu,0xc578) && !em_web_selection.placement_attempts,"in-flight native selection clears after original return");
    puts("PASS in-flight native selection cancel never restores preview");
    restore(&ready);require(em_web_placement_begin_world(784,1136)==1,"drag before modal transition");
    unsigned callback=dune_long(&em_cpu,0xe002),unchanged=em_cpu.pc;
    write_mem(&em_cpu,0xffe002,4,0);em_web_selection_observe();
    require(em_cpu.pc==unchanged && !em_web_selection.phase && !dune_web_placement_active(),"modal transition aborts without redirecting native stack");
    write_mem(&em_cpu,0xffe002,4,callback);idle(120);
    require(!dune_long(&em_cpu,0xc578) && em_cpu.ram[0x4eb8+3]==paid,"return from menu clears only old yard preview");
    puts("PASS modal return cancels preview and keeps paid product");
    return 0;
}
