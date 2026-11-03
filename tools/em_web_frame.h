/* Read-only companion to a completed native VDP render. Capture immediately
 * after rendered_frames increments; never replay live 68K sprite handlers. */
#ifndef DUNE_EM_WEB_FRAME_H
#define DUNE_EM_WEB_FRAME_H
static const CPU *em_web_frame_owner;
static VDP em_web_frame_vdp;
static uint64_t em_web_frame_id,em_web_frame_cache_id;
static int em_web_frame_valid,em_web_frame_cache_mode;
static const CPU*em_web_frame_hold_owner;static int em_web_frame_holding,em_web_frame_license_visible,em_web_frame_black;
static uint8_t em_web_frame_held[320*224*3];
static uint8_t em_web_frame_clean[320*224*3];
static void em_web_frame_invalidate(const CPU*c){em_web_frame_owner=c;em_web_frame_valid=0;em_web_frame_cache_mode=-1;em_web_frame_holding=0;}
static void em_web_frame_capture(const CPU*c){
 if(!em_web_frame_owner)em_web_frame_owner=c;
 if(c!=em_web_frame_owner||c->vdp.frame_width!=320||c->vdp.frame_height!=224)return;
 memcpy(&em_web_frame_vdp,&c->vdp,sizeof em_web_frame_vdp);
 em_web_frame_id=c->vdp.rendered_frames;em_web_frame_valid=1;em_web_frame_cache_mode=-1;
 em_web_frame_black=1;for(unsigned i=0;i<320*224*3;i++)if(c->vdp.frame[i]){em_web_frame_black=0;break;}
 /* Exact original settled-Main LICENSED BY SEGA plane-A shape, sourced from
  * title-menu-000040; RGB nonblack additionally proves actual visible ink. */
 uint32_t hash=2166136261u;int ink=0;for(unsigned y=202;y<208;y++)for(unsigned x=96;x<224;x++){unsigned a=vdp_plane_pixel(&em_web_frame_vdp,0,x,y)&63;hash=(hash^a)*16777619u;unsigned at=(y*320+x)*3;if(a==34&&(c->vdp.frame[at]||c->vdp.frame[at+1]||c->vdp.frame[at+2]))ink=1;}em_web_frame_license_visible=hash==0xe76b252du&&ink;
}
static int em_web_frame_current(const CPU*c){return em_web_frame_valid&&em_web_frame_owner==c&&em_web_frame_id==c->vdp.rendered_frames;}
static int em_web_frame_hold_active(const CPU*c){return em_web_frame_holding&&em_web_frame_hold_owner==c;}
static void em_web_frame_hold_begin(const CPU*c){if(c->vdp.frame_width==320&&c->vdp.frame_height==224){memcpy(em_web_frame_held,c->vdp.frame,sizeof em_web_frame_held);em_web_frame_hold_owner=c;em_web_frame_holding=1;}}
static void em_web_frame_hold_end(const CPU*c){if(em_web_frame_hold_owner==c)em_web_frame_holding=0;}
static const uint8_t*em_web_frame_present(const CPU*c){return em_web_frame_hold_active(c)?em_web_frame_held:c->vdp.frame;}
static unsigned em_web_frame_a_address(VDP*v,unsigned x,unsigned y){
 unsigned sx,sy;if(vdp_window_at(v,x,y))return ((v->registers[3]&0x3c)<<10)+((y/8)*64+x/8)*2;
 return vdp_plane_address(v,0,x,y,&sx,&sy);
}
static int em_web_frame_rect(unsigned x,unsigned y,unsigned rx,unsigned ry,unsigned rw,unsigned rh){return x>=rx&&x<rx+rw&&y>=ry&&y<ry+rh;}
static void em_web_frame_pixel(VDP*v,unsigned a,unsigned b,unsigned sprite,uint8_t*out){
 unsigned color=v->registers[7]&63,intensity=1;
 if(v->registers[1]&0x40){
  if(v->registers[12]&8){unsigned mixed=vdp_shadow_pixel(a,b,sprite,color);color=mixed&63;intensity=mixed>>6;}
  else {if(b&&!(b&128))color=b&63;if(a&&!(a&128))color=a&63;if(sprite&&!(sprite&128))color=sprite&63;if(b&128)color=b&63;if(a&128)color=a&63;if(sprite&128)color=sprite&63;}
 }
 unsigned rgb=v->cram[color];out[0]=vdp_channel((rgb>>1)&7,intensity);out[1]=vdp_channel((rgb>>5)&7,intensity);out[2]=vdp_channel((rgb>>9)&7,intensity);
}
/* Results descriptor labels use a separate native white alphabet (tiles
 * 02F5..030B, lane3), while live counters/rank use bank0500+ASCII, lane2.
 * These exact native rectangles exclude every numeric counter/clock cell.
 * Bit order is shared with localized-results.mjs; source geometry is320x224. */
