/* Quick Save & Quick Load Savestate Serialization for Dune II (ReArrakis) */
#ifndef DUNE_SAVESTATE_H
#define DUNE_SAVESTATE_H

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <stdint.h>
#include <string.h>

#define DUNE_SAVESTATE_MAGIC 0x56415344 /* "DSAV" */
#define DUNE_SAVESTATE_VERSION 1

#pragma pack(push, 1)
typedef struct {
    uint32_t magic;
    uint32_t version;
    uint32_t ym_size;
    uint32_t total_size;

    /* 68000 Registers & State */
    uint32_t d[8], a[8], pc, usp, ssp;
    uint16_t sr;
    uint8_t ram[65536];
    uint8_t io_data[3], io_control[3], tmss[4];
    uint8_t io_tx[3], io_serial_control[3];
    uint8_t pad_buttons[3];

    /* VDP Video State */
    uint8_t vdp_registers[24];
    uint8_t vdp_vram[65536];
    uint16_t vdp_cram[64];
    uint16_t vdp_vsram[40];
    uint16_t vdp_address, vdp_bus_value;
    uint8_t vdp_code, vdp_command_pending, vdp_fill_pending;
    uint64_t vdp_data_reads, vdp_data_writes, vdp_dma_bytes;
    uint16_t vdp_line, vdp_line_clock;
    uint8_t vdp_hint_counter, vdp_irq_h, vdp_irq_v, vdp_vint_status, vdp_pal;
    uint64_t vdp_frames;

    /* Z80 Audio Bus */
    uint8_t z80_ram[8192];
    uint8_t z80_requested, z80_reset_released;
    uint16_t z80_bank;
    uint64_t z80_ram_writes;

    /* Z80 CPU Registers */
    uint8_t z80_r8[6], z80_alternate[6], z80_a, z80_f, z80_a_alt, z80_f_alt;
    uint8_t z80_i, z80_r, z80_iff1, z80_iff2, z80_im, z80_halted;
    uint8_t z80_irq_line, z80_ei_delay;
    uint16_t z80_pc, z80_sp, z80_ix, z80_iy, z80_wz;
    int64_t z80_debt;
    uint64_t z80_steps, z80_cycles, z80_interrupts;

    /* PSG & EEPROM */
    PSG psg;
    EEPROM eeprom;

    /* Simulation Timing & Clocks */
    uint64_t steps, cycles, master_cycles, interrupts;
    unsigned instruction_cycles, z80_divider;
    int halted;
} DuneSaveState;
#pragma pack(pop)

static uint8_t g_dune_state_buffer[256 * 1024];

EMSCRIPTEN_KEEPALIVE void dune_mouse_leave(void) {
    em_host.dune_view.pointer_valid = 0;
    em_host.dune_mouse.pan_x = 0;
    em_host.dune_mouse.pan_y = 0;
    em_host.dune_mouse.point_world = 0;
    em_host.dune_mouse.camera_hold = 1;
    em_cpu.ram[0xbf12] = 0; em_cpu.ram[0xbf13] = 160;
    em_cpu.ram[0xbf14] = 0; em_cpu.ram[0xbf15] = 112;
    memset(em_cpu.ram + 0xbf0e, 0, 4);
}

EMSCRIPTEN_KEEPALIVE uint8_t *dune_get_save_buffer(void) {
    return g_dune_state_buffer;
}

EMSCRIPTEN_KEEPALIVE int dune_get_max_save_size(void) {
    return (int)sizeof(g_dune_state_buffer);
}

