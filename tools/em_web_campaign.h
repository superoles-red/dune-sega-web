/* Browser campaign intent and read-only native scene/outcome observation.
 * Include after CPU, dune_word/long and em_cpu; call observe before input hooks.
 * No ROM/instruction modifications. Starts use the original NewHouse flow,
 * original password validator for missions2..9, and the original scenario loader.
 */
#ifndef DUNE_EM_WEB_CAMPAIGN_H
#define DUNE_EM_WEB_CAMPAIGN_H
#include <stdint.h>
#include <stdio.h>
#include <string.h>

typedef struct {
 CPU *cpu;
 const char *scene;
 uint32_t scene_pc,call_return,call_sp;
 uint64_t last_steps,last_cycles,scene_frame,outcome_seq,starts;
 int pending,stage,requested_house,requested_mission,calling,campaign_confirm_played;
 int armed,played_house,played_mission,result_candidate,result_check,native_loading;
 int outcome,outcome_house,outcome_mission;
 int input_pending,input_action,input_value,input_release,input_scope,options_in_game,options_music_test,options_sound_test;
 int route_pending,route_target,route_phase,ui_call_active,ui_call_kind,frontend_hold;
 uint64_t attract_counter_resets,campaign_feedback_suppressed;
 int sound_pending,sound_active,sound_entered,sound_kind;
 int frontend_audio_requested,frontend_audio_active,frontend_music_running,frontend_music_pending;
 uint64_t frontend_audio_suppressed,frontend_music_commands,frontend_feedback_remapped;
 uint32_t sound_return,sound_sp,sound_d[8],sound_a[8];
 uint16_t sound_sr;
 uint64_t sound_requests,sound_consumed,sound_calls;
 uint32_t ui_call_return,ui_call_sp;
 uint64_t route_seq,scene_generation,poll_generation,poll_step,ready_generation,ready_render;
 const char *presentation_phase;
 uint64_t presentation_generation,presentation_render,main_ready_generation,main_choices_generation;
 int presentation_armed,presentation_full;
 uint64_t building_palette_generation,title_end_generation,title_end_render;
 uint64_t transition_generation,transition_frame,transition_render;
 int transition_kind,transition_phase,transition_covered,transition_ready;
 uint32_t transition_object;
 int fade_direction,fade_active;uint64_t fade_serial,fade_start_frame,fade_start_cycles,fade_end_render,fade_last_frames;
 uint32_t poll_pc,poll_source,poll_callback,release_source,message_pointer,message_line_pointer;
 int message_phase,message_line_progress,message_lines_total,message_complete,confirm_mode,stats_mission,stats_victory;
 int text_pending,text_draw_complete;
 uint64_t text_checked_render;
 char staged_message[512],visible_message[512];
 uint64_t poll_frame,input_seq;
} EmWebCampaign;
static EmWebCampaign em_web_campaign;
/* Cached world presentation while an original UI route prepares its screen. */
static unsigned em_web_route_hold_generation;static int em_web_route_hold_enabled;
static const char *em_web_campaign_house_name(int h){return h==0?"Harkonnen":h==1?"Atreides":h==2?"Ordos":"";}
static unsigned em_web_campaign_password(int house,int mission){
 if(house<0||house>2||mission<2||mission>9)return 0;
 return 0x20c14u+(unsigned)((mission-2)*3+house)*11u;
}
static int em_web_campaign_house(const CPU*c){unsigned h=dune_word(c,0xc274);return h<3?(int)h:-1;}
static int em_web_campaign_mission(const CPU*c){unsigned m=dune_word(c,0xc050);return m<9?(int)m+1:0;}
static int em_web_campaign_region(int house,int mission){
 static const uint8_t regions[3][9]={{1,2,4,3,6,5,7,9,8},{5,9,4,1,3,0,8,7,6},{7,6,3,4,9,0,5,2,1}};
 return house>=0&&house<3&&mission>=1&&mission<=9?regions[house][mission-1]:-1;
}
static void em_web_campaign_scene(CPU*c,const char*name){
 EmWebCampaign*s=&em_web_campaign;
 if(!s->scene||strcmp(s->scene,name)){s->scene=name;s->scene_pc=c->pc;s->scene_frame=c->vdp.frames;++s->scene_generation;s->poll_pc=s->poll_source=s->poll_callback=0;s->poll_generation=0;s->ready_generation=0;s->main_ready_generation=s->main_choices_generation=0;s->presentation_phase=name;++s->presentation_generation;s->presentation_render=c->vdp.rendered_frames;s->presentation_armed=0;s->presentation_full=!strcmp(name,"campaign")||!strcmp(name,"loading")||!strcmp(name,"victory_movie")||!strcmp(name,"defeat_movie")||!strcmp(name,"ending")||!strcmp(name,"credits");}
}
static void em_web_campaign_after_load(CPU*c){
 #ifdef DUNE_EM_WEB_WORLD_INTENT_H
 em_web_world_intent_cancel();
 #endif
 em_web_route_hold_enabled=0;EmWebCampaign*s=&em_web_campaign;uint64_t seq=s->outcome_seq,starts=s->starts;
 #ifdef DUNE_EM_WEB_FRAME_H
 em_web_frame_invalidate(c);
#endif
 memset(s,0,sizeof*s);s->cpu=c;s->outcome_seq=seq;s->starts=starts;s->outcome_house=s->outcome_mission=-1;
 s->last_steps=c->steps;s->last_cycles=c->master_cycles;s->scene_generation=1;s->scene="unknown";s->scene_pc=c->pc;s->scene_frame=c->vdp.frames;
 int context=dune_mouse_context(c);
 if(context==1&&em_web_campaign_house(c)>=0&&em_web_campaign_mission(c)){
  s->armed=1;s->played_house=em_web_campaign_house(c);s->played_mission=em_web_campaign_mission(c);s->scene="map";
 }else if(context==2||context==3)s->scene="building";
}
static void em_web_campaign_transition_cancel(CPU*c){
 EmWebCampaign*s=&em_web_campaign;s->transition_kind=s->transition_phase=s->transition_ready=s->transition_covered=0;
 #ifdef DUNE_EM_WEB_FRAME_H
 em_web_frame_hold_end(c);
 #endif
}
static int em_web_campaign_request(CPU*c,int house,int mission){
 if(!c||c->fault||house<0||house>2||mission<1||mission>9||em_web_campaign.calling)return 0;
 EmWebCampaign*s=&em_web_campaign;
 if(s->cpu!=c)em_web_campaign_after_load(c);
 #ifdef DUNE_EM_WEB_WORLD_INTENT_H
 em_web_world_intent_cancel();
 #endif
 em_web_campaign_transition_cancel(c);
 s->input_pending=s->input_release=0;s->sound_pending=0;s->campaign_confirm_played=0;s->frontend_hold=0;s->frontend_audio_requested=s->frontend_audio_active=0;s->route_pending=0;s->pending=1;s->stage=1;s->requested_house=house;s->requested_mission=mission;s->armed=0;s->result_check=0;s->outcome=0;
 return 1;
}
/* Queued native menu intent. It never holds a pad bit across screens.
 * 0=raw mask,1=option row,2=option value Right,3=main row,4=house,5=Yes/No.
 * Option row5 is deliberately absent: passwords are decorative campaign names.
 */
static int em_web_campaign_input_request(CPU*c,int action,int value){
 EmWebCampaign*s=&em_web_campaign;
 if(!c||c->fault||action<0||action>5||s->input_pending)return 0;
 if(s->cpu==c&&s->presentation_full&&s->poll_generation!=s->scene_generation)return 0;
 if(action==0&&(value<1||value>255))return 0;
 if(dune_mouse_context(c)==1&&(action!=0||value!=PAD_START))return 0;
 if((action==1||action==2)&&(value<0||value>7||value==5))return 0;
 if((action==3||action==4)&&(value<0||value>2))return 0;
 if(action==5&&(value<0||value>1))return 0;
 if(s->cpu!=c)em_web_campaign_after_load(c);
 s->input_pending=1;s->input_action=action;s->input_value=value;s->input_scope=action==0&&value==PAD_START?(dune_mouse_context(c)==1?1:s->poll_source==0x20f24?2:0):0;return 1;
}
/* Native renderer completion is the readiness barrier, not elapsed JS time.
 * A relevant input continuation is reached only after the original draw setup;
 * the next completed VDP frame must contain that setup before UI publication. */
