/* Dune's original map descriptors and native sprite traversal, presentation only. */
#ifndef GENESIS_DUNE_VIEW_H
#define GENESIS_DUNE_VIEW_H
#ifdef GENESIS_DUNE_MOUSE
typedef struct {
    CPU *shadow;
    uint8_t *pixels,*ui;
    unsigned zoom,width,height;
    int left,top,cursor_valid,cursor_x,cursor_y,cursor_hidden;
    int camera_valid,camera_x,camera_y,last_camera_x,last_camera_y;
    int pointer_valid,pointer_x,pointer_y;
    uint64_t pan_frame;
    uint64_t frame;
} DuneView;
typedef struct {
    int width,height,world_width,world_height,left,top;
    double ui_scale,world_scale,ui_x,ui_y;
} DuneLayout;
static DuneLayout dune_view_layout(const CPU *c,int w,int h,unsigned zoom){
    DuneLayout p={0};p.width=w;p.height=h;
    if(w<=0 || h<=0 || !c->vdp.frame_width || !c->vdp.frame_height)return p;
    if(zoom<50)zoom=50;if(zoom>100)zoom=100;
    p.ui_scale=(double)w/c->vdp.frame_width;
    if((double)h/c->vdp.frame_height<p.ui_scale)p.ui_scale=(double)h/c->vdp.frame_height;
    p.ui_x=(w-c->vdp.frame_width*p.ui_scale)/2;p.ui_y=(h-c->vdp.frame_height*p.ui_scale)/2;
    p.world_scale=p.ui_scale*zoom/100.0;
    if(w/1024.0>p.world_scale)p.world_scale=w/1024.0;
    if(h/768.0>p.world_scale)p.world_scale=h/768.0;
    p.world_width=(int)(w/p.world_scale+0.999);p.world_height=(int)(h/p.world_scale+0.999);
    p.left=(int)dune_word(c,0xe3ec)+160-p.world_width/2;
    p.top=(int)dune_word(c,0xe3ee)+112-p.world_height/2;
    return p;
}
static unsigned dune_view_rom_word(const CPU *c,unsigned a){
    return a+1<c->rom_size?((unsigned)c->rom[a]<<8)|c->rom[a+1]:0;
}
static void dune_view_rgb(const VDP *v,unsigned a,unsigned b,unsigned s,uint8_t *out){
    unsigned color=v->registers[7]&63,intensity=1;
    if(v->registers[12]&8){unsigned mix=vdp_shadow_pixel(a,b,s,color);color=mix&63;intensity=mix>>6;}
    else{
        if(b && !(b&128))color=b&63;if(a && !(a&128))color=a&63;
        if(s && !(s&128))color=s&63;if(b&128)color=b&63;
        if(a&128)color=a&63;if(s&128)color=s&63;
    }
    unsigned rgb=v->cram[color];out[0]=vdp_channel((rgb>>1)&7,intensity);
    out[1]=vdp_channel((rgb>>5)&7,intensity);out[2]=vdp_channel((rgb>>9)&7,intensity);
}
static void dune_view_terrain(const CPU *c,int wx,int wy,unsigned *a,unsigned *b){
    *a=*b=0;if(wx<0 || wy<0 || wx>=2048 || wy>=2048)return;
    unsigned map=0x7d9c+((wy/32)*64+wx/32)*4,word=dune_word(c,map);
    unsigned cell=((wy&31)/8)*8+((wx&31)/8)*2,overlay=(word>>8)&254;
    if(c->ram[0xc198] && overlay>=0x67)overlay=0;
    unsigned ae=dune_view_rom_word(c,0x4adf0+overlay*16+cell);
    unsigned be=dune_view_rom_word(c,0x4adf0+(word&511)*32+cell);
    *a=vdp_tile_pixel(&c->vdp,ae,wx&7,wy&7);*b=vdp_tile_pixel(&c->vdp,be,wx&7,wy&7);
}
static int dune_view_sprites(DuneView *v,const CPU *source,int left,int top,uint8_t *sprites,int ui){
    CPU *c=v->shadow;memcpy(c,source,sizeof *c);c->audio_mode=AUDIO_STUB;
    unsigned head=dune_word(c,0xf3ac),at=head;
    for(unsigned n=0;at && n<512;++n){
        if(at>65520)return 0;
        /* Fixed UI is composited separately. Freeze animation counters on the copy. */
        /* BF18 is the screen cursor. BF60 is a separate WORLD order marker;
           moving that marker left the real cursor in the HUD layer. */
        if(at==dune_word(c,0xbf18)){
            if(ui || v->cursor_hidden)c->ram[at+7]|=0x80;
            else{
                int wx=v->cursor_valid?v->cursor_x:dune_word(source,0xe3ec)+dune_word(source,0xbf12);
                int wy=v->cursor_valid?v->cursor_y:dune_word(source,0xe3ee)+dune_word(source,0xbf14);
                /* $6092 is the grid cursor; $6D10 is the free pointer. */
                if(v->cursor_valid && dune_long(source,0xe002)==0x6092){wx&=~31;wy&=~31;}
                write_mem(c,0xff0000+at,4,0xffefa0);
                write_mem(c,0xffefa0,2,wy*8);write_mem(c,0xffefa2,2,wx*8);
                c->ram[at+7]&=(uint8_t)~0x44;
            }
        }else if(!!(c->ram[at+7]&0x40)!=!!ui)c->ram[at+7]|=0x80;
        c->ram[at+4]=2;at=dune_word(c,at+14);
    }
    c->ram[0xe3be]=(uint8_t)(left>>8);c->ram[0xe3bf]=(uint8_t)left;
    c->ram[0xe3c0]=(uint8_t)(top>>8);c->ram[0xe3c1]=(uint8_t)top;
    c->pc=0x1088;c->a[0]=(uint32_t)(int32_t)(int16_t)head;c->sr=0x2700;c->a[7]=0xffef00;
    write_mem(c,c->a[7],4,0xdead00);
    unsigned steps=0;
    while(!c->fault && c->pc!=0xdead00 && steps++<100000)translated_step(c);
    if(c->fault || c->pc!=0xdead00)return 0;
    unsigned sat=(c->vdp.registers[5]&0x7e)<<9;
    for(unsigned i=0;i<640;++i)c->vdp.vram[(sat+i)&65535]=c->ram[0xe428+i];
    memset(sprites,0,320*224);vdp_sprites(&c->vdp,320,224,sprites);return 1;
}
static int dune_view_build(DuneView *v,const CPU *c,const DuneLayout *p){
    if(!p->world_width || !p->world_height)return 0;
    if(!v->shadow)v->shadow=malloc(sizeof *v->shadow);
    if(!v->shadow)return 0;
    if(v->width!=(unsigned)p->world_width || v->height!=(unsigned)p->world_height){
        size_t size=(size_t)p->world_width*p->world_height*3;
        uint8_t *pixels=realloc(v->pixels,size);if(!pixels)return 0;
        v->pixels=pixels;v->width=p->world_width;v->height=p->world_height;
    }
    uint8_t sprites[320*224];
    for(unsigned by=0;by<v->height;by+=192)for(unsigned bx=0;bx<v->width;bx+=256){
        if(!dune_view_sprites(v,c,p->left+(int)bx-32,p->top+(int)by-16,sprites,0))return 0;
        unsigned bw=v->width-bx<256?v->width-bx:256,bh=v->height-by<192?v->height-by:192;
        for(unsigned y=0;y<bh;++y)for(unsigned x=0;x<bw;++x){
            unsigned a,b;int wx=p->left+bx+x,wy=p->top+by+y;
            dune_view_terrain(c,wx,wy,&a,&b);
            unsigned s=sprites[(y+16)*320+x+32];
            uint8_t *out=v->pixels+((by+y)*v->width+bx+x)*3;
            if(wx<0 || wy<0 || wx>=2048 || wy>=2048)memset(out,0,3);
            else dune_view_rgb(&v->shadow->vdp,a,b,s,out);
        }
    }
    if(!v->ui)v->ui=malloc(320*224*4);
    if(!v->ui || !dune_view_sprites(v,c,dune_word(c,0xe3ec),dune_word(c,0xe3ee),sprites,1))return 0;
    /* Alpha alone cannot isolate the HUD: the live framebuffer already has
       the world cursor/placement preview over its opaque minimap pixels. */
    uint8_t clean_ui[320*224*3];
    vdp_render_pixels(&v->shadow->vdp,320,224,sprites,clean_ui);
    int minimap_visible=0;
    for(unsigned y=144;y<208;++y)for(unsigned x=240;x<304;++x)minimap_visible|=sprites[y*320+x]!=0;
    for(unsigned y=0;y<224;++y)for(unsigned x=0;x<320;++x){
        unsigned at=y*320+x;
        memcpy(v->ui+at*4,clean_ui+at*3,3);
        int minimap=minimap_visible && x>=240 && x<304 && y>=144 && y<208;
        v->ui[at*4+3]=(minimap || sprites[at])?255:0;
        /* Keep the original frame pixel-exact in its central world area.
           A virtual cursor outside that area needs the replayed world layer. */
        int xx=(int)dune_word(c,0xe3ec)+(int)x-p->left;
        int yy=(int)dune_word(c,0xe3ee)+(int)y-p->top;
        if(!v->cursor_valid && !v->cursor_hidden && !v->ui[at*4+3] && xx>=0 && yy>=0 && xx<(int)v->width && yy<(int)v->height)
            memcpy(v->pixels+((unsigned)yy*v->width+(unsigned)xx)*3,c->vdp.frame+at*3,3);
    }
    v->left=p->left;v->top=p->top;v->frame=c->vdp.rendered_frames;return 1;
}
#endif
#endif
