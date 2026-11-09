/* Synthetic DAC signal is a focused output-isolation fixture, not gameplay.
 * Compare the actual original saved YM state and raw interpolation history. */
#include "../.local/source/build/dune-web-audio.cpp"
#include <cstdio>
#include <cstdlib>
static void check(bool ok,const char*what){if(!ok){std::fprintf(stderr,"FAIL %s\n",what);std::exit(1);}}
static void reg(void*g,unsigned address,uint8_t value){genesis_ymfm_write(g,0,uint8_t(address));genesis_ymfm_write(g,1,value);}
int main(){
 void*chips[4]={genesis_ymfm_create(),genesis_ymfm_create(),genesis_ymfm_create(),genesis_ymfm_create()};
 unsigned gains[4][6]={{100,100,100,100,100,100},{100,100,100,100,100,50},{100,100,100,100,100,25},{100,100,100,100,100,0}};
 for(unsigned k=0;k<4;++k){check(chips[k],"allocate actual YMFM");genesis_ymfm_output_levels(chips[k],gains[k]);reg(chips[k],0x2b,0x80);genesis_ymfm_write(chips[k],2,0xb6);genesis_ymfm_write(chips[k],3,0xc0);}
 int32_t last[4]={0,0,0,0};unsigned edges=0;
 for(unsigned n=0;n<256;++n){
  int32_t out[4][2];for(unsigned k=0;k<4;++k){reg(chips[k],0x2a,(n/16)&1?0xe0:0x20);genesis_ymfm_advance(chips[k],uint64_t(n+1)*1008,out[k]);check(out[k][0]==out[k][1],"original centered DAC stays stereo centered");}
  if(n>4){int32_t full=out[0][0]-last[0],half=out[1][0]-last[1],quarter=out[2][0]-last[2],off=out[3][0]-last[3];if(std::abs(full)>100){++edges;check(std::abs(half*2-full)<=4,"DAC 50 percent halves amplitude without scaling other voices");check(std::abs(quarter*4-full)<=8,"DAC 25 percent quarters amplitude without scaling other voices");}check(!off,"DAC OFF removes its signal modulation");}
  for(unsigned k=0;k<4;++k)last[k]=out[k][0];
 }
 check(edges>=10,"DAC fixture has audible changing signal");
 size_t bytes=genesis_ymfm_state_size(chips[0]);std::vector<uint8_t> expected(bytes),actual(bytes);check(genesis_ymfm_save_state(chips[0],expected.data(),bytes),"save original unity chip");
 for(unsigned k=1;k<4;++k){check(genesis_ymfm_state_size(chips[k])==bytes&&genesis_ymfm_save_state(chips[k],actual.data(),bytes)&&actual==expected,"all YM registers, feedback, timers and raw interpolation remain byte-identical");}
 for(void*g:chips)genesis_ymfm_destroy(g);
 std::printf("PASS DAC independent100/50/25/OFF amplitude, %u signal edges, identical original %zu-byte YMFM state\n",edges,bytes);return 0;
}
