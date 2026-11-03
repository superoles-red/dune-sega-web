/* Read-only live native building/shop UI bridge.
 * Include after em_web_menu_select.h in the browser host section. It exposes
 * original cells, records and completed VDP RGB pixels; it does not calculate
 * a new catalogue, write money/stock, simulate a purchase or alter native code.
 * Define EM_WEB_BUILDING_UI_NO_EXPORTS for portable native fixture tests.
 */
#ifndef DUNE_EM_WEB_BUILDING_UI_H
#define DUNE_EM_WEB_BUILDING_UI_H
#include <stdint.h>
#include <stddef.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>

static const char *const em_bui_building_keys[19]={
    "concrete-1","concrete-4","palace","light-vehicle","heavy-vehicle","hi-tech","ix","wor",
    "construction-yard","windtrap","barracks","starport","refinery","repair","wall","turret","rocket-turret","silo","outpost"};
static const char *const em_bui_unit_keys[27]={
    "carryall","ornithopter","infantry","troopers","soldier","trooper","saboteur","launcher","deviator","tank","siege-tank","devastator","sonic-tank","trike","raider-trike","quad","harvester","mcv","death-hand","rocket","turret-rocket","deviator-rocket","mini-rocket","bullet","sonic-blast","sandworm","frigate"};
typedef struct {char *buffer;size_t capacity,length;int failed;} EmBuiJson;
static void em_bui_append(EmBuiJson *j,const char *fmt,...){
    if(j->failed)return;
    va_list args;va_start(args,fmt);int n=vsnprintf(j->buffer+j->length,j->capacity-j->length,fmt,args);va_end(args);
    if(n<0||(size_t)n>=j->capacity-j->length){j->failed=1;return;}j->length+=(size_t)n;
}
static void em_bui_string(EmBuiJson *j,const char *s){
    em_bui_append(j,"\"");
    for(unsigned i=0;s&&s[i]&&i<128;++i){unsigned ch=(unsigned char)s[i];
        if(ch=='"'||ch=='\\')em_bui_append(j,"\\%c",ch);
        else if(ch<32)em_bui_append(j,"\\u%04x",ch);else em_bui_append(j,"%c",ch);
    }
    em_bui_append(j,"\"");
}
static unsigned em_bui_rom_word(const CPU *c,unsigned at){
    return at+1<c->rom_size?((unsigned)c->rom[at]<<8)|c->rom[at+1]:0;
}
static uint32_t em_bui_rom_long(const CPU *c,unsigned at){
    return (em_bui_rom_word(c,at)<<16)|em_bui_rom_word(c,at+2);
}
static unsigned em_bui_definition(const CPU *c,int building,int id){
    if(id<0||id>=(building?19:27))return 0;
    unsigned at=em_bui_rom_long(c,(building?0x6b954:0x6c5bc)+(unsigned)id*4);
    return at&&at+102<c->rom_size?at:0;
}
static void em_bui_name(const CPU *c,unsigned definition,char name[96]){
    if(!definition){name[0]=0;return;}
    unsigned at=definition?em_bui_rom_long(c,definition+2):0,i=0;
    while(at+i<c->rom_size&&i<95&&c->rom[at+i]){name[i]=(char)c->rom[at+i];++i;}
    while(i&&name[i-1]==' ')--i;name[i]=0;
}
static int em_bui_ram_pointer(uint32_t p,unsigned bytes){return p>=0xff0000u&&p<=0x1000000u-bytes;}
static void em_bui_text(const CPU *c,unsigned at,unsigned length,char text[96]){
    unsigned i=0;
    for(;i<length&&i<95&&at+i<65536;++i){unsigned ch=c->ram[at+i];if(!ch)break;text[i]=(char)ch;}
    while(i&&text[i-1]==' ')--i;text[i]=0;
}
static const char *em_bui_command_key(int context,int raw){
    if(context==3){switch(raw){case 28:return "exit";case 29:case 31:return "repair";case 30:case 32:return "stop";case 27:return "send-order";default:return "native-command";}}
    switch(raw){case -1:return "exit";case -2:case -4:return "repair";case -3:case -5:return "stop";default:return "native-command";}
}
static const char *em_bui_command_name(int context,int raw){
    const char *key=em_bui_command_key(context,raw);
    return !strcmp(key,"exit")?"EXIT":!strcmp(key,"repair")?"FIX":!strcmp(key,"stop")?"STOP":!strcmp(key,"send-order")?"Send Order":"Native command";
}
static int em_bui_explicit_disabled(int context,int raw){return context==3?(raw==31||raw==32):(raw==-4||raw==-5);}
static unsigned em_bui_stock_record(const CPU *c,int raw){
    if(raw<0||raw>=27)return 0;
    for(unsigned i=0;i<9;++i){unsigned p=0xc2d8+i*12;if(dune_word(c,p)==(unsigned)raw)return p;}
    return 0;
}
static int em_bui_preview_armed(const CPU *c,const EmWebMenuSelect *s,int context,unsigned col,unsigned row,int raw){
    return s&&s->armed&&s->cpu==c&&s->context==context&&s->producer==dune_long(c,0xc578)&&
        s->armed_cell==(int)(row*3+col)&&s->armed_item==raw;
}
/* UI palette lanes 1/3 are fixed native menu palettes. A completed raster must
 * also contain the current chrome, rather than the preceding fade/title frame.
 * These points lie on static body pixels, away from lamps, focus and portraits. */
