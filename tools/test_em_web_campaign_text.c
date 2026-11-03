/* Original native speech paragraphs, completed-frame timing and save recovery. */
#define GENESIS_NO_MAIN
#include "../.local/source/build/dune-base.c"
#include "em_web_campaign.h"
static CPU c,before;static unsigned changed,commits;
static void check(int ok,const char*s){if(!ok){fprintf(stderr,"FAIL %s pc=%06x %s\n",s,c.pc,em_web_campaign_report(&c));exit(1);}}
int main(int argc,char**argv){check(argc>=2,"speech fixture required");for(int a=1;a<argc;a++){
 FILE*f=fopen(argv[a],"rb");check(f&&fread(&c,sizeof c,1,f)==1,"CPU read");fclose(f);c.rom=rom_data;c.rom_size=sizeof rom_data;c.reason=NULL;c.fault=0;c.audio_mode=AUDIO_MUTE;c.pad_buttons[0]=0;memset(&em_web_campaign,0,sizeof em_web_campaign);em_web_campaign_after_load(&c);char last[512]={0};unsigned recovered=0;uint64_t end=c.vdp.frames+500;
 while(!c.fault&&c.vdp.frames<end){int audit=c.pc==0x1fb34||(c.pc==0x4d4e&&dune_long(&c,c.a[7]&65535)==0x1fa44);if(audit)before=c;em_web_campaign_observe(&c);if(audit)check(!memcmp(&before,&c,sizeof c),"text/native observer has no CPU writes without pending intent");
 if(strcmp(last,em_web_campaign.visible_message)){check(!em_web_campaign.text_pending,"published text has completed native raster match");strcpy(last,em_web_campaign.visible_message);++commits;recovered=1;printf("VISIBLE %s %s\n",argv[a],last);}
 machine_step(&c);
 }
 check(!c.fault&&recovered&&em_web_campaign.message_pointer,"restored native speech recovers visible paragraph and ROM source");before=c;const char*j=em_web_campaign_report(&c);check(!memcmp(&before,&c,sizeof c),"speech getter immutable");char out[256];snprintf(out,sizeof out,".local/campaign-analysis/text-%d.json",a);f=fopen(out,"w");check(f!=NULL,"JSON output");fputs(j,f);fclose(f);
 }
 printf("PASS %u native visible paragraphs recovered and completed-frame fenced; CPU immutable\n",commits);return 0;}
