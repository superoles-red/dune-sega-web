/* Offline original cursor5 art. Native4B38+1088 run only on a CPU copy. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include <sys/stat.h>
static CPU source,before,copy;
static uint8_t indices[320*224],rgba[320*224*4];
static void check(int ok,const char*why){if(!ok){fprintf(stderr,"FAIL %s pc%06x %s\n",why,copy.pc,copy.reason?copy.reason:"");exit(1);}}
static unsigned run(unsigned pc){copy.pc=pc;copy.sr=0x2700;copy.a[7]=0xffef00;write_mem(&copy,copy.a[7],4,0xdead00);unsigned steps=0;while(!copy.fault&&copy.pc!=0xdead00&&steps++<100000)translated_step(&copy);check(!copy.fault&&copy.pc==0xdead00,"original helper returns");return steps;}
int main(int argc,char**argv){
 check(argc==3,"usage original-map.cpu.bin output-directory");FILE*f=fopen(argv[1],"rb");check(f&&fread(&source,sizeof source,1,f)==1&&fgetc(f)==EOF,"exact native snapshot ABI");fclose(f);
 source.rom=rom_data;source.rom_size=sizeof rom_data;source.reason=NULL;source.fault=0;source.audio_mode=AUDIO_MUTE;source.pad_buttons[0]=0;check(dune_mouse_context(&source)==1,"authentic native map source");before=source;copy=source;copy.audio_mode=AUDIO_STUB;
 unsigned node=dune_word(&copy,0xbf18),marker=dune_word(&copy,0xbf60);check(node&&marker&&node!=marker,"cursor and world marker are distinct");uint8_t marker_before[16];memcpy(marker_before,copy.ram+marker,16);
 /* Negative second argument preserves the independent original BF60 marker. */
 write_mem(&copy,0xffef04,2,5);write_mem(&copy,0xffef06,2,65535);unsigned setter_steps=run(0x4b38);
 unsigned table=0x60e8c+5*8,bank=read_mem(&copy,table,4)&0xffffff,mapping=read_mem(&copy,table+4,4);
 check(dune_word(&copy,0xbf62)==5&&dune_long(&copy,node+8)==mapping,"native setter selected original cursor5 table mapping");
 check(!memcmp(marker_before,copy.ram+marker,16),"native cursor setter leaves BF60 untouched");check(bank+256<=sizeof rom_data,"bounded original cursor pattern bank");
 memcpy(copy.vdp.vram+0xf780,rom_data+bank,256);
 unsigned flags=dune_word(&copy,node+6);int left=dune_word(&copy,0xe3ec),top=dune_word(&copy,0xe3ee);
 write_mem(&copy,0xfff3ac,2,node);write_mem(&copy,0xff0000+node+14,2,0);copy.ram[node+7]&=(uint8_t)~(0x80|0x40|0x04);copy.ram[node+4]=2;
 write_mem(&copy,0xff0000+node,4,0xffefa0);write_mem(&copy,0xffefa0,2,(top+112)*8);write_mem(&copy,0xffefa2,2,(left+160)*8);write_mem(&copy,0xffe3be,2,left);write_mem(&copy,0xffe3c0,2,top);
 copy.a[0]=(uint32_t)(int32_t)(int16_t)node;unsigned builder_steps=run(0x1088),sat=(copy.vdp.registers[5]&0x7e)<<9;for(unsigned i=0;i<640;i++)copy.vdp.vram[(sat+i)&65535]=copy.ram[0xe428+i];
 vdp_sprites(&copy.vdp,320,224,indices);unsigned x0=320,y0=224,x1=0,y1=0,visible=0;
 for(unsigned y=0;y<224;y++)for(unsigned x=0;x<320;x++){unsigned at=y*320+x,index=indices[at];if(!(index&15))continue;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;visible++;unsigned color=copy.vdp.cram[index&63];rgba[at*4]=vdp_channel((color>>1)&7,1);rgba[at*4+1]=vdp_channel((color>>5)&7,1);rgba[at*4+2]=vdp_channel((color>>9)&7,1);rgba[at*4+3]=255;}
 unsigned w=x1-x0+1,h=y1-y0+1;check(visible&&w<=64&&h<=64,"bounded original target cursor sprite");check(!memcmp(&source,&before,sizeof source),"whole source CPU remains unchanged");
 mkdir(argv[2],0755);char path[4096];snprintf(path,sizeof path,"%s/attack-reticle.rgba",argv[2]);f=fopen(path,"wb");check(f!=NULL,"RGBA output");for(unsigned y=y0;y<=y1;y++)check(fwrite(rgba+(y*320+x0)*4,4,w,f)==w,"RGBA row output");fclose(f);
 snprintf(path,sizeof path,"%s/source-proof.json",argv[2]);f=fopen(path,"w");check(f!=NULL,"proof output");fprintf(f,"{\"cursorId\":5,\"nativeSetterPc\":19256,\"nativeSetterSteps\":%u,\"nativeSetterSecondArgument\":65535,\"cursorNode\":%u,\"independentWorldMarkerNode\":%u,\"worldMarkerUnchanged\":true,\"tableRecordRom\":%u,\"patternBankRom\":%u,\"patternBankBytes\":256,\"mappingPointer\":%u,\"nativeFlags\":%u,\"patternVram\":63360,\"nativeBuilderPc\":4232,\"nativeBuilderSteps\":%u,\"width\":%u,\"height\":%u,\"sourceBbox\":[%u,%u,%u,%u],\"nativePosition\":[160,112],\"visiblePixels\":%u,\"sourceCpuWholeStructUnchanged\":true}\n",setter_steps,node,marker,table,bank,mapping,flags,builder_steps,w,h,x0,y0,w,h,visible);fclose(f);
 printf("PASS authentic native cursor5 %ux%u,%uopaque pixels; original4B38→1088, sourceCPU/BF60 unchanged\n",w,h,visible);return 0;
}