static int em_bui_presentation_ready(const CPU *c){
    if(c->vdp.frame_width!=320||c->vdp.frame_height!=224||c->vdp.render_unsupported||!(c->vdp.registers[1]&0x40))return 0;
    for(unsigned lane=1;lane<=3;lane+=2)for(unsigned i=0;i<16;++i)
        if(c->vdp.cram[lane*16+i]!=em_bui_rom_word(c,0xa6c98+(lane*16+i)*2))return 0;
    static const unsigned points[][2]={{140,56},{140,80},{140,120},{144,192},{312,80}};
    for(unsigned i=0;i<sizeof points/sizeof points[0];++i){unsigned x=points[i][0],y=points[i][1],b=vdp_plane_pixel(&c->vdp,1,x,y),a=vdp_window_at(&c->vdp,x,y)?vdp_window_pixel(&c->vdp,x,y,1):vdp_plane_pixel(&c->vdp,0,x,y),p=(y*320+x)*3;
        unsigned chosen=b&15?b:0;if((a&15)&&((a&128)||!(chosen&128)))chosen=a;
        unsigned color=c->vdp.cram[(chosen&15)?chosen&63:c->vdp.registers[7]&63];
        if(c->vdp.frame[p]!=vdp_channel((color>>1)&7,1)||c->vdp.frame[p+1]!=vdp_channel((color>>5)&7,1)||c->vdp.frame[p+2]!=vdp_channel((color>>9)&7,1))return 0;
    }
    return 1;
}
/* Bounded, read-only LCW expansion of the actual original monitor resource.
 * No CPU shadow, VDP writes, mutable RAM scratch or instruction changes. */