EMSCRIPTEN_KEEPALIVE int dune_save_state_to_buffer(void) {
    if (!em_window) return 0;
    DuneSaveState *s = (DuneSaveState *)g_dune_state_buffer;
    memset(s, 0, sizeof(*s));

    s->magic = DUNE_SAVESTATE_MAGIC;
    s->version = DUNE_SAVESTATE_VERSION;

    /* 68000 state */
    memcpy(s->d, em_cpu.d, sizeof(s->d));
    memcpy(s->a, em_cpu.a, sizeof(s->a));
    s->pc = em_cpu.pc;
    s->usp = em_cpu.usp;
    s->ssp = em_cpu.ssp;
    s->sr = em_cpu.sr;
    memcpy(s->ram, em_cpu.ram, sizeof(s->ram));
    memcpy(s->io_data, em_cpu.io_data, sizeof(s->io_data));
    memcpy(s->io_control, em_cpu.io_control, sizeof(s->io_control));
    memcpy(s->tmss, em_cpu.tmss, sizeof(s->tmss));
    memcpy(s->io_tx, em_cpu.io_tx, sizeof(s->io_tx));
    memcpy(s->io_serial_control, em_cpu.io_serial_control, sizeof(s->io_serial_control));
    memcpy(s->pad_buttons, em_cpu.pad_buttons, sizeof(s->pad_buttons));

    /* VDP graphics state */
    memcpy(s->vdp_registers, em_cpu.vdp.registers, sizeof(s->vdp_registers));
    memcpy(s->vdp_vram, em_cpu.vdp.vram, sizeof(s->vdp_vram));
    memcpy(s->vdp_cram, em_cpu.vdp.cram, sizeof(s->vdp_cram));
    memcpy(s->vdp_vsram, em_cpu.vdp.vsram, sizeof(s->vdp_vsram));
    s->vdp_address = em_cpu.vdp.address;
    s->vdp_bus_value = em_cpu.vdp.bus_value;
    s->vdp_code = em_cpu.vdp.code;
    s->vdp_command_pending = em_cpu.vdp.command_pending;
    s->vdp_fill_pending = em_cpu.vdp.fill_pending;
    s->vdp_data_reads = em_cpu.vdp.data_reads;
    s->vdp_data_writes = em_cpu.vdp.data_writes;
    s->vdp_dma_bytes = em_cpu.vdp.dma_bytes;
    s->vdp_line = em_cpu.vdp.line;
    s->vdp_line_clock = em_cpu.vdp.line_clock;
    s->vdp_hint_counter = em_cpu.vdp.hint_counter;
    s->vdp_irq_h = em_cpu.vdp.irq_h;
    s->vdp_irq_v = em_cpu.vdp.irq_v;
    s->vdp_vint_status = em_cpu.vdp.vint_status;
    s->vdp_pal = em_cpu.vdp.pal;
    s->vdp_frames = em_cpu.vdp.frames;

    /* Z80 bus state */
    memcpy(s->z80_ram, em_cpu.z80_bus.ram, sizeof(s->z80_ram));
    s->z80_requested = em_cpu.z80_bus.requested;
    s->z80_reset_released = em_cpu.z80_bus.reset_released;
    s->z80_bank = em_cpu.z80_bus.bank;
    s->z80_ram_writes = em_cpu.z80_bus.ram_writes;

    /* Z80 CPU state */
    memcpy(s->z80_r8, em_cpu.z80_cpu.r8, sizeof(s->z80_r8));
    memcpy(s->z80_alternate, em_cpu.z80_cpu.alternate, sizeof(s->z80_alternate));
    s->z80_a = em_cpu.z80_cpu.a;
    s->z80_f = em_cpu.z80_cpu.f;
    s->z80_a_alt = em_cpu.z80_cpu.a_alt;
    s->z80_f_alt = em_cpu.z80_cpu.f_alt;
    s->z80_i = em_cpu.z80_cpu.i;
    s->z80_r = em_cpu.z80_cpu.r;
    s->z80_iff1 = em_cpu.z80_cpu.iff1;
    s->z80_iff2 = em_cpu.z80_cpu.iff2;
    s->z80_im = em_cpu.z80_cpu.im;
    s->z80_halted = em_cpu.z80_cpu.halted;
    s->z80_irq_line = em_cpu.z80_cpu.irq_line;
    s->z80_ei_delay = em_cpu.z80_cpu.ei_delay;
    s->z80_pc = em_cpu.z80_cpu.pc;
    s->z80_sp = em_cpu.z80_cpu.sp;
    s->z80_ix = em_cpu.z80_cpu.ix;
    s->z80_iy = em_cpu.z80_cpu.iy;
    s->z80_wz = em_cpu.z80_cpu.wz;
    s->z80_debt = em_cpu.z80_cpu.debt;
    s->z80_steps = em_cpu.z80_cpu.steps;
    s->z80_cycles = em_cpu.z80_cpu.cycles;
    s->z80_interrupts = em_cpu.z80_cpu.interrupts;

    /* PSG & EEPROM */
    s->psg = em_cpu.psg;
    s->eeprom = em_cpu.eeprom;

    /* Clocks */
    s->steps = em_cpu.steps;
    s->cycles = em_cpu.cycles;
    s->master_cycles = em_cpu.master_cycles;
    s->interrupts = em_cpu.interrupts;
    s->instruction_cycles = em_cpu.instruction_cycles;
    s->z80_divider = em_cpu.z80_divider;
    s->halted = em_cpu.halted;

    /* Yamaha YM2612 sound synthesizer internal state */
    uint32_t ym_size = 0;
#ifdef GENESIS_AUDIO
    if (em_cpu.audio_mode == AUDIO_ON && em_cpu.audio.fm) {
        ym_size = (uint32_t)genesis_ymfm_state_size(em_cpu.audio.fm);
        if (ym_size > 0 && sizeof(*s) + ym_size <= sizeof(g_dune_state_buffer)) {
            if (genesis_ymfm_save_state(em_cpu.audio.fm, g_dune_state_buffer + sizeof(*s), ym_size)) {
                s->ym_size = ym_size;
            } else {
                s->ym_size = 0;
            }
        }
    }
#endif
    s->total_size = (uint32_t)(sizeof(*s) + s->ym_size);
    return (int)s->total_size;
}

