#define EM_WEB_CLOCK_ONLY
#include "em_web_host.h"
#include <assert.h>
#include <stdio.h>

enum { NTSC_MASTER_HZ=53693175, NTSC_FRAME_CLOCKS=3420*262 };

/* A synthetic host consuming 28-clock instruction quanta. This tests browser
   pacing, not game emulation or the original machine scheduler. */
static uint64_t elapsed_run(unsigned refresh,unsigned seconds) {
    EmWebClock clock={0};uint64_t executed=0;
    em_web_clock_reset(&clock,0.0);
    for(unsigned callback=1;callback<=refresh*seconds;++callback) {
        double now=(double)callback*1000.0/(double)refresh;
        uint64_t due=em_web_clock_due(&clock,now,NTSC_MASTER_HZ,0);
        uint64_t work=due?((due+27)/28)*28:0;
        executed+=work;em_web_clock_consume(&clock,work);
    }
    return executed;
}

int main(void) {
    uint64_t expected=(uint64_t)NTSC_MASTER_HZ*60;
    for(unsigned refresh=30;refresh<=240;refresh*=2) {
        uint64_t clocks=elapsed_run(refresh,60);
        assert(clocks>=expected && clocks-expected<28);
        assert(clocks/NTSC_FRAME_CLOCKS==3595); /* native ~59.9227 Hz, not 60 */
        printf("PASS %u Hz: %llu master clocks, %llu native frames\n",refresh,
            (unsigned long long)clocks,(unsigned long long)(clocks/NTSC_FRAME_CLOCKS));
    }
    EmWebClock clock={0};em_web_clock_reset(&clock,0.0);
    assert(em_web_clock_due(&clock,100.0,1000,0)==100);
    em_web_clock_consume(&clock,100);
    assert(em_web_clock_due(&clock,500.0,1000,1)==0);
    assert(em_web_clock_due(&clock,900.0,1000,1)==0);
    assert(em_web_clock_due(&clock,1000.0,1000,0)==100);
    em_web_clock_consume(&clock,100);
    assert(em_web_clock_due(&clock,5000.0,1000,0)==0); /* suspended host */
    assert(em_web_clock_due(&clock,4999.0,1000,0)==0); /* clock discontinuity */
    assert(em_web_clock_due(&clock,5000.0,1000,0)==1);
    puts("PASS pause/resume, suspension and clock discontinuities");
    return 0;
}
