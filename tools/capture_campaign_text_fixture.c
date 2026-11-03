/* Controlled offline Ordos defeat fixture, not an earned completion. The
 * original outcome predicate, speech writer and native five-row layout run. */
#define main prior_campaign_scene_capture_main
#include "capture_campaign_scenes.c"
#undef main
int main(int argc,char**argv){
 check(argc==3,"usage ORIGINAL_ORDOS_M1_CPU EXISTING_OUTPUT_DIRECTORY");
 outdir=argv[2];scenario_outcome(argv[1],2,1,0);return 0;
}
