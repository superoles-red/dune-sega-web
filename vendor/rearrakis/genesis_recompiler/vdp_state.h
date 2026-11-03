/* Functional Mode 5 VDP state. Transfers complete synchronously; no renderer. */
#ifndef GENESIS_VDP_STATE_H
#define GENESIS_VDP_STATE_H
typedef struct {
    uint8_t registers[24], vram[65536];
    uint16_t cram[64], vsram[40];
    uint16_t address, bus_value;
    uint8_t code, command_pending, fill_pending;
    uint64_t data_reads, data_writes, dma_bytes;
    uint16_t line, line_clock;
    uint8_t hint_counter, irq_h, irq_v, vint_status, pal;
    uint64_t frames;
    uint8_t frame[320*240*3], render_unsupported;
    uint16_t frame_width, frame_height;
    uint64_t rendered_frames;
} VDP;
#endif
