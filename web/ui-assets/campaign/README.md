# Original USA campaign bridge

`manifest.json` is decoded from the pinned USA ROM by `tools/extract_campaign_manifest.py`.
It contains three playable house IDs (0 Harkonnen,1 Atreides,2 Ordos), nine missions
per house, all27 original scenarios,24 ordinary passwords (missions2–9), fixed
native territory IDs and literal English briefing/victory/defeat/hint text.
Mission1 has no password; its presentation name is an explicit UI ordinal.
Native mission PROCEED/ADVICE shows the mission or original hints; it does not
choose a DOS-style scenario branch. Excluded cheat passwords are recorded separately, never levels.

## Integration

Include `tools/em_web_campaign.h` after CPU/native VDP/mouse definitions.
Before each `machine_step`, call `em_web_campaign_observe(&em_cpu)`; when it returns1,
skip other input adapters for that instruction, then still execute `machine_step`.
After a successful original state load call `em_web_campaign_after_load(&em_cpu)`.
This cancels pending UI requests, clears incomplete result checks and arms only
an actual restored map context (a building save rearms after its native map resumes). The bridge does not write a save slot.
The host must release held UI/pad/mouse intents when starting a new run and allow
native CPU execution; a host-level paused RAF cannot process any queued intent.

Exports:

- `dune_web_campaign_json()` returns read-only scene/native-poll, campaign, current
  message and original options values. Native rows expose coordinates for reference.
- `dune_web_campaign_start(house,mission)` returns1 for a queued valid request.
  Invalid houses/missions return0 and do not modify the CPU. It uses the original
  NewHouse menu state at `$1253E`, original picker, original password validator
  `$21902` with a literal ROM password for missions2–9, then the original
  `$264F8 -> $26540 -> $1609C` briefing/scenario/map/research/spawn flow.
  Mission1 follows the original new-house initialization. Existing old UI screens
  finish through native neutral/confirm polls. Automation stops at request stage4;
  the **new** requested briefing requires the user's ordinary native Continue.
- `dune_web_campaign_input(action,value)` queues original menu intent. Action0:
  raw pad mask;1: options row click;2: options value Right;3: main-menu row0..2;
  4: native house ID0..2;5: native first0/second1 choice. Options row5/password input is omitted.
  Rows6/7 are available only in native in-game options. Choice navigation uses
  original directions and animation checks, then one native confirmation and one
  neutral release. A raw Continue is consumed by exactly one native poll, even
  when the next screen immediately asks for another key. In battle only raw
  Start128 is accepted; campaign input cannot issue hidden controller orders.

Vertical Mentat confirmation and horizontal options confirmation are different:
`confirmStyle` identifies them. Horizontal Yes/No uses original DBF0 coordinates
112/180 and waits for DBFA. Native prompt text is `ARE YOU SURE?` at ROM `$21A32`.
A new campaign request chooses native No when leaving an old horizontal popup.

## Outcome and progress contract

Only original `$22AF0` victory-check invocation followed by `$22AF4` returning1
and the real `$22AFC` branch produces a victory edge. Original `$22BDE` produces
defeat. Both require a previously armed actual map with the same house/mission.
`outcomeSeq` is local to the current runtime instance, not a persistent global
cutoff across page reloads. It increments once per genuine checked outcome and `outcomeHouse` /
`outcomeMission` retain its identity before native `$22B94` increments the mission.
Loading, scene changes, arbitrary PC values and starting a mission do not unlock.
Ninth victory reports `campaignComplete`; original ending/credits still execute.
`starts` also counts native automatic next-mission initialization, and
`activeRunArmed/House/Mission` identify the current actual run independently of the
last outcome. Browser storage owns per-house unlocks and replay eligibility.

## Native text timing

`messageText` is the complete literal source speech; displaying it immediately
would reveal future native paragraphs. Original `$1FBBA` splits a speech into
sentences/paragraphs with CR word-wrap. `$25B02` clears the previous text and draws
one current native RAM paragraph. `visibleMessageText` uses that exact RAM string,
published only when its native glyph raster matches the **completed** VDP frame.
No guessed browser typewriter timer is used. CR bytes are original native layout
wraps; a responsive presentation may treat those wraps as whitespace.
`messageComplete` is the original all-paragraphs-shown flag, gated by that completed
frame. The historical `messageLinesTotal/LineProgress` fields are native state
counters, not a character-prefix length. `messagePhase` is the original state.
The fallback native text area starts at screen16,16; some long native paragraphs
wrap to five8px rows, so retain at least288×40 source pixels (or the full native
frame) when using live original glyphs.

## Verification boundary

Native regressions create all27 original scenario starts and inspect house,
mission, territory, initial credits/quota and real active map/object state.
This is start coverage, not a full earned campaign playthrough. Outcome/art
fixtures deliberately satisfy original conditions offline (quota, or original
Building_Free on the losing side); no such fixture operation ships in the bridge.
All original ROM and translated instruction bytes remain unchanged.

Local evidence: `.local/campaign-analysis/`, `.local/campaign-fixtures/` and
`.local/campaign-scenes/`. Raw CPU snapshots retain original device state and
are intentionally local.

Explicit campaign navigation can leave the first staff-credit scroll early. Only
a pending new-run request opens the original UI-only D4 byte gate at `$11844`;
the original input poll and cleanup then run. Idle credits retain their native
first-scroll wait. The separate three-house regression proves the bounded gate,
original exit, manual new briefing, and absence of false victory events.

Modern screen routing and native-frame readiness are documented in
`docs/native-screen-routing.md`. Exports `dune_web_screen_route(target)` and
`dune_web_ui_sound()` do not modify ROM instructions or scenario/combat data.
