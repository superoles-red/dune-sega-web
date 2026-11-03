/* Host playback gain for the verified Dune ROM; keeps chip timing untouched. */
#ifndef GENESIS_DUNE_AUDIO_H
#define GENESIS_DUNE_AUDIO_H
#ifdef GENESIS_DUNE_MOUSE
static int dune_audio_volume(const char *text){
 if(!text || !*text)return 100;
 char *end;long value=strtol(text,&end,10);
 return end==text || *end || value<0 || value>200 ? 100:(int)value;
}
static int16_t dune_audio_scale(int16_t sample,int percent){
 int32_t value=(int32_t)sample*4*percent/100;
 int negative=value<0;if(negative)value=-value;
 /* Smooth knee above 24000; bounded below the signed PCM ceiling. */
 if(value>24000){
  int32_t excess=value-24000;
  value=24000+(int32_t)((int64_t)excess*8767/(excess+8767));
 }
 return (int16_t)(negative?-value:value);
}
#endif
#endif
