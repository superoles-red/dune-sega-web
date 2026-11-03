/* Temporal oracle: live machine_step/vdp_render use original instructions;
 * modern pointer observers are deliberately absent after native menu entry. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-web.c"
#include <sys/stat.h>
#include <errno.h>
static CPU core,baseline,before,saved;
static DuneMouse pointer;
static unsigned producer;
static uint64_t bfac_updated,bfae_updated,bfb0_updated;
static void native_step(void){
 if(core.pc==0x7f98)bfac_updated=core.vdp.frames;
 if(core.pc==0x8014)bfae_updated=core.vdp.frames;
 if(core.pc==0x8054)bfb0_updated=core.vdp.frames;
 machine_step(&core);
}
static void check(int ok,const char *message){if(!ok){fprintf(stderr,"FAIL %s pc=%06x context%d frame%llu %s\n",message,core.pc,dune_mouse_context(&core),(unsigned long long)core.vdp.frames,core.reason?core.reason:"");exit(1);}}
static void observe_setup(void){
 if(producer && core.pc==0x27d3c){write_mem(&core,0xffc578,4,0xff0000+producer);write_mem(&core,0xff0000+producer+6,2,dune_word(&core,producer+6)|0x8000);producer=0;}
 dune_mouse_observe(&pointer,&core);
}
static void setup_frames(unsigned count){uint64_t end=core.vdp.frames+count;while(!core.fault&&core.vdp.frames<end){observe_setup();machine_step(&core);}check(!core.fault,"native setup");}
static void reset(void){core=baseline;core.rom=rom_data;core.rom_size=sizeof rom_data;core.reason=NULL;core.audio_mode=AUDIO_STUB;core.fault=0;core.pad_buttons[0]=0;memset(&pointer,0,sizeof pointer);pointer.enabled=1;producer=0;bfac_updated=bfae_updated=bfb0_updated=0;}
static unsigned create_starport(void){
 saved=core;unsigned top=0xef00,low=top;core.pc=0xe584;core.sr=0x2700;core.a[7]=0xff0000+top;
 write_mem(&core,core.a[7],4,0xdead00);write_mem(&core,core.a[7]+4,2,1);write_mem(&core,core.a[7]+6,2,11);write_mem(&core,core.a[7]+8,2,1);write_mem(&core,core.a[7]+10,2,65535);
 unsigned n=0;while(!core.fault&&core.pc!=0xdead00&&n++<5000000){if((core.a[7]&65535)<low)low=core.a[7]&65535;translated_step(&core);}unsigned p=core.a[0]&65535;check(!core.fault&&core.pc==0xdead00&&p,"original Starport creation");
 memcpy(core.ram+low,saved.ram+low,top+20-low);memcpy(core.d,saved.d,sizeof core.d);memcpy(core.a,saved.a,sizeof core.a);core.pc=saved.pc;core.sr=saved.sr;core.usp=saved.usp;core.ssp=saved.ssp;return p;
}
static void enter(int starport){reset();if(starport)producer=create_starport();setup_frames(2);for(unsigned i=0;i<4&&dune_mouse_context(&core)!=(starport?3:2);++i){dune_mouse_world_click(&pointer,&core,784,1136,DUNE_CLICK_SELECT);setup_frames(40);}setup_frames(140);check(dune_mouse_context(&core)==(starport?3:2),"original menu entry");pointer.enabled=0;}
static unsigned hash(const unsigned char *p,size_t n){unsigned h=2166136261u;while(n--){h^=*p++;h*=16777619u;}return h;}
static FILE *out(const char *directory,const char *name){char p[4096];snprintf(p,sizeof p,"%s/%s",directory,name);FILE*f=fopen(p,"wb");check(f!=NULL,"output file");return f;}
static void dump(const char *directory,const char *name,const unsigned char *p,size_t n){FILE*f=out(directory,name);check(fwrite(p,1,n,f)==n,"output write");fclose(f);}
static void crop(const unsigned char *rgb,int x,int y,int w,int h,unsigned char *to){for(int row=0;row<h;++row)memcpy(to+row*w*3,rgb+((y+row)*320+x)*3,w*3);}
static const uint8_t *legacy_frame(DuneView *view,const CPU *source){
 static uint8_t pixels[320*224*3],sprites[320*224];
 if(!view->shadow)view->shadow=malloc(sizeof *view->shadow);
 check(view->shadow!=NULL,"legacy shadow allocation");
 check(dune_view_sprites(view,source,dune_word(source,0xe3ec),dune_word(source,0xe3ee),sprites,2),"legacy menu replay");
 vdp_render_pixels(&view->shadow->vdp,320,224,sprites,pixels);return pixels;
}
static void focus_rgba(const CPU *source,unsigned char *rgba){
 static VDP v;static unsigned char sprites[320*224];v=source->vdp;
 unsigned sat=(v.registers[5]&0x7e)<<9,link=0,found=0;
 for(unsigned n=0;n<80;++n){unsigned at=sat+link*8,shape=vdp_word(&v,at+2),entry=vdp_word(&v,at+4);
  if((entry&2047)>=0x3e0 && (entry&2047)<0x3ec)++found;
  else{v.vram[(at+6)&65535]=0;v.vram[(at+7)&65535]=0;}
  link=shape&127;if(!link)break;
 }
 check(found>0,"focus pattern7C00 found in actual SAT");memset(sprites,0,sizeof sprites);vdp_sprites(&v,320,224,sprites);
 unsigned opaque=0;
 for(unsigned y=0;y<24;++y)for(unsigned x=0;x<32;++x){unsigned screen=(y+48)*320+x+32,to=(y*32+x)*4;
  unsigned alpha=(sprites[screen]&15)!=0;opaque+=alpha;
  for(unsigned c=0;c<3;++c)rgba[to+c]=alpha?source->vdp.frame[screen*3+c]:0;
  rgba[to+3]=alpha?255:0;
 }
 check(opaque==208,"native nonzero sprite nibbles give 208 focus alpha pixels");
}
static void run(const char *directory,int starport,int sample_line){
 mkdir(directory,0755);enter(starport);DuneView view={0};
 FILE*f=out(directory,"timeline.json");fprintf(f,"{\"sampleLine\":%d,\"context\":%d,\"masterHz\":%u,\"frameClocks\":%u,\"nativeResolution\":[320,224],\"samples\":[",sample_line,starport?3:2,vdp_master_frequency(&core.vdp),VDP_LINE_CLOCKS*vdp_frame_lines(&core.vdp));
 unsigned adapted_mismatch_frames=0,mismatch_frames=0,border_mismatch_frames=0,led_mismatch_frames=0,ring_mismatch_frames=0,phase_counts[4]={0};
 static unsigned char shadow_rgb[320*224*3],nf[32*24*3],sf[32*24*3],nl[16*20*3],sl[16*20*3],ng[16*16*3],sg[16*16*3];
 unsigned char rgba[32*24*4];unsigned previous_counter=0,last_phase=99;uint64_t start_frame=core.vdp.frames;
 for(unsigned sample=0;sample<320;++sample){
  uint64_t render=core.vdp.rendered_frames;while(!core.fault&&core.vdp.rendered_frames==render)native_step();
  if(sample_line>=0)while(!core.fault && core.vdp.line!=(unsigned)sample_line)native_step();
  check(!core.fault,"untouched native execution");
  before=core;const uint8_t *adapted=em_web_menu_frame(&view,&core);
  adapted_mismatch_frames+=memcmp(adapted,core.vdp.frame,320*224*3)!=0;
  const uint8_t *picture=legacy_frame(&view,&core);memcpy(shadow_rgb,picture,sizeof shadow_rgb);
  check(!memcmp(&before,&core,sizeof core),"both presentation paths preserve the live CPU");focus_rgba(&core,rgba);
  unsigned counter=dune_word(&core,starport?0xc008:0xbfa8),phase=(counter&31)>>3;phase_counts[phase]++;
  unsigned diffs=0,bdiffs=0;for(unsigned p=0;p<320*224*3;p+=3)if(memcmp(core.vdp.frame+p,shadow_rgb+p,3))++diffs;
  crop(core.vdp.frame,32,48,32,24,nf);crop(shadow_rgb,32,48,32,24,sf);
  for(unsigned y=0;y<24;y++)for(unsigned x=0;x<32;x++)if(x<2||x>=30||y<2||y>=22)if(memcmp(nf+(y*32+x)*3,sf+(y*32+x)*3,3))++bdiffs;
  crop(core.vdp.frame,272,48,16,20,nl);crop(shadow_rgb,272,48,16,20,sl);
  crop(core.vdp.frame,172,16,16,16,ng);crop(shadow_rgb,172,16,16,16,sg);
  mismatch_frames+=diffs!=0;border_mismatch_frames+=bdiffs!=0;led_mismatch_frames+=memcmp(nl,sl,sizeof nl)!=0;ring_mismatch_frames+=memcmp(ng,sg,sizeof ng)!=0;
  char name[80];snprintf(name,sizeof name,"focus-native-%03u.rgba",sample);dump(directory,name,rgba,sizeof rgba);snprintf(name,sizeof name,"focus-native-%03u.rgb",sample);dump(directory,name,nf,sizeof nf);snprintf(name,sizeof name,"focus-shadow-%03u.rgb",sample);dump(directory,name,sf,sizeof sf);
  snprintf(name,sizeof name,"red-led-native-%03u.rgb",sample);dump(directory,name,nl,sizeof nl);snprintf(name,sizeof name,"green-ring-native-%03u.rgb",sample);dump(directory,name,ng,sizeof ng);
  if(sample==0 || phase!=last_phase || bdiffs){snprintf(name,sizeof name,"native-full-%03u.rgb",sample);dump(directory,name,core.vdp.frame,320*224*3);snprintf(name,sizeof name,"shadow-full-%03u.rgb",sample);dump(directory,name,shadow_rgb,sizeof shadow_rgb);}
  fprintf(f,"%s{\"sample\":%u,\"frame\":%llu,\"renderedFrame\":%llu,\"masterCycles\":%llu,\"pc\":%u,\"phaseCounter\":%u,\"phase\":%u,\"counterStep\":%d,\"rgb\":[%u,%u,%u],\"shadowRgb\":[%u,%u,%u],\"borderDiffPixels\":%u,\"fullDiffPixels\":%u,\"nativeFocusHash\":%u,\"shadowFocusHash\":%u,\"redLedHash\":%u,\"greenRingHash\":%u,\"bfac\":%u,\"bfae\":%u,\"bfb0\":%u,\"bfacUpdateFrame\":%llu,\"bfaeUpdateFrame\":%llu,\"bfb0UpdateFrame\":%llu}",sample?",":"",sample,(unsigned long long)core.vdp.frames,(unsigned long long)core.vdp.rendered_frames,(unsigned long long)core.master_cycles,core.pc,counter,phase,sample?(int)((counter-previous_counter)&65535):0,nf[0],nf[1],nf[2],sf[0],sf[1],sf[2],bdiffs,diffs,hash(nf,sizeof nf),hash(sf,sizeof sf),hash(nl,sizeof nl),hash(ng,sizeof ng),dune_word(&core,0xbfac),dune_word(&core,0xbfae),dune_word(&core,0xbfb0),(unsigned long long)bfac_updated,(unsigned long long)bfae_updated,(unsigned long long)bfb0_updated);
  previous_counter=counter;last_phase=phase;
 }
 fprintf(f,"],\"frameRange\":[%llu,%llu],\"adaptedMismatchFrames\":%u,\"legacyMismatchFrames\":%u,\"borderMismatchFrames\":%u,\"redLedMismatchFrames\":%u,\"greenRingMismatchFrames\":%u,\"phaseCounts\":[%u,%u,%u,%u]}\n",(unsigned long long)start_frame,(unsigned long long)core.vdp.frames,adapted_mismatch_frames,mismatch_frames,border_mismatch_frames,led_mismatch_frames,ring_mismatch_frames,phase_counts[0],phase_counts[1],phase_counts[2],phase_counts[3]);fclose(f);
 printf("%s 320 untouched native frames: adapted diff=%u, legacy full diff=%u, legacy focus diff=%u, LED diff=%u, ring diff=%u; phases=%u/%u/%u/%u\n",directory,adapted_mismatch_frames,mismatch_frames,border_mismatch_frames,led_mismatch_frames,ring_mismatch_frames,phase_counts[0],phase_counts[1],phase_counts[2],phase_counts[3]);check(!adapted_mismatch_frames,"adapted output equals every completed native frame");free(view.shadow);
}
int main(int argc,char **argv){check(argc==3,"snapshot and output directory required");FILE*f=fopen(argv[1],"rb");check(f&&fread(&baseline,sizeof baseline,1,f)==1,"native CPU snapshot");fclose(f);mkdir(argv[2],0755);char p[4096];snprintf(p,sizeof p,"%s/yard",argv[2]);run(p,0,-1);snprintf(p,sizeof p,"%s/starport",argv[2]);run(p,1,-1);snprintf(p,sizeof p,"%s/yard-midline100",argv[2]);run(p,0,100);snprintf(p,sizeof p,"%s/starport-midline100",argv[2]);run(p,1,100);return 0;}