static unsigned em_bui_monitor_patterns(const CPU *c,unsigned record,uint8_t out[4096]){
    unsigned at=record+202,n=0;
    while(at<c->rom_size&&n<4096){unsigned code=c->rom[at++],count,offset;
        if(code==0x80)return n;
        if(code<0x80){if(at>=c->rom_size)return 0;count=(code>>4)+3;offset=((code&15)<<8)|c->rom[at++];if(!offset||offset>n||count>4096-n)return 0;for(unsigned i=0;i<count;i++){out[n]=out[n-offset];++n;}}
        else if(code==0xfe){if(at+3>c->rom_size)return 0;count=c->rom[at]|(c->rom[at+1]<<8);unsigned value=c->rom[at+2];at+=3;if(count>4096-n)return 0;memset(out+n,value,count);n+=count;}
        else if(code&0x40){if(at+(code==0xff?4u:2u)>c->rom_size)return 0;count=code==0xff?(unsigned)c->rom[at]|((unsigned)c->rom[at+1]<<8):(code&63)+3;if(code==0xff)at+=2;offset=c->rom[at]|(c->rom[at+1]<<8);at+=2;if(offset>=n||count>4096-n)return 0;for(unsigned i=0;i<count;i++){out[n++]=out[offset++];}}
        else{count=code&63;if(at+count>c->rom_size||count>4096-n)return 0;memcpy(out+n,c->rom+at,count);n+=count;at+=count;}
    }return 0;
}
static unsigned em_bui_upgrade_monitor_record(const CPU *c){
    if(dune_mouse_context(c)!=2||!dune_long(c,0xc61c))return 0;
    unsigned col=dune_word(c,0xbf8a),row=dune_word(c,0xbf8c);if(col>=3||row>=6)return 0;
    if(em_web_menu_select_item(c,2,(int)col,(int)row)!=(int)c->ram[0xc618])return 0;
    unsigned id=c->ram[0xbfa0],building=!!c->ram[0xc614];if(id>=(building?19u:27u))return 0;
    unsigned record=em_bui_rom_long(c,(building?0x882a4:0x8f1d0)+id*4);
    return record&&record!=0x95cd8&&record+202<c->rom_size?record:0;
}
static const uint8_t *em_bui_frame_rgb_for(const CPU *c){
    static uint8_t frame[320*224*3],patterns[4096];static unsigned cached_record,cached_length;
    if(!em_bui_presentation_ready(c))return NULL;
    unsigned record=em_bui_upgrade_monitor_record(c);if(!record)return c->vdp.frame;
    if(record!=cached_record){cached_length=em_bui_monitor_patterns(c,record,patterns);cached_record=record;}if(!cached_length)return c->vdp.frame;
    /* The native Upgrade/Infantry frame contains 180 stale leading VRAM bytes
     * in the captured original runtime. Reassemble only its monitor rectangle
     * from its actual ROM patterns/map and CURRENT native CRAM0. Every other
     * frame pixel, sprite phase and gameplay byte remains unchanged. */
    for(unsigned ty=0;ty<7;++ty)for(unsigned tx=0;tx<12;++tx){unsigned expected=(em_bui_rom_word(c,record+32+(ty*12+tx)*2)+0x380)&0x9fff,sx,sy,x=160+tx*8,y=40+ty*8,at=vdp_plane_address(&c->vdp,0,x,y,&sx,&sy);if(vdp_window_at(&c->vdp,x,y))at=((c->vdp.registers[3]&0x3c)<<10)+((y/8)*64+x/8)*2;if(vdp_word(&c->vdp,at)!=expected)return c->vdp.frame;}
    memcpy(frame,c->vdp.frame,sizeof frame);
    for(unsigned y=0;y<56;++y)for(unsigned x=0;x<96;++x){unsigned entry=em_bui_rom_word(c,record+32+((y/8)*12+x/8)*2),xx=entry&0x800?7-(x&7):x&7,yy=entry&0x1000?7-(y&7):y&7,at=(entry&2047)*32+yy*4+xx/2;if(at>=cached_length)return c->vdp.frame;
        unsigned byte=patterns[at],index=xx&1?byte&15:byte>>4,color=c->vdp.cram[index],to=((y+40)*320+x+160)*3;
        frame[to]=vdp_channel((color>>1)&7,1);frame[to+1]=vdp_channel((color>>5)&7,1);frame[to+2]=vdp_channel((color>>9)&7,1);
    }return frame;
}
/* The outer transition may freeze after the native callback has left its
 * building context. Preserve the actually published corrected monitor frame,
 * rather than reintroduce the raw Upgrade-strip pixels during that interval. */
