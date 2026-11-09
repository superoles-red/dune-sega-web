/* Output-only music/effect levels for the verified Dune GEMS 2.5 driver.
 * GEMS copies CCBFLAGS bit 3 (SFX timebase) into the allocated physical voice
 * flag. Unlike the CCB, that flag retains the sounding/releasing note's class
 * when the logical sequencer channel is reused. No original RAM/register is
 * written here, and no host preference is added to CPU or portable saves. */
#ifndef EM_WEB_AUDIO_LEVELS_H
#define EM_WEB_AUDIO_LEVELS_H
static unsigned em_web_music_level=100,em_web_sound_level=100;
static unsigned em_web_audio_fm_levels[6]={100,100,100,100,100,100};
static unsigned em_web_audio_psg_levels[4]={100,100,100,100};
#ifdef GENESIS_AUDIO
void genesis_ymfm_output_levels(void *chip,const unsigned levels[6]);
#endif
static int em_web_audio_levels_set(int music,int sound){
 if((music!=0&&music!=50&&music!=100)||(sound!=0&&sound!=50&&sound!=100))return 0;
 em_web_music_level=(unsigned)music;em_web_sound_level=(unsigned)sound;return 1;
}
static int32_t em_web_audio_level_sample(int32_t sample,unsigned level){
 return level==100?sample:level==50?sample/2:0;
}
static unsigned em_web_audio_voice_level(const CPU*c,unsigned row){
 return c->z80_bus.ram[row]&8?em_web_sound_level:em_web_music_level;
}
static void em_web_audio_levels_sync(CPU*c){
 /* Physical FM allocation order is 0,1,3,4,5,2; the table's voice codes are
  * 0,1,4,5,6,2 for YM register $28. Row $17B1 also owns DAC playback. */
 static const unsigned fm_rows[6]={0x1795,0x179c,0x17b8,0x17a3,0x17aa,0x17b1};
 for(unsigned i=0;i<6;++i)em_web_audio_fm_levels[i]=em_web_audio_voice_level(c,fm_rows[i]);
 for(unsigned i=0;i<3;++i)em_web_audio_psg_levels[i]=em_web_audio_voice_level(c,0x17c0+7*i);
 em_web_audio_psg_levels[3]=em_web_audio_voice_level(c,0x17d6);
#ifdef GENESIS_AUDIO
 if(c->audio.fm)genesis_ymfm_output_levels(c->audio.fm,em_web_audio_fm_levels);
#endif
}
#endif
