/* Native special-action regression. Unit_Create and every ability/order below
 * execute original translated game code. Fixture setup only isolates actors
 * and establishes paid-building sentinels; no fake death/deployment/countdown.
 *
 * clang -std=c11 -O1 tools/test_em_web_actions_special.c \
 *   -o .local/test-actions-special -lm
 * .local/test-actions-special /absolute/path/to/mission-atreides-01.cpu.bin
 */
#define GENESIS_NO_MAIN
#ifndef ORACLE_SOURCE
#define ORACLE_SOURCE "../.local/source/build/dune-base.c"
#endif
#include ORACLE_SOURCE
#define EMSCRIPTEN_KEEPALIVE
#define EM_WEB_SELECTION_NO_SCREEN
static CPU em_cpu,baseline,save_regs;
static struct {int paused,stopped;DuneMouse dune_mouse;} em_host;
static int em_window=1;
#ifdef EM_TEST_WORLD_INTENT
#include "em_web_world_intent.h"
#endif
#include "em_web_selection.h"

static unsigned native_a,native_b,map_returns,watched_unit,saw_die;
static void step(void){
    em_web_selection_observe();
    dune_mouse_observe(&em_host.dune_mouse,&em_cpu);
    if(em_cpu.pc==0x27b80)++native_a;
    if(em_cpu.pc==0x28392)++native_b;
    if(em_cpu.pc==0xe57a)++map_returns;
    if(watched_unit && em_cpu.ram[watched_unit+84]==10)saw_die=1;
    machine_step(&em_cpu);
}
static void require(int condition,const char *message){
    if(condition)return;
    fprintf(stderr,"FAIL %s pc=%06x mode=%u context=%d selected=%06x currentBuilding=%06x fault=%s state=%s\n",
            message,em_cpu.pc,dune_word(&em_cpu,0xc264),dune_mouse_context(&em_cpu),
            dune_long(&em_cpu,0xc25c),dune_long(&em_cpu,0xc578),
            em_cpu.reason?em_cpu.reason:"none",dune_web_actions_debug());
    exit(1);
}
static void reset(void){
    em_cpu=baseline;em_cpu.rom=rom_data;em_cpu.rom_size=sizeof rom_data;
    em_cpu.reason=NULL;em_cpu.pad_buttons[0]=0;
    memset(&em_host,0,sizeof em_host);em_host.dune_mouse.enabled=1;
    dune_web_selection_reset();
    native_a=native_b=map_returns=watched_unit=saw_die=0;
}
static int idle(void){
    return !em_web_selection.operation && !em_web_selection.phase &&
           !em_host.dune_mouse.count && !em_host.dune_mouse.stage;
}
static int wait_dispatch(unsigned old_a,unsigned old_b,unsigned old_returns,unsigned frames){
    uint64_t end=em_cpu.vdp.frames+frames;
    unsigned dispatched=0,return_at_dispatch=old_returns;
    while(!em_cpu.fault && em_cpu.vdp.frames<end){
        step();
        if(!dispatched && (native_a>old_a || native_b>old_b)){
            dispatched=1;return_at_dispatch=map_returns;
        }
        if(dispatched && map_returns>return_at_dispatch && idle())return 1;
    }
    return 0;
}
static void native_click(unsigned unit){
    unsigned a=native_a,b=native_b,r=map_returns;
    dune_mouse_world_click(&em_host.dune_mouse,&em_cpu,
                          dune_word(&em_cpu,unit+12)/8,
                          dune_word(&em_cpu,unit+10)/8,DUNE_CLICK_SELECT);
    require(wait_dispatch(a,b,r,120),"original contextual A completes");
    require(native_a>a && native_b==b,"A reaches original A branch only");
}
static void contextual_b(void){
    unsigned a=native_a,b=native_b,r=map_returns;
    require(dune_web_action_b()==1,"contextual B accepted");
    require(wait_dispatch(a,b,r,120),"contextual B completes through original handler");
    require(native_b>b && native_a==a,"B reaches original B branch only");
}
static void clear_selection(void){
    unsigned a=native_a,b=native_b,r=map_returns;
    require(dune_web_clear_selection()==1,"pure clear accepted");
    uint64_t end=em_cpu.vdp.frames+120;
    while(!em_cpu.fault && em_cpu.vdp.frames<end){
        step();if(map_returns>r && idle())break;
    }
    require(!em_cpu.fault && map_returns>r && idle(),"pure clear completes");
    require(native_a==a && native_b==b,"pure clear dispatches neither A nor B");
}
static void isolate(unsigned keep){
    for(unsigned p=0x1000;p<0x47c8;p+=140)
        if(p!=keep)write_mem(&em_cpu,0xff0000+p+4,2,0);
    for(unsigned i=0;i<4096;++i){
        unsigned t=0x7d9c+i*4;
        if(em_cpu.ram[t+2]&16){
            unsigned index=em_cpu.ram[t+3];
            unsigned p=index?0x1000+(index-1)*140:0;
            if(p!=keep){em_cpu.ram[t+2]&=~16;em_cpu.ram[t+3]=0;}
        }
    }
}
static unsigned create_native(unsigned index,unsigned type,unsigned owner,unsigned tx,unsigned ty){
    save_regs=em_cpu;unsigned stack=0xef00,low=stack;
    em_cpu.pc=0x468ba;em_cpu.sr=0x2700;em_cpu.a[7]=0xff0000+stack;
    write_mem(&em_cpu,em_cpu.a[7],4,0xdead00);
    write_mem(&em_cpu,em_cpu.a[7]+4,2,index);
    write_mem(&em_cpu,em_cpu.a[7]+6,2,type);
    write_mem(&em_cpu,em_cpu.a[7]+8,2,owner);
    write_mem(&em_cpu,em_cpu.a[7]+10,4,(((ty<<8)|128)<<16)|((tx<<8)|128));
    write_mem(&em_cpu,em_cpu.a[7]+14,2,128);
    unsigned n=0;
    while(!em_cpu.fault && em_cpu.pc!=0xdead00 && n++<5000000){
        if((em_cpu.a[7]&65535)<low)low=em_cpu.a[7]&65535;
        translated_step(&em_cpu);
    }
    unsigned p=em_cpu.a[0]&0xffffff;
    require(!em_cpu.fault && em_cpu.pc==0xdead00 && p>=0xff1000 && p<0xff47c8,
            "original Unit_Create returns an allocated unit");
    memcpy(em_cpu.ram+low,save_regs.ram+low,stack+20-low);
    memcpy(em_cpu.d,save_regs.d,sizeof em_cpu.d);
    memcpy(em_cpu.a,save_regs.a,sizeof em_cpu.a);
    em_cpu.pc=save_regs.pc;em_cpu.sr=save_regs.sr;
    em_cpu.usp=save_regs.usp;em_cpu.ssp=save_regs.ssp;
    printf("native Unit_Create type%u owner%u ptr%06x hp%u at%u,%u steps%u\n",
           type,owner,p,dune_word(&em_cpu,(p&65535)+18),tx,ty,n);
    return p&65535;
}
static unsigned arm_native(unsigned type,unsigned tx,unsigned ty){
    reset();isolate(0);
    unsigned unit=create_native(43,type,1,tx,ty);
    native_click(unit);
    require(dune_long(&em_cpu,0xc25c)==0xff0000+unit,"first original A selects special unit");
    native_click(unit);
    require((dune_word(&em_cpu,unit+6)&128)!=0 && em_cpu.ram[unit+15]>0,
            "second original self A arms native timed ability");
    /* The order caller may deselect after committing A. A subsequent native
     * selection is needed before B can address that same armed unit. */
    if(dune_long(&em_cpu,0xc25c)!=0xff0000+unit)native_click(unit);
    require(dune_long(&em_cpu,0xc25c)==0xff0000+unit &&
            (dune_word(&em_cpu,unit+6)&128)!=0 && em_cpu.ram[unit+15]>0,
            "armed special unit is natively selected for contextual action");
    return unit;
}
static unsigned owned_yards(void){
    unsigned n=0;
    for(unsigned p=0x4eb8;p<0x6aaa;p+=98)
        if((dune_word(&em_cpu,p+4)&3)==3 && em_cpu.ram[p+2]==8 &&
           em_cpu.ram[p+8]==1 && dune_word(&em_cpu,p+18)>0)++n;
    return n;
}
int main(int argc,char **argv){
    if(argc!=2)return 2;
    FILE *f=fopen(argv[1],"rb");
    if(!f || fread(&baseline,sizeof baseline,1,f)!=1)return 3;
    fclose(f);

    unsigned unit=arm_native(11,24,34);
    unsigned timer=em_cpu.ram[unit+15],action=em_cpu.ram[unit+84];
    unsigned hp=dune_word(&em_cpu,unit+18);
    clear_selection();
    require(dune_long(&em_cpu,0xc25c)==0 && dune_long(&em_cpu,0xc578)==0,
            "pure clear removes unit and current building selection");
    require((dune_word(&em_cpu,unit+6)&128)!=0 && em_cpu.ram[unit+15]>0 &&
            em_cpu.ram[unit+15]<=timer && em_cpu.ram[unit+84]==action &&
            dune_word(&em_cpu,unit+18)==hp,
            "pure clear preserves armed ability, live countdown, action and HP");
    printf("PASS pure clear retains native Devastator countdown %u->%u, armed flag and HP%u\n",
           timer,em_cpu.ram[unit+15],hp);

    unit=arm_native(11,24,34);watched_unit=unit;
    /* A lingering ready producer must not steal the armed unit's native B. */
    write_mem(&em_cpu,0xff4ebe,2,dune_word(&em_cpu,0x4ebe)|0x2000);
    em_cpu.ram[0x4ebb]=2;
    write_mem(&em_cpu,0xffc578,4,0xff4eb8);
    write_mem(&em_cpu,0xffc57c,4,0xff4eb8);
    unsigned armed_building_flags=dune_word(&em_cpu,0x4ebe);
    uint64_t start=em_cpu.vdp.frames;
    contextual_b();
    require(dune_long(&em_cpu,0xc578)==0xff4eb8 &&
            dune_word(&em_cpu,0x4ebe)==armed_building_flags && em_cpu.ram[0x4ebb]==2,
            "armed unit takes original B priority over lingering ready producer");
    uint64_t end=em_cpu.vdp.frames+180;
    while(!em_cpu.fault && !saw_die && em_cpu.vdp.frames<end)step();
    require(!em_cpu.fault && saw_die,"B completes native Devastator countdown and native Die10 follows");
    printf("PASS original Devastator A arms; contextual B reaches native Die10 after%llu frames\n",
           (unsigned long long)(em_cpu.vdp.frames-start));

    reset();isolate(0x2298);
    native_click(0x2298);
    /* Production can finish while a unit is selected. Establish that explicit
     * ready-yard fixture after selecting, since A on a ready yard normally
     * means placement rather than unit selection. */
    write_mem(&em_cpu,0xff4ebe,2,(dune_word(&em_cpu,0x4ebe)&0x7fff)|0x2000);
    em_cpu.ram[0x4ebb]=2;
    write_mem(&em_cpu,0xffc578,4,0xff4eb8);
    write_mem(&em_cpu,0xffc57c,4,0xff4eb8);
    require(dune_long(&em_cpu,0xc25c)==0xff2298 &&
            dune_long(&em_cpu,0xc578)==0xff4eb8 && !(dune_word(&em_cpu,0x4ebe)&0x8000),
            "unit selection coexists with unhighlighted lingering current building");
    unsigned building_flags=dune_word(&em_cpu,0x4ebe),unit_flags=dune_word(&em_cpu,0x229e);
    unsigned a=native_a,b=native_b;
    require(dune_web_action_b()==0,"ordinary unit has pure clear rather than contextual B");
    require(native_a==a && native_b==b && idle() &&
            dune_long(&em_cpu,0xc25c)==0xff2298 && dune_word(&em_cpu,0x229e)==unit_flags &&
            dune_long(&em_cpu,0xc578)==0xff4eb8 && dune_word(&em_cpu,0x4ebe)==building_flags &&
            em_cpu.ram[0x4ebb]==2 && dune_long(&em_cpu,0xc174)==0,
            "ordinary-unit B rejection preserves both selections and paid producer");
    clear_selection();
    require(dune_long(&em_cpu,0xc25c)==0 && dune_long(&em_cpu,0xc578)==0 &&
            dune_long(&em_cpu,0xc57c)==0xff4eb8 &&
            dune_word(&em_cpu,0x4ebe)==building_flags && em_cpu.ram[0x4ebb]==2,
            "pure clear removes both current selections while preserving paid product and history");
    puts("PASS ordinary-unit B rejected despite lingering ready yard; pure clear preserves paid product and history");

    unit=arm_native(17,26,35);
    unsigned yards=owned_yards();
    start=em_cpu.vdp.frames;contextual_b();end=em_cpu.vdp.frames+300;
    while(!em_cpu.fault && em_cpu.vdp.frames<end){
        int consumed=(dune_word(&em_cpu,unit+4)&3)!=3 ||
                     (dune_word(&em_cpu,unit+4)&4)!=0 || dune_word(&em_cpu,unit+18)==0;
        if(owned_yards()>yards && consumed)break;
        step();
    }
    require(!em_cpu.fault && owned_yards()==yards+1,
            "native MCV A then B deploys an actual additional owned construction yard");
    require((dune_word(&em_cpu,unit+4)&3)!=3 ||
            (dune_word(&em_cpu,unit+4)&4)!=0 || dune_word(&em_cpu,unit+18)==0,
            "native MCV is consumed or removed from map after deployment");
    printf("PASS original MCV A arms; contextual B deploys native yard%u->%u after%llu frames\n",
           yards,owned_yards(),(unsigned long long)(em_cpu.vdp.frames-start));
    return 0;
}
