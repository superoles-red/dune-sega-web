/* Native completed-palette/raster entry barrier, without browser timers. */
#define main existing_building_fixture_main
#include "test_em_web_building_ui.c"
#undef main
int main(int argc,char**argv){
 if(argc!=2)return 2;
 const unsigned types[]={8,11};
 for(unsigned t=0;t<2;t++){
  load(argv[1],1,9);unsigned producer=types[t]==8?own_building(8):create(types[t]),p=producer&65535;
  unsigned wx=dune_word(&c,p+12)/8+8,wy=dune_word(&c,p+10)/8+8,first_context=0,first_ready=0,not_ready_frames=0;
  uint64_t start=c.vdp.frames,last=c.vdp.frames;
  for(unsigned attempt=0;attempt<8&&!first_ready;attempt++){
   dune_mouse_world_click(&mouse,&c,wx,wy,DUNE_CLICK_SELECT);uint64_t end=c.vdp.frames+60;
   while(!c.fault&&c.vdp.frames<end){observe();machine_step(&c);if(c.vdp.frames==last)continue;last=c.vdp.frames;
    int context=dune_mouse_context(&c);if(context!=2&&context!=3)continue;
    if(!first_context)first_context=(unsigned)(c.vdp.frames-start);
    if(em_bui_presentation_ready(&c)){if(!first_ready)first_ready=(unsigned)(c.vdp.frames-start);}
    else not_ready_frames++;
   }
  }
  require(first_context&&first_ready&&first_ready>first_context&&not_ready_frames,"native entry has a rejected fade before its completed full-palette frame");
  uint16_t palette[64];memcpy(palette,c.vdp.cram,sizeof c.vdp.cram);frames(60);
  require(em_bui_presentation_ready(&c),"native settled frame stays ready");
  for(unsigned lane=1;lane<=3;lane+=2)for(unsigned i=0;i<16;++i)require(c.vdp.cram[lane*16+i]==palette[lane*16+i],"first published native chrome palette equals later settled native chrome palette");
  printf("PASS type%u native context frame%u -> completed full-palette frame%u, gated%u fade frames; +60frames identical chrome CRAM\n",types[t],first_context,first_ready,not_ready_frames);
 }
 return 0;
}
