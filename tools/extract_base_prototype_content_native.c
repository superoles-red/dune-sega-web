/* Offline, controlled late-tech base fixture. No shipping runtime changes.
 * All buildings and the resulting menu grid use original Sega instructions.
 */
#define GENESIS_NO_MAIN
#ifndef ORACLE_SOURCE
#define ORACLE_SOURCE "../.local/source/build/dune-base.c"
#endif
#include ORACLE_SOURCE
static CPU c,saved;
static DuneMouse mouse;
static void fixture_fail(const char *why){fprintf(stderr,"%s pc=%06x reason=%s\n",why,c.pc,c.reason?c.reason:"none");exit(1);}
static void frames(unsigned n){
    uint64_t end=c.vdp.frames+n;
    while(!c.fault&&c.vdp.frames<end){dune_mouse_observe(&mouse,&c);machine_step(&c);}
    if(c.fault)fixture_fail("Native frame failed");
}
static unsigned create(unsigned index,unsigned type,unsigned tile){
    saved=c;unsigned stack=0xef00,low=stack;
    c.pc=0xe584;c.sr=0x2700;c.a[7]=0xff0000+stack;
    write_mem(&c,c.a[7],4,0xdead00);write_mem(&c,c.a[7]+4,2,index);
    write_mem(&c,c.a[7]+6,2,type);write_mem(&c,c.a[7]+8,2,1);write_mem(&c,c.a[7]+10,2,tile);
    unsigned steps=0;
    while(!c.fault&&c.pc!=0xdead00&&steps++<5000000){if((c.a[7]&65535)<low)low=c.a[7]&65535;translated_step(&c);}
    unsigned p=c.a[0]&0xffffff;
    if(c.fault||c.pc!=0xdead00||!p)fixture_fail("Original Building_Create failed");
    memcpy(c.ram+low,saved.ram+low,stack+20-low);
    memcpy(c.d,saved.d,sizeof c.d);memcpy(c.a,saved.a,sizeof c.a);
    c.pc=saved.pc;c.sr=saved.sr;c.usp=saved.usp;c.ssp=saved.ssp;
    if(dune_word(&c,(p&65535)+4)&4)fixture_fail("Native fixture building remained unmapped");
    return p;
}
int main(int argc,char **argv){
    if(argc!=3){fprintf(stderr,"usage: %s original-first-mission.cpu.bin output.json\n",argv[0]);return 2;}
    FILE *f=fopen(argv[1],"rb");if(!f||fread(&c,sizeof c,1,f)!=1||fgetc(f)!=EOF)fixture_fail("Snapshot ABI mismatch");fclose(f);
    c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.pad_buttons[0]=0;c.audio_mode=AUDIO_MUTE;
    mouse.enabled=1;
    /* Explicit fixture setup only: final-campaign tech and authored/preplaced
     * buildings, as used by the original scenario initializer. Never overwrite
     * the availability table or the final BF8E menu grid. */
    write_mem(&c,0xffc050,2,8);
    unsigned mode=dune_word(&c,0xc148);write_mem(&c,0xffc148,2,mode+1);
    /* Keep Palace unbuilt: it is a one-per-house building and native
     * availability removes its purchase after one has already been placed.
     * The existing Starport prerequisite then enables Palace as another
     * genuine purchase, pushing the original Upgrade cell into row six. */
    unsigned types[]={9,12,18,3,4,11,10,5,13,17};
    unsigned positions[]={18+18*64,22+18*64,26+18*64,30+18*64,34+18*64,38+18*64,42+18*64,22+23*64,26+23*64,30+23*64};
    unsigned pointers[sizeof(types)/sizeof(types[0])];
    for(unsigned i=0;i<sizeof(types)/sizeof(types[0]);++i)pointers[i]=create(i+1,types[i],positions[i]);
    write_mem(&c,0xffc148,2,mode);
    frames(2);
    for(unsigned i=0;i<4&&dune_mouse_context(&c)!=2;++i){dune_mouse_world_click(&mouse,&c,784,1136,DUNE_CLICK_SELECT);frames(40);}
    frames(40);
    if(dune_mouse_context(&c)!=2||c.ram[0xbf85]!=8)fixture_fail("Original Construction Yard menu did not open");
    f=fopen(argv[2],"w");if(!f){perror(argv[2]);return 2;}
    unsigned house=dune_long(&c,0xc278)&65535,products=0;
    fprintf(f,"{\"fixture\":\"controlled-final-tech-fully-developed-atreides-base\",\"houseId\":%u,\"campaignIndex\":%u,\"frame\":%llu,\"credits\":%u,\"displayedCredits\":%u,\"yardUpgradeLevel\":%u,\"grid\":[",dune_word(&c,0xc274),dune_word(&c,0xc050),(unsigned long long)c.vdp.frames,dune_long(&c,house+18),dune_long(&c,0xc058),c.ram[0x4eb8+84]);
    for(unsigned i=0;i<18;++i){int raw=(int8_t)c.ram[0xbf8e + i];fprintf(f,"%s%d",i?",":"",raw);if(raw>=0&&raw<19)++products;}
    fprintf(f,"],\"createdByOriginalBuildingCreate\":[");
    for(unsigned i=0;i<sizeof(types)/sizeof(types[0]);++i)fprintf(f,"%s{\"id\":%u,\"pointer\":%u,\"tile\":%u}",i?",":"",types[i],pointers[i],positions[i]);
    fprintf(f,"],\"productCells\":%u,\"nativeMenuContext\":%d,\"fault\":%d}\n",products,dune_mouse_context(&c),c.fault);fclose(f);
    if(products<12 || c.ram[0xbf8e + 15]==0x80)fixture_fail("Fixture did not expose twelve buildings and a nonempty original sixth row");
    printf("Original Construction Yard grid: %u purchase cells; credits=%u; context=%d\n",products,dune_long(&c,house+18),dune_mouse_context(&c));return 0;
}
