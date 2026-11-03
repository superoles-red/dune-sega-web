/* Offline original ordinary map-cursor extraction. Only a CPU copy is changed;
 * the live BF18 cursor, independent BF60 marker and gameplay are untouched. */
#define GENESIS_NO_MAIN
#ifndef ORACLE_SOURCE
#define ORACLE_SOURCE "../.local/source/build/dune-base.c"
#endif
#include ORACLE_SOURCE
#include <sys/stat.h>
static CPU source,before,shadow;
static uint8_t indexed[320*224],rgba[320*224*4];
static void check(int okay,const char *why){if(!okay){fprintf(stderr,"FAIL %s pc=%06x reason=%s\n",why,shadow.pc,shadow.reason?shadow.reason:"none");exit(1);}}
int main(int argc,char **argv){
    if(argc!=3){fprintf(stderr,"usage: %s original-map.cpu.bin output-directory\n",argv[0]);return 2;}
    FILE *f=fopen(argv[1],"rb");check(f&&fread(&source,sizeof source,1,f)==1&&fgetc(f)==EOF,"exact original CPU snapshot ABI");fclose(f);
    source.rom=rom_data;source.rom_size=sizeof rom_data;source.reason=NULL;source.fault=0;source.audio_mode=AUDIO_MUTE;source.pad_buttons[0]=0;
    check(dune_mouse_context(&source)==1,"source is an actual original mission map");before=source;shadow=source;shadow.audio_mode=AUDIO_STUB;
    unsigned node=dune_word(&source,0xbf18),world_marker=dune_word(&source,0xbf60);
    check(node&&node<=65520&&node!=world_marker,"ordinary BF18 cursor is distinct from BF60 order marker");
    unsigned mapping=dune_long(&source,node+8),original_flags=dune_word(&source,node+6),original_word12=dune_word(&source,node+12);
    /* The native cursor table at$60E8C pairs an original 256-byte pattern bank
     * with each mapping ($4B7E..$4B94). Early map snapshots may retain a pending
     * cursor DMA and an empty F780 bank. Recreate that exact original upload
     * on the offline copy, rather than drawing a replacement cursor. */
    unsigned pattern_rom=0,table_record=0;
    for(unsigned i=0;i<34;++i){unsigned at=0x60e8c+i*8;
        if((read_mem(&shadow,at+4,4)&0xffffff)==(mapping&0xffffff)){unsigned p=read_mem(&shadow,at,4)&0xffffff;if(p&&p+256<=sizeof rom_data){pattern_rom=p;table_record=at;break;}}
    }
    check(pattern_rom,"original native cursor mapping has its ROM pattern-table pair");
    memcpy(shadow.vdp.vram+0xf780,rom_data+pattern_rom,256);
    int left=(int)dune_word(&source,0xe3ec),top=(int)dune_word(&source,0xe3ee),wx=left+160,wy=top+112;
    /* Isolate just this original sprite node, then run the same native sprite
     * builder used by dune_view_sprites. No alternate mapping/art is supplied. */
    write_mem(&shadow,0xfff3ac,2,node);write_mem(&shadow,0xff0000+node+14,2,0);
    shadow.ram[node+7]&=(uint8_t)~(0x80|0x40|0x04);shadow.ram[node+4]=2;
    write_mem(&shadow,0xff0000+node,4,0xffefa0);write_mem(&shadow,0xffefa0,2,wy*8);write_mem(&shadow,0xffefa2,2,wx*8);
    write_mem(&shadow,0xffe3be,2,left);write_mem(&shadow,0xffe3c0,2,top);
    shadow.pc=0x1088;shadow.a[0]=(uint32_t)(int32_t)(int16_t)node;shadow.sr=0x2700;shadow.a[7]=0xffef00;write_mem(&shadow,shadow.a[7],4,0xdead00);
    unsigned steps=0;while(!shadow.fault&&shadow.pc!=0xdead00&&steps++<100000)translated_step(&shadow);
    check(!shadow.fault&&shadow.pc==0xdead00,"original $1088 sprite builder returned");
    unsigned sat=(shadow.vdp.registers[5]&0x7e)<<9;for(unsigned i=0;i<640;++i)shadow.vdp.vram[(sat+i)&65535]=shadow.ram[0xe428+i];
    vdp_sprites(&shadow.vdp,320,224,indexed);
    unsigned x0=320,y0=224,x1=0,y1=0,visible=0;
    for(unsigned y=0;y<224;++y)for(unsigned x=0;x<320;++x){unsigned index=indexed[y*320+x];if(!(index&15))continue;
        if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;++visible;
        unsigned color=shadow.vdp.cram[index&63],at=(y*320+x)*4;
        rgba[at]=vdp_channel((color>>1)&7,1);rgba[at+1]=vdp_channel((color>>5)&7,1);rgba[at+2]=vdp_channel((color>>9)&7,1);rgba[at+3]=255;
    }
    if(!visible||x1-x0+1>64||y1-y0+1>64)fprintf(stderr,"cursor diagnostic node%04x marker%04x mapping%08x flags%04x word12%u left%d top%d visible%u bbox%u,%u..%u,%u SAT%04x first%04x/%04x/%04x/%04x\n",node,world_marker,mapping,original_flags,original_word12,left,top,visible,x0,y0,x1,y1,sat,dune_word(&shadow,0xe428),dune_word(&shadow,0xe42a),dune_word(&shadow,0xe42c),dune_word(&shadow,0xe42e));
    check(visible&&x1-x0+1<=64&&y1-y0+1<=64,"ordinary cursor has a bounded native sprite image");
    check(!memcmp(&source,&before,sizeof source),"whole original source CPU remains byte-identical");
    mkdir(argv[2],0755);char path[4096];snprintf(path,sizeof path,"%s/order-reticle.rgba",argv[2]);f=fopen(path,"wb");check(f!=NULL,"RGBA output");
    unsigned w=x1-x0+1,h=y1-y0+1;for(unsigned y=y0;y<=y1;++y)check(fwrite(rgba+(y*320+x0)*4,4,w,f)==w,"native RGBA row");fclose(f);
    snprintf(path,sizeof path,"%s/reticle-source.json",argv[2]);f=fopen(path,"w");check(f!=NULL,"source report output");
    fprintf(f,"{\"sourceMapContext\":1,\"cursorNode\":%u,\"independentWorldMarkerNode\":%u,\"mappingPointer\":%u,\"originalFlags\":%u,\"originalWord12\":%u,\"cursorTableRom\":396940,\"cursorTableRecordRom\":%u,\"patternBankRom\":%u,\"patternBankBytes\":256,\"patternVram\":63360,\"offlineOriginalDmaRecreated\":true,\"nativeBuilderPc\":4232,\"nativeBuilderSteps\":%u,\"satVramBase\":%u,\"satRamSource\":58408,\"nativePosition\":[160,112],\"sourceBbox\":[%u,%u,%u,%u],\"width\":%u,\"height\":%u,\"visiblePixels\":%u,\"sourceCpuByteIdentical\":true,\"nativePaletteCram\":[",node,world_marker,mapping,original_flags,original_word12,table_record,pattern_rom,steps,sat,x0,y0,w,h,w,h,visible);
    for(unsigned i=0;i<64;++i)fprintf(f,"%s%u",i?",":"",shadow.vdp.cram[i]);fprintf(f,"]}\n");fclose(f);
    printf("PASS ordinary BF18 cursor: %ux%u RGBA, %u visible native pixels; source CPU unchanged, BF60 untouched\n",w,h,visible);return 0;
}
