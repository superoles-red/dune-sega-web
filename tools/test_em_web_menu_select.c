/* Offline regression against the actual original game. No mocked production. */
#define GENESIS_NO_MAIN
#ifndef ORACLE_SOURCE
#define ORACLE_SOURCE "../.local/source/build/dune-base.c"
#endif
#define dune_mouse_observe em_native_mouse_observe
#include ORACLE_SOURCE
#undef dune_mouse_observe
#include "em_web_menu_select.h"
#include <assert.h>
static CPU c,baseline,menu_baseline,save_regs;
static DuneMouse mouse;
static unsigned repair_events,production_events,stop_events,navigation_sounds;
static unsigned fixture_starport;
static unsigned purchase_events,purchased_type,purchased_quantity,delivery_unit;
static unsigned upgrade_building,upgrade_charges;
static void require(int ok,const char *message) {
    if(!ok) {
        fprintf(stderr,"FAIL %s pc=%06x frame=%llu context=%d row/col=%u/%u item=%d yard=%04x product=%u reason=%s\n",
            message,c.pc,(unsigned long long)c.vdp.frames,dune_mouse_context(&c),
            dune_word(&c,0xbf8c),dune_word(&c,0xbf8a),(int8_t)c.ram[0xbfa1],
            dune_word(&c,0x4ebe),dune_word(&c,0x4eb8+82),c.reason?c.reason:"none");
        exit(1);
    }
}
static void observe(void) {
    if(fixture_starport && c.pc==0x27d3c) {
        /* Swap only fixture selection at the original menu-open call site,
         * retaining its real task/caller stack. No menu, inventory or action
         * implementation is substituted. The first mission has no Starport.
         */
        write_mem(&c,0xffc578,4,0xff0000+fixture_starport);
        write_mem(&c,0xff0000+fixture_starport+6,2,dune_word(&c,fixture_starport+6)|0x8000);
        fixture_starport=0;
    }
    if(c.pc==0x2913e && (dune_word(&c,0x4eb8+4)&0x2000))++repair_events;
    if(c.pc==0x29096 && (dune_word(&c,0x4eb8+6)&0x4000))++production_events;
    if(c.pc==0x29172 && !(dune_word(&c,0x4eb8+6)&0x6000))++stop_events;
    if(c.pc==0x288fc)++navigation_sounds;
    if(c.pc==0x28c2a) {
        unsigned p=c.a[3]&65535;++purchase_events;
        purchased_type=dune_word(&c,p);purchased_quantity=c.ram[p+2];
    }
    if(c.pc==0xfcf2 && c.a[0])delivery_unit=c.a[0]&65535;
    if(c.pc==0xbeec && (c.a[2]&65535)==upgrade_building)++upgrade_charges;
    if(!em_web_menu_select_observe(&mouse,&c))em_native_mouse_observe(&mouse,&c);
}
static void frames(unsigned count) {
    uint64_t end=c.vdp.frames+count;
    while(!c.fault&&c.vdp.frames<end){observe();machine_step(&c);}
    require(!c.fault,"native machine remains healthy");
}
static void reset(void) {
    c=baseline;c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;
    c.audio_mode=AUDIO_MUTE;c.pad_buttons[0]=0;
    memset(&mouse,0,sizeof mouse);mouse.enabled=1;
    memset(&em_web_menu_select,0,sizeof em_web_menu_select);
    repair_events=production_events=stop_events=navigation_sounds=0;
    fixture_starport=0;upgrade_building=upgrade_charges=0;
    purchase_events=purchased_type=purchased_quantity=delivery_unit=0;
}
static void world_click(int x,int y,unsigned wait) {
    dune_mouse_world_click(&mouse,&c,x,y,DUNE_CLICK_SELECT);frames(wait);
}
static void open_yard(void) {
    reset();frames(2);
    for(unsigned i=0;i<4&&dune_mouse_context(&c)!=2;++i)world_click(784,1136,40);
    require(dune_mouse_context(&c)==2,"original A opens Construction Yard menu");
}
static void restore_menu(void) {
    c=menu_baseline;memset(&mouse,0,sizeof mouse);mouse.enabled=1;mouse.context=2;
    memset(&em_web_menu_select,0,sizeof em_web_menu_select);
    repair_events=production_events=stop_events=navigation_sounds=0;
    purchase_events=purchased_type=purchased_quantity=delivery_unit=0;
}
static unsigned credits(void) {
    return dune_long(&c,(dune_long(&c,0xc278)&65535)+18);
}
/* This fixture adds a real Starport via original Building_Create. No fake
 * menu item, production order, inventory, price or spending is injected.
 */
