/* Native menu composition keeps its real focus sprite. Only copies are drawn. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-web.c"
#include "em_web_menu_select.h"
#include <assert.h>
#include <math.h>

static CPU cpu,baseline,before,without_focus,saved_regs,menu_oracle;
static DuneMouse mouse;
static unsigned fixture_starport;
static unsigned production_events;
static unsigned selection_beeps;
static int modern_input=1;
static unsigned last_click_delay;
static void require(int condition,const char *message){
    if(!condition){
        fprintf(stderr,"FAIL %s pc=%06x frame=%llu context=%d delay=%u beeps=%u confirms=%llu reason=%s\n",message,cpu.pc,
            (unsigned long long)cpu.vdp.frames,dune_mouse_context(&cpu),last_click_delay,selection_beeps,(unsigned long long)em_web_menu_select.confirmations,cpu.reason?cpu.reason:"none");
        exit(1);
    }
}
static void observe(void){
    if(cpu.pc==0x1664 && (cpu.d[0]&0xffff)==25)++selection_beeps;
    if(fixture_starport && cpu.pc==0x27d3c){
        /* The first mission has no Starport. Reuse the proven menu-test fixture:
         * select an original Building_Create result at the native menu caller. */
        write_mem(&cpu,0xffc578,4,0xff0000+fixture_starport);
        write_mem(&cpu,0xff0000+fixture_starport+6,2,dune_word(&cpu,fixture_starport+6)|0x8000);
        fixture_starport=0;
    }
    if(cpu.pc==0x29096 && (dune_word(&cpu,0x4eb8+6)&0x4000))++production_events;
    if(!modern_input || !em_web_menu_select_observe(&mouse,&cpu))dune_mouse_observe(&mouse,&cpu);
}
static void frames(unsigned count){
    uint64_t end=cpu.vdp.frames+count;
    while(!cpu.fault && cpu.vdp.frames<end){observe();machine_step(&cpu);}
    require(!cpu.fault,"native machine remains healthy");
}
static void reset(void){
    cpu=baseline;cpu.rom=rom_data;cpu.rom_size=sizeof rom_data;cpu.reason=NULL;cpu.fault=0;
    cpu.audio_mode=AUDIO_STUB;cpu.pad_buttons[0]=0;
    memset(&mouse,0,sizeof mouse);mouse.enabled=1;
    memset(&em_web_menu_select,0,sizeof em_web_menu_select);
    fixture_starport=production_events=selection_beeps=0;modern_input=1;
}
static void world_click(int x,int y){dune_mouse_world_click(&mouse,&cpu,x,y,DUNE_CLICK_SELECT);frames(40);}
static unsigned click(int col,int row){
    uint64_t started=cpu.vdp.frames,clicks=mouse.clicks,end=started+12;
    dune_mouse_click(&mouse,&cpu,48+col*32,60+row*24,DUNE_CLICK_SELECT);
    while(!cpu.fault && mouse.clicks==clicks && cpu.vdp.frames<end){observe();machine_step(&cpu);}
    require(!cpu.fault && mouse.clicks==clicks+1,"one original menu event consumed");
    unsigned delay=(unsigned)(cpu.vdp.frames-started);last_click_delay=delay;frames(8);return delay;
}
static unsigned credits(void){return dune_long(&cpu,(dune_long(&cpu,0xc278)&65535)+18);}

/* Isolate the frame in the already-completed original SAT, without replaying
 * sprite animation or reading future RAM positions. Every changed pixel is
 * the native 2px rectangle of the selected 32x24 cell. Colours are compared
 * through whole-frame identity, not assumed from a single animation phase. */