static int em_web_campaign_scene_ready(const CPU*c){
 const EmWebCampaign*s=&em_web_campaign;
 return !(s->transition_kind==2&&(s->fade_active||c->vdp.rendered_frames<=s->fade_end_render))&&s->ready_generation==s->scene_generation&&s->ready_generation&&c->vdp.rendered_frames>s->ready_render&&c->vdp.frame_width==320&&c->vdp.frame_height==224&&!c->vdp.render_unsupported&&(c->vdp.registers[1]&0x40);
}
static void em_web_campaign_presentation(CPU*c,const char*phase,int full){
 EmWebCampaign*s=&em_web_campaign;
 if(!s->presentation_phase||strcmp(s->presentation_phase,phase)||s->presentation_full!=full){s->presentation_phase=phase;s->presentation_full=full;++s->presentation_generation;s->presentation_render=c->vdp.rendered_frames;s->presentation_armed=1;if(full){s->poll_generation=0;s->ready_generation=0;}}
 else if(!s->presentation_armed){s->presentation_armed=1;s->presentation_render=c->vdp.rendered_frames;}
}
static int em_web_campaign_presentation_ready(const CPU*c){
 const EmWebCampaign*s=&em_web_campaign;
 return s->presentation_armed&&c->vdp.rendered_frames>s->presentation_render&&c->vdp.frame_width==320&&c->vdp.frame_height==224&&!c->vdp.render_unsupported;
}
static int em_web_campaign_terminal(const CPU*c){
 const EmWebCampaign*s=&em_web_campaign;
 if(!s->scene)return 0;
 if(!strcmp(s->scene,"results")&&s->poll_source==0x272d2&&s->poll_generation==s->scene_generation&&!s->stats_victory)return 1;
 return !strcmp(s->scene,"credits")&&s->poll_source==0x11850&&s->poll_generation==s->scene_generation&&(c->d[4]&255);
}
static void em_web_campaign_draw_ready(CPU*c){
 EmWebCampaign*s=&em_web_campaign;
 if(s->ready_generation!=s->scene_generation){s->ready_generation=s->scene_generation;s->ready_render=c->vdp.rendered_frames;}
 if(!s->presentation_armed){s->presentation_armed=1;s->presentation_render=c->vdp.rendered_frames;}
}
/* Transition ownership belongs to the host curtain. Capture before the first
 * native palette fade and retain both generation and ready until next entry.
 * A host ack releases presentation caches only; no native wait is accelerated. */
static void em_web_campaign_transition_begin(CPU*c,int kind){
 EmWebCampaign*s=&em_web_campaign;if(s->pending||s->route_pending)return;
 ++s->transition_generation;s->transition_kind=kind;s->transition_phase=1;s->transition_covered=s->transition_ready=0;s->transition_object=dune_long(c,0xc578);s->transition_frame=c->vdp.frames;s->transition_render=c->vdp.rendered_frames;
 #ifdef DUNE_EM_WEB_FRAME_H
 em_web_frame_hold_begin(c);
 #endif
}
static int em_web_campaign_transition_active(const CPU*c){const EmWebCampaign*s=&em_web_campaign;return s->cpu==c&&s->transition_kind&&!(s->transition_covered&&s->transition_ready);}
static int em_web_campaign_world_hold(const CPU*c){if(em_web_route_hold_enabled)return 1;const EmWebCampaign*s=&em_web_campaign;return s->cpu==c&&s->transition_kind==1&&!s->transition_covered&&!s->pending&&!s->route_pending;}
static void em_web_campaign_transition_update(CPU*c){
 EmWebCampaign*s=&em_web_campaign;if(!s->transition_kind||s->transition_ready)return;
 if(s->scene&&!strcmp(s->scene,s->transition_kind==1?"building":"map")&&em_web_campaign_scene_ready(c)){s->transition_ready=1;s->transition_phase=4;}
}
static int em_web_campaign_transition_ack(CPU*c,unsigned generation){
 EmWebCampaign*s=&em_web_campaign;if(s->cpu!=c||!s->transition_kind||s->transition_generation!=generation)return 0;s->transition_covered=1;
 #ifdef DUNE_EM_WEB_FRAME_H
 em_web_frame_hold_end(c);
 #endif
 return 1;
}
static int em_web_campaign_password_presentation(const CPU*c){const EmWebCampaign*s=&em_web_campaign;return s->cpu==c&&s->scene&&(!strcmp(s->scene,"password_display")||(s->presentation_phase&&!strcmp(s->presentation_phase,"password_scroll")));}
static int em_web_campaign_title_license_ready(const CPU*c){
 const EmWebCampaign*s=&em_web_campaign;
 #ifdef DUNE_EM_WEB_FRAME_H
 return s->scene&&!strcmp(s->scene,"main")&&s->title_end_generation==s->scene_generation&&c->vdp.rendered_frames>s->title_end_render&&em_web_frame_current(c)&&em_web_frame_license_visible;
 #else
 (void)c;return 0;
 #endif
}
static int em_web_campaign_flyover(const CPU*c){const EmWebCampaign*s=&em_web_campaign;return s->cpu==c&&!c->fault&&s->presentation_phase&&(!strcmp(s->presentation_phase,"victory_flyover")||!strcmp(s->presentation_phase,"defeat_flyover"));}
static int em_web_campaign_battle_presentation(const CPU*c){return em_web_campaign_flyover(c)&&c->vdp.frame_width==320&&c->vdp.frame_height==224&&!c->vdp.render_unsupported&&!em_web_campaign.pending;}
static int em_web_campaign_world_visible(const CPU*c){
 const EmWebCampaign*s=&em_web_campaign;
 return em_web_campaign_battle_presentation(c)||(s->cpu==c&&!c->fault&&s->scene&&!strcmp(s->scene,"map")&&dune_mouse_context(c)==1&&em_web_campaign_scene_ready(c)&&!(s->transition_kind==2&&!s->transition_covered&&!s->pending&&!s->route_pending)&&!s->ui_call_active&&(!s->route_pending||s->route_target==4)&&!s->pending);
}
static const char*em_web_campaign_route_name(int target){return target==0?"main":target==1?"options":target==2?"tutorial":target==3?"pause":"map";}
static int em_web_campaign_route_request(CPU*c,int target){
 EmWebCampaign*s=&em_web_campaign;
 if(!c||c->fault||target<0||target>4||s->calling)return 0;
 if(s->cpu!=c)em_web_campaign_after_load(c);
 unsigned house_pointer=dune_long(c,0xc278)&0xffffffu;
 if(target<3&&(dune_mouse_context(c)||s->armed||s->ui_call_active||(house_pointer>=0xff0000&&house_pointer<=0xffffa0)))return 0;
 if(target>=3&&!dune_mouse_context(c)&&!(s->scene&&!strcmp(s->scene,"pause")))return 0;
 if(s->route_pending&&s->route_target==target)return 1;
 #ifdef DUNE_EM_WEB_WORLD_INTENT_H
 em_web_world_intent_cancel();
 #endif
 em_web_campaign_transition_cancel(c);
 s->pending=0;s->frontend_hold=0;if(target==2)s->frontend_audio_requested=s->frontend_audio_active=0;s->route_pending=1;s->route_target=target;s->route_phase=0;++s->route_seq;
 s->input_pending=s->input_release=0;return 1;
}
/* Frontend-only feedback borrows the original sound wrapper at a native UI
 * poll, with a real long argument and caller-register preservation. The wrapper
 * itself respects native Sound/DC51. Native game/menu actions need no duplicate. */
static int em_web_campaign_sound_request(CPU*c){
 EmWebCampaign*s=&em_web_campaign;if(!c||c->fault||dune_mouse_context(c))return 0;
 if(s->cpu!=c)em_web_campaign_after_load(c);
 if(!s->sound_pending){s->sound_pending=1;++s->sound_requests;}return 1;
}
static int em_web_campaign_frontend_audio_clean(const CPU*c){
 const EmWebCampaign*s=&em_web_campaign;unsigned hp=dune_long(c,0xc278)&0xffffffu;
 return !s->pending&&!s->armed&&em_web_campaign_house(c)==-1&&!(hp>=0xff0000&&hp<=0xffffa0)&&!(s->route_pending&&s->route_target==2);
}
static void em_web_campaign_frontend_audio_request(CPU*c,int enabled){
 EmWebCampaign*s=&em_web_campaign;if(s->cpu!=c)em_web_campaign_after_load(c);
 if(!enabled){s->frontend_audio_requested=s->frontend_audio_active=0;return;}
 if(s->pending||s->armed||(s->route_pending&&s->route_target==2))return;
 unsigned hp=dune_long(c,0xc278)&0xffffffu;if(hp>=0xff0000&&hp<=0xffffa0)return;
 if(s->scene&&(!strcmp(s->scene,"tutorial")||!strcmp(s->scene,"house")||!strcmp(s->scene,"briefing")||!strcmp(s->scene,"campaign")||!strcmp(s->scene,"loading")))return;
 s->frontend_audio_requested=1;
}
/* Only presentation-level audio calls of clean Main/Options are suppressed.
 * Original toggle handlers still change DC50/DC51 and play/stop the real native
 * track. The game, tutorial and every campaign/cinematic call remain original. */