EMSCRIPTEN_KEEPALIVE int dune_load_state_from_buffer(int size) {
    if (!em_window || size < (int)sizeof(DuneSaveState)) return 0;
    const DuneSaveState *s = (const DuneSaveState *)g_dune_state_buffer;
    if (s->magic != DUNE_SAVESTATE_MAGIC || s->version != DUNE_SAVESTATE_VERSION) return 0;
    if ((int)s->total_size > size) return 0;

    /* 68000 state */
    memcpy(em_cpu.d, s->d, sizeof(s->d));
    memcpy(em_cpu.a, s->a, sizeof(s->a));
    em_cpu.pc = s->pc;
    em_cpu.usp = s->usp;
    em_cpu.ssp = s->ssp;
    em_cpu.sr = s->sr;
    memcpy(em_cpu.ram, s->ram, sizeof(s->ram));
    memcpy(em_cpu.io_data, s->io_data, sizeof(s->io_data));
    memcpy(em_cpu.io_control, s->io_control, sizeof(s->io_control));
    memcpy(em_cpu.tmss, s->tmss, sizeof(s->tmss));
    memcpy(em_cpu.io_tx, s->io_tx, sizeof(s->io_tx));
    memcpy(em_cpu.io_serial_control, s->io_serial_control, sizeof(s->io_serial_control));
    memcpy(em_cpu.pad_buttons, s->pad_buttons, sizeof(s->pad_buttons));

    /* VDP graphics state */
    memcpy(em_cpu.vdp.registers, s->vdp_registers, sizeof(s->vdp_registers));
    memcpy(em_cpu.vdp.vram, s->vdp_vram, sizeof(s->vdp_vram));
    memcpy(em_cpu.vdp.cram, s->vdp_cram, sizeof(s->vdp_cram));
    memcpy(em_cpu.vdp.vsram, s->vdp_vsram, sizeof(s->vdp_vsram));
    em_cpu.vdp.address = s->vdp_address;
    em_cpu.vdp.bus_value = s->vdp_bus_value;
    em_cpu.vdp.code = s->vdp_code;
    em_cpu.vdp.command_pending = s->vdp_command_pending;
    em_cpu.vdp.fill_pending = s->vdp_fill_pending;
    em_cpu.vdp.data_reads = s->vdp_data_reads;
    em_cpu.vdp.data_writes = s->vdp_data_writes;
    em_cpu.vdp.dma_bytes = s->vdp_dma_bytes;
    em_cpu.vdp.line = s->vdp_line;
    em_cpu.vdp.line_clock = s->vdp_line_clock;
    em_cpu.vdp.hint_counter = s->vdp_hint_counter;
    em_cpu.vdp.irq_h = s->vdp_irq_h;
    em_cpu.vdp.irq_v = s->vdp_irq_v;
    em_cpu.vdp.vint_status = s->vdp_vint_status;
    em_cpu.vdp.pal = s->vdp_pal;
    em_cpu.vdp.frames = s->vdp_frames;

    /* Z80 bus state */
    memcpy(em_cpu.z80_bus.ram, s->z80_ram, sizeof(s->z80_ram));
    em_cpu.z80_bus.requested = s->z80_requested;
    em_cpu.z80_bus.reset_released = s->z80_reset_released;
    em_cpu.z80_bus.bank = s->z80_bank;
    em_cpu.z80_bus.ram_writes = s->z80_ram_writes;

    /* Z80 CPU state */
    memcpy(em_cpu.z80_cpu.r8, s->z80_r8, sizeof(s->z80_r8));
    memcpy(em_cpu.z80_cpu.alternate, s->z80_alternate, sizeof(s->z80_alternate));
    em_cpu.z80_cpu.a = s->z80_a;
    em_cpu.z80_cpu.f = s->z80_f;
    em_cpu.z80_cpu.a_alt = s->z80_a_alt;
    em_cpu.z80_cpu.f_alt = s->z80_f_alt;
    em_cpu.z80_cpu.i = s->z80_i;
    em_cpu.z80_cpu.r = s->z80_r;
    em_cpu.z80_cpu.iff1 = s->z80_iff1;
    em_cpu.z80_cpu.iff2 = s->z80_iff2;
    em_cpu.z80_cpu.im = s->z80_im;
    em_cpu.z80_cpu.halted = s->z80_halted;
    em_cpu.z80_cpu.irq_line = s->z80_irq_line;
    em_cpu.z80_cpu.ei_delay = s->z80_ei_delay;
    em_cpu.z80_cpu.pc = s->z80_pc;
    em_cpu.z80_cpu.sp = s->z80_sp;
    em_cpu.z80_cpu.ix = s->z80_ix;
    em_cpu.z80_cpu.iy = s->z80_iy;
    em_cpu.z80_cpu.wz = s->z80_wz;
    em_cpu.z80_cpu.debt = s->z80_debt;
    em_cpu.z80_cpu.steps = s->z80_steps;
    em_cpu.z80_cpu.cycles = s->z80_cycles;
    em_cpu.z80_cpu.interrupts = s->z80_interrupts;

    /* PSG & EEPROM */
    em_cpu.psg = s->psg;
    em_cpu.eeprom = s->eeprom;

    /* Clocks */
    em_cpu.steps = s->steps;
    em_cpu.cycles = s->cycles;
    em_cpu.master_cycles = s->master_cycles;
    em_cpu.interrupts = s->interrupts;
    em_cpu.instruction_cycles = s->instruction_cycles;
    em_cpu.z80_divider = s->z80_divider;
    em_cpu.halted = s->halted;
    em_cpu.fault = 0;
    em_cpu.reason = NULL;

    /* Yamaha YM2612 FM chip state */
#ifdef GENESIS_AUDIO
    if (em_cpu.audio_mode == AUDIO_ON && em_cpu.audio.fm) {
        if (s->ym_size > 0 && sizeof(*s) + s->ym_size <= (size_t)size) {
            void *new_fm = genesis_ymfm_load_state(g_dune_state_buffer + sizeof(*s), s->ym_size);
            if (new_fm) {
                genesis_ymfm_destroy(em_cpu.audio.fm);
                em_cpu.audio.fm = new_fm;
            } else {
                genesis_ymfm_reset(em_cpu.audio.fm);
            }
        } else {
            genesis_ymfm_reset(em_cpu.audio.fm);
        }
    }
#endif

    /* Flush audio ring buffers so no desynced samples play */
    em_cpu.audio.read = 0;
    em_cpu.audio.count = 0;
    em_cpu.audio.cursor = em_cpu.master_cycles;
    em_cpu.audio.next_sample = em_cpu.master_cycles;

    /* Synchronize host timer and invalidate cached frame */
    sdl_host_rebase(&em_host, &em_cpu);
    em_host.next_service = em_cpu.master_cycles;
    em_host.last_frame = 0;
    return 1;
}
#endif
#endif
