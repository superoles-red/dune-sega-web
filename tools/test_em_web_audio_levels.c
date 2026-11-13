/* Differential AUDIO_ON fixture: identical original CPU/YM execution at every
 * output level. Test-only FF/16/12 FIFO commands are the exact original GEMS
 * play-sequence12 UI cue, not another synthesizer or browser feedback sound. */
#define GENESIS_NO_MAIN
#define GENESIS_AUDIO
#ifdef EM_WEB_LEVELS_BASELINE
#include "../.local/source/build/dune-base.c"
#else
#include "../.local/source/build/dune-web.c"
#endif
static CPU c;
static void check(int ok,const char*what){if(!ok){fprintf(stderr,"FAIL %s pc%x zpc%x %s\n",what,c.pc,c.z80_cpu.pc,c.reason?c.reason:"");exit(1);}}
static void write_file(const char*prefix,const char*suffix,const void*data,size_t bytes){char path[4096];snprintf(path,sizeof path,"%s.%s",prefix,suffix);FILE*f=fopen(path,"wb");check(f&&fwrite(data,1,bytes,f)==bytes,"write proof");fclose(f);}
static void cue(void){unsigned w=c.z80_bus.ram[0x36]&63,r=c.z80_bus.ram[0x37]&63;check(((r-w-1)&63)>=3,"native FIFO room");const uint8_t bytes[3]={255,16,12};for(unsigned i=0;i<3;++i){c.z80_bus.ram[0x1b40+w]=bytes[i];w=(w+1)&63;}c.z80_bus.ram[0x36]=(uint8_t)w;}
int main(int argc,char**argv){
 check(argc==4,"usage music sound output-prefix");int music=atoi(argv[1]),sound=atoi(argv[2]);
#ifndef EM_WEB_LEVELS_BASELINE
 check(em_web_audio_levels_set(music,sound),"valid levels");check(!em_web_audio_levels_set(75,100)&&em_web_music_level==(unsigned)music&&em_web_sound_level==(unsigned)sound,"invalid values leave current levels intact");
 check(em_web_audio_level_sample(127,10)==12&&em_web_audio_level_sample(-127,10)==-12,"10 percent scales signed PSG samples toward zero");
 /* Source ownership is retained in the physical table independently of a CCB
  * being reused; DAC uses actual physical FM channel 5, not a global mix gain. */
 CPU test={0};test.z80_bus.ram[0x1795]=0x08;test.z80_bus.ram[0x17b1]=0x48;test.z80_bus.ram[0x17c7]=0x88;test.z80_bus.ram[0x17d6]=0x18;
 em_web_audio_levels_sync(&test);check(em_web_audio_fm_levels[0]==(unsigned)sound&&em_web_audio_fm_levels[1]==(unsigned)music&&em_web_audio_fm_levels[5]==(unsigned)sound&&em_web_audio_psg_levels[0]==(unsigned)music&&em_web_audio_psg_levels[1]==(unsigned)sound&&em_web_audio_psg_levels[3]==(unsigned)sound,"FM/DAC/PSG/noise source mapping including release/free flags");
#endif
 FILE*f=fopen(".local/frontend-fixture/frontend.cpu.bin","rb");check(f&&fread(&c,sizeof c,1,f)==1,"real cold Main CPU");fclose(f);uint8_t ym[2048];f=fopen(".local/frontend-fixture/frontend.ym.bin","rb");check(f!=NULL,"real cold Main YM");size_t ym_n=fread(ym,1,sizeof ym,f);fclose(f);
 c.audio.fm=genesis_ymfm_load_state(ym,ym_n);check(c.audio.fm!=NULL,"restore real YM");c.rom=rom_data;c.rom_size=sizeof rom_data;c.audio_mode=AUDIO_ON;c.audio.wav=NULL;c.audio.playback=1;c.audio.read=c.audio.count=0;c.fault=0;c.reason=NULL;
 uint64_t first=c.vdp.frames,last=first,hash=1469598103934665603ull,energy=0,frames=0;unsigned music_seen=0,sfx_seen=0,psg_seen=0;int16_t pcm[2048];
 while(c.vdp.frames<first+120){
  if(c.vdp.frames!=last){last=c.vdp.frames;if((last-first)%20==1)cue();}
  machine_step(&c);check(!c.fault,"original native execution");
  if(c.audio.count>=800){unsigned n=audio_pop(&c,pcm,1024);for(unsigned i=0;i<n*2;++i){uint16_t s=(uint16_t)pcm[i];hash=(hash^(s&255))*1099511628211ull;hash=(hash^(s>>8))*1099511628211ull;energy+=(unsigned)(pcm[i]<0?-(int)pcm[i]:pcm[i]);}frames+=n;}
  const unsigned rows[6]={0x1795,0x179c,0x17b8,0x17a3,0x17aa,0x17b1};for(unsigned i=0;i<6;++i)if(!(c.z80_bus.ram[rows[i]]&128)){if(c.z80_bus.ram[rows[i]]&8)sfx_seen|=1u<<i;else music_seen|=1u<<i;}for(unsigned i=0;i<4;++i)if(c.psg.volume[i]!=15)psg_seen|=1u<<i;
 }
 check(music_seen&&sfx_seen&&psg_seen,"real driver produces music, native UI effect and PSG");check(genesis_ymfm_save_state(c.audio.fm,ym,ym_n),"serialize exact chip");write_file(argv[3],"ym",ym,ym_n);genesis_ymfm_destroy(c.audio.fm);c.audio.fm=NULL;
 // These fields contain only output PCM/filter integration, not chip clocks,
 // original registers, CPU/RAM, voice allocation, counters, AI or world state.
 c.rom=NULL;write_file(argv[3],"cpu-full",&c,sizeof c);
 c.audio.read=c.audio.count=c.audio.peak=0;memset(c.audio.ring,0,sizeof c.audio.ring);memset(c.audio.previous_input,0,sizeof c.audio.previous_input);memset(c.audio.filter,0,sizeof c.audio.filter);c.psg.area=0;
 write_file(argv[3],"cpu",&c,sizeof c);printf("music=%d sound=%d frames=%llu hash=%016llx energy=%llu musicChannels=%x sfxChannels=%x psgChannels=%x CPU=%zu YM=%zu\n",music,sound,(unsigned long long)frames,(unsigned long long)hash,(unsigned long long)energy,music_seen,sfx_seen,psg_seen,sizeof c,ym_n);return 0;
}
