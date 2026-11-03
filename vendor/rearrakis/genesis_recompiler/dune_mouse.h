/* Mouse intent for the verified Dune USA ROM; native code still selects and orders. */
#ifndef GENESIS_DUNE_MOUSE_H
#define GENESIS_DUNE_MOUSE_H
#ifdef GENESIS_DUNE_MOUSE
enum { DUNE_CLICK_SELECT=1, DUNE_CLICK_ORDER=2, DUNE_CLICK_CANCEL=3 };
typedef struct { int x,y,action,world,wx,wy; } DuneClick;
typedef struct {
    int enabled,x,y,dirty,stage,context,point_world,wx,wy;
    int camera_hold,pan_x,pan_y;
    int tile_valid,tile_wx,tile_wy;
    unsigned head,count;
    int front_kind;
    uint32_t front_callback,front_source;
    uint64_t front_frame,cooldown;
    uint64_t moves,clicks;
    DuneClick queue[8];
} DuneMouse;
static unsigned dune_word(const CPU *c,unsigned a) {
    return ((unsigned)c->ram[a]<<8)|c->ram[a+1];
}
static uint32_t dune_long(const CPU *c,unsigned a) {
    return (dune_word(c,a)<<16)|dune_word(c,a+2);
}
static void dune_mouse_reset(DuneMouse *m) {
    m->dirty=m->stage=m->point_world=m->camera_hold=m->pan_x=m->pan_y=0;m->head=m->count=0;
    m->tile_valid=0;
}
static int dune_mouse_context(const CPU *c) {
    if(c->fault || !c->vdp.rendered_frames)return 0;
    uint32_t callback=dune_long(c,0xe002);
    if(callback==0x4504){
        uint32_t building=dune_long(c,0xc578);
        if(building>=0xff0000 && building<=0xffffa0){
            unsigned type=c->ram[(building&65535)+2];
            if(type==c->ram[0xbf85] && type>=2 && type<=18 &&
               type!=6 && type!=14)return type==11?3:2;
        }
    }
    if(callback!=0x6092 && callback!=0x6d10)return 0;
    unsigned left=dune_word(c,0xbf1a),top=dune_word(c,0xbf1c);
    unsigned right=dune_word(c,0xbf1e),bottom=dune_word(c,0xbf20);
    return left<right && top<bottom && right<=c->vdp.frame_width &&
           bottom<=c->vdp.frame_height ? 1:0;
}
static int dune_mouse_game(const CPU *c) {return dune_mouse_context(c)==1;}
static int dune_mouse_cell(const CPU *c,int x,int y,int *col,int *row) {
    int starport=dune_mouse_context(c)==3;
    if(x<32 || x>=128 || y<48 || y>=(starport?144:192))return 0;
    *col=(x-32)/32;*row=(y-48)/24;
    return c->ram[(starport?0xbfcc:0xbf8e) + *row*3 + *col]!=(starport?0xff:0x80);
}
/* These are native pad-read continuations, rather than a guess from a title
   image or a callback shared by unrelated screens. */
