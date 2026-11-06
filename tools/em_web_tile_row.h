/* Decode an immutable original 8-pixel pattern row once. Palette/priority,
 * both flips and transparent high-priority shadow pixels remain native. */
#ifndef DUNE_EM_WEB_TILE_ROW_H
#define DUNE_EM_WEB_TILE_ROW_H
typedef struct {
    unsigned bits,ink,empty,flip;
} EmWebTileRow;
static EmWebTileRow em_web_tile_row(const VDP *v,unsigned entry,unsigned y){
    unsigned row=(entry&0x1000)?7-y:y,at=(entry&0x7ff)*32+row*4;
    unsigned bits=((unsigned)v->vram[at]<<24)|((unsigned)v->vram[at+1]<<16)|
                  ((unsigned)v->vram[at+2]<<8)|v->vram[at+3];
    return (EmWebTileRow){bits,((entry>>9)&0x30)|((entry>>8)&0x80),
        (v->registers[12]&8)?(entry>>8)&0x80:0,!!(entry&0x800)};
}
static unsigned em_web_row_pixel(const EmWebTileRow *row,unsigned x){
    unsigned shift=row->flip?x*4:28-x*4,nibble=(row->bits>>shift)&15;
    return nibble?row->ink|nibble:row->empty;
}
#endif