static const uint16_t em_web_frame_results_labels[12][4]={
 {24,24,48,8},{200,24,40,8},{48,40,232,8},
 {88,88,144,8},{88,128,144,8},{72,168,184,8},
 {48,104,32,8},{32,112,48,8},{48,144,32,8},
 {32,152,48,8},{48,184,32,8},{32,192,48,8}
};
static int em_web_frame_results_label_at(unsigned x,unsigned y,unsigned entry){
 unsigned tile=entry&2047;if((entry&0xf800)!=0x6000||tile<0x2f5||tile>0x30b)return 0;
 for(unsigned i=0;i<12;i++){const uint16_t*r=em_web_frame_results_labels[i];if(em_web_frame_rect(x,y,r[0],r[1],r[2],r[3]))return 1;}
 return 0;
}
static int em_web_frame_results_rank_at(unsigned x,unsigned y,unsigned entry){
 unsigned tile=entry&2047;return em_web_frame_rect(x,y,0,56,320,8)&&(entry&0xf800)==0x4000&&tile>=0x520&&tile<=0x57e;
}
static unsigned em_web_frame_results_label_mask(const CPU*c){
 if(!em_web_frame_current(c))return 0;VDP*v=&em_web_frame_vdp;unsigned mask=0;
 for(unsigned i=0;i<12;i++){const uint16_t*r=em_web_frame_results_labels[i];for(unsigned x=r[0];x<r[0]+r[2];x+=8){unsigned entry=vdp_word(v,em_web_frame_a_address(v,x,r[1]));if(em_web_frame_results_label_at(x,r[1],entry)){mask|=1u<<i;break;}}}
 return mask;
}
static void em_web_frame_results_rank(const CPU*c,char*out){
 out[0]=0;if(!em_web_frame_current(c))return;VDP*v=&em_web_frame_vdp;unsigned used=0;
 for(unsigned i=0;i<40;i++){unsigned entry=vdp_word(v,em_web_frame_a_address(v,i*8,56)),tile=entry&2047;out[i]=em_web_frame_results_rank_at(i*8,56,entry)?(char)(tile-0x500):' ';if(out[i]!=' ')used=i+1;}
 out[used]=0;
}
static void em_web_frame_results_ink(const CPU*c,unsigned palette,uint8_t*out){
 unsigned rgb=em_web_frame_current(c)?em_web_frame_vdp.cram[palette&63]:0;
 out[0]=vdp_channel((rgb>>1)&7,1);out[1]=vdp_channel((rgb>>5)&7,1);out[2]=vdp_channel((rgb>>9)&7,1);
}
/* Only these actual ending/credits role strings may be replaced. Author names,
 * logos, legal notices and every other original plane-A pixel stay native.
 * Rows are decoded through the original completed VDP scroll/name-table rules;
 * y may be negative while a glyph row scrolls past the top of the screen. */
