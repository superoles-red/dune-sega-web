/* Native integration fixtures for the read-only building UI bridge.
 * Starts come from original campaign loaders; authored extra buildings use
 * original Building_Create in scenario-init mode, never a hand-written menu.
 */
#define GENESIS_NO_MAIN
#ifndef ORACLE_SOURCE
#define ORACLE_SOURCE "../.local/source/build/dune-base.c"
#endif
#include ORACLE_SOURCE
#include "em_web_menu_select.h"
#define EM_WEB_BUILDING_UI_NO_EXPORTS
#include "em_web_building_ui.h"

static CPU c,baseline,original,before;
static DuneMouse mouse;
static unsigned fixture_count;
static unsigned purchase_events,purchased_type,purchased_quantity,delivery_unit;
static void require(int condition,const char *what){if(!condition){fprintf(stderr,"FAIL %s pc=%06x context=%d house=%u producer=%u reason=%s\n",what,c.pc,dune_mouse_context(&c),dune_word(&c,0xc274),dune_long(&c,0xc578),c.reason?c.reason:"none");exit(1);}}
static void observe(void){
    if(c.pc==0x28c2a){unsigned p=c.a[3]&65535;++purchase_events;purchased_type=dune_word(&c,p);purchased_quantity=c.ram[p+2];}
    if(c.pc==0xfcf2&&c.a[0])delivery_unit=c.a[0]&65535;
    if(!em_web_menu_select_observe(&mouse,&c))dune_mouse_observe(&mouse,&c);
}
static void frames(unsigned n){uint64_t end=c.vdp.frames+n;while(!c.fault&&c.vdp.frames<end){observe();machine_step(&c);}require(!c.fault,"original machine remains healthy");}
static void load(const char *directory,unsigned house,unsigned mission){
    char path[4096];snprintf(path,sizeof path,"%s/house%u-mission%02u.cpu.bin",directory,house,mission);FILE*f=fopen(path,"rb");require(f&&fread(&baseline,sizeof baseline,1,f)==1&&fgetc(f)==EOF,"authentic snapshot loads with exact CPU ABI");fclose(f);
    c=baseline;c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.pad_buttons[0]=0;c.audio_mode=AUDIO_MUTE;
    memset(&mouse,0,sizeof mouse);mouse.enabled=1;memset(&em_web_menu_select,0,sizeof em_web_menu_select);
    purchase_events=purchased_type=purchased_quantity=delivery_unit=0;
    require(dune_mouse_context(&c)==1&&dune_word(&c,0xc274)==house,"authentic requested player house/map");
    frames(40);
}
static unsigned building_record(unsigned i){return em_bui_rom_long(&c,0x4a71e + i*4)&65535;}
static unsigned own_building(unsigned type){
    for(unsigned i=0;i<73;++i){unsigned p=building_record(i);if((dune_word(&c,p+4)&3)==3&&c.ram[p+2]==type&&c.ram[p+8]==dune_word(&c,0xc274))return 0xff0000+p;}return 0;
}
static unsigned empty_tile(void){
    int x0=(int)dune_word(&c,0xe3ec)/32+4,y0=(int)dune_word(&c,0xe3ee)/32+3;
    for(int radius=0;radius<=32;++radius)for(int yy=-radius;yy<=radius;++yy)for(int xx=-radius;xx<=radius;++xx){
        if(abs(xx)+abs(yy)!=radius)continue;int x=x0+xx,y=y0+yy;if(x<0||y<0||x>60||y>60)continue;int ok=1;
        for(int dy=0;dy<3;++dy)for(int dx=0;dx<3;++dx){unsigned a=0x7d9c+((y+dy)*64+x+dx)*4;if((c.ram[a+2]&32)&&c.ram[a+3])ok=0;}
        if(ok)return (unsigned)(y*64+x);
    }
    require(0,"free native authored-building site exists");return 0;
}
static unsigned create(unsigned type){
    unsigned index=73;for(unsigned i=0;i<73;++i)if(!(dune_word(&c,building_record(i)+4)&1)){index=i;break;}
    require(index<73,"free original building allocation slot");unsigned tile=empty_tile(),house=dune_word(&c,0xc274),mode=dune_word(&c,0xc148);
    write_mem(&c,0xffc148,2,mode+1);original=c;unsigned stack=0xef00,low=stack;
    c.pc=0xe584;c.sr=0x2700;c.a[7]=0xff0000+stack;write_mem(&c,c.a[7],4,0xdead00);
    write_mem(&c,c.a[7]+4,2,index);write_mem(&c,c.a[7]+6,2,type);write_mem(&c,c.a[7]+8,2,house);write_mem(&c,c.a[7]+10,2,tile);
    unsigned steps=0;while(!c.fault&&c.pc!=0xdead00&&steps++<5000000){if((c.a[7]&65535)<low)low=c.a[7]&65535;translated_step(&c);}
    unsigned p=c.a[0]&0xffffff;require(!c.fault&&c.pc==0xdead00&&p,"original Building_Create returns a building");
    memcpy(c.ram+low,original.ram+low,stack+20-low);memcpy(c.d,original.d,sizeof c.d);memcpy(c.a,original.a,sizeof c.a);
    c.pc=original.pc;c.sr=original.sr;c.usp=original.usp;c.ssp=original.ssp;write_mem(&c,0xffc148,2,mode);
    require(!(dune_word(&c,(p&65535)+4)&4),"authored producer is mapped by original placement");return p;
}
static void open(unsigned producer){
    unsigned p=producer&65535;int wx=(int)dune_word(&c,p+12)/8+8,wy=(int)dune_word(&c,p+10)/8+8;
    for(unsigned i=0;i<8&&dune_mouse_context(&c)!=2&&dune_mouse_context(&c)!=3;++i){dune_mouse_world_click(&mouse,&c,wx,wy,DUNE_CLICK_SELECT);frames(60);}
    frames(40);require((dune_mouse_context(&c)==2||dune_mouse_context(&c)==3)&&dune_long(&c,0xc578)==producer,"original pointer opens the intended producer menu");
}
static unsigned money(void){return dune_long(&c,(dune_long(&c,0xc278)&65535)+18);}
static void dump(const char *directory,const char *stem){
    before=c;DuneMouse mouse_before=mouse;EmWebMenuSelect select_before=em_web_menu_select;
    const char *json=em_web_building_ui_json_for(&c,&em_web_menu_select);
    require(!memcmp(&c,&before,sizeof c)&&!memcmp(&mouse,&mouse_before,sizeof mouse)&&!memcmp(&em_web_menu_select,&select_before,sizeof select_before),"JSON is read-only for whole CPU, mouse and purchase adapter");
    require(!strstr(json,"json-overflow")&&strlen(json)<32768,"bounded JSON report is complete");
    char path[4096];snprintf(path,sizeof path,"%s/%s.json",directory,stem);FILE*f=fopen(path,"w");require(f!=NULL,"JSON output opens");fputs(json,f);fclose(f);
    snprintf(path,sizeof path,"%s/%s.cpu.bin",directory,stem);f=fopen(path,"wb");require(f&&fwrite(&c,sizeof c,1,f)==1,"CPU fixture writes");fclose(f);
    snprintf(path,sizeof path,"%s/%s.rgb",directory,stem);f=fopen(path,"wb");require(f&&fwrite(c.vdp.frame,320*224*3,1,f)==1,"original completed VDP frame writes");fclose(f);
    before=c;mouse_before=mouse;
    require(!em_web_building_ui_tap_for(&c,&mouse,99,dune_long(&c,0xc578),0,0),"stale context is rejected");
    require(!em_web_building_ui_tap_for(&c,&mouse,dune_mouse_context(&c),0,0,0),"stale producer is rejected");
    require(!em_web_building_ui_tap_for(&c,&mouse,dune_mouse_context(&c),dune_long(&c,0xc578),3,0),"outside column rejected");
    require(!memcmp(&c,&before,sizeof c)&&!memcmp(&mouse,&mouse_before,sizeof mouse),"rejected intents alter no CPU or mouse state");
    ++fixture_count;
}
static unsigned tap(int col,int row){
    uint64_t frame=c.vdp.frames,clicks=mouse.clicks;
    require(em_web_building_ui_tap_for(&c,&mouse,dune_mouse_context(&c),dune_long(&c,0xc578),col,row),"bridge queues one actual native pointer intent");
    while(!c.fault&&c.vdp.frames<frame+20&&mouse.clicks==clicks){observe();machine_step(&c);}
    require(!c.fault&&mouse.clicks==clicks+1,"one intent consumes exactly one original mouse event");return (unsigned)(c.vdp.frames-frame);
}
static int cell(int raw){int context=dune_mouse_context(&c),n=context==3?12:18;for(int i=0;i<n;++i)if(em_web_menu_select_item(&c,context,i%3,i/3)==raw)return i;return -1;}
static void purchase_test(const char *source,const char *out,unsigned house){
    load(source,house,1);unsigned yard=own_building(8);require(yard,"authentic house owns its starting Yard");open(yard);
    int chosen=cell(9);require(chosen>=0,"original first mission offers Windtrap");
    unsigned bank=money(),product=dune_word(&c,(yard&65535)+82),paid=c.ram[(yard&65535)+3];uint64_t confirms=em_web_menu_select.confirmations;
    tap(chosen%3,chosen/3);frames(8);require(em_web_menu_select.armed&&em_web_menu_select.confirmations==confirms&&money()==bank&&dune_word(&c,(yard&65535)+82)==product&&c.ram[(yard&65535)+3]==paid,"first bridge tap only previews; no original payment/production");
    char stem[96];snprintf(stem,sizeof stem,"house%u-windtrap-preview",house);dump(out,stem);
    tap(chosen%3,chosen/3);frames(150);require(em_web_menu_select.confirmations==confirms+1&&dune_word(&c,(yard&65535)+82)==9&&c.ram[(yard&65535)+3]!=255&&money()<bank,"second bridge tap starts and pays real original Windtrap production");
    open(yard);chosen=cell(-3);require(chosen>=0,"original in-progress production enables STOP");confirms=em_web_menu_select.confirmations;
    tap(chosen%3,chosen/3);frames(150);require(em_web_menu_select.confirmations==confirms+1&&dune_mouse_context(&c)==1&&c.ram[(yard&65535)+3]==255,"one STOP bridge tap cancels original production");
    printf("PASS house%u first/second Windtrap and immediate native STOP\n",house);
}
static void upgrade_test(const char *source,const char *out,unsigned house){
    load(source,house,2);create(18);unsigned factory=create(10),p=factory&65535;frames(2);open(factory);
    int chosen=cell(27);require(chosen>=0,"native Barracks with real Outpost prerequisite offers Upgrade");
    unsigned bank=money(),level=c.ram[p+84],flags=dune_word(&c,p+6);uint64_t confirms=em_web_menu_select.confirmations;
    tap(chosen%3,chosen/3);frames(8);
    require(em_web_menu_select.armed&&em_web_menu_select.confirmations==confirms&&money()==bank&&dune_word(&c,p+6)==flags,"first Upgrade bridge tap previews without spending or native upgrade flag");
    char stem[96];snprintf(stem,sizeof stem,"house%u-upgrade-preview",house);dump(out,stem);
    tap(chosen%3,chosen/3);frames(400);
    require(em_web_menu_select.confirmations==confirms+1&&!em_web_menu_select.armed&&money()<bank&&c.ram[p+84]==level+1,"second Upgrade bridge tap performs original paid upgrade and reaches next level");
    printf("PASS house%u native Upgrade level %u -> %u, actual credits %u -> %u\n",house,level,c.ram[p+84],bank,money());
}
static void repair_test(const char *source,const char *out,unsigned house){
    load(source,house,2);unsigned building=create(9),p=building&65535,hp=dune_word(&c,p+18);
    /* Controlled damage changes only the offline fixture, before native menu
     * construction. Original FIX eligibility, repair ticks and spending run. */
    require(hp>100,"native Windtrap has room for controlled fixture damage");write_mem(&c,0xff0000+p+18,2,hp-100);frames(2);open(building);
    int chosen=cell(-2);require(chosen>=0,"original damaged Windtrap offers enabled FIX");
    char stem[96];snprintf(stem,sizeof stem,"house%u-repair-ready",house);dump(out,stem);
    unsigned bank=money(),damaged=dune_word(&c,p+18);uint64_t confirms=em_web_menu_select.confirmations;
    tap(chosen%3,chosen/3);frames(150);
    require(em_web_menu_select.confirmations==confirms+1&&!em_web_menu_select.armed&&dune_mouse_context(&c)==1&&dune_word(&c,p+18)>damaged&&money()<bank,"one FIX bridge tap enters native repair, restores HP and spends original credits");
    printf("PASS house%u native FIX hp %u -> %u, actual credits %u -> %u\n",house,damaged,dune_word(&c,p+18),bank,money());
}
static void starport_test(const char *source,const char *out,unsigned house){
    load(source,house,9);unsigned port=create(11);frames(2);open(port);
    int chosen=-1,locked=-1;unsigned record=0;
    for(int i=11;i>=0;--i){int raw=em_web_menu_select_item(&c,3,i%3,i/3);unsigned r=em_bui_stock_record(&c,raw);if(r&&(int8_t)c.ram[r+3]<0){locked=i;break;}}
    if(locked>=0){
        unsigned bank=money();uint64_t confirms=em_web_menu_select.confirmations;
        tap(locked%3,locked/3);frames(8);require(em_web_menu_select.armed&&money()==bank&&em_web_menu_select.confirmations==confirms,"native locked Starport first tap still previews");
        char stem[96];snprintf(stem,sizeof stem,"house%u-starport-locked-preview",house);dump(out,stem);
        tap(locked%3,locked/3);frames(8);require(!em_web_menu_select.armed&&money()==bank&&dune_mouse_context(&c)==3&&em_web_menu_select.confirmations==confirms+1,"original locked Starport stock guard rejects the confirmed action");
    }
    for(int i=11;i>=0;--i){int raw=em_web_menu_select_item(&c,3,i%3,i/3);unsigned r=em_bui_stock_record(&c,raw);if(raw!=1&&r&&(int8_t)c.ram[r+3]>0&&dune_word(&c,r+4)<=money()){chosen=i;record=r;break;}}
    require(chosen>=0,"original Starport offers an affordable stocked native unit");
    unsigned bank=money(),price=dune_word(&c,record+4),stock=c.ram[record+3],ordered=c.ram[record+2];uint64_t confirms=em_web_menu_select.confirmations;
    tap(chosen%3,chosen/3);frames(8);
    require(em_web_menu_select.armed&&em_web_menu_select.confirmations==confirms&&money()==bank&&c.ram[record+3]==stock&&c.ram[record+2]==ordered,"first Starport bridge tap previews without changing credits, basket or stock");
    char stem[96];snprintf(stem,sizeof stem,"house%u-starport-preview",house);dump(out,stem);
    tap(chosen%3,chosen/3);frames(8);
    require(!em_web_menu_select.armed&&em_web_menu_select.confirmations==confirms+1&&money()==bank-price&&c.ram[record+3]==stock-1&&purchase_events==1&&purchased_type==dune_word(&c,record)&&purchased_quantity==ordered+1,"second Starport bridge tap spends exact live price and changes original stock/basket once before native delivery clears it");
    require(delivery_unit&&c.ram[delivery_unit+2]==purchased_type&&c.ram[delivery_unit+8]==house&&dune_word(&c,delivery_unit+18)>0,"original Starport delivery creates the real purchased unit for the real player house");
    snprintf(stem,sizeof stem,"house%u-starport-purchased",house);dump(out,stem);
    printf("PASS house%u native Starport type%u price%u, actual credits %u -> %u, stock %u -> %u\n",house,dune_word(&c,record),price,bank,money(),stock,c.ram[record+3]);
}
int main(int argc,char **argv){
    if(argc!=3){fprintf(stderr,"usage: %s authentic-campaign-fixture-directory output-directory\n",argv[0]);return 2;}
    const unsigned types[]={2,3,4,5,7,8,9,10,11,12,13,15,16,17,18};
    for(unsigned house=0;house<3;++house){
        for(unsigned ti=0;ti<sizeof types/sizeof types[0];++ti){
            unsigned type=types[ti];load(argv[1],house,9);
            unsigned producer=type==8?own_building(8):0;if(!producer)producer=create(type);open(producer);
            require(c.ram[0xbf85]==type,"original menu producer type matches");
            if(type==11)require(dune_mouse_context(&c)==3,"original Starport uses its 12-cell context");else require(dune_mouse_context(&c)==2,"original building uses its 18-cell context");
            char stem[96];snprintf(stem,sizeof stem,"house%u-building%02u",house,type);dump(argv[2],stem);
            printf("PASS %s context=%d raw=%d mode=%u cells=%u\n",stem,dune_mouse_context(&c),em_web_menu_select_item(&c,dune_mouse_context(&c),0,0),c.ram[0xc614],type==11?12:18);
        }
        purchase_test(argv[1],argv[2],house);
        upgrade_test(argv[1],argv[2],house);
        repair_test(argv[1],argv[2],house);
        starport_test(argv[1],argv[2],house);
    }
    printf("PASS %u native UI fixtures, whole-state read-only checks, guarded original pointer intents and all-house paid production paths\n",fixture_count);
    return 0;
}
