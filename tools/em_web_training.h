/* Read-only observer for the separate authored Harkonnen native tutorial.
 * Include after em_web_building_ui.h. No observer installs gameplay state.
 * The host's trainingMode owns UI/save isolation; this report cannot enable it.
 */
#ifndef DUNE_EM_WEB_TRAINING_H
#define DUNE_EM_WEB_TRAINING_H
#define EM_TRAINING_TANK_ID 43u
#define EM_TRAINING_HARVESTER_ID 44u
#define EM_TRAINING_ENEMY_ID 45u
static unsigned em_training_unit(unsigned id){return 0xff1000u+id*140u;}
static int em_training_alive(const CPU*c,unsigned pointer,int building){
 unsigned a=pointer&65535,flags=dune_word(c,a+4);return pointer>=0xff1000u&&pointer<=0xffff00u&&(building?(flags&7)==3:(flags&1))&&dune_word(c,a+18)>0&&dune_word(c,a)==(building?(a-0x4eb8)/98u:(a-0x1000)/140u);
}
static unsigned em_training_owned_building(const CPU*c,unsigned type){
 unsigned owner=dune_word(c,0xc274);
 for(unsigned i=0;i<73;i++){unsigned p=em_bui_rom_long(c,0x4a71e + i*4);if(em_training_alive(c,p,1)&&c->ram[(p&65535)+2]==type&&c->ram[(p&65535)+8]==owner)return p;}return 0;
}
/* Exact read-only table operations of native terrain classifier $0057EA. */
static unsigned em_training_terrain(const CPU*c,unsigned tile){
 if(tile>=4096||c->rom_size<0x58300)return 65535;
 unsigned a=0x7d9c+tile*4,kind=c->rom[0x581c+(dune_word(c,a)&511)],overlay=c->rom[0x581c+((c->ram[a]>>1)&127)];return overlay==13?overlay:kind;
}
static void em_training_object(EmBuiJson*j,const CPU*c,unsigned pointer,int building){
 unsigned a=pointer&65535;int valid=pointer&&em_bui_ram_pointer(pointer,building?98:140),alive=valid&&em_training_alive(c,pointer,building);
 unsigned type=valid?c->ram[a+2]:65535,definition=valid?em_bui_definition(c,building,(int)type):0,flags=valid?dune_word(c,a+6):0;
 unsigned flags4=valid?dune_word(c,a+4):0;
 em_bui_append(j,"{\"pointer\":%u,\"id\":%u,\"type\":%u,\"owner\":%u,\"alive\":%s,\"allocated\":%s,\"inWorld\":%s,\"stored\":%s,\"flags4\":%u,\"worldX\":%u,\"worldY\":%u,\"hp\":%u,\"maxHp\":%u,\"action\":%u,\"cargo\":%u,\"flags6\":%u,\"product\":%u,\"productionIndex\":%u,\"ready\":%s}",pointer,valid?dune_word(c,a):65535,type,valid?c->ram[a+8]:65535,alive?"true":"false",flags4&1?"true":"false",(flags4&7)==3?"true":"false",alive&&!building&&(flags4&7)!=3?"true":"false",flags4,valid?dune_word(c,a+12)/8:0,valid?dune_word(c,a+10)/8:0,valid?dune_word(c,a+18):0,definition?em_bui_rom_word(c,definition+16):0,valid&&!building?c->ram[a+84]:65535,valid&&!building&&type==16?c->ram[a+94]:0,flags,valid&&building?dune_word(c,a+82):65535,valid&&building?c->ram[a+3]:255,alive&&building&&type==8&&(flags&0x2000)&&c->ram[a+3]!=255?"true":"false");
}
static const char*em_web_training_json_for(const CPU*c){
 static char result[16384];EmBuiJson j={result,sizeof result,0,0};unsigned house=dune_word(c,0xc274),mission=dune_word(c,0xc050)+1,tank=em_training_unit(43),harvester=em_training_unit(44),enemy=em_training_unit(45),current_house=dune_long(c,0xc278),canonical_house=dune_long(c,0xdc24)+house*70,ha=(em_bui_ram_pointer(canonical_house,70)?canonical_house:current_house)&65535;
 int active=house==0&&mission==9&&dune_word(c,tank&65535)==43&&c->ram[(tank&65535)+2]==9&&c->ram[(tank&65535)+8]==0&&dune_word(c,harvester&65535)==44&&c->ram[(harvester&65535)+2]==16&&c->ram[(harvester&65535)+8]==0;
 unsigned owned[19]={0},total=0,concrete=0,spice_count=0;
 for(unsigned i=0;i<73;i++){unsigned p=em_bui_rom_long(c,0x4a71e + i*4),a=p&65535;if(em_training_alive(c,p,1)&&c->ram[a+8]==house&&c->ram[a+2]<19){owned[c->ram[a+2]]++;total++;}}
 for(unsigned tile=0;tile<4096;tile++){unsigned kind=em_training_terrain(c,tile);if(kind==10)concrete++;if(kind==8||kind==9)spice_count++;}
 em_bui_append(&j,"{\"version\":1,\"active\":%s,\"map\":%s,\"context\":%d,\"house\":%u,\"mission\":%u,\"credits\":%u,\"creditsDisplayed\":%u,\"creditsCounter\":%u,\"housePointerCurrent\":%u,\"housePointerCanonical\":%u,\"creditsCurrentPointer\":%u,\"capacity\":%u,\"power\":{\"production\":%u,\"usage\":%u},\"selectedUnit\":%u,\"selectedBuilding\":%u,\"objects\":{\"tank\":",active?"true":"false",dune_mouse_context(c)==1?"true":"false",dune_mouse_context(c),house,mission,dune_long(c,ha+18),dune_long(c,0xc058),dune_long(c,0xd6c0),current_house,canonical_house,em_bui_ram_pointer(current_house,70)?dune_long(c,(current_house&65535)+18):0,dune_long(c,ha+22),dune_word(c,ha+26),dune_word(c,ha+28),dune_long(c,0xc25c),dune_long(c,0xc578));
 em_training_object(&j,c,tank,0);em_bui_append(&j,",\"harvester\":");em_training_object(&j,c,harvester,0);em_bui_append(&j,",\"enemy\":");em_training_object(&j,c,enemy,0);em_bui_append(&j,",\"yard\":");em_training_object(&j,c,em_training_owned_building(c,8),1);em_bui_append(&j,",\"refinery\":");em_training_object(&j,c,em_training_owned_building(c,12),1);em_bui_append(&j,"},\"ownedBuildingCount\":%u,\"ownedBuildingTypes\":[",total);
 for(unsigned i=0;i<19;i++)em_bui_append(&j,"%s%u",i?",":"",owned[i]);em_bui_append(&j,"],\"concreteTiles\":%u,\"spiceTileCount\":%u,\"spiceTiles\":[",concrete,spice_count);
 unsigned hx=dune_word(c,(harvester&65535)+12)/256,hy=dune_word(c,(harvester&65535)+10)/256,n=0;
 for(unsigned radius=0;radius<=4&&n<16;radius++)for(unsigned tile=0;tile<4096&&n<16;tile++){unsigned x=tile&63,y=tile/64,d=(unsigned)(abs((int)x-(int)hx)+abs((int)y-(int)hy)),kind=em_training_terrain(c,tile);if(d==radius&&(kind==8||kind==9)){em_bui_append(&j,"%s{\"tile\":%u,\"worldX\":%u,\"worldY\":%u,\"kind\":%u}",n?",":"",tile,x*32+16,y*32+16,kind);n++;}}
 em_bui_append(&j,"]}");if(j.failed)return "{\"active\":false,\"error\":\"training-json-overflow\"}";return result;
}
#ifndef EM_WEB_TRAINING_NO_EXPORTS
EMSCRIPTEN_KEEPALIVE const char*dune_web_training_json(void){return em_web_training_json_for(&em_cpu);}
#endif
#endif