static const uint8_t *em_bui_present_frame_for(const CPU*c){
    int context=dune_mouse_context(c);
#ifdef DUNE_EM_WEB_FRAME_H
    static uint8_t published[320*224*3];static const CPU*owner;static uint32_t producer;
    static unsigned house,mission;static uint64_t frame;static int valid;
    if(owner==c&&c->vdp.frames<frame)valid=0;
    if(em_web_frame_hold_active(c)){
        if(valid&&owner==c&&house==dune_word(c,0xc274)&&mission==dune_word(c,0xc050)&&
           (producer==dune_long(c,0xc578)||context==0))return published;
        return em_web_frame_present(c);
    }
#endif
    const uint8_t*rgb=context==2||context==3?em_bui_frame_rgb_for(c):NULL;
#ifdef DUNE_EM_WEB_FRAME_H
    if(rgb){memcpy(published,rgb,sizeof published);owner=c;producer=dune_long(c,0xc578);house=dune_word(c,0xc274);mission=dune_word(c,0xc050);frame=c->vdp.frames;valid=1;}
#endif
    return rgb;
}

/* One native queued pointer release. Explicitly disabled commands and sold-out
 * products remain clickable: their first tap can show information and their
 * actual action is still accepted/rejected by original game instructions.
 */
static int em_web_building_ui_tap_for(CPU *c,DuneMouse *m,int expected_context,uint32_t expected_producer,int col,int row){
    int context=dune_mouse_context(c),rows=context==3?4:6;
    if(!m||!m->enabled||(context!=2&&context!=3)||context!=expected_context||
       dune_long(c,0xc578)!=expected_producer||col<0||col>=3||row<0||row>=rows||(m->context==context&&m->count>=8))return 0;
    unsigned raw=c->ram[(context==3?0xbfcc:0xbf8e)+row*3+col];
    if(raw==(unsigned)(context==3?255:128))return 0;
    unsigned before=m->context==context?m->count:0;
    dune_mouse_click(m,c,48+32*col,60+24*row,DUNE_CLICK_SELECT);
    return m->count>before;
}