typedef struct{int x,y,width;char text[41];uint8_t ink[3];}EmWebLocalizedLine;
static int em_web_frame_credit_role(const char*text){
 static const char*const roles[]={"The End","Executive producer","Producers","Product Coordinators","Designers","Programmers","Writer","Artists","Music and Sound","Voices","Frank Klepacki - House voices","Glenn Sperry - Units","Quality Assurance","Special thanks to","Thank you for playing"};
 for(unsigned i=0;i<sizeof roles/sizeof roles[0];i++)if(!strcmp(text,roles[i]))return 1;return 0;
}
static int em_web_frame_credit_glyph(unsigned entry){unsigned tile=entry&2047,lane=entry&0xf800;return (lane==0x4000||lane==0x6000)&&tile>=0x4a0&&tile<=0x4fe;}
static unsigned em_web_frame_credit_lines(const CPU*c,EmWebLocalizedLine*lines,unsigned capacity){
 if(!em_web_frame_current(c))return 0;VDP*v=&em_web_frame_vdp;unsigned count=0;
 for(int y=0;y<224&&count<capacity;){
  unsigned sx,sy;vdp_plane_address(v,0,0,(unsigned)y,&sx,&sy);int origin=y-(int)(sy&7),next=origin+8;
  if((sx&7)||vdp_window_at(v,0,(unsigned)y)){y=next;continue;}
  char text[41];int first=40,last=-1;unsigned first_entry=0;
  for(unsigned x=0;x<40;x++){unsigned at=em_web_frame_a_address(v,x*8,(unsigned)y),entry=vdp_word(v,at);text[x]=em_web_frame_credit_glyph(entry)?(char)((entry&2047)-0x480):' ';if(text[x]!=' '){if(first==40){first=(int)x;first_entry=entry;}last=(int)x;}}
  text[40]=0;
  if(last>=first){text[last+1]=0;if(em_web_frame_credit_role(text+first)){EmWebLocalizedLine*line=&lines[count++];line->x=first*8;line->y=origin;line->width=(last-first+1)*8;snprintf(line->text,sizeof line->text,"%s",text+first);em_web_frame_results_ink(c,((first_entry>>9)&0x30)|13,line->ink);}}
  y=next;
 }
 return count;
}
/* A native victory/loss formation is a fixed-screen sprite, not a unit.
 * Reproject only its presentation copy onto the existing adapted viewport.
 * Original 7-plane artwork/spacing and native phase/coordinates stay intact. */
static unsigned em_web_frame_ram16(const CPU*c,unsigned at){return ((unsigned)c->ram[at]<<8)|c->ram[at+1];}
static unsigned em_web_frame_ram32(const CPU*c,unsigned at){return (em_web_frame_ram16(c,at)<<16)|em_web_frame_ram16(c,at+2);}
static void em_web_frame_put16(CPU*c,unsigned at,unsigned value){c->ram[at]=(uint8_t)(value>>8);c->ram[at+1]=(uint8_t)value;}
static void em_web_frame_put32(CPU*c,unsigned at,unsigned value){em_web_frame_put16(c,at,value>>16);em_web_frame_put16(c,at+2,value);}
static int em_web_frame_flyover_active(const CPU*c){return !c->fault&&em_web_frame_ram32(c,0xe002)==0xb544;}
static int em_web_frame_project_flyover(CPU*shadow,const CPU*source,unsigned node,int left,int top,unsigned width,unsigned height,int ui){
 if(node>65520||!em_web_frame_flyover_active(source)||em_web_frame_ram32(source,node)!=0xffd306u)return 0;
 if(ui){shadow->ram[node+7]|=0x80;return 1;}
 if(!width||!height)return 0;
 int x=(int)(int16_t)em_web_frame_ram16(source,0xd306),y=(int)(int16_t)em_web_frame_ram16(source,0xd308);
 int wx=left+(int)((int64_t)x*width/320),wy=top+(int)((int64_t)y*height/224);
 em_web_frame_put32(shadow,node,0xffefa8);em_web_frame_put16(shadow,0xefa8,(unsigned)(wy*8));em_web_frame_put16(shadow,0xefaa,(unsigned)(wx*8));shadow->ram[node+7]&=(uint8_t)~0x40u;return 1;
}
/* mode1: original story glyph cells and the two native choice sprites.
 * mode2: main choice glyphs from the first original choice-write; neither logo nor copyright is masked. */
