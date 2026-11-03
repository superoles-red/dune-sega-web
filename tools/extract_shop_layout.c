/* Offline supplemental UI-layout capture. Reuses the pinned original-native
 * fixture/renderer from the UI extractor, without editing its output assets. */
#define main shop_ui_extraction_main
#include "extract_shop_ui.c"
#undef main

static void region_rgb(const char *name,unsigned frame,const uint8_t *rgb,int x,int y,int w,int h){
    char path[4096];snprintf(path,sizeof path,"%s/%s-%03u.rgb",output,name,frame);FILE*f=fopen(path,"wb");check(f!=NULL,"layout animation output");
    for(int yy=0;yy<h;++yy)check(fwrite(rgb+((y+yy)*320+x)*3,3,w,f)==(size_t)w,"layout region bytes");fclose(f);
}
int main(int argc,char **argv){
    if(argc!=3){fprintf(stderr,"Usage: %s CPU_SNAPSHOT OUTPUT_RAW_DIRECTORY\n",argv[0]);return 2;}
    FILE*f=fopen(argv[1],"rb");check(f&&fread(&baseline,sizeof baseline,1,f)==1,"original CPU snapshot");fclose(f);output=argv[2];mkdir(output,0755);
    restore();frames(2);open_at(784,1136,2);frames(20);
    write_bytes("menu-vram","bin",core.vdp.vram,sizeof core.vdp.vram);
    write_bytes("menu-registers","bin",core.vdp.registers,sizeof core.vdp.registers);
    write_bytes("menu-vsram","bin",core.vdp.vsram,sizeof core.vdp.vsram);
    uint8_t palette[64*3];for(unsigned i=0;i<64;++i){unsigned c=core.vdp.cram[i];palette[i*3]=vdp_channel((c>>1)&7,1);palette[i*3+1]=vdp_channel((c>>5)&7,1);palette[i*3+2]=vdp_channel((c>>9)&7,1);}write_bytes("menu-palette","rgb",palette,sizeof palette);
    static uint8_t rgb[320*224*3];
    f=file("capture","json");fprintf(f,"{\"firstNativeFrame\":%llu,\"nativeFrames\":240,\"masterHz\":%u,\"clocksPerFrame\":%u,\"regions\":[{\"id\":\"red-indicator\",\"rect\":[272,48,16,24]},{\"id\":\"green-indicator\",\"rect\":[172,12,16,16]},{\"id\":\"radar-display\",\"rect\":[64,16,72,24]},{\"id\":\"vent\",\"rect\":[264,116,40,56]}]}\n",(unsigned long long)core.vdp.frames,vdp_master_frequency(&core.vdp),VDP_LINE_CLOCKS*vdp_frame_lines(&core.vdp));fclose(f);
    for(unsigned n=0;n<240;++n){
        /* Use the actual last completed native VDP frame. Replaying1088 on a
         * clone here would advance sprite phases by an extra renderer step. */
        memcpy(rgb,core.vdp.frame,sizeof rgb);
        if(!n)write_bytes("menu-stable","rgb",rgb,sizeof rgb);
        region_rgb("red-indicator",n,rgb,272,48,16,24);
        region_rgb("green-indicator",n,rgb,172,12,16,16);
        region_rgb("radar-display",n,rgb,64,16,72,24);
        region_rgb("vent",n,rgb,264,116,40,56);
        frames(1);
    }
    puts("Captured original menu VRAM/palette plus240 native frames of four chrome regions.");
    return 0;
}