static int em_web_campaign_frontend_audio_observe(CPU*c){
 EmWebCampaign*s=&em_web_campaign;
 if(!s->frontend_audio_active||!em_web_campaign_frontend_audio_clean(c))return 0;
 /* Main retains its original 13-entry effects bank CF970. The full
  * Options bank normally supplies cues25/40/44, so those IDs must never be
  * interpreted through the retained smaller bank. Native Main confirm12 is
  * the profile's own valid cue; its original mute wrapper remains in charge. */
 if(c->pc==0x2dd26||c->pc==0x2ddb6||c->pc==0x1664||c->pc==0x167a){unsigned sp=c->a[7]&65535;if(sp<=65528){unsigned id=dune_long(c,sp+4);if(id>=13&&id<256){write_mem(c,c->a[7]+4,4,12);++s->frontend_feedback_remapped;if(c->pc!=0x167a)c->pc=0x2ddb6;return 1;}}}
 if(c->pc==0x20db8&&s->frontend_music_running)c->a[5]=0;
 unsigned next=0;
 switch(c->pc){
 case 0x179aa:next=0x179b0;break; /* pause background for leaving native Main */
 case 0x179b4:next=0x179ba;break; /* stop Main theme */
 case 0x17a0c:next=0x17a12;c->ram[0xbf2a]=c->ram[0xbf2b]=0;write_mem(c,0xffe41a,2,0);break;
 case 0x20efe:next=0x20f0a;break; /* adjacent stop/resume calls form one presentation pair */
 case 0x20f04:next=0x20f0a;break; /* resume matching presentation pause */
 case 0x214d8:next=0x214de;break; /* exit Options: preserve its playing theme */
 case 0x1744a:next=0x17450;break; /* returning Main: retain current music driver */
 case 0x174cc:if(s->frontend_music_running)next=0x174d2;break;
 default:break;
 }
 if(next){c->pc=next;++s->frontend_audio_suppressed;return 1;}
 if(c->pc==0x2ddcc){unsigned sp=c->a[7]&65535;if(sp<=65528&&dune_long(c,sp+4)==0)s->frontend_music_running=0;}
 if(c->pc==0x2dd26){unsigned sp=c->a[7]&65535;if(sp<=65528&&dune_long(c,sp+4)==0)s->frontend_music_running=1;}
 return 0;
}
static int em_web_campaign_sound_return(CPU*c){
 EmWebCampaign*s=&em_web_campaign;
 if(s->sound_active&&!s->sound_kind&&c->pc==0x1664&&!s->sound_entered){s->sound_entered=1;++s->sound_calls;}
 if(!s->sound_active||c->pc!=s->sound_return||c->a[7]!=s->sound_sp-4)return 0;
 memcpy(c->d,s->sound_d,sizeof c->d);memcpy(c->a,s->sound_a,sizeof c->a);c->sr=s->sound_sr;
 if(s->sound_kind){s->frontend_music_running=s->sound_kind==1;if(s->poll_source==0x20f24)c->a[5]=s->frontend_music_running?0:0xffffffffu;++s->frontend_music_commands;}else ++s->sound_consumed;
 s->sound_active=0;return 1;
}
static int em_web_campaign_sound_safe_poll(unsigned source){
 switch(source){
 case 0x178d2:case 0x20f24:case 0x4938:case 0x25cb2:case 0x21ae6:
 case 0x1fa44:case 0x1f56a:case 0x1f5f2:case 0x1293a:case 0x12a22:
 case 0x272d2:case 0x272fa:case 0x11850:case 0x418b8:return 1;
 default:return 0;
 }
}
static int em_web_campaign_sound_observe(CPU*c){
 EmWebCampaign*s=&em_web_campaign;
 if(s->sound_active||s->calling||s->poll_step!=c->steps||s->poll_generation!=s->scene_generation)return 0;
 int music=0;if(s->frontend_audio_active&&em_web_campaign_frontend_audio_clean(c)&&s->poll_source==0x20f24){if(!!c->ram[0xdc50]!=!!s->frontend_music_running)music=c->ram[0xdc50]?1:2;}
 if(!music&&!s->sound_pending)return 0;
 /* Modern frontend feedback must not pause a live battle to play UI audio. */
 if(dune_mouse_context(c)||!em_web_campaign_sound_safe_poll(s->poll_source))return 0;
 if(!music)s->sound_pending=0;s->sound_kind=music;s->sound_active=1;s->sound_entered=0;s->sound_return=c->pc;s->sound_sp=c->a[7];s->sound_sr=c->sr;
 memcpy(s->sound_d,c->d,sizeof c->d);memcpy(s->sound_a,c->a,sizeof c->a);
 unsigned cue=(c->z80_bus.ram[0x1b48]==0x70&&c->z80_bus.ram[0x1b49]==0xf9&&c->z80_bus.ram[0x1b4a]==0x0c)?12:25;
 c->a[7]-=8;write_mem(c,c->a[7],4,s->sound_return);write_mem(c,c->a[7]+4,4,music?0:cue);c->pc=music==1?0x2dd26:music==2?0x2ddcc:0x2ddb6;return 1;
}
static unsigned em_web_campaign_rom_long(const CPU*c,unsigned at){return at+4<=c->rom_size?((unsigned)c->rom[at]<<24)|((unsigned)c->rom[at+1]<<16)|((unsigned)c->rom[at+2]<<8)|c->rom[at+3]:0;}
static void em_web_campaign_stage_text(CPU*c,unsigned ptr){
 EmWebCampaign*s=&em_web_campaign;if(ptr<0xff0000||ptr>0xfffffe)return;unsigned n=0,at=ptr&65535;
 while(n+1<sizeof s->staged_message&&at+n<65536){unsigned ch=c->ram[at+n];s->staged_message[n++]=(char)ch;if(!ch)break;}
 s->staged_message[n<sizeof s->staged_message?n:sizeof s->staged_message-1]=0;s->text_pending=1;
}
static int em_web_campaign_poll(CPU*c){
 EmWebCampaign*s=&em_web_campaign;unsigned source=0;int raw=1;
 switch(c->pc){
 case 0x4d4e:{unsigned sp=c->a[7]&65535;if(sp>65532)return 0;source=dune_long(c,sp);break;}
 case 0x847e:case 0x28884:case 0x9188:case 0x28ac0:case 0x418b8:case 0x272d2:case 0x272fa:case 0x617a:case 0x6e06:case 0x4938:case 0x25cb2:case 0x4724:case 0x17d22:case 0x17e96:case 0x17ea6:case 0x17eb6:source=c->pc;break;
 default:return 0;
 }
 if(c->pc==0x4d4e&&source!=0x178d2&&source!=0x20f24&&source!=0x1f56a&&source!=0x1f5f2&&source!=0x21660&&source!=0x21ae6&&source!=0x27a14){
  /* Other native story/results callers are valid only outside active battle. */
  if(dune_mouse_context(c))return 0;
 }
 if((c->pc==0x617a||c->pc==0x6e06)&&s->input_pending&&(s->input_action!=0||s->input_value!=PAD_START))return 0;
 if(source==0x25cb2){unsigned fp=c->a[6]&65535;if(fp<=65530)s->confirm_mode=!!dune_word(c,fp+4);}
 if(source==0x272d2||source==0x272fa){unsigned fp=c->a[6]&65535;if(fp<=65510){s->stats_mission=dune_word(c,fp+4);s->stats_victory=!!dune_word(c,fp+24);}}
 if(source==0x847e||source==0x28884||source==0x9188||source==0x28ac0)em_web_campaign_scene(c,"building");
 if(source==0x617a||source==0x6e06)em_web_campaign_scene(c,"map");
 if(source==0x418b8)em_web_campaign_scene(c,"tutorial");
 if(source==0x1293a)em_web_campaign_scene(c,"victory_movie");
 if(source==0x12a22)em_web_campaign_scene(c,"defeat_movie");
 if(source==0x1f56a)em_web_campaign_scene(c,"victory");
 if(source==0x1f5f2)em_web_campaign_scene(c,"defeat");
 if(source==0x11850)em_web_campaign_scene(c,"credits");
 if(source==0x25cb2){s->message_complete=1;em_web_campaign_scene(c,s->confirm_mode?"briefing":"house_briefing");}
 (void)raw;s->poll_pc=c->pc;s->poll_source=source;s->poll_callback=dune_long(c,0xe002);s->poll_frame=c->vdp.frames;s->poll_step=c->steps;
 if(source==0x1fa44){unsigned fp=c->a[6]&65535;if(fp>=50&&fp<=65518){
  s->message_pointer=dune_long(c,fp+14);s->message_complete=!!(c->d[5]&65535);s->message_phase=c->a[4]&65535;s->message_line_progress=dune_word(c,fp-48);s->message_lines_total=dune_word(c,fp-46);s->message_line_pointer=c->a[2];
  int h=em_web_campaign_house(c),mission=em_web_campaign_mission(c);const char*scene="briefing";
  if(h>=0){unsigned intro=em_web_campaign_rom_long(c,0x87d7c+h*4),table=em_web_campaign_rom_long(c,0x87f38+h*4);if(s->message_pointer==intro)scene="house_briefing";else if(mission){if(s->message_pointer==em_web_campaign_rom_long(c,table+(mission-1)*16+4))scene="victory";else if(s->message_pointer==em_web_campaign_rom_long(c,table+(mission-1)*16+8))scene="defeat";}}
  em_web_campaign_scene(c,scene);
  /* A restored save may already be inside the speech. Recover its current
   * actual paragraph from the original remaining counter/A2, never a timer. */
  unsigned remaining=dune_word(c,fp-50),total=dune_word(c,fp-46),at=c->a[2]&65535;
  if(!s->visible_message[0]&&!s->text_pending&&remaining<total&&at<0x1000){unsigned start=at;if(!s->message_complete){unsigned cur=0,last=0;while(cur<at&&cur<0x1000){last=cur;while(cur<at&&c->ram[cur])++cur;if(cur<at)++cur;}if(cur==at)start=last;}em_web_campaign_stage_text(c,0xff0000+start);s->text_draw_complete=1;s->text_checked_render=UINT64_MAX;}
 }}
 if(source==0x178d2){em_web_campaign_scene(c,"main");s->main_ready_generation=s->scene_generation;if(s->title_end_generation!=s->scene_generation){s->title_end_generation=s->scene_generation;s->title_end_render=c->vdp.rendered_frames;}if(s->frontend_audio_requested&&!s->frontend_audio_active&&em_web_campaign_frontend_audio_clean(c)){s->frontend_audio_active=1;s->frontend_music_running=!!c->ram[0xdc50];}}
 if(source==0x20f24){s->options_in_game=!!(c->a[4]&65535);s->options_music_test=c->d[7]&65535;s->options_sound_test=c->a[3]&65535;em_web_campaign_scene(c,s->options_in_game?"pause":"options");}
 /* Only the modern frontend holds the native idle attract counter. This is
  * the same D7 word reset by original Up/Down, not a CPU/audio pause. Legacy
  * defaults to false; real navigation requests always release the hold. */
 if(source==0x178d2&&s->frontend_hold&&!s->route_pending&&!s->pending){
  if((c->d[7]&65535)!=0x384)++s->attract_counter_resets;
  c->d[7]=(c->d[7]&0xffff0000u)|0x384u;
 }
 s->poll_pc=c->pc;s->poll_source=source;s->poll_callback=dune_long(c,0xe002);s->poll_generation=s->scene_generation;
 /* Directional focus callbacks can run during the original palette fade.
  * Only the original palette-setup return authorizes public building RGB.
  * Restored saves can establish this at the native post-setup A poll. */
 if(source==0x28884||source==0x28ac0)s->building_palette_generation=s->scene_generation;
 if(!s->scene||strcmp(s->scene,"building")||s->building_palette_generation==s->scene_generation)em_web_campaign_draw_ready(c);
 if(s->input_release){s->input_release=0;c->d[0]&=0xffff0000u;return 1;}
 if(!s->input_pending)return 0;
 if(s->input_scope==1&&c->pc!=0x617a&&c->pc!=0x6e06)return 0;
 if(s->input_scope==2&&source!=0x20f24)return 0;
 if(source==0x847e||source==0x28884||source==0x9188||source==0x28ac0)return 0;
 int action=s->input_action,value=s->input_value,done=0;unsigned key=0;
 if(action==0){key=(unsigned)value;done=1;}
 else if((action==1||action==2)&&source==0x20f24){
  if(value>=(s->options_in_game?8:6)){s->input_pending=0;return 0;}
  unsigned current=dune_word(c,0xdbfc);
  if(!dune_word(c,0xdbf8)){key=current==(unsigned)value?(action==2?PAD_RIGHT:PAD_C):current>(unsigned)value?PAD_UP:PAD_DOWN;done=current==(unsigned)value;}
 }else if(action==3&&source==0x178d2){unsigned target=160+8*(unsigned)value,current=dune_word(c,0xd70e);key=current==target?PAD_C:current>target?PAD_UP:PAD_DOWN;done=current==target;}
 else if(action==4&&c->pc==0x4938){unsigned target=value==1?32:value==2?120:208,current=dune_word(c,0xbef8);if(!dune_word(c,0xbf02)){key=current==target?PAD_A:current>target?PAD_LEFT:PAD_RIGHT;done=current==target;}}
 else if(action==5&&source==0x21ae6){unsigned target=value?180:112,current=dune_word(c,0xdbf0);if(!dune_word(c,0xdbfa)){key=current==target?PAD_C:current>target?PAD_LEFT:PAD_RIGHT;done=current==target;}}
 else if(action==5&&c->pc==0x25cb2){unsigned target=value?0x140:0x128,current=dune_word(c,0xa62c);key=current==target?PAD_A:current>target?PAD_UP:PAD_DOWN;done=current==target;}
 else return 0;
 c->d[0]=(c->d[0]&0xffff0000u)|key;
 if(key){s->input_release=1;s->release_source=source;}
 if(done){s->input_pending=0;++s->input_seq;}
 return 1;
}
static int em_web_campaign_apply(CPU*c){
 EmWebCampaign*s=&em_web_campaign;
 if(s->requested_mission==1){s->stage=4;return 0;}
 unsigned password=em_web_campaign_password(s->requested_house,s->requested_mission);
 /* Inject an ordinary original JSR at this verified C-caller checkpoint.
  * The callee preserves D3..D5/A2/A3. Its only game writes are the canonical
  * password selectors C274/C04C/C050; map/spawn/research remain the native loader.
  * Its stack argument is removed when it returns to this same checkpoint.
  */
 s->call_return=c->pc;s->call_sp=c->a[7];s->calling=1;s->stage=3;
 c->a[7]-=8;write_mem(c,c->a[7],4,s->call_return);write_mem(c,c->a[7]+4,4,password);c->pc=0x21902;
 return 1;
}
/* The original writer draws one current sentence/paragraph, not a prefix of
 * the whole speech. Copy its real RAM argument, then publish only once that
 * native glyph raster is present in the actual completed VDP frame. No timer.
 */