static const uint8_t*em_web_frame_textless(const CPU*c,int mode){
 if(!mode)return em_web_frame_present(c);
 if(!em_web_frame_valid||em_web_frame_owner!=c||em_web_frame_id!=c->vdp.rendered_frames)return NULL;
 if(em_web_frame_cache_mode==mode&&em_web_frame_cache_id==em_web_frame_id)return em_web_frame_clean;
 static uint8_t sprites[320*224];VDP*v=&em_web_frame_vdp;memset(sprites,0,sizeof sprites);
 EmWebLocalizedLine credits[29];unsigned credit_count=mode==6?em_web_frame_credit_lines(c,credits,29):0;
 if(v->registers[1]&0x40)vdp_sprites(v,320,224,sprites);
 memcpy(em_web_frame_clean,v->frame,sizeof em_web_frame_clean);
 for(unsigned y=0;y<224;y++)for(unsigned x=0;x<320;x++){
  if(mode==6){unsigned entry=vdp_word(v,em_web_frame_a_address(v,x,y));if(em_web_frame_credit_glyph(entry))for(unsigned i=0;i<credit_count;i++){EmWebLocalizedLine*r=&credits[i];if((int)x>=r->x&&(int)x<r->x+r->width&&(int)y>=r->y&&(int)y<r->y+8){em_web_frame_pixel(v,0,vdp_plane_pixel(v,1,x,y),sprites[y*320+x],em_web_frame_clean+(y*320+x)*3);break;}}continue;}
  if(mode==5){unsigned entry=vdp_word(v,em_web_frame_a_address(v,x,y));if(em_web_frame_results_label_at(x,y,entry)||em_web_frame_results_rank_at(x,y,entry))em_web_frame_pixel(v,0,vdp_plane_pixel(v,1,x,y),sprites[y*320+x],em_web_frame_clean+(y*320+x)*3);continue;}
  if(mode==3){unsigned sx,sy,at=vdp_plane_address(v,0,x,y,&sx,&sy);if(!vdp_window_at(v,x,y)&&at>=0xee00&&at<0xfc00)em_web_frame_pixel(v,0,vdp_plane_pixel(v,1,x,y),sprites[y*320+x],em_web_frame_clean+(y*320+x)*3);continue;}
  int story=(mode==1||mode==4);
  int words=story?em_web_frame_rect(x,y,16,16,288,40):em_web_frame_rect(x,y,128,160,80,24);
  int choices=mode==4?0:mode==1?(em_web_frame_rect(x,y,184,164,96,24)||em_web_frame_rect(x,y,184,188,96,28)):em_web_frame_rect(x,y,104,156,144,32);
  if(!words&&!choices)continue;
  unsigned at=em_web_frame_a_address(v,x,y),entry=vdp_word(v,at),tile=entry&2047;
  int hide_text=words&&(entry&0xf800)==(story?0xc000:0x6000)&&tile>=0x480&&tile<=0x4de;
  if(!hide_text&&!choices)continue;
  unsigned b=vdp_plane_pixel(v,1,x,y),a=hide_text?0:vdp_window_at(v,x,y)?vdp_window_pixel(v,x,y,1):vdp_plane_pixel(v,0,x,y);
  em_web_frame_pixel(v,a,b,choices?0:sprites[y*320+x],em_web_frame_clean+(y*320+x)*3);
 }
 em_web_frame_cache_id=em_web_frame_id;em_web_frame_cache_mode=mode;return em_web_frame_clean;
}
#endif