static unsigned create_building(unsigned index,unsigned type,unsigned tile) {
    save_regs=c;unsigned stack=0xef00,low=stack;
    c.pc=0xe584;c.sr=0x2700;c.a[7]=0xff0000+stack;
    write_mem(&c,c.a[7],4,0xdead00);
    write_mem(&c,c.a[7]+4,2,index);write_mem(&c,c.a[7]+6,2,type);
    write_mem(&c,c.a[7]+8,2,1);write_mem(&c,c.a[7]+10,2,tile);
    unsigned steps=0;
    while(!c.fault&&c.pc!=0xdead00&&steps++<5000000) {
        if((c.a[7]&65535)<low)low=c.a[7]&65535;
        translated_step(&c);
    }
    unsigned pointer=c.a[0]&0xffffff;
    require(!c.fault&&c.pc==0xdead00&&pointer,"original Building_Create succeeds");
    memcpy(c.ram+low,save_regs.ram+low,stack+20-low);
    memcpy(c.d,save_regs.d,sizeof c.d);memcpy(c.a,save_regs.a,sizeof c.a);
    c.pc=save_regs.pc;c.sr=save_regs.sr;c.usp=save_regs.usp;c.ssp=save_regs.ssp;
    return pointer&65535;
}
static unsigned click(int col,int row,unsigned max_frames) {
    uint64_t before=mouse.clicks,frame=c.vdp.frames;
    dune_mouse_click(&mouse,&c,48+32*col,60+24*row,DUNE_CLICK_SELECT);
    while(!c.fault&&c.vdp.frames<frame+max_frames&&mouse.clicks==before) {
        observe();machine_step(&c);
    }
    require(!c.fault,"click executes without native fault");
    return (unsigned)(c.vdp.frames-frame);
}
int main(int argc,char **argv) {
    require(argc==2,"snapshot path supplied");FILE*f=fopen(argv[1],"rb");
    require(f&&fread(&baseline,sizeof baseline,1,f)==1,"stable native snapshot loads");fclose(f);
    open_yard();frames(40);menu_baseline=c;
    require((int8_t)c.ram[0xbf8e + 4]==9,"native initial menu offers Windtrap");
    require(em_web_menu_select_purchase(&c,2,19) && !em_web_menu_select_purchase(&c,2,20),"native byte-sized Yard boundary includes paid Upgrade19 only");
    unsigned money=credits(),delay=click(1,1,12);frames(40);
    require(em_web_menu_select.picks==1 && em_web_menu_select.first_selections==1 &&
            em_web_menu_select.confirmations==0 && em_web_menu_select.armed &&
            c.ram[0xbfa1]==9 && credits()==money && !production_events && c.ram[0x4eb8+3]==255,
            "first nonadjacent Windtrap tap selects native details without spending/production/A");
    require(delay<=4 && navigation_sounds==1,"pointer preview avoids controller interpolation and plays one original selection sound");
    puts("PASS first Windtrap tap shows original details without purchase");
    delay=click(1,1,12);frames(150);
    require(em_web_menu_select.confirmations==1 && !em_web_menu_select.armed,"second Windtrap tap confirms exactly one original A and disarms");
    require(production_events && dune_word(&c,0x4eb8+82)==9 && c.ram[0x4eb8+3]!=255,
            "original game creates the paid Windtrap production order");
    require(credits()<money,"original production spends real house credits");
    printf("PASS nonadjacent Windtrap: A in %u VDP frames, native paid index %u, credits %u -> %u\n",
        delay,c.ram[0x4eb8+3],money,credits());

    world_click(784,1136,40);frames(40);
    require(dune_mouse_context(&c)==2 && (int8_t)c.ram[0xbf8e + 2]==-3,
            "real in-progress Windtrap enables native STOP command");
    delay=click(2,0,12);frames(150);
    require(delay<=4 && stop_events && dune_mouse_context(&c)==1 &&
            !(dune_word(&c,0x4eb8+6)&0x6000) && c.ram[0x4eb8+3]==255,
            "original enabled STOP cancels the real paid production order");
    puts("PASS native enabled STOP cancels real paid production");

    restore_menu();money=credits();unsigned product=dune_word(&c,0x4eb8+82);
    delay=click(2,0,12);frames(40);
    require(delay<=4 && dune_mouse_context(&c)==2 && em_web_menu_select.confirmations==1,
            "disabled STOP is directly selected but rejected by original A checks");
    require(!production_events && dune_word(&c,0x4eb8+82)==product && credits()==money,
            "disabled STOP cannot alter production or spend credits");
    puts("PASS original disabled STOP guard remains effective");

    restore_menu();money=credits();product=dune_word(&c,0x4eb8+82);
    require(c.ram[0xbf8e + 5]==0x80,"native product grid contains unavailable cell");
    click(1,1,12);frames(8);require(em_web_menu_select.armed,"purchase preview is armed before invalid-cell tap");
    dune_mouse_click(&mouse,&c,112,84,DUNE_CLICK_SELECT);frames(10);
    require(!mouse.count && em_web_menu_select.armed && !em_web_menu_select.confirmations &&
            dune_mouse_context(&c)==2 && credits()==money && dune_word(&c,0x4eb8+82)==product,
            "upstream-dropped invalid tap is no event and cannot purchase or discard preview");
    /* A valid queued intent can become unavailable before native processing;
     * model that race without changing a native cell or game-state byte. */
    mouse.queue[(mouse.head+mouse.count++)%8]=(DuneClick){.x=112,.y=84,.action=DUNE_CLICK_SELECT};frames(8);
    require(!mouse.count && !em_web_menu_select.armed && !em_web_menu_select.confirmations && credits()==money,
            "an actual queued invalid event disarms without native purchase");
    click(1,1,12);frames(8);
    require(em_web_menu_select.armed && em_web_menu_select.first_selections==2 && !em_web_menu_select.confirmations && credits()==money,
            "purchase after invalid-cell tap requires a new first preview");
    puts("PASS native unavailable-cell sentinel disarms old preview and cannot purchase");

    restore_menu();money=credits();
    dune_mouse_point(&mouse,&c,80,84);frames(8);
    require(c.ram[0xbfa1]==9 && !em_web_menu_select.armed && !em_web_menu_select.confirmations,"native hover/default-highlighted purchase has no prior tap arm");
    em_web_menu_select_reset_state();
    click(1,1,12);frames(8);
    require(em_web_menu_select.armed && em_web_menu_select.first_selections==1 && !em_web_menu_select.confirmations && credits()==money,"first tap on already highlighted default purchase only previews");
    dune_mouse_point(&mouse,&c,200,100);frames(8);
    require(em_web_menu_select.armed && !em_web_menu_select.confirmations,"reading info with pointer outside the purchase grid preserves preview");
    save_regs=c;dune_mouse_reset(&mouse);frames(180);
    require(em_web_menu_select.armed && !em_web_menu_select.confirmations && credits()==money,"benign SDL leave/focus mouse reset and reading delay preserve purchase preview");
    click(1,1,12);frames(150);
    require(em_web_menu_select.confirmations==1 && production_events && credits()<money,"second tap after benign leave and delay confirms original purchase");
    /* Exact load contract: same CPU/mouse addresses and selected cell, restored
     * original core plus mouse reset AND explicit adapter-reset hook. */
    c=save_regs;dune_mouse_reset(&mouse);em_web_menu_select_reset_state();frames(2);
    require(!em_web_menu_select.armed,"same-address load explicitly invalidates old menu preview");
    production_events=0;money=credits();click(1,1,12);frames(8);
    require(em_web_menu_select.armed && em_web_menu_select.first_selections==1 && !em_web_menu_select.confirmations && credits()==money && !production_events,"first post-load purchase tap cannot reuse old confirmation");
    em_web_menu_select_reset_state();click(1,1,12);frames(8);
    require(em_web_menu_select.armed && em_web_menu_select.first_selections==1 && !em_web_menu_select.confirmations && credits()==money,"explicit adapter reset also requires a fresh preview tap");
    puts("PASS default purchase, benign pointer leave/delay and explicit same-address load/reset");
    /* A different legitimate producer at the same callback/context must not
     * inherit an armed purchase. No native A runs during the reference swap. */
    uint32_t prior_producer=dune_long(&c,0xc578);
    unsigned second_yard=create_building(1,8,65535);
    write_mem(&c,0xffc578,4,0xff0000+second_yard);em_web_menu_select_observe(&mouse,&c);
    require(!em_web_menu_select.armed,"changing current producer in the same menu context discards its old arm");
    write_mem(&c,0xffc578,4,prior_producer);em_web_menu_select_observe(&mouse,&c);
    click(1,1,12);frames(8);
    require(em_web_menu_select.armed && !em_web_menu_select.confirmations && credits()==money,"returning to prior producer still requires a fresh first tap");
    puts("PASS producer change cannot inherit a purchase confirmation");

    restore_menu();money=credits();int other=-1;
    for(int i=0;i<18;++i){int item=(int8_t)c.ram[0xbf8e + i];if(item>=0 && item<19 && item!=9){other=i;break;}}
    require(other>=0,"original menu offers another purchase");
    click(1,1,12);frames(8);click(other%3,other/3,12);frames(8);click(1,1,12);frames(8);
    require(em_web_menu_select.armed && em_web_menu_select.armed_item==9 && em_web_menu_select.first_selections==3 && !em_web_menu_select.confirmations && credits()==money,
            "changing purchases discards old arm, including returning to the first item");
    delay=click(0,0,12);
    uint64_t exit_frame=c.vdp.frames,exit_limit=exit_frame+600;
    while(!c.fault && c.vdp.frames<exit_limit && c.pc!=0x27b5e){observe();machine_step(&c);}
    require(c.pc==0x27b5e && dune_mouse_context(&c)==1 && !c.ram[0xbe9c],"original map-input handler becomes ready after native EXIT cleanup");
    printf("Native EXIT input ready after %llu VDP frames (BE9C=%u)\n",(unsigned long long)(c.vdp.frames-exit_frame),c.ram[0xbe9c]);
    require(delay<=4 && dune_mouse_context(&c)==1 && !em_web_menu_select.armed && em_web_menu_select.confirmations==1 && !production_events,"EXIT immediately acts and clears a purchase preview");
    for(unsigned i=0;i<4&&dune_mouse_context(&c)!=2;++i)world_click(784,1136,40);
    frames(8);require(dune_mouse_context(&c)==2,"native Yard menu reopens");
    unsigned old_confirm=em_web_menu_select.confirmations;money=credits();click(1,1,12);frames(8);
    require(em_web_menu_select.armed && em_web_menu_select.confirmations==old_confirm && !production_events && credits()==money,"menu reentry cannot reuse the prior purchase arm");
    puts("PASS purchase changes, immediate EXIT and native menu reentry reset confirmation");

    reset();
    /* Damage before native menu entry: its command grid caches availability.
     * Original repair logic must subsequently restore HP and spend credits. */
    write_mem(&c,0xff4eb8+18,2,700);frames(2);
    for(unsigned i=0;i<4&&dune_mouse_context(&c)!=2;++i)world_click(784,1136,40);
    frames(40);money=credits();unsigned damaged=dune_word(&c,0x4eb8+18);
    require(dune_mouse_context(&c)==2 && (int8_t)c.ram[0xbf8e + 1]==-2,"native damaged-Yard entry enables actual FIX command");
    delay=click(1,0,12);frames(150);
    require(delay<=4 && repair_events && dune_mouse_context(&c)==1 && !em_web_menu_select.first_selections &&
            dune_word(&c,0x4eb8+18)>damaged && credits()<money,
            "enabled FIX immediately enters original repair, restores HP and spends native credits");
    puts("PASS native enabled FIX remains immediate and performs real repair");

    restore_menu();money=credits();
    dune_mouse_click(&mouse,&c,80,84,DUNE_CLICK_SELECT);
    dune_mouse_click(&mouse,&c,80,84,DUNE_CLICK_SELECT);
    frames(150);
    require(em_web_menu_select.first_selections==1 && em_web_menu_select.confirmations==1 && production_events && credits()<money,
            "two separately queued fast taps preview then confirm exactly one purchase");
    puts("PASS two fast separate tap events confirm exactly one native production order");

    restore_menu();money=credits();delay=click(0,0,12);frames(150);
    require(delay<=4 && dune_mouse_context(&c)==1 && !production_events && !repair_events,
            "EXIT returns to map without a production or repair command");
    puts("PASS native EXIT returns to map without production");

    reset();write_mem(&c,0xffc050,2,1); /* mission2 tech fixture; native grid owns eligibility */
    unsigned factory=create_building(1,10,37*64+24);upgrade_building=factory;
    require(!(dune_word(&c,factory+4)&4),"original factory fixture is mapped for native upgrade ticks");
    /* Preplaced-scenario fixture through original Building_Create: factories
     * require a real mapped Outpost in the house's native built-object mask to
     * offer Upgrade. The original scenario-init placement mode allows authored
     * starting buildings; restore it before any menu/action under test. */
    unsigned scenario_init=dune_word(&c,0xc148);write_mem(&c,0xffc148,2,scenario_init+1);
    unsigned outpost=create_building(2,18,37*64+26);write_mem(&c,0xffc148,2,scenario_init);
    require(!(dune_word(&c,outpost+4)&4),"native preplaced Outpost supplies actual house upgrade prerequisite");
    frames(2);
    for(unsigned i=0;i<4&&dune_mouse_context(&c)!=2;++i)world_click(784,1200,40);
    frames(40);require(dune_mouse_context(&c)==2 && c.ram[0xbf85]==10,"original A opens native later-tech factory menu");
    int upgrade_cell=-1;for(int i=0;i<18;++i)if(c.ram[0xbf8e + i]==27){upgrade_cell=i;break;}
    if(upgrade_cell<0){printf("Upgrade fixture factory%04x HP%u max? flags%04x level%u progress%u reqcamp%u C618%u C619%u BFB5%u grid:",factory,dune_word(&c,factory+18),dune_word(&c,factory+6),c.ram[factory+84],c.ram[factory+85],dune_word(&c,0xc050),c.ram[0xc618],c.ram[0xc619],c.ram[0xbfb5]);for(int i=0;i<18;++i)printf(" %d",(int8_t)c.ram[0xbf8e + i]);puts("");}
    require(upgrade_cell>=0 && em_web_menu_select_purchase(&c,2,27) && !em_web_menu_select_purchase(&c,2,28),"native byte-sized factory boundary includes its actual paid Upgrade27");
    money=credits();unsigned level=c.ram[factory+84],flags=dune_word(&c,factory+6);
    click(upgrade_cell%3,upgrade_cell/3,12);frames(8);
    require(em_web_menu_select.armed && !em_web_menu_select.confirmations && credits()==money && dune_word(&c,factory+6)==flags && !upgrade_charges,"first Upgrade tap only previews; no native upgrade flag or spending");
    click(upgrade_cell%3,upgrade_cell/3,12);frames(400);
    require(em_web_menu_select.confirmations==1 && !em_web_menu_select.armed && upgrade_charges>0 && credits()<money && c.ram[factory+84]==level+1,
            "second Upgrade tap starts real original paid upgrade and reaches next level");
    printf("PASS paid Upgrade: original charges %u, credits %u -> %u, level %u -> %u\n",upgrade_charges,money,credits(),level,c.ram[factory+84]);

    reset();unsigned starport=create_building(1,11,65535);
    /* Open from the real original map-input caller. Only fixture selection
     * changes to the newly native-created Starport at that call boundary.
     */
    fixture_starport=starport;frames(2);
    for(unsigned i=0;i<4&&dune_mouse_context(&c)!=3;++i)world_click(784,1136,40);
    frames(40);
    require(dune_mouse_context(&c)==3,"original menu routine opens native-created Starport");
    printf("Starport ptr=%04x grid:",starport);for(unsigned i=0;i<12;++i)printf(" %u",c.ram[0xbfcc+i]);puts("");
    int chosen=-1,locked=-1;unsigned basket=0,price=0,stock=0,ordered=0;
    for(int cell=11;cell>=0&&locked<0;--cell) {
        unsigned type=c.ram[0xbfcc+cell];if(type>=28)continue;
        for(unsigned i=0;i<9;++i) {
            unsigned p=0xc2d8+i*12;
            if(dune_word(&c,p)==type && (int8_t)c.ram[p+3]<0){locked=cell;break;}
        }
    }
    unsigned prior_confirmations=0;
    if(locked>=0) {
        money=credits();delay=click(locked%3,locked/3,12);frames(8);
        require(delay<=4 && credits()==money && dune_mouse_context(&c)==3 && em_web_menu_select.armed && !em_web_menu_select.confirmations,
                "locked Starport first tap previews without original A");
        delay=click(locked%3,locked/3,12);frames(8);
        require(delay<=4 && credits()==money && dune_mouse_context(&c)==3 && em_web_menu_select.confirmations==1 && !em_web_menu_select.armed,
                "original Starport second-tap guard rejects negative-stock/campaign-locked unit");
        puts("PASS native Starport locked-stock guard remains effective");
        prior_confirmations=1;
    }
    for(int cell=11;cell>=0&&chosen<0;--cell) {
        unsigned type=c.ram[0xbfcc+cell];if(type>=28)continue;
        for(unsigned i=0;i<9;++i) {
            unsigned p=0xc2d8+i*12;
            if(dune_word(&c,p)==type && (int8_t)c.ram[p+3]>0 && dune_word(&c,p+4)<=credits()) {
                chosen=cell;basket=p;price=dune_word(&c,p+4);stock=c.ram[p+3];ordered=c.ram[p+2];break;
            }
        }
    }
    require(chosen>=0,"native Starport inventory offers an affordable stocked unit");
    money=credits();delay=click(chosen%3,chosen/3,12);frames(8);
    require(delay<=4 && dune_word(&c,0xbfc8)==(unsigned)chosen%3 &&
            dune_word(&c,0xbfca)==(unsigned)chosen/3 && em_web_menu_select.confirmations==prior_confirmations &&
            em_web_menu_select.armed && !purchase_events && credits()==money && c.ram[basket+3]==stock && c.ram[basket+2]==ordered,
            "first Starport tap selects native details without spending or changing stock/basket");
    delay=click(chosen%3,chosen/3,12);frames(8);
    require(delay<=4 && em_web_menu_select.confirmations==prior_confirmations+1 && !em_web_menu_select.armed,
            "second Starport tap confirms exactly one original A and disarms");
    require(purchase_events==1 && purchased_type==dune_word(&c,basket) && purchased_quantity==ordered+1 &&
            c.ram[basket+3]==stock-1 && credits()==money-price,
            "original Starport purchase changes real basket/stock and spends native price");
    require(delivery_unit && c.ram[delivery_unit+2]==purchased_type && c.ram[delivery_unit+8]==1 &&
            dune_word(&c,delivery_unit+18)>0,
            "original Starport FA88 creates a real native delivery unit");
    printf("PASS native Starport purchase: cell %d, A in %u VDP frames, credits %u -> %u, price %u\n",
        chosen,delay,money,credits(),price);
    printf("PASS original Starport delivery Unit_Create: type %u, native pointer %04x, HP %u\n",
        purchased_type,delivery_unit,dune_word(&c,delivery_unit+18));
    return 0;
}