static void em_web_campaign_visible_text(CPU*c){
 EmWebCampaign*s=&em_web_campaign;
 if(!s->text_pending||!s->text_draw_complete||c->vdp.frame_width!=320||c->vdp.frame_height!=224||s->text_checked_render==c->vdp.rendered_frames)return;
 s->text_checked_render=c->vdp.rendered_frames;
 static uint8_t expected[320*224*3],sprites[320*224];
 vdp_render_pixels(&c->vdp,320,224,sprites,expected);
 unsigned checked=0,lit=0;
 for(unsigned y=0;y<80;y++)for(unsigned x=0;x<320;x++){
  unsigned sx,sy,at=vdp_plane_address(&c->vdp,0,x,y,&sx,&sy);
  if(vdp_window_at(&c->vdp,x,y))at=((c->vdp.registers[3]&0x3c)<<10)+((y/8)*64+x/8)*2;
  unsigned entry=vdp_word(&c->vdp,at),tile=entry&2047;
  if((entry&0xf800)!=0xc000||tile<0x480||tile>0x4de)continue;
  unsigned pos=(y*320+x)*3;
  if(memcmp(expected+pos,c->vdp.frame+pos,3))return;
  ++checked;lit+=expected[pos]!=0||expected[pos+1]!=0||expected[pos+2]!=0;
 }
 if(checked&&lit){memcpy(s->visible_message,s->staged_message,sizeof s->visible_message);s->text_pending=s->text_draw_complete=0;}
}
/* Returning from gameplay to the catalogue uses an ordinary clean frontend
 * state load in the host. Startup main-menu drawing is not a safe game-world
 * subroutine: its shared graphics scratch and callback restoration overwrite
 * the world presentation. Never borrow it from a live scenario. */
static int em_web_campaign_route_key(CPU*c,unsigned key){
 EmWebCampaign*s=&em_web_campaign;c->d[0]=(c->d[0]&0xffff0000u)|key;
 if(key)s->input_release=1;return 1;
}
/* Shared by screen navigation and direct campaign requests. Native B only
 * resets a menu action; leaving requires the original Exit cell and native A. */
static int em_web_campaign_exit_building(CPU*c){
 unsigned source=c->pc;
 if(source==0x847e||source==0x9188){
  unsigned col=dune_word(c,source==0x9188?0xbfc8:0xbf8a),row=dune_word(c,source==0x9188?0xbfca:0xbf8c);
  if(col||row){ /* Same verified native-cell entry as the ordinary mouse adapter. */
   c->d[0]&=0xffff0000u;c->d[1]&=0xffff0000u;c->a[1]=0;c->pc=source==0x9188?0x91d6:0x84cc;return 1;
  }return 0;
 }
 if(source==0x28884||source==0x28ac0){
  unsigned col=dune_word(c,source==0x28ac0?0xbfc8:0xbf8a),row=dune_word(c,source==0x28ac0?0xbfca:0xbf8c);
  if(col||row)return 0;c->ram[0xbf2b]='A';return em_web_campaign_route_key(c,'A');
 }
 return 0;
}
/* A modern global-screen request asks for the original no-intro Main path.
 * Never borrow Main from a world. These registers are private presentation
 * arguments/counters in the authentic startup routine; all native palette,
 * loader/audio calls and instruction clocks still run normally. */
static void em_web_campaign_route_intro(CPU*c){
 EmWebCampaign*s=&em_web_campaign;unsigned hp=dune_long(c,0xc278)&0xffffffu;
 int requested=(s->route_pending&&s->route_target>=0&&s->route_target<3)||(s->pending&&s->stage>=1&&s->stage<4);
 if(!requested||s->armed||s->ui_call_active||s->calling||dune_mouse_context(c)||(hp>=0xff0000&&hp<=0xffffa0))return;
 /* The console logo routine runs before9320 initializes house=-1. Its exact
  * original caller and private saved-register frame distinguish it from any
  * game wait. Retain one genuine VBlank; initialization and driver calls run. */
 unsigned sp=c->a[7]&65535;
 if((c->pc==0x1898||c->pc==0x189a)&&sp<=65516&&dune_long(c,sp+16)==0x17ee){
  c->d[2]=(c->d[2]&0xffff0000u)|0xfffeu;c->d[4]&=0xffff0000u;
  if(c->pc==0x189a)c->d[3]&=0xffff0000u;
  return;
 }
 if(em_web_campaign_house(c)!=-1)return;
 /* Original17420 loaded the first/warm-call argument into A3. Zero is the
  * original warm Main argument used by caller9474/94DA, not a new entry ABI. */
 if(c->pc==0x17424||c->pc==0x174d2)c->a[3]=0;
 /* A request can arrive after the no-intro branch. Finish only these fixed
  * decorative title holds; the following original render/palette/audio path
  * remains authoritative. The next real native input poll takes the route. */
 if(c->pc==0x174f4||c->pc==0x177d2)c->d[3]=(c->d[3]&0xffff0000u)|0xc8u;
 if(c->pc==0x1752e)c->d[3]=(c->d[3]&0xffff0000u)|0x12cu;
}

