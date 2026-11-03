/* Offline original cold-boot Main save, with the original YMFM state.
 * Never linked into the browser runtime. No scenario or world fixture input. */
#define GENESIS_NO_MAIN
#define GENESIS_AUDIO
#include "../.local/source/build/dune-base.c"
#include <sys/stat.h>
static CPU frontend_cpu;
#define em_cpu frontend_cpu
#define em_window 1
#define EMSCRIPTEN_KEEPALIVE
#include "../.local/frontend-save-serializer.inc"
#undef em_cpu
#undef em_window
static const char *output;
static void check(int ok,const char *what){if(!ok){fprintf(stderr,"FAIL %s pc=%06x frame=%llu z80=%04x reason=%s\n",what,frontend_cpu.pc,(unsigned long long)frontend_cpu.vdp.frames,frontend_cpu.z80_cpu.pc,frontend_cpu.reason?frontend_cpu.reason:"");exit(1);}}
static void dump(const char *suffix,const void *data,size_t bytes){char path[4096];snprintf(path,sizeof path,"%s/frontend.%s",output,suffix);FILE*f=fopen(path,"wb");check(f&&fwrite(data,1,bytes,f)==bytes,"write frontend evidence");fclose(f);}
static unsigned mismatch(void){CPU*c=&frontend_cpu;static uint8_t sprites[320*224],rgb[320*224*3];memset(sprites,0,sizeof sprites);vdp_sprites(&c->vdp,320,224,sprites);vdp_render_pixels(&c->vdp,320,224,sprites,rgb);unsigned n=0;for(unsigned i=0;i<sizeof rgb;i++)n+=rgb[i]!=c->vdp.frame[i];return n;}
static int main_poll(void){CPU*c=&frontend_cpu;unsigned sp=c->a[7]&65535;return c->pc==0x4d4e&&sp<=65532&&dune_long(c,sp)==0x178d2;}
int main(int argc,char **argv){
 check(argc==2,"usage output-directory");output=argv[1];mkdir(output,0755);CPU*c=&frontend_cpu;
 c->rom=rom_data;c->rom_size=sizeof rom_data;c->sr=0x2700;c->io_tx[0]=c->io_tx[1]=0xff;c->io_tx[2]=0xfb;
 c->a[7]=read_mem(c,0,4);c->ssp=c->a[7];c->pc=read_mem(c,4,4)&0xffffff;c->audio_mode=AUDIO_ON;
 check(audio_init(c,NULL),"real cold-boot YMFM initialization");
 uint64_t first_poll_render=0,first_poll_frame=0;unsigned polls=0;
 while(!c->fault&&c->vdp.frames<6000){
  if(main_poll()){
   polls++;if(!first_poll_render){first_poll_render=c->vdp.rendered_frames;first_poll_frame=c->vdp.frames;}
   if(c->vdp.rendered_frames>=first_poll_render+8&&c->vdp.frame_width==320&&c->vdp.frame_height==224&&!mismatch())break;
  }
  machine_step(c);
 }
 check(!c->fault&&main_poll()&&first_poll_render&&c->vdp.rendered_frames>=first_poll_render+8,"original completed interactive Main poll after cold boot");
 check(dune_mouse_context(c)==0&&dune_word(c,0xc274)==65535&&dune_long(c,0xc278)==0,"cold Main has no player house or world context");
 check(c->audio_mode==AUDIO_ON&&c->audio.fm&&c->audio.frames&&c->audio.peak,"native original audio actually executed");
 int total=dune_save_state_to_buffer();DuneSaveState*s=(DuneSaveState*)g_dune_state_buffer;
 check(total>0&&s->version==2&&s->ym_size>0&&s->total_size==(unsigned)total,"current original v2 serializer includes YMFM state");
 dump("state.bin",g_dune_state_buffer,(size_t)total);dump("cpu.bin",c,sizeof*c);dump("rgb",c->vdp.frame,320*224*3);dump("ym.bin",g_dune_state_buffer+sizeof*s,s->ym_size);
 void*copy=genesis_ymfm_load_state(g_dune_state_buffer+sizeof*s,s->ym_size);check(copy!=NULL,"serialized YMFM state validates on load");
 uint8_t *roundtrip=malloc(s->ym_size);check(roundtrip&&genesis_ymfm_state_size(copy)==s->ym_size&&genesis_ymfm_save_state(copy,roundtrip,s->ym_size),"serialize restored YMFM state");
 check(!memcmp(roundtrip,g_dune_state_buffer+sizeof*s,s->ym_size),"YMFM portable byte roundtrip is identical");free(roundtrip);
 unsigned nonzero=0;for(unsigned i=0;i<4096;i++){int32_t a[2],b[2];uint64_t clock=c->master_cycles+(uint64_t)(i+1)*100;genesis_ymfm_advance(c->audio.fm,clock,a);genesis_ymfm_advance(copy,clock,b);check(a[0]==b[0]&&a[1]==b[1],"restored YMFM produces identical clocked stereo samples");nonzero+=a[0]!=0||a[1]!=0;}
 genesis_ymfm_destroy(copy);
 char path[4096];snprintf(path,sizeof path,"%s/report.json",output);FILE*f=fopen(path,"w");check(f!=NULL,"frontend report output");
 fprintf(f,"{\"scene\":\"main\",\"nativePollPc\":%u,\"nativePollSource\":%u,\"houseId\":-1,\"houseRaw\":%u,\"housePointer\":%u,\"credits\":null,\"mapContext\":%d,\"pc\":%u,\"stackPointer\":%u,\"frame\":%llu,\"completedFrame\":%llu,\"firstMainPollFrame\":%llu,\"settledCompletedFrames\":%llu,\"mainPollsObserved\":%u,\"currentVdpRgbMismatchBytes\":%u,\"z80Pc\":%u,\"z80Steps\":%llu,\"nativeAudioMode\":%d,\"nativeAudioFrames\":%llu,\"nativeAudioPeak\":%u,\"ymBytes\":%u,\"ymByteRoundtripIdentical\":true,\"ymClockedStereoParitySamples\":4096,\"ymProbeNonzeroSamples\":%u,\"nativeStructBytes\":%zu,\"payloadBytes\":%d,\"fault\":%d}\n",c->pc,dune_long(c,c->a[7]&65535),dune_word(c,0xc274),dune_long(c,0xc278),dune_mouse_context(c),c->pc,c->a[7],(unsigned long long)c->vdp.frames,(unsigned long long)c->vdp.rendered_frames,(unsigned long long)first_poll_frame,(unsigned long long)(c->vdp.rendered_frames-first_poll_render),polls,mismatch(),c->z80_cpu.pc,(unsigned long long)c->z80_cpu.steps,c->audio_mode,(unsigned long long)c->audio.frames,c->audio.peak,s->ym_size,nonzero,sizeof*s,total,c->fault);fclose(f);
 printf("PASS genuine cold Main, house=-1 context0; v2 %dbytes including %u YMFMbytes;4096 identical restored stereo samples\n",total,s->ym_size);
 audio_finish(c);return 0;
}