static const char *em_web_building_ui_json_for(const CPU *c,const EmWebMenuSelect *selection){
    static char result[32768];EmBuiJson j={result,sizeof result,0,0};
    int context=dune_mouse_context(c),active=context==2||context==3;
    uint32_t producer=dune_long(c,0xc578),house=dune_long(c,0xc278);
    unsigned pa=producer&65535,ha=house&65535;
    int producer_valid=em_bui_ram_pointer(producer,98);
    unsigned type=producer_valid?c->ram[pa+2]:65535;
    unsigned pd=em_bui_definition(c,1,(int)type);
    char producer_name[96];em_bui_name(c,pd,producer_name);
    uint32_t credits=em_bui_ram_pointer(house,70)?dune_long(c,ha+18):0;
    unsigned col=active?dune_word(c,context==3?0xbfc8:0xbf8a):0,row=active?dune_word(c,context==3?0xbfca:0xbf8c):0;
    unsigned rows=context==3?4:6,count=active?rows*3:0;
    int selected=active&&col<3&&row<rows?(int)(row*3+col):-1;
    int selected_raw=selected>=0?em_web_menu_select_item(c,context,(int)col,(int)row):-999;
    int armed=selected>=0&&em_bui_preview_armed(c,selection,context,col,row,selected_raw);
    int building_mode=!!c->ram[0xc614];
    const char *kind=context==3?"starport":type==8?"construction-yard":type==2?"palace":dune_long(c,0xc61c)?"production":"building";
    em_bui_append(&j,"{\"version\":1,\"active\":%s,\"context\":%d,\"menuKind\":",active?"true":"false",context);em_bui_string(&j,kind);
    em_bui_append(&j,",\"creditsActual\":%u,\"creditsDisplayed\":%u,\"creditsCounter\":%u,\"creditsVelocity\":%d,\"playerHouse\":%u,\"nativeFrameId\":%llu,\"nativeGameFrame\":%llu,\"nativeStep\":%llu,\"rows\":%u,\"columns\":3,\"selectedIndex\":%d,\"selectedCol\":%u,\"selectedRow\":%u,\"selectedRaw\":%d,\"previewArmed\":%s,\"buildingMode\":%s,\"productTable\":%u,\"upgradeBoundary\":%u,\"upgradeTarget\":%u,\"orderTotal\":%u,\"frame\":{\"width\":320,\"height\":224,\"channels\":3,\"bytes\":215040,\"ready\":%s},\"producer\":{\"pointer\":%u,\"id\":%u,\"type\":%u,\"house\":%u,\"key\":",credits,dune_long(c,0xc058),dune_long(c,0xd6c0),(int32_t)dune_long(c,0xd6bc),dune_word(c,0xc274),(unsigned long long)c->vdp.rendered_frames,(unsigned long long)c->vdp.frames,(unsigned long long)c->steps,active?rows:0,selected,col,row,selected_raw,armed?"true":"false",building_mode?"true":"false",dune_long(c,0xc61c),c->ram[0xc618],c->ram[0xbfa0],dune_word(c,0xbff4),active&&em_bui_presentation_ready(c)?"true":"false",producer,producer_valid?dune_word(c,pa):65535,type,producer_valid?c->ram[pa+8]:65535);
    em_bui_string(&j,type<19?em_bui_building_keys[type]:"unknown");em_bui_append(&j,",\"name\":");em_bui_string(&j,producer_name);
    em_bui_append(&j,",\"hp\":%u,\"maxHp\":%u,\"power\":%d,\"product\":%u,\"productionIndex\":%u,\"flags4\":%u,\"flags6\":%u,\"upgradeLevel\":%u,\"upgradeRemainingRaw\":%u,\"statusTimerRaw\":%u},\"sourceRects\":{\"portrait\":{\"x\":160,\"y\":40,\"w\":96,\"h\":56},\"name\":{\"x\":160,\"y\":104,\"w\":96,\"h\":8},\"creditsWindow\":{\"x\":224,\"y\":8,\"w\":80,\"h\":16},\"price\":{\"x\":192,\"y\":128,\"w\":64,\"h\":8},\"secondary\":{\"x\":192,\"y\":160,\"w\":64,\"h\":8},\"hp\":{\"x\":192,\"y\":192,\"w\":64,\"h\":8},\"priceIcon\":{\"x\":156,\"y\":116,\"w\":24,\"h\":24},\"secondaryIcon\":{\"x\":156,\"y\":148,\"w\":24,\"h\":24},\"hpIcon\":{\"x\":156,\"y\":180,\"w\":24,\"h\":24},\"priceMeter\":{\"x\":188,\"y\":124,\"w\":80,\"h\":16},\"secondaryMeter\":{\"x\":188,\"y\":156,\"w\":80,\"h\":16},\"hpMeter\":{\"x\":188,\"y\":188,\"w\":80,\"h\":16}},\"detailTexts\":{",producer_valid?dune_word(c,pa+18):0,pd?em_bui_rom_word(c,pd+16):0,pd?(int16_t)em_bui_rom_word(c,pd+58):0,producer_valid?dune_word(c,pa+82):65535,producer_valid?c->ram[pa+3]:255,producer_valid?dune_word(c,pa+4):0,producer_valid?dune_word(c,pa+6):0,producer_valid?c->ram[pa+84]:0,producer_valid?c->ram[pa+85]:0,producer_valid?dune_word(c,pa+78):0);
    const char *text_keys[4]={"name","price","secondary","hp"};const unsigned text_offsets[4]={0xc5b0,0xc5bc,0xc5c4,0xc5cc};
    for(unsigned i=0;i<4;++i){char text[96];em_bui_text(c,text_offsets[i],i?8:12,text);em_bui_append(&j,"%s\"%s\":",i?",":"",text_keys[i]);em_bui_string(&j,text);}
    /* The native menu SAT mapping $6A7EE displays six glyph cells at x248,
     * y16. $A5DA's ASCII cache starts at C85A; keep its full eight-byte cache
     * separately for diagnostics when an unusually large value overflows the
     * original six-cell display. The visible string is not C058's floor. */
    char cash_text[96],cash_cache[96];em_bui_text(c,0xc85a,6,cash_text);em_bui_text(c,0xc85a,8,cash_cache);
    em_bui_append(&j,"},\"creditsText\":");em_bui_string(&j,cash_text);
    em_bui_append(&j,",\"creditsGlyphCache\":");em_bui_string(&j,cash_cache);
    em_bui_append(&j,",\"creditsGlyphRect\":{\"x\":248,\"y\":16,\"w\":48,\"h\":8}");
    em_bui_append(&j,",\"paletteCram\":[");for(unsigned i=0;i<64;++i)em_bui_append(&j,"%s%u",i?",":"",c->vdp.cram[i]);
    em_bui_append(&j,"],\"cells\":[");
    for(unsigned index=0;index<count;++index){
        unsigned cr=index/3,cc=index%3;int raw=em_web_menu_select_item(c,context,(int)cc,(int)cr);
        int empty=context==3?raw==255:raw==-128;
        int upgrade=!empty&&context==2&&dune_long(c,0xc61c)&&raw==(int)c->ram[0xc618];
        int product=!empty&&!upgrade&&(context==3?(raw>=0&&raw<27):(dune_long(c,0xc61c)&&raw>=0&&raw<(int)c->ram[0xc618]));
        int item_building=context==3?0:building_mode;
        unsigned definition=product?em_bui_definition(c,item_building,raw):0;
        unsigned stock_record=context==3?em_bui_stock_record(c,raw):0;
        int stock=stock_record?(int8_t)c->ram[stock_record+3]:-999;
        int explicit_disabled=em_bui_explicit_disabled(context,raw);
        int disabled=explicit_disabled||(context==3&&product&&stock_record&&stock<=0);
        int catalog_available=!empty&&!disabled&&!(context==3&&product&&!stock_record);
        const char *cell_kind=empty?"empty":upgrade?"upgrade":product?(item_building?"building":"unit"):"command";
        const char *key=empty?"empty":upgrade?"upgrade":product?(item_building?em_bui_building_keys[raw]:em_bui_unit_keys[raw]):em_bui_command_key(context,raw);
        char name[96];if(definition)em_bui_name(c,definition,name);else snprintf(name,sizeof name,"%s",empty?"":upgrade?"* Upgrade *":em_bui_command_name(context,raw));
        int cost=context==3&&product?(stock_record?(int)dune_word(c,stock_record+4):-1):definition?(int)em_bui_rom_word(c,definition+22):upgrade&&pd?(int)em_bui_rom_word(c,pd+22)/2:-1;
        em_bui_append(&j,"%s{\"index\":%u,\"row\":%u,\"col\":%u,\"raw\":%d,\"kind\":",index?",":"",index,cr,cc,raw);em_bui_string(&j,cell_kind);
        em_bui_append(&j,",\"key\":");em_bui_string(&j,key);em_bui_append(&j,",\"name\":");em_bui_string(&j,name);
        em_bui_append(&j,",\"visible\":%s,\"clickable\":%s,\"available\":%s,\"disabled\":%s,\"explicitDisabledCommand\":%s,\"selected\":%s,\"previewArmed\":%s,\"nativeGuardsRemainAuthoritative\":true,\"id\":",empty?"false":"true",empty?"false":"true",catalog_available?"true":"false",disabled?"true":"false",explicit_disabled?"true":"false",(int)index==selected?"true":"false",em_bui_preview_armed(c,selection,context,cc,cr,raw)?"true":"false");
        if(product)em_bui_append(&j,"%d",raw);else em_bui_append(&j,"null");
        em_bui_append(&j,",\"portraitId\":");if(product||upgrade)em_bui_append(&j,"%u",upgrade?c->ram[0xbfa0]:(unsigned)raw);else em_bui_append(&j,"null");
        em_bui_append(&j,",\"portraitKind\":");em_bui_string(&j,item_building?"building":"unit");
        em_bui_append(&j,",\"cost\":");if(cost>=0)em_bui_append(&j,"%d",cost);else em_bui_append(&j,"null");
        em_bui_append(&j,",\"costSource\":");em_bui_string(&j,stock_record?"native-starport-record+4":context==3&&product?"native-starport-record-not-ready":definition?"original-ROM-definition+22":upgrade?"native-half-producer-cost":"native-command-no-fixed-purchase-price");
        em_bui_append(&j,",\"affordable\":");if(cost>=0)em_bui_append(&j,"%s",credits>=(unsigned)cost?"true":"false");else em_bui_append(&j,"null");
        em_bui_append(&j,",\"power\":");if(definition&&item_building)em_bui_append(&j,"%d",(int16_t)em_bui_rom_word(c,definition+58));else em_bui_append(&j,"null");
        em_bui_append(&j,",\"hp\":");if(definition)em_bui_append(&j,"%u",em_bui_rom_word(c,definition+16));else if(upgrade)em_bui_append(&j,"0");else em_bui_append(&j,"null");
        em_bui_append(&j,",\"damage\":");if(definition&&!item_building)em_bui_append(&j,"%u",em_bui_rom_word(c,definition+84));else if(upgrade)em_bui_append(&j,"0");else em_bui_append(&j,"null");
        em_bui_append(&j,",\"stock\":");if(stock_record)em_bui_append(&j,"%d",stock);else em_bui_append(&j,"null");
        em_bui_append(&j,",\"ordered\":");if(stock_record)em_bui_append(&j,"%u",c->ram[stock_record+2]);else em_bui_append(&j,"null");
        em_bui_append(&j,",\"count\":");if(stock_record)em_bui_append(&j,"%u",c->ram[stock_record+2]);else em_bui_append(&j,"null");
        em_bui_append(&j,",\"unit\":");
        if(definition&&!item_building)em_bui_append(&j,"{\"range\":%u,\"fireDelay\":%u,\"movementType\":%u,\"speedFactor\":%u,\"turningSpeed\":%u,\"damage\":%u}",em_bui_rom_word(c,definition+82),em_bui_rom_word(c,definition+80),em_bui_rom_word(c,definition+62),em_bui_rom_word(c,definition+66),em_bui_rom_word(c,definition+68),em_bui_rom_word(c,definition+84));else em_bui_append(&j,"null");
        em_bui_append(&j,",\"sourceRect\":{\"x\":%u,\"y\":%u,\"w\":32,\"h\":24}}",32+cc*32,48+cr*24);
    }
    em_bui_append(&j,"],\"semantics\":{\"clickable\":\"All nonempty native cells, including disabled commands and sold-out items, can be sent to the original pointer adapter. Never use affordable or available to bypass native guards.\",\"secondary\":\"Building info uses negative signed power as its displayed second number; unit info uses damage. The live native glyph crop is authoritative.\",\"frame\":\"Completed original native VDP RGB frame with original focus, palette, counters and animations. Copy the returned bytes before another game frame.\"}}");
    if(j.failed)snprintf(result,sizeof result,"{\"version\":1,\"active\":false,\"error\":\"building-ui-json-overflow\"}");
    return result;
}

#ifndef EM_WEB_BUILDING_UI_NO_EXPORTS
EMSCRIPTEN_KEEPALIVE const char *dune_web_building_ui_json(void){return em_web_building_ui_json_for(&em_cpu,&em_web_menu_select);}
EMSCRIPTEN_KEEPALIVE int dune_web_building_ui_tap(int col,int row){
    if(!em_window||em_host.paused||em_host.stopped)return 0;
    return em_web_building_ui_tap_for(&em_cpu,&em_host.dune_mouse,dune_mouse_context(&em_cpu),dune_long(&em_cpu,0xc578),col,row);
}
EMSCRIPTEN_KEEPALIVE int dune_web_building_ui_tap_checked(int context,uint32_t producer,int col,int row){
    if(!em_window||em_host.paused||em_host.stopped)return 0;
    return em_web_building_ui_tap_for(&em_cpu,&em_host.dune_mouse,context,producer,col,row);
}
EMSCRIPTEN_KEEPALIVE const uint8_t *dune_web_building_ui_frame_rgb(void){
    return em_bui_present_frame_for(&em_cpu);
}
#endif
#endif