static int em_web_campaign_route_observe(CPU*c){
 EmWebCampaign*s=&em_web_campaign;
 if(!s->route_pending||s->pending||s->calling)return 0;
 const char*target=em_web_campaign_route_name(s->route_target);
 if(s->scene&&!strcmp(s->scene,target)&&em_web_campaign_scene_ready(c)){
  if(s->route_target!=1||!s->options_in_game){s->route_pending=0;s->route_phase=0;return 0;}
 }
 if(c->pc==0x11844&&s->route_target<3)c->d[4]=(c->d[4]&0xffffff00u)|0xffu;
 if(s->poll_step!=c->steps||s->poll_generation!=s->scene_generation)return 0;
 unsigned source=s->poll_source,key=0;
 if(source==0x617a||source==0x6e06){if(s->route_target==3)key=PAD_START;else return 0;}
 else if(source==0x20f24){
  s->route_phase=0;
  if((s->route_target==3&&s->options_in_game)||(s->route_target==1&&!s->options_in_game))return 0;
  key=PAD_START;
 }else if(source==0x178d2){
  if(s->route_target==0||s->route_phase)return 0;
  unsigned target_y=s->route_target==1?168:s->route_target==2?176:160,current=dune_word(c,0xd70e);
  key=current==target_y?PAD_C:current>target_y?PAD_UP:PAD_DOWN;
  if(current==target_y)s->route_phase=1;
 }else if(source==0x847e||source==0x9188||source==0x28884||source==0x28ac0)return em_web_campaign_exit_building(c);
 else if(source==0x418b8){if(s->route_target==2)return 0;key=PAD_START;}
 else if(source==0x21ae6){unsigned current=dune_word(c,0xdbf0);if(dune_word(c,0xdbfa))return 0;key=current==180?PAD_C:current>180?PAD_LEFT:PAD_RIGHT;}
 else if(source==0x25cb2){key=dune_word(c,0xa62c)==0x128?PAD_A:PAD_UP;}
 else if(source==0x21660){key=PAD_START;}
 else key=PAD_A; /* Original old intro/story/movie/result wait only. */
 return em_web_campaign_route_key(c,key);
}
static int em_web_campaign_observe(CPU*c){
 EmWebCampaign*s=&em_web_campaign;
 if(s->cpu!=c||c->steps<s->last_steps||c->master_cycles<s->last_cycles)em_web_campaign_after_load(c);
 s->last_steps=c->steps;s->last_cycles=c->master_cycles;
 if(c->fault)return 0;
 em_web_campaign_route_intro(c);
 em_web_campaign_transition_update(c);
 if(em_web_campaign_sound_return(c))return 1;
 /* An explicit campaign request drives the old hidden menu selections.
  * Keep one genuine confirm; omit only scripted cursor/duplicate-confirm cues.
  * Voice, music, mission briefing and every ordinary player action are native. */
 if(s->pending&&s->stage<4){unsigned next=0;switch(c->pc){
 case 0x17af6:next=0x17afc;break;case 0x4830:next=0x4836;break;case 0x4856:next=0x485c;break;case 0x25d14:next=0x25d1a;break;
 case 0x1798c:s->campaign_confirm_played=1;break;
 case 0x26c22:if(s->campaign_confirm_played)next=0x26c28;else s->campaign_confirm_played=1;break;
 case 0x1f3c8:if(s->campaign_confirm_played)next=0x1f3ce;else s->campaign_confirm_played=1;break;
 case 0x25d2c:if(s->campaign_confirm_played)next=0x25d32;else s->campaign_confirm_played=1;break;
 default:break;}
 if(next){c->pc=next;++s->campaign_feedback_suppressed;return 1;}}

 if(em_web_campaign_frontend_audio_observe(c))return 1;
 if(s->calling&&c->pc==s->call_return&&c->a[7]==s->call_sp-4){
  c->a[7]+=4;s->calling=0;
  if((c->d[0]&65535)!=1||em_web_campaign_house(c)!=s->requested_house||em_web_campaign_mission(c)!=s->requested_mission){s->pending=0;s->stage=-1;return 1;}
  s->stage=4;return 1;
 }
 switch(c->pc){
 case 0x628:case 0x6c8:s->fade_active=1;s->fade_direction=c->pc==0x628?1:2;++s->fade_serial;s->fade_start_frame=c->vdp.frames;s->fade_start_cycles=c->master_cycles;break;
 case 0x6c6:case 0x786:if(s->fade_active){s->fade_active=0;s->fade_last_frames=c->vdp.frames-s->fade_start_frame;s->fade_end_render=c->vdp.rendered_frames;}break;
 case 0x200:em_web_campaign_scene(c,"boot");break;
 case 0x9320:em_web_campaign_scene(c,"title");break;
 case 0x17418:case 0x178d2:em_web_campaign_scene(c,"main");break;
 case 0x177d8:em_web_campaign_scene(c,"main");s->title_end_generation=s->scene_generation;s->title_end_render=c->vdp.rendered_frames;break;
 case 0x1780a:em_web_campaign_scene(c,"main");s->main_choices_generation=s->scene_generation;break;
 case 0x26b8a:case 0x4938:em_web_campaign_scene(c,"house");break;
 case 0x1f346:em_web_campaign_scene(c,"house_briefing");break;
 case 0x1f3ea:em_web_campaign_scene(c,"campaign");break;
 case 0x1f4b6:em_web_campaign_presentation(c,"briefing_exit",1);break;
 case 0x2610c:em_web_campaign_scene(c,"campaign");em_web_campaign_presentation(c,"strategic_map",1);break;
 case 0x25b02:{unsigned sp=c->a[7]&65535;if(sp<=65528){em_web_campaign_stage_text(c,dune_long(c,sp+4));s->text_draw_complete=0;}break;}
 case 0x1fb34:if(s->text_pending){s->text_draw_complete=1;s->text_checked_render=UINT64_MAX;}break;
 case 0x25ece:case 0x260ec:{s->visible_message[0]=s->staged_message[0]=0;s->text_pending=s->text_draw_complete=s->message_complete=0;unsigned sp=c->a[7]&65535;if(sp<=65524){s->message_pointer=dune_long(c,sp+6);unsigned ret=dune_long(c,sp);if(ret==0x1f3b4)em_web_campaign_scene(c,"house_briefing");else if(ret==0x1f562)em_web_campaign_scene(c,"victory");else if(ret==0x1f5e4)em_web_campaign_scene(c,"defeat");else em_web_campaign_scene(c,"briefing");}break;}
 case 0x287dc:case 0x28a18:em_web_campaign_transition_begin(c,1);s->scene=NULL;em_web_campaign_scene(c,"building");s->building_palette_generation=0;break;
 case 0x287f0:case 0x28a2c:if(s->transition_kind==1)s->transition_phase=2;break;
 case 0x2884c:case 0x28a88:if(s->transition_kind==1)s->transition_phase=3;break;
 case 0x28854:case 0x28a90:s->building_palette_generation=s->scene_generation;break;
 case 0x2895c:case 0x28ce8:em_web_campaign_transition_begin(c,2);s->ready_generation=s->poll_generation=0;break;
 case 0x28974:case 0x28d00:if(s->transition_kind==2)s->transition_phase=2;break;
 case 0x289f2:case 0x28d5a:if(s->transition_kind==2)s->transition_phase=3;break;
 case 0x26540:s->native_loading=1;em_web_campaign_scene(c,"loading");em_web_campaign_presentation(c,"battle_loading",1);break;
 case 0x1609c:em_web_campaign_scene(c,"loading");break;
 case 0x20da6:s->options_in_game=!!dune_word(c,(c->a[7]+4)&65535);em_web_campaign_scene(c,s->options_in_game?"pause":"options");break;
 case 0x215c0:em_web_campaign_scene(c,"password");break;
 case 0x21a5c:s->message_pointer=0x21a32;em_web_campaign_scene(c,"confirm");break;
 case 0x22af0:s->result_check=1;s->result_candidate=-1;break;
 case 0x22af4:if(s->result_check)s->result_candidate=(c->d[0]&65535)==1;break;
 case 0x22afc:case 0x22bde:{
  int win=c->pc==0x22afc;
  if(s->result_check&&s->result_candidate==win&&s->armed&&s->played_house==em_web_campaign_house(c)&&s->played_mission==em_web_campaign_mission(c)){
   s->outcome=win?1:2;s->outcome_house=s->played_house;s->outcome_mission=s->played_mission;++s->outcome_seq;s->armed=0;
  }
  s->result_check=0;em_web_campaign_scene(c,win?"victory":"defeat");em_web_campaign_presentation(c,win?"victory_flyover":"defeat_flyover",1);break;
 }
 case 0x26984:{unsigned sp=c->a[7]&65535,ret=sp<=65532?dune_long(c,sp):0;int win=ret==0x26980;em_web_campaign_scene(c,win?"victory":"defeat");em_web_campaign_presentation(c,win?"victory_flyover":"defeat_flyover",1);break;}
 case 0x128ae:em_web_campaign_scene(c,"victory_movie");em_web_campaign_presentation(c,"victory_movie_setup",1);break;
 case 0x12916:em_web_campaign_scene(c,"victory_movie");em_web_campaign_presentation(c,"victory_planes",1);em_web_campaign_draw_ready(c);break;
 case 0x12996:em_web_campaign_scene(c,"defeat_movie");em_web_campaign_presentation(c,"defeat_movie_setup",1);break;
 case 0x129fe:em_web_campaign_scene(c,"defeat_movie");em_web_campaign_presentation(c,"defeat_planes",1);em_web_campaign_draw_ready(c);break;
 case 0x271e2:em_web_campaign_scene(c,"results");em_web_campaign_presentation(c,"results_setup",1);break;
 case 0x27238:em_web_campaign_scene(c,"results");em_web_campaign_presentation(c,"results_counting",1);break;
 case 0x272d2:em_web_campaign_scene(c,"results");break;
 case 0x272ea:em_web_campaign_presentation(c,"password_scroll",1);break;
 case 0x272fa:em_web_campaign_scene(c,"password_display");break;
 case 0x12734:em_web_campaign_scene(c,"ending");em_web_campaign_presentation(c,"finale_setup",1);break;
 case 0x127b4:em_web_campaign_scene(c,"ending");em_web_campaign_presentation(c,"finale",1);em_web_campaign_draw_ready(c);break;
 case 0x11840:case 0x11844:em_web_campaign_scene(c,"credits");em_web_campaign_presentation(c,"credits",1);em_web_campaign_draw_ready(c);break;
 case 0x117b8:em_web_campaign_scene(c,"credits");break;
 case 0x3067c:em_web_campaign_scene(c,"tutorial");break;
 default:break;
 }
 /* Restored strategic-map animation saves can be inside its inputless waits. */
 if((c->pc==0xfd4||c->pc==0xfde)&&(c->a[7]&65535)<=65532){unsigned ret=dune_long(c,c->a[7]&65535);switch(ret){case 0x2618e:case 0x26196:case 0x261ca:case 0x261ce:case 0x261d2:case 0x2627c:case 0x26280:case 0x26284:case 0x26424:case 0x26440:em_web_campaign_scene(c,"campaign");em_web_campaign_presentation(c,"strategic_map",1);break;default:break;}}
 int context=dune_mouse_context(c);
 if(context==1&&s->native_loading&&(c->pc==0x617a||c->pc==0x6e06||c->pc==0x125f6||c->pc==0x16d18)){s->native_loading=0;if(!s->pending||s->stage==4){s->armed=1;s->played_house=em_web_campaign_house(c);s->played_mission=em_web_campaign_mission(c);++s->starts;}}
 if((c->pc==0x125f6||c->pc==0x16d18||c->pc==0x617a||c->pc==0x6e06)&&em_web_campaign_house(c)>=0&&em_web_campaign_mission(c)){
  if(!s->outcome&&(!s->pending||s->stage==4)){s->armed=1;s->played_house=em_web_campaign_house(c);s->played_mission=em_web_campaign_mission(c);}
  em_web_campaign_scene(c,context>1?"building":"map");
 }
 if(context==1&&(c->pc==0x617a||c->pc==0x6e06)&&s->pending&&s->stage==4&&s->played_house==s->requested_house&&s->played_mission==s->requested_mission){s->pending=0;s->stage=0;em_web_campaign_scene(c,"map");}
 em_web_campaign_visible_text(c);
 if(em_web_campaign_poll(c))return 1;
 if(em_web_campaign_sound_observe(c))return 1;
 if(em_web_campaign_route_observe(c))return 1;
 if(!s->pending||s->stage==4||s->calling)return 0;
 /* No rewind, reset, savebuffer writes or fabricated scenario state. */
 /* Explicit modern navigation may leave the first staff scroll early. Open
  * only its presentation gate at the original TST.B checkpoint; the original
  * input poll, exit, cleanup and next menu still execute normally. */
 if(c->pc==0x11844)c->d[4]=(c->d[4]&0xffffff00u)|0xffu;
 if(c->pc==0x1253e&&s->stage==1){write_mem(c,0xffc14c,2,2);s->stage=2;return 0;}
 if((c->pc==0x16cfc||c->pc==0x1259a)&&s->stage<3)return em_web_campaign_apply(c);
 /* A new requested run may replace an old briefing, result or movie. Move
  * through those OLD screens only with original neutral/confirm polls. Stage4
  * above stops this automation before the newly requested briefing. */
 if(c->pc==0x4d4e&&dune_mouse_context(c)==0){unsigned sp=c->a[7]&65535;unsigned source=sp<=65532?dune_long(c,sp):0;
  if(source==0x21ae6){unsigned current=dune_word(c,0xdbf0),key=0;if(!dune_word(c,0xdbfa))key=current==180?PAD_C:current>180?PAD_LEFT:PAD_RIGHT;c->d[0]=(c->d[0]&0xffff0000u)|key;if(key)s->input_release=1;return 1;}
  if(source==0x178d2){unsigned current=dune_word(c,0xd70e),key=current==160?PAD_C:current>160?PAD_UP:PAD_DOWN;c->d[0]=(c->d[0]&0xffff0000u)|key;s->input_release=1;return 1;}
  if(source!=0x178d2){unsigned key=(source==0x20f24||source==0x21660)?PAD_START:PAD_A;c->d[0]=(c->d[0]&0xffff0000u)|key;s->input_release=1;return 1;}}
 if(c->pc==0x418b8){c->d[0]=(c->d[0]&0xffff0000u)|PAD_START;s->input_release=1;return 1;}
 if(c->pc==0x272d2||c->pc==0x272fa){c->d[0]=(c->d[0]&0xffff0000u)|PAD_A;s->input_release=1;return 1;}
 if(c->pc==0x20f24){c->d[0]=(c->d[0]&0xffff0000u)|'S';return 1;}
 if(c->pc==0x4938){
  unsigned target=s->requested_house==1?32:s->requested_house==2?120:208,current=dune_word(c,0xbef8),key=0;
  if(!dune_word(c,0xbf02))key=current==target?PAD_A:current>target?PAD_LEFT:PAD_RIGHT;
  c->d[0]=(c->d[0]&0xffff0000u)|key;return 1;
 }
 if(c->pc==0x25cb2){unsigned y=dune_word(c,0xa62c);c->d[0]=(c->d[0]&0xffff0000u)|(y==0x128?PAD_A:PAD_UP);return 1;}
 if((context==2||context==3)&&em_web_campaign_exit_building(c))return 1;
 /* Native boot/title/movie wait, only before the requested mission briefing. */
 if(c->pc==0x4724||c->pc==0x17d22||c->pc==0x17e96||c->pc==0x17ea6||c->pc==0x17eb6){c->d[0]=(c->d[0]&0xffff0000u)|PAD_A;return 1;}
 return 0;
}
static void em_web_campaign_display_string(const CPU*c,unsigned x,unsigned y,unsigned count,char*out){
 for(unsigned i=0;i<count;i++){unsigned sx,sy,at=vdp_plane_address(&c->vdp,0,x+i*8,y,&sx,&sy);if(vdp_window_at(&c->vdp,x+i*8,y))at=((c->vdp.registers[3]&0x3c)<<10)+((y/8)*64+(x+i*8)/8)*2;unsigned entry=vdp_word(&c->vdp,at),tile=entry&2047;out[i]=tile>=0x520&&tile<=0x57e?(char)(tile-0x500):entry==0x62f5?':':' ';}out[count]=0;while(count&&out[count-1]==' ')out[--count]=0;
}
static size_t em_web_campaign_json_text(char*out,size_t size,size_t n,const char*value){
 out[n++]='"';for(unsigned i=0;value[i]&&n+8<size;i++){unsigned ch=(unsigned char)value[i];if(ch=='"'||ch=='\\'){out[n++]='\\';out[n++]=(char)ch;}else if(ch<32){int z=snprintf(out+n,size-n,"\\u%04x",ch);n+=(size_t)z;}else out[n++]=(char)ch;}out[n++]='"';out[n]=0;return n;
}
static const char*em_web_campaign_report(CPU*c){
 static char json[6144];EmWebCampaign*s=&em_web_campaign;int h=em_web_campaign_house(c),mission=em_web_campaign_mission(c);
 snprintf(json,sizeof json,"{\"scene\":\"%s\",\"sceneNativePc\":%u,\"sceneFrame\":%llu,\"houseId\":%d,\"house\":\"%s\",\"mission\":%d,\"region\":%d,\"regionChoice\":false,\"pending\":%d,\"requestStage\":%d,\"requestedHouse\":%d,\"requestedMission\":%d,\"starts\":%llu,\"outcome\":\"%s\",\"outcomeSeq\":%llu,\"outcomeHouse\":%d,\"outcomeMission\":%d,\"campaignComplete\":%s,\"mapContext\":%d,\"pc\":%u,\"fault\":%d}",
 s->scene?s->scene:"boot",s->scene_pc,(unsigned long long)s->scene_frame,h,em_web_campaign_house_name(h),mission,em_web_campaign_region(h,mission),s->pending,s->stage,s->requested_house,s->requested_mission,(unsigned long long)s->starts,s->outcome==1?"victory":s->outcome==2?"defeat":"none",(unsigned long long)s->outcome_seq,s->outcome_house,s->outcome_mission,s->outcome==1&&s->outcome_mission==9?"true":"false",dune_mouse_context(c),c->pc,c->fault);
 size_t n=strlen(json);if(n&&json[n-1]=='}')json[--n]=0;
 const char*kind=s->poll_generation!=s->scene_generation?"transition":s->scene&&!strcmp(s->scene,"map")?"battle":s->poll_source==0x20f24?"options":s->poll_source==0x178d2?"main":s->poll_pc==0x4938?"house":(s->poll_pc==0x25cb2||s->poll_source==0x21ae6)?"confirm":"continue";
 snprintf(json+n,sizeof json-n,",\"inputKind\":\"%s\",\"nativePollPc\":%u,\"nativePollSource\":%u,\"nativeCallback\":%u,\"inputQueued\":%d,\"inputSeq\":%llu,\"continueMask\":%u,\"confirmStyle\":\"%s\",\"choiceLabels\":[\"%s\",\"%s\"],\"backMask\":%d,\"optionsInGame\":%d,\"music\":%d,\"sound\":%d,\"autoscroll\":%d,\"musicTest\":%u,\"soundTest\":%u,\"optionRow\":%u",kind,s->poll_pc,s->poll_source,s->poll_callback,s->input_pending,(unsigned long long)s->input_seq,(s->poll_pc==0x617a||s->poll_pc==0x6e06||dune_mouse_context(c)==1)?PAD_START:PAD_A,s->poll_source==0x21ae6?"horizontal":s->poll_pc==0x25cb2?"vertical":"none",s->poll_pc==0x25cb2&&s->confirm_mode?"PROCEED":"YES",s->poll_pc==0x25cb2&&s->confirm_mode?"ADVICE":"NO",s->poll_source==0x20f24?128:0,s->options_in_game,!!c->ram[0xdc50],!!c->ram[0xdc51],!!c->ram[0xbf7c],s->options_music_test,s->options_sound_test,dune_word(c,0xdbfc));
 n=strlen(json);snprintf(json+n,sizeof json-n,",\"sceneGeneration\":%llu,\"sceneReady\":%s,\"sceneReadyAfterFrame\":%llu,\"completedFrame\":%llu,\"pollValid\":%s,\"routePending\":%d,\"routeTarget\":%d,\"routeTargetName\":\"%s\",\"routeSeq\":%llu,\"uiCallActive\":%d",(unsigned long long)s->scene_generation,em_web_campaign_scene_ready(c)?"true":"false",(unsigned long long)s->ready_render,(unsigned long long)c->vdp.rendered_frames,s->poll_generation==s->scene_generation?"true":"false",s->route_pending,s->route_target,em_web_campaign_route_name(s->route_target),(unsigned long long)s->route_seq,s->ui_call_active||s->sound_active);
 n=strlen(json);snprintf(json+n,sizeof json-n,",\"presentationReady\":%s,\"presentationPhase\":\"%s\",\"presentationFullFrame\":%s,\"presentationGeneration\":%llu,\"nativeFrameRect\":[0,0,320,224],\"outcomeTerminal\":%s,\"terminalHouseId\":%d,\"terminalMission\":%d",em_web_campaign_presentation_ready(c)?"true":"false",s->presentation_phase?s->presentation_phase:(s->scene?s->scene:"unknown"),s->presentation_full?"true":"false",(unsigned long long)s->presentation_generation,em_web_campaign_terminal(c)?"true":"false",h,s->scene&&!strcmp(s->scene,"credits")?9:s->stats_mission);
 n=strlen(json);snprintf(json+n,sizeof json-n,",\"battlePresentation\":%s,\"flyover\":%s",em_web_campaign_world_visible(c)?"true":"false",em_web_campaign_flyover(c)?"true":"false");
 n=strlen(json);snprintf(json+n,sizeof json-n,",\"transitionGeneration\":%llu,\"transitionIntent\":\"%s\",\"transitionPhase\":\"%s\",\"transitionTarget\":\"%s\",\"transitionActive\":%s,\"transitionReady\":%s,\"transitionCovered\":%s,\"transitionObject\":%u,\"nativeFadeActive\":%s,\"nativeFadeDirection\":\"%s\",\"nativeFadeSerial\":%llu,\"nativeFadeLastFrames\":%llu,\"nativeDisplayEnabled\":%s,\"passwordPresentation\":%s,\"titleLicenseReady\":%s",(unsigned long long)s->transition_generation,s->transition_kind==1?"building_enter":s->transition_kind==2?"building_exit":"none",s->transition_phase==1?"out":s->transition_phase==2?"loading":s->transition_phase==3?"in":s->transition_phase==4?"ready":"none",s->transition_kind==1?"building":s->transition_kind==2?"map":"none",em_web_campaign_transition_active(c)?"true":"false",s->transition_ready?"true":"false",s->transition_covered?"true":"false",s->transition_object,s->fade_active?"true":"false",s->fade_active?(s->fade_direction==1?"out":"in"):"none",(unsigned long long)s->fade_serial,(unsigned long long)s->fade_last_frames,(c->vdp.registers[1]&64)?"true":"false",em_web_campaign_password_presentation(c)?"true":"false",em_web_campaign_title_license_ready(c)?"true":"false");
 #ifdef DUNE_EM_WEB_FRAME_H
 n=strlen(json);snprintf(json+n,sizeof json-n,",\"nativeFrameBlack\":%s",em_web_frame_current(c)&&em_web_frame_black?"true":"false");
 #endif
 n=strlen(json);snprintf(json+n,sizeof json-n,",\"frontendAudio\":%s,\"frontendMusicRunning\":%s,\"frontendAudioSuppressed\":%llu,\"frontendMusicCommands\":%llu,\"frontendFeedbackRemapped\":%llu",s->frontend_audio_active?"true":"false",s->frontend_music_running?"true":"false",(unsigned long long)s->frontend_audio_suppressed,(unsigned long long)s->frontend_music_commands,(unsigned long long)s->frontend_feedback_remapped);
 n=strlen(json);snprintf(json+n,sizeof json-n,",\"frontendHold\":%d,\"attractCounterResets\":%llu",s->frontend_hold,(unsigned long long)s->attract_counter_resets);
 n=strlen(json);snprintf(json+n,sizeof json-n,",\"mainChoicesWritten\":%s,\"campaignFeedbackSuppressed\":%llu",s->main_choices_generation==s->scene_generation?"true":"false",(unsigned long long)s->campaign_feedback_suppressed);
 n=strlen(json);snprintf(json+n,sizeof json-n,",\"inputReady\":%s",s->poll_generation==s->scene_generation&&em_web_campaign_scene_ready(c)?"true":"false");
 n=strlen(json);snprintf(json+n,sizeof json-n,",\"uiSoundQueued\":%d,\"uiSoundRequests\":%llu,\"uiSoundConsumed\":%llu,\"uiSoundNativeCalls\":%llu",s->sound_pending,(unsigned long long)s->sound_requests,(unsigned long long)s->sound_consumed,(unsigned long long)s->sound_calls);
 n=strlen(json);snprintf(json+n,sizeof json-n,",\"rows\":[");
 static const char*labels[8]={"Music","Sound","Autoscroll","Music test","Sound test","Password","Restart mission","Pick another house"};
 static const int tops[8]={36,52,68,84,100,132,148,164};
 if(s->poll_source==0x20f24){int comma=0;for(int row=0;row<(s->options_in_game?8:6);row++){if(row==5)continue;n=strlen(json);snprintf(json+n,sizeof json-n,"%s{\"row\":%d,\"label\":\"%s\",\"nativeHit\":[120,%d],\"sourceRect\":[24,%d,288,16]}",comma?",":"",row,labels[row],tops[row]+8,tops[row]);comma=1;}}
 n=strlen(json);snprintf(json+n,sizeof json-n,"],\"activeRunArmed\":%d,\"activeRunHouse\":%d,\"activeRunMission\":%d,\"messagePointer\":%u,\"messagePhase\":%d,\"messageLineProgress\":%d,\"messageLinesTotal\":%d,\"messageNativeLinePointer\":%u,\"messageText\":\"",s->armed,s->played_house,s->played_mission,s->message_pointer,s->message_phase,s->message_line_progress,s->message_lines_total,s->message_line_pointer);
 n=strlen(json);unsigned ptr=s->message_pointer;
 if(ptr&&ptr<c->rom_size)for(unsigned i=0;ptr+i<c->rom_size&&i<1800&&n+8<sizeof json;i++){unsigned ch=c->rom[ptr+i];if(!ch)break;if(ch=='"'||ch=='\\'){json[n++]='\\';json[n++]=(char)ch;}else if(ch<32){int z=snprintf(json+n,sizeof json-n,"\\u%04x",ch);n+=(size_t)z;}else json[n++]=(char)ch;}
 json[n++]='"';json[n]=0;
 int add=snprintf(json+n,sizeof json-n,",\"nativeTextRect\":[16,16,288,40],\"messageComplete\":%s,\"visibleMessageText\":\"",s->message_complete&&!s->text_pending?"true":"false");n+=(size_t)add;
 for(unsigned i=0;s->visible_message[i]&&i<sizeof s->visible_message&&n+8<sizeof json;i++){unsigned ch=(unsigned char)s->visible_message[i];if(ch=='"'||ch=='\\'){json[n++]='\\';json[n++]=(char)ch;}else if(ch<32){int z=snprintf(json+n,sizeof json-n,"\\u%04x",ch);n+=(size_t)z;}else json[n++]=(char)ch;}
 json[n++]='"';json[n]=0;
 int stats_ready=(s->poll_source==0x272d2||s->poll_source==0x272fa)&&s->scene&&(!strcmp(s->scene,"results")||!strcmp(s->scene,"password_display"));
 int z=snprintf(json+n,sizeof json-n,",\"statsReady\":%s,\"statsDisplay\":{\"ready\":%s",stats_ready?"true":"false",stats_ready?"true":"false");n+=(size_t)z;
 if(stats_ready){z=snprintf(json+n,sizeof json-n,",\"mission\":%d,\"victory\":%s,\"campaignComplete\":%s",s->stats_mission,s->stats_victory?"true":"false",s->stats_victory&&s->stats_mission==9?"true":"false");n+=(size_t)z;char value[48];const char*keys[3]={"score","time","rank"};const unsigned xx[3]={72,240,0},yy[3]={24,24,56},cc[3]={5,5,40};for(unsigned i=0;i<3;i++){z=snprintf(json+n,sizeof json-n,",\"%s\":",keys[i]);n+=(size_t)z;em_web_campaign_display_string(c,xx[i],yy[i],cc[i],value);n=em_web_campaign_json_text(json,sizeof json,n,value);}z=snprintf(json+n,sizeof json-n,",\"counts\":[");n+=(size_t)z;const unsigned ys[6]={104,112,144,152,184,192};for(unsigned i=0;i<6;i++){if(i)json[n++]=',';em_web_campaign_display_string(c,256,ys[i],5,value);n=em_web_campaign_json_text(json,sizeof json,n,value);}json[n++]=']';const char*groups[3]={"spice","units","structures"};for(unsigned i=0;i<3;i++){z=snprintf(json+n,sizeof json-n,",\"%s\":{\"you\":",groups[i]);n+=(size_t)z;em_web_campaign_display_string(c,256,ys[i*2],5,value);n=em_web_campaign_json_text(json,sizeof json,n,value);z=snprintf(json+n,sizeof json-n,",\"enemy\":");n+=(size_t)z;em_web_campaign_display_string(c,256,ys[i*2+1],5,value);n=em_web_campaign_json_text(json,sizeof json,n,value);json[n++]='}';}}
 json[n++]='}';json[n++]='}';json[n]=0;return json;
}
#ifdef __EMSCRIPTEN__
static void em_web_campaign_release_host(void){
 memset(em_cpu.pad_buttons,0,sizeof em_cpu.pad_buttons);
 dune_mouse_reset(&em_host.dune_mouse);em_web_menu_select_reset_state();
 em_host.dune_view.pointer_valid=0;em_host.fast_forward=0;em_host.paused=0;
 dune_web_reset_clock();
}
EMSCRIPTEN_KEEPALIVE const uint8_t*dune_web_readonly_textless_frame_rgb(void){
#ifdef DUNE_EM_WEB_FRAME_H
 EmWebCampaign*s=&em_web_campaign;int mode=em_web_campaign_password_presentation(&em_cpu)?3:s->presentation_phase&&!strcmp(s->presentation_phase,"briefing_exit")?4:!s->presentation_full&&s->scene&&(!strcmp(s->scene,"briefing")||!strcmp(s->scene,"house_briefing")||!strcmp(s->scene,"victory")||!strcmp(s->scene,"defeat"))?1:s->scene&&!strcmp(s->scene,"main")&&(s->main_choices_generation==s->scene_generation||s->main_ready_generation==s->scene_generation)?2:0;
 return em_web_frame_textless(&em_cpu,mode);
#else
 return em_cpu.vdp.frame;
#endif
}
/* Optional localized Results presentation only. No score/timer/counter is
 * reconstructed; all those pixels remain the completed original frame. */