static void check_focus(DuneView *view,int col,int row,const char *label){
    int context=dune_mouse_context(&cpu),starport=context==3;
    require(context==2 || context==3,"original production or Starport context");
    require(dune_word(&cpu,starport?0xbfc8:0xbf8a)==(unsigned)col &&
            dune_word(&cpu,starport?0xbfca:0xbf8c)==(unsigned)row,"native selected row/column");
    unsigned node=dune_word(&cpu,starport?0xbfc6:0xbf86);
    require(node && node<=65520,"native focus sprite exists");
    static uint8_t full[320*224*3],all[320*224*3],off[320*224*3],sprites[320*224];
    uint64_t rendered=cpu.vdp.rendered_frames;
    while(!cpu.fault && cpu.vdp.rendered_frames==rendered){observe();machine_step(&cpu);}
    require(!cpu.fault,"original complete VDP frame available");before=cpu;
    const uint8_t *image=em_web_menu_frame(view,&cpu);
    require(image==cpu.vdp.frame,"menu displays the actual completed native VDP frame");
    memcpy(full,image,sizeof full);
    require(!memcmp(&before,&cpu,sizeof cpu),"normal composition never writes live CPU");
    memset(sprites,0,sizeof sprites);vdp_sprites(&cpu.vdp,320,224,sprites);
    vdp_render_pixels(&cpu.vdp,320,224,sprites,all);
    require(!memcmp(full,all,sizeof full),"completed native frame preserves original SAT and VRAM phase");
    require(!memcmp(&before,&cpu,sizeof cpu),"reference renderer never writes live CPU");
    without_focus=cpu;
    unsigned sat=(cpu.vdp.registers[5]&0x7e)<<9,link=0,found=0;
    for(unsigned n=0;n<80;++n){
        unsigned at=sat+link*8,shape=vdp_word(&cpu.vdp,at+2),entry=vdp_word(&cpu.vdp,at+4);
        int x=(int)(vdp_word(&cpu.vdp,at+6)&511)-128,y=(int)(vdp_word(&cpu.vdp,at)&1023)-128;
        unsigned width=(((shape>>10)&3)+1)*8,height=(((shape>>8)&3)+1)*8;
        if((entry&2047)>=0x3e0 && (entry&2047)<0x3ec){
            without_focus.vdp.vram[(at+6)&65535]=0;
            without_focus.vdp.vram[(at+7)&65535]=0;++found;
        }
        link=shape&127;if(!link)break;
    }
    require(found>0,"original frame SAT entries use native frame pattern bank7C00");
    memset(sprites,0,sizeof sprites);vdp_sprites(&without_focus.vdp,320,224,sprites);
    vdp_render_pixels(&without_focus.vdp,320,224,sprites,off);
    unsigned changed=0;int minx=320,miny=224,maxx=-1,maxy=-1;
    const int left=32+col*32,top=48+row*24;
    for(int y=0;y<224;++y)for(int x=0;x<320;++x){
        unsigned p=(unsigned)(y*320+x)*3;
        if(!memcmp(full+p,off+p,3))continue;
        ++changed;if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;
        require(x>=left && x<left+32 && y>=top && y<top+24,"focus changes only its selected cell");
        require(x<left+2 || x>=left+30 || y<top+2 || y>=top+22,"focus pixels form the native two-pixel border");
        require(full[p] || full[p+1] || full[p+2],"visible native border retains its phase colour");
    }
    if(changed!=208 || minx!=left || miny!=top || maxx!=left+31 || maxy!=top+23)
        fprintf(stderr,"focus %s node%04x changed%u bounds%d,%d..%d,%d expected%d,%d\n",label,node,changed,minx,miny,maxx,maxy,left,top);
    require(changed==208 && minx==left && miny==top && maxx==left+31 && maxy==top+23,"whole native focus rectangle surrounds the active cell");
    require(!memcmp(&before,&cpu,sizeof cpu),"focus isolation leaves all live CPU and game state intact");
    printf("PASS %s: native focus %04x, %u original border pixels at %d,%d..%d,%d; live CPU unchanged\n",label,node,changed,minx,miny,maxx,maxy);
}

