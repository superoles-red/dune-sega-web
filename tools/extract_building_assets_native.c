/* Offline validation of the original Sega USA LCW decoder, not web runtime.
 * clang -std=c11 -O1 tools/extract_building_assets_native.c \
 *   -o .local/extract-building-assets-native -lm
 * The Python exporter compares every resulting byte with its own decoder.
 */
#define GENESIS_NO_MAIN
#ifndef ORACLE_SOURCE
#define ORACLE_SOURCE "../.local/source/build/dune-base.c"
#endif
#include ORACLE_SOURCE

static CPU cpu;
static unsigned rom_word(unsigned at) {
    return ((unsigned)rom_data[at]<<8)|rom_data[at+1];
}
static uint32_t rom_long(unsigned at) {
    return (rom_word(at)<<16)|rom_word(at+2);
}
int main(int argc,char **argv) {
    if(argc!=2){fprintf(stderr,"usage: %s output-directory\n",argv[0]);return 2;}
    for(unsigned id=0;id<19;++id) {
        memset(&cpu,0,sizeof cpu);cpu.rom=rom_data;cpu.rom_size=sizeof rom_data;
        cpu.audio_mode=AUDIO_STUB;cpu.sr=0x2700;cpu.a[7]=0xffef00;
        unsigned record=rom_long(0x882a4+id*4);
        cpu.pc=0xc32;cpu.a[0]=record+202;cpu.a[1]=0xff0000;
        cpu.d[0]=rom_word(record+200);
        write_mem(&cpu,cpu.a[7],4,0xdead00);
        unsigned steps=0,decoded=0;
        while(!cpu.fault&&cpu.pc!=0xdead00&&steps++<1000000) {
            if(cpu.pc==0xcca)decoded=(cpu.a[3]&65535);
            translated_step(&cpu);
        }
        if(cpu.fault||cpu.pc!=0xdead00||decoded<32||decoded>4096) {
            fprintf(stderr,"Native decoder failed for building %u, pc=%06x, decoded=%u\n",id,cpu.pc,decoded);return 1;
        }
        char path[4096];snprintf(path,sizeof path,"%s/building-%02u.patterns.bin",argv[1],id);
        FILE *f=fopen(path,"wb");if(!f){perror(path);return 2;}
        if(fwrite(cpu.ram,1,decoded,f)!=decoded||fclose(f)){perror(path);return 2;}
        printf("building %02u: native $0C32 decoded %u bytes in %u translated steps\n",id,decoded,steps);
    }
    return 0;
}