static int em_web_campaign_results_overlay_active(void){
 EmWebCampaign*s=&em_web_campaign;return s->cpu==&em_cpu&&s->scene&&!strcmp(s->scene,"results")&&(!s->presentation_phase||!strncmp(s->presentation_phase,"results",7));
}
EMSCRIPTEN_KEEPALIVE const uint8_t*dune_web_results_frame_rgb(void){
#ifdef DUNE_EM_WEB_FRAME_H
 if(em_web_campaign_results_overlay_active())return em_web_frame_textless(&em_cpu,5);
 return em_web_frame_present(&em_cpu);
#else
 return em_cpu.vdp.frame;
#endif
}
EMSCRIPTEN_KEEPALIVE const char*dune_web_results_overlay_json(void){
 static char json[512];
#ifdef DUNE_EM_WEB_FRAME_H
 unsigned mask=em_web_campaign_results_overlay_active()?em_web_frame_results_label_mask(&em_cpu):0;char rank[41]={0};uint8_t label[3]={0},yellow[3]={0};
 if(mask){em_web_frame_results_rank(&em_cpu,rank);em_web_frame_results_ink(&em_cpu,61,label);em_web_frame_results_ink(&em_cpu,40,yellow);}
 size_t n=(size_t)snprintf(json,sizeof json,"{\"ready\":%s,\"frame\":%llu,\"labelMask\":%u,\"labelInk\":[%u,%u,%u],\"rankInk\":[%u,%u,%u],\"rankVisible\":%s,\"rank\":",mask?"true":"false",(unsigned long long)em_cpu.vdp.rendered_frames,mask,label[0],label[1],label[2],yellow[0],yellow[1],yellow[2],rank[0]?"true":"false");
 n=em_web_campaign_json_text(json,sizeof json,n,rank);json[n++]='}';json[n]=0;
#else
 strcpy(json,"{\"ready\":false}");
#endif
 return json;
}
static int em_web_campaign_localized_credits_active(void){EmWebCampaign*s=&em_web_campaign;return s->cpu==&em_cpu&&s->scene&&(!strcmp(s->scene,"ending")||!strcmp(s->scene,"credits"));}
EMSCRIPTEN_KEEPALIVE const uint8_t*dune_web_localized_scene_frame_rgb(void){
#ifdef DUNE_EM_WEB_FRAME_H
 if(em_web_campaign_localized_credits_active())return em_web_frame_textless(&em_cpu,6);
 return em_web_frame_present(&em_cpu);
#else
 return em_cpu.vdp.frame;
#endif
}
EMSCRIPTEN_KEEPALIVE const char*dune_web_localized_scene_overlay_json(void){
 static char json[4096];size_t n=0;
#ifdef DUNE_EM_WEB_FRAME_H
 EmWebLocalizedLine lines[29];unsigned count=em_web_campaign_localized_credits_active()?em_web_frame_credit_lines(&em_cpu,lines,29):0;
 n=(size_t)snprintf(json,sizeof json,"{\"ready\":%s,\"frame\":%llu,\"lines\":[",count?"true":"false",(unsigned long long)em_cpu.vdp.rendered_frames);
 for(unsigned i=0;i<count&&n+192<sizeof json;i++){EmWebLocalizedLine*r=&lines[i];if(i)json[n++]=',';n+=(size_t)snprintf(json+n,sizeof json-n,"{\"x\":%d,\"y\":%d,\"width\":%d,\"ink\":[%u,%u,%u],\"text\":",r->x,r->y,r->width,r->ink[0],r->ink[1],r->ink[2]);n=em_web_campaign_json_text(json,sizeof json,n,r->text);json[n++]='}';}json[n++]=']';json[n++]='}';json[n]=0;
#else
 (void)n;strcpy(json,"{\"ready\":false,\"lines\":[]}");
#endif
 return json;
}
EMSCRIPTEN_KEEPALIVE void dune_web_route_hold(unsigned generation,int enabled){if(enabled){em_web_route_hold_generation=generation;em_web_route_hold_enabled=1;}else if(em_web_route_hold_generation==generation)em_web_route_hold_enabled=0;}
EMSCRIPTEN_KEEPALIVE int dune_web_transition_covered(unsigned generation){return em_web_campaign_transition_ack(&em_cpu,generation);}
EMSCRIPTEN_KEEPALIVE const char*dune_web_campaign_json(void){return em_web_campaign_report(&em_cpu);}
EMSCRIPTEN_KEEPALIVE int dune_web_campaign_start(int house,int mission){int accepted=em_web_campaign_request(&em_cpu,house,mission);if(accepted)em_web_campaign_release_host();return accepted;}
EMSCRIPTEN_KEEPALIVE void dune_web_frontend_audio(int enabled){em_web_campaign_frontend_audio_request(&em_cpu,enabled);}
EMSCRIPTEN_KEEPALIVE void dune_web_frontend_hold(int enabled){if(em_web_campaign.cpu!=&em_cpu)em_web_campaign_after_load(&em_cpu);em_web_campaign.frontend_hold=!!enabled;}
EMSCRIPTEN_KEEPALIVE int dune_web_ui_sound(void){return em_web_campaign_sound_request(&em_cpu);}
EMSCRIPTEN_KEEPALIVE int dune_web_screen_route(int target){int accepted=em_web_campaign_route_request(&em_cpu,target);if(accepted)em_web_campaign_release_host();return accepted;}
EMSCRIPTEN_KEEPALIVE int dune_web_campaign_input(int action,int value){return em_web_campaign_input_request(&em_cpu,action,value);}
#endif
#endif