static unsigned create_building(unsigned index,unsigned type,unsigned tile){
    saved_regs=cpu;unsigned stack=0xef00,low=stack;
    cpu.pc=0xe584;cpu.sr=0x2700;cpu.a[7]=0xff0000+stack;
    write_mem(&cpu,cpu.a[7],4,0xdead00);
    write_mem(&cpu,cpu.a[7]+4,2,index);write_mem(&cpu,cpu.a[7]+6,2,type);
    write_mem(&cpu,cpu.a[7]+8,2,1);write_mem(&cpu,cpu.a[7]+10,2,tile);
    unsigned steps=0;
    while(!cpu.fault && cpu.pc!=0xdead00 && steps++<5000000){
        if((cpu.a[7]&65535)<low)low=cpu.a[7]&65535;
        translated_step(&cpu);
    }
    unsigned pointer=cpu.a[0]&0xffffff;
    require(!cpu.fault && cpu.pc==0xdead00 && pointer,"original Building_Create supplies native Starport fixture");
    memcpy(cpu.ram+low,saved_regs.ram+low,stack+20-low);
    memcpy(cpu.d,saved_regs.d,sizeof cpu.d);memcpy(cpu.a,saved_regs.a,sizeof cpu.a);
    cpu.pc=saved_regs.pc;cpu.sr=saved_regs.sr;cpu.usp=saved_regs.usp;cpu.ssp=saved_regs.ssp;
    return pointer&65535;
}
int main(int argc,char **argv){
    require(argc==2,"snapshot path supplied");FILE *f=fopen(argv[1],"rb");
    require(f && fread(&baseline,sizeof baseline,1,f)==1,"original mission snapshot loads");fclose(f);
    DuneView view={0};reset();frames(2);
    for(unsigned i=0;i<4 && dune_mouse_context(&cpu)!=2;++i)world_click(784,1136);
    frames(40);require(dune_mouse_context(&cpu)==2,"native Yard menu opens");
    check_focus(&view,0,0,"Yard EXIT");menu_oracle=cpu;
    selection_beeps=0;
    unsigned money=credits(),product=dune_word(&cpu,0x4eb8+82);
    click(1,1);require(em_web_menu_select.armed && !em_web_menu_select.confirmations &&
        !production_events && credits()==money && dune_word(&cpu,0x4eb8+82)==product && cpu.ram[0x4eb8+3]==255,
        "first Windtrap tap only previews and does not spend or produce");
    require(selection_beeps==1,"first preview plays exactly one native selection sound25");
    check_focus(&view,1,1,"Yard Windtrap preview");
    unsigned beeps_before=selection_beeps,delay=click(2,0);
    require(delay<=4 && selection_beeps==beeps_before+1,"one STOP tap plays native selection25 once without controller latency");
    require(dune_mouse_context(&cpu)==2 && !production_events,"original disabled STOP guard retains menu");
    check_focus(&view,2,0,"Yard disabled STOP");
    beeps_before=selection_beeps;delay=click(1,0);
    require(delay<=4 && selection_beeps==beeps_before+1,"one FIX tap plays native selection25 once without controller latency");
    require(dune_mouse_context(&cpu)==2 && !production_events,"original disabled FIX guard retains menu");
    check_focus(&view,1,0,"Yard disabled FIX");
    click(1,1);check_focus(&view,1,1,"Yard Windtrap preview after commands");
    unsigned confirmations=(unsigned)em_web_menu_select.confirmations,beeps=selection_beeps;
    click(1,1);frames(150);
    require(selection_beeps==beeps,"second tap adds no duplicate selection beep to original purchase audio");
    require(em_web_menu_select.confirmations==confirmations+1 && production_events &&
        dune_word(&cpu,0x4eb8+82)==9 && cpu.ram[0x4eb8+3]!=255 && credits()<money,
        "second Windtrap tap retains exactly one original paid production action");
    puts("PASS native second-tap purchase unchanged by visible focus");

    reset();fixture_starport=create_building(1,11,65535);frames(2);
    for(unsigned i=0;i<4 && dune_mouse_context(&cpu)!=3;++i)world_click(784,1136);
    frames(40);require(dune_mouse_context(&cpu)==3,"native-created Starport menu opens");
    check_focus(&view,0,0,"Starport initial command");
    int cell=-1;
    for(int i=11;i>=0 && cell<0;--i)
        if(em_web_menu_select_purchase(&cpu,3,cpu.ram[0xbfcc+i]))cell=i;
    require(cell>=0,"native Starport grid contains a product");
    money=credits();click(cell%3,cell/3);
    require(em_web_menu_select.armed && !em_web_menu_select.confirmations && credits()==money,
        "Starport first tap retains native information without a purchase");
    check_focus(&view,cell%3,cell/3,"Starport product preview");
    require(selection_beeps==1,"Starport preview also uses exactly one original sound25");
    beeps_before=selection_beeps;delay=click(0,0);
    /* A distant Starport item also refreshes its native info panel before
     * the feedback/A polls: allow its observed five-to-seven-frame native path at different VBlank phases. */
    require(delay<=8 && selection_beeps==beeps_before+1 && em_web_menu_select.confirmations==1,"one Starport EXIT tap plays one native25 then confirms once");
    frames(150);require(dune_mouse_context(&cpu)==1,"one Starport EXIT tap retains original exit action");

    cpu=menu_oracle;memset(&mouse,0,sizeof mouse);modern_input=0;
    selection_beeps=0;cpu.pad_buttons[0]=PAD_RIGHT;frames(10);cpu.pad_buttons[0]=0;frames(60);
    require(dune_word(&cpu,0xbf8c)==0 && dune_word(&cpu,0xbf8a)>0 && selection_beeps==dune_word(&cpu,0xbf8a),"unmodified native pad movement identifies sound25 once per cell transition");
    printf("PASS original pad movement and pointer preview share native sound25 (%u pad transitions), no duplicate purchase beep\n",selection_beeps);
    cpu=menu_oracle;memset(&mouse,0,sizeof mouse);mouse.enabled=1;mouse.context=2;modern_input=1;em_web_menu_select_reset_state();
    selection_beeps=0;production_events=0;delay=click(0,0);
    require(delay<=4 && selection_beeps==1 && em_web_menu_select.confirmations==1,"one Yard EXIT tap plays one native25 then confirms once");
    frames(150);require(dune_mouse_context(&cpu)==1 && !production_events,"Yard EXIT remains one-tap without a production action");
    puts("PASS one-tap EXIT/FIX/STOP feedback uses the original selection25 path");
    cpu=menu_oracle;memset(&mouse,0,sizeof mouse);mouse.enabled=1;mouse.context=2;modern_input=1;em_web_menu_select_reset_state();
    cpu.ram[0xdc51]=0;selection_beeps=0;money=credits();click(1,1);frames(40);
    require(em_web_menu_select.armed && !selection_beeps && credits()==money,"native SFX option suppresses preview beep without a purchase");
    puts("PASS original sound-effects option respected");
    DuneLayout portrait=dune_view_layout(&cpu,390,844,100),landscape=dune_view_layout(&cpu,844,390,100);
    require(fabs(portrait.ui_y+224*portrait.ui_scale-844)<.001,"portrait fallback remains bottom aligned");
    require(fabs(landscape.ui_y-(390-224*landscape.ui_scale)/2)<.001,"landscape remains centred");
    cpu=baseline;cpu.rom=rom_data;cpu.rom_size=sizeof rom_data;cpu.reason=NULL;
    write_mem(&cpu,0xffe002,4,0x6092);write_mem(&cpu,0xffc578,4,0);require(!em_web_cursor_preview(&cpu),"ordinary map cursor remains hidden");
    write_mem(&cpu,0xffc578,4,0xff4eb8);write_mem(&cpu,0xff4ebe,2,0xa000);require(!em_web_cursor_preview(&cpu),"idle-ready building has no placement cursor");
    write_mem(&cpu,0xffc25c,4,0xff220c);require(em_web_cursor_kind(&cpu)==0,"selected unit does not expose the ordinary cursor");
    unsigned marker=dune_word(&cpu,0xbf60);before=cpu;
    (void)em_web_cursor_kind(&cpu);require(dune_word(&cpu,0xbf60)==marker && !memcmp(&before,&cpu,sizeof cpu),"native BF60 selection marker is untouched");
    write_mem(&cpu,0xffc25c,4,0);em_web_present_native_drag=1;require(em_web_cursor_kind(&cpu)==2,"actual drag retains its native coloured footprint");
    puts("PASS map cursor suppression, original selection marker, real-drag footprint, portrait/landscape layout unchanged");
    free(view.shadow);return 0;
}