static int dune_mouse_front_poll(const CPU *c){
    switch(c->pc){
    case 0x4938:return 6; /* house picker */
    case 0x25cb2:return 7; /* YES/NO confirmation */
    case 0x4d4e:{
        unsigned sp=c->a[7]&65535;
        return sp<=65532 && dune_long(c,sp)==0x178d2?5:4;
    }
    case 0x4724:case 0x17d22:case 0x17e96:case 0x17ea6:case 0x17eb6:
        return 4;
    default:return 0;
    }
}
static int dune_mouse_active(const DuneMouse *m,const CPU *c){
    int context=dune_mouse_context(c);
    int front=!c->fault && c->vdp.rendered_frames && m->front_kind &&
        m->front_callback==dune_long(c,0xe002) &&
        c->vdp.frames-m->front_frame<=4?m->front_kind:0;
    if(context==1)return context;
    if(front>=5)return front;
    return context?context:front;
}
static int dune_mouse_point(DuneMouse *m,const CPU *c,int x,int y) {
    if(!m->enabled || !dune_mouse_active(m,c) || x<0 || y<0 ||
       x>=(int)c->vdp.frame_width || y>=(int)c->vdp.frame_height)return 0;
    int context=dune_mouse_active(m,c);
    if(m->context!=context){dune_mouse_reset(m);m->context=context;}
    m->point_world=0;m->x=x;m->y=y;m->dirty=1;
    if(context==1)m->camera_hold=1;
    return 1;
}
static void dune_mouse_click(DuneMouse *m,const CPU *c,int x,int y,int action) {
    if(!dune_mouse_point(m,c,x,y))return;
    if(m->context>=4){
        if(c->vdp.frames<m->cooldown || m->count)return;
        if(m->context==5 && (x<104 || x>=248 || y<156 || y>=184))return;
        if(m->context==6 && (y<32 || y>=208))return;
    }
    int col,row;
    if((m->context==2 || m->context==3) && action==DUNE_CLICK_SELECT &&
       !dune_mouse_cell(c,x,y,&col,&row))return;
    if(m->count==8)return;
    m->queue[(m->head+m->count++)%8]=(DuneClick){x,y,action};
}
static int dune_mouse_world_point(DuneMouse *m,const CPU *c,int wx,int wy){
    if(!m->enabled || dune_mouse_context(c)!=1 || wx<0 || wy<0 || wx>=2048 || wy>=2048)return 0;
    if(m->context!=1){dune_mouse_reset(m);m->context=1;}
    m->point_world=1;m->camera_hold=1;m->wx=wx;m->wy=wy;m->dirty=1;return 1;
}
static void dune_mouse_world_click(DuneMouse *m,const CPU *c,int wx,int wy,int action){
    if(!dune_mouse_world_point(m,c,wx,wy) || m->count==8)return;
    m->queue[(m->head+m->count++)%8]=(DuneClick){.action=action,.world=1,.wx=wx,.wy=wy};
}
static int dune_mouse_world_local(const CPU *c,int wx,int wy,int *x,int *y){
    /* Grid picking adds 16 ($646C); free picking uses the origin ($7002). */
    int inset=dune_long(c,0xe002)==0x6d10?0:16;
    *x=wx-(int)dune_word(c,0xe3ec)-inset;*y=wy-(int)dune_word(c,0xe3ee)-inset;
    /* The pad cursor has a 24px inset, even at the mission's world border.
       Keep its visible position legal; tile picking below retains the exact
       world cell rather than rejecting or selecting the neighbouring cell. */
    if(wx>=(int)dune_word(c,0xe3d2) && wx<(int)dune_word(c,0xe3d4)+(int)c->vdp.frame_width &&
       wy>=(int)dune_word(c,0xe3ce) && wy<(int)dune_word(c,0xe3d0)+(int)c->vdp.frame_height){
        int left=dune_word(c,0xbf1a),right=dune_word(c,0xbf1e),top=dune_word(c,0xbf1c),bottom=dune_word(c,0xbf20);
        int cx=dune_word(c,0xe3ec),cy=dune_word(c,0xe3ee);
        if(*x<left && cx==(int)dune_word(c,0xe400))*x=left;
        if(*x>right && cx==(int)dune_word(c,0xe402))*x=right;
        if(*y<top && cy==(int)dune_word(c,0xe3fc))*y=top;
        if(*y>bottom && cy==(int)dune_word(c,0xe3fe))*y=bottom;
    }
    return *x>=(int)dune_word(c,0xbf1a) && *x<=(int)dune_word(c,0xbf1e) &&
           *y>=(int)dune_word(c,0xbf1c) && *y<=(int)dune_word(c,0xbf20);
}
static void dune_mouse_pan(DuneMouse *m,CPU *c){
    if(c->pc!=0x78d0 || !m->camera_hold || c->pad_buttons[0] || dune_mouse_context(c)!=1)return;
    int queued=m->count && m->queue[m->head].world;
    if(!queued){
        c->d[0]=(c->d[0]&~65535u);
        c->d[1]=(c->d[1]&~65535u);
        return;
    }
    DuneClick *q=&m->queue[m->head];int x,y;
    int visible=dune_mouse_world_local(c,q->wx,q->wy,&x,&y);
    int moved=0;
    for(unsigned axis=0;axis<2;++axis){
        int pos=dune_word(c,0xe3ec+axis*2);
        int target=axis?q->wy-112:q->wx-160;
        unsigned bound=axis?0xe3fc:0xe400;
        int low=(int16_t)dune_word(c,bound),high=(int16_t)dune_word(c,bound+2);
        if(low<=high){if(target<low)target=low;if(target>high)target=high;}
        int delta=visible?0:target-pos;if(delta>7)delta=7;if(delta<-7)delta=-7;
        moved|=delta!=0;
        /* $78D8 stores D0/D1 into the camera delta fields itself. */
        c->d[axis]=(c->d[axis]&~65535u)|(uint16_t)delta;
    }
    /* The original mission camera bounds may exclude a border cell. Do not
       turn an unreachable click into a command at a different coordinate. */
    if(!visible && !moved){m->head=(m->head+1)%8;--m->count;m->stage=0;}
}
static void dune_mouse_warp(DuneMouse *m,CPU *c,int x,int y) {
    int left=dune_word(c,0xbf1a),top=dune_word(c,0xbf1c);
    int right=dune_word(c,0xbf1e),bottom=dune_word(c,0xbf20);
    if(x<left)x=left;if(x>right)x=right;
    if(y<top)y=top;if(y>bottom)y=bottom;
    c->ram[0xbf12]=(uint8_t)(x>>8);c->ram[0xbf13]=(uint8_t)x;
    c->ram[0xbf14]=(uint8_t)(y>>8);c->ram[0xbf15]=(uint8_t)y;
    /* Clear a previous controller delta, not the camera or world position. */
    memset(c->ram+0xbf0e,0,4);++m->moves;
}
static void dune_mouse_pop(DuneMouse *m) {
    m->head=(m->head+1)%8;--m->count;m->stage=0;++m->clicks;
}
static void dune_mouse_observe(DuneMouse *m,CPU *c) {
    if(!m->enabled)return;
    if((c->pc==0x6486 || c->pc==0x701c) && m->tile_valid){
        if(!c->pad_buttons[0] && dune_mouse_context(c)==1){
            unsigned tile=(m->tile_wy/32)*64+m->tile_wx/32;
            c->ram[0xc240]=tile>>8;c->ram[0xc241]=tile;
        }
        m->tile_valid=0;
    }
    dune_mouse_pan(m,c);
    int front=dune_mouse_front_poll(c);
    if(front && (front>=5 || !dune_mouse_context(c))){
        uint32_t callback=dune_long(c,0xe002),source=c->pc;
        if(c->pc==0x4d4e){
            unsigned sp=c->a[7]&65535;
            source=sp<=65532?dune_long(c,sp):0;
        }else if(c->pc==0x17ea6 || c->pc==0x17eb6)source=0x17e96;
        if(m->front_kind!=front || m->front_callback!=callback || m->front_source!=source){
            dune_mouse_reset(m);m->context=front;
        }
        m->front_kind=front;m->front_callback=callback;m->front_source=source;
        m->front_frame=c->vdp.frames;
        if(c->pad_buttons[0]){dune_mouse_reset(m);return;}
        if(!m->dirty && !m->count)return;
        int x=m->count?m->queue[m->head].x:m->x;
        int y=m->count?m->queue[m->head].y:m->y;
        int ready=1;unsigned key=0;
        if(front==5){
            if(x<104 || x>=248 || y<156 || y>=184){m->dirty=0;return;}
            unsigned target=160+8*((y-156)/8),current=dune_word(c,0xd70e);
            if(current!=target){key=current>target?1:2;ready=0;}
        }else if(front==6){
            unsigned target=x<104?32:x<192?120:208,current=dune_word(c,0xbef8);
            if(dune_word(c,0xbf02)){ready=0;}
            else if(current!=target){key=current>target?4:8;ready=0;}
        }else if(front==7){
            unsigned target=y<180?0x128:0x140,current=dune_word(c,0xa62c);
            if(current!=target){key=current>target?1:2;ready=0;}
        }
        if(key){c->d[0]=key;++m->moves;}
        if(ready){
            m->dirty=0;
            if(m->count){
                c->d[0]=0x40;dune_mouse_pop(m);dune_mouse_reset(m);
                m->cooldown=c->vdp.frames+20;
            }
        }
        return;
    }
    if(!m->dirty && !m->count)return;
    if(c->pc!=0x6176 && c->pc!=0x617a && c->pc!=0x6e02 && c->pc!=0x6e06 &&
       c->pc!=0x847e && c->pc!=0x28884 && c->pc!=0x9188 && c->pc!=0x28ac0)return;
    int context=dune_mouse_context(c);
    if(!context || context!=m->context || c->pad_buttons[0]){
        dune_mouse_reset(m);m->context=context;return;
    }
    if(context==2 || context==3){
        int starport=context==3;
        int x=m->count?m->queue[m->head].x:m->x;
        int y=m->count?m->queue[m->head].y:m->y;
        if(m->count && m->queue[m->head].action!=DUNE_CLICK_SELECT){x=48;y=60;}
        int col,row,hit=dune_mouse_cell(c,x,y,&col,&row);
        unsigned current_col=dune_word(c,starport?0xbfc8:0xbf8a);
        unsigned current_row=dune_word(c,starport?0xbfca:0xbf8c);
        if(!hit && !m->count){m->dirty=0;return;}
        if(c->pc==(starport?0x9188:0x847e) && hit && current_col<3 && current_row<(starport?4u:6u)){
            /* Walk through enabled cells: some factories leave holes in the
               grid, so a fixed horizontal-first route can get stuck. */
            unsigned direction=0,base=starport?0xbfcc:0xbf8e;
            int rows=starport?4:6,start=current_row*3+current_col,target=row*3+col;
            int queue[18],prev[18],edge[18],head=0,tail=0;
            for(int i=0;i<18;++i)prev[i]=-1;
            queue[tail++]=start;prev[start]=start;
            while(head<tail && prev[target]<0){
                int at=queue[head++],cx=at%3,cy=at/3;
                const int dx[]={-1,1,0,0},dy[]={0,0,-1,1};
                const unsigned keys[]={PAD_LEFT,PAD_RIGHT,PAD_UP,PAD_DOWN};
                for(int k=0;k<4;++k){
                    int nx=cx+dx[k],ny=cy+dy[k],next=ny*3+nx;
                    if(nx<0 || nx>=3 || ny<0 || ny>=rows || prev[next]>=0 ||
                       c->ram[base+next]==(starport?0xff:0x80))continue;
                    prev[next]=at;edge[next]=keys[k];queue[tail++]=next;
                }
            }
            if(target!=start && prev[target]>=0){
                int next=target;
                while(prev[next]!=start)next=prev[next];
                direction=edge[next];
            }
            /* Original arrow navigation updates highlighting and item details. */
            if(direction){c->a[0]=direction*2;++m->moves;}
            else {m->dirty=0;if(target!=start && m->count)dune_mouse_pop(m);}
        }else if(c->pc==(starport?0x28ac0:0x28884) && m->count){
            if(hit && current_col==(unsigned)col && current_row==(unsigned)row){
                c->d[0]='A';c->ram[0xbf2b]='A';dune_mouse_pop(m);
            }else if(!hit)dune_mouse_pop(m);
        }
        return;
    }
    /* VBlank pad reads cover both map presenters and construction placement.
       Warp first, let native cursor/tile logic run, then send one A/B edge. */
    if(c->pc==0x6176 || c->pc==0x6e02){
        if(m->count){
            DuneClick *q=&m->queue[m->head];
            int x=q->x,y=q->y;
            if(q->world && !dune_mouse_world_local(c,q->wx,q->wy,&x,&y))return;
            if(q->world){m->tile_valid=1;m->tile_wx=q->wx;m->tile_wy=q->wy;}
            /* Native auto-centering can move BF12 between VBlanks. Restore
               the target again on the frame that sends A/B, including borders. */
            dune_mouse_warp(m,c,x,y);if(!m->stage)m->stage=2;
        }else if(!m->count && m->dirty){
            int x=m->x,y=m->y;
            if(!m->point_world || dune_mouse_world_local(c,m->wx,m->wy,&x,&y)){
                dune_mouse_warp(m,c,x,y);
                if(m->point_world){m->tile_valid=1;m->tile_wx=m->wx;m->tile_wy=m->wy;}
            }
            m->dirty=0;
        }
    }else if(c->pc==0x617a || c->pc==0x6e06){
        if(m->stage==2){m->stage=1;return;}
        if(m->stage==1){
            DuneClick q=m->queue[m->head];
            uint32_t selected=dune_long(c,0xc25c);
            unsigned key=q.action==DUNE_CLICK_SELECT ||
                (q.action==DUNE_CLICK_ORDER && selected>=0xff0000 && selected<=0xfffffe)
                ? 0x40:0x10;
            c->d[0]=(c->d[0]&~65535u)|key;dune_mouse_pop(m);
        }
    }
}
#endif
#endif
