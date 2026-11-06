/* Offline source-art inspection. The original ROM and shipping code are read
 * only. A copied native Results state supplies its original palette/registers;
 * native $26C68 decodes each of its three mission-indexed background maps.
 * clang -std=c11 -O0 tools/audit_native_results_art.c -o .local/audit-native-results-art -lm
 * .local/audit-native-results-art RESULTS_CPU OUTPUT_DIRECTORY
 */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_frame.h"
static CPU c,baseline,before;
static uint8_t background[320*224*3];
static const char*outdir;
static void write_art(const char*id,const char*ext,const void*bytes,size_t size){
 char path[4096];snprintf(path,sizeof path,"%s/%s.%s",outdir,id,ext);FILE*f=fopen(path,"wb");
 if(!f||fwrite(bytes,1,size,f)!=size){fprintf(stderr,"FAIL output %s\n",path);exit(3);}fclose(f);
}
static void output(unsigned mission,unsigned steps){
 char id[64];snprintf(id,sizeof id,"stats-mission-%u",mission);
 before=c;em_web_frame_invalidate(&c);em_web_frame_capture(&c);
 const uint8_t*clean=em_web_frame_textless(&c,5);if(!clean||memcmp(&before,&c,sizeof c)){fprintf(stderr,"FAIL readonly Results getter\n");exit(4);}
 unsigned changed=0,outside=0;
 for(unsigned y=0;y<224;y++)for(unsigned x=0;x<320;x++){
  unsigned at=(y*320+x)*3,entry=vdp_word(&c.vdp,em_web_frame_a_address(&c.vdp,x,y));
  int eligible=em_web_frame_results_label_at(x,y,entry)||em_web_frame_results_rank_at(x,y,entry);
  if(memcmp(clean+at,c.vdp.frame+at,3)){changed++;if(!eligible)outside++;}
  em_web_frame_pixel(&c.vdp,0,vdp_plane_pixel(&c.vdp,1,x,y),0,background+at);
 }
 if(outside){fprintf(stderr,"FAIL Results getter changed background\n");exit(5);}
 write_art(id,"rgb",c.vdp.frame,sizeof background);write_art(id,"plane-b.rgb",background,sizeof background);write_art(id,"textless.rgb",clean,sizeof background);
 char json[1024];int size=snprintf(json,sizeof json,"{\"missionArgument\":%u,\"remainder\":%u,\"nativeFunction\":%u,\"nativeMapTable\":%u,\"nativeMapPointer\":%u,\"originalInstructions\":%u,\"width\":320,\"height\":224,\"readOnlyResultsGetterCpuUnchanged\":true,\"textlessChangedPixels\":%u,\"textlessOutsideActualGlyphCellsChangedPixels\":%u,\"scope\":\"Controlled offline native source-art decode, not a naturally played mission. The three original mission-indexed maps use the original Results palette and renderer.\"}\n",mission,mission%3,0x26c68,0x26c5c,read_mem(&c,0x26c5c+(mission%3)*4,4),steps,changed,outside);
 write_art(id,"json",json,(size_t)size);printf("PASS mission%u remainder%u map%06x nativeInstructions%u readonlyCPU+outsideGlyphs\n",mission,mission%3,read_mem(&c,0x26c5c+(mission%3)*4,4),steps);fflush(stdout);
}
int main(int argc,char**argv){
 if(argc!=3){fprintf(stderr,"usage RESULTS_CPU OUTPUT_DIRECTORY\n");return 2;}outdir=argv[2];
 FILE*f=fopen(argv[1],"rb");if(!f||fread(&baseline,sizeof baseline,1,f)!=1||fgetc(f)!=EOF)return 3;fclose(f);
 for(unsigned mission=1;mission<=3;mission++){
  c=baseline;c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.audio_mode=AUDIO_MUTE;c.pad_buttons[0]=0;c.pc=0x26c68;c.sr=0x2000;c.a[7]=0xffef00;c.d[0]=mission;write_mem(&c,c.a[7],4,0xdead00);
  unsigned steps=0;while(!c.fault&&c.pc!=0xdead00&&steps++<30000000)machine_step(&c);
  if(c.fault||c.pc!=0xdead00){fprintf(stderr,"FAIL mission%u steps%u pc%x\n",mission,steps,c.pc);return 4;}
  vdp_render(&c);output(mission,steps);
 }
 return 0;
}
