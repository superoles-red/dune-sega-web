/* Offline validation of original unit-monitor LCW resources through $0C32. */
#define GENESIS_NO_MAIN
#ifndef ORACLE_SOURCE
#define ORACLE_SOURCE "../.local/source/build/dune-base.c"
#endif
#include ORACLE_SOURCE
static CPU cpu;
static unsigned rw(unsigned a){return ((unsigned)rom_data[a]<<8)|rom_data[a+1];}
static unsigned rl(unsigned a){return (rw(a)<<16)|rw(a+2);}
int main(int argc,char **argv){
    if(argc!=2)return 2;unsigned count=0;
    for(unsigned id=0;id<27;++id){
        unsigned record=rl(0x8f1d0+id*4);
        if(!record||record==0x95cd8)continue;
        memset(&cpu,0,sizeof cpu);cpu.rom=rom_data;cpu.rom_size=sizeof rom_data;cpu.audio_mode=AUDIO_STUB;
        cpu.pc=0xc32;cpu.sr=0x2700;cpu.a[7]=0xffef00;cpu.a[0]=record+202;cpu.a[1]=0xff0000;cpu.d[0]=rw(record+200);write_mem(&cpu,cpu.a[7],4,0xdead00);
        unsigned steps=0,decoded=0;
        while(!cpu.fault&&cpu.pc!=0xdead00&&steps++<1000000){if(cpu.pc==0xcca)decoded=cpu.a[3]&65535;translated_step(&cpu);}
        if(cpu.fault||cpu.pc!=0xdead00||decoded<32||decoded>4096){fprintf(stderr,"Native unit LCW failed: id%u pc%06x decoded%u\n",id,cpu.pc,decoded);return 1;}
        char path[4096];snprintf(path,sizeof path,"%s/unit-%02u.patterns.bin",argv[1],id);FILE*f=fopen(path,"wb");if(!f||fwrite(cpu.ram,1,decoded,f)!=decoded||fclose(f))return 3;
        printf("unit %02u: original $0C32 decoded %u bytes\n",id,decoded);++count;
    }
    return count==17?0:4;
}
