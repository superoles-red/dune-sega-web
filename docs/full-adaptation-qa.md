# Native QA современной адаптации

Проверка 2 ноября 2026: **13 C-наборов заново скомпилированы и выполнены,
все завершились с кодом0**. Из них12 относятся к камере, представлению,
одиночному управлению и зданиям; один проверяет сохранённый legacy menu adapter.
Браузер и интерфейсные файлы в этой проверке не изменялись. Campaign header и
его отдельные тесты находятся за пределами этой серии.

Повторный building bridge прогон создал **60 новых native captures**. Их JSON,
исходные RGB и штатные browser-v2 saves проверены. **Все60 v2 saves побайтно
совпали с уже находящимися в `web/qa-fixtures/buildings/`**. Таким образом,
браузерная QA использует именно повторно проверенные состояния.

## Исходная версия и неизменность игровых инструкций

Источник — оригинальная USA Sega Genesis / Mega Drive версия:
`Dune - The Battle for Arrakis (USA).gen`, 1,048,576байт.

| Проверка | Результат |
| --- | --- |
| SHA-256 пользовательского ROM | `b1bbe73186e0902fa8b2db0f227bf306e3d6a80fe592f927d1aa9d60c0f335ba` |
| SHA-256 закреплённого `dune-base.c` | `e3055a76cd0eeb151591984a2c12312dcea49754afa0edee9f84889814ad1578` |
| ROM, извлечённый из `rom_data[]` | Полностью равен пользовательскому файлу; SHA-256 тот же |
| Полный suffix после `static const uint8_t rom_data[] = {` | 20,287,078байт; в `dune-base.c` и `dune-web.c` побайтно одинаков |
| SHA-256 этого suffix | `4e763ee0cacf0868846699f2b36cc7bcc1db9ef27facefdc61fb2d7e99c398c1` |

Проверен весь suffix до конца файла, включая ROM, данные и сгенерированные
обработчики оригинальных инструкций. Host-адаптеры находятся перед этим
участком либо в отдельных headers. Их SHA-256, команды компиляции, исходники
тестов, бинарники и журналы записаны в `.local/final-native-qa/report.json`.
После тестов все проверяемые noncampaign headers повторно сверены и не изменились.

Это подтверждает сохранность исходных игровых инструкций и данных. Корректность
новых host-адаптеров подтверждается перечисленными ниже сценариями; равенство
suffix само по себе не заменяет проверку новых способов ввода и отображения.

## Повторные C-проверки

Все перечисленные бинарники собраны в `.local/final-native-qa/` из текущих
исходников с `clang -std=c11 -O1 -Wformat`. Для presentation/animation нужен
`-Itools`. Тесты с оригинальным состоянием используют закреплённый native
Atreides mission01 snapshot; building bridge использует оригинальные campaign
snapshots всех трёх домов. Файлы логов имеют имя `<suite>.run.log`.

SHA-256 используемого исходного Atreides snapshot:
`ee43b4985900c02d487b0367fd39ea8ec8db6c58aad2f25d93bddc5b8e922b23`.

| Suite / исходник `tools/test_em_web_*.c` | Выполненные проверки |
| --- | --- |
| `camera` | DPI1/2/3, границы камеры, pan за пальцем, дробные перемещения, zoom с сохранением anchor |
| `clock` | Четыре host refresh режима30/60/120/240Hz по60секунд синтетического времени; pause/resume, suspension, discontinuities |
| `minimap` | Родные mission origins, масштаб16/32, привязка view rectangle к камере, clipped drag, невидимая мини-карта |
| `portrait` | Геометрия прежнего three-crop представления, оба menu contexts, DPR1/2/3, дробный/неравномерный density и guards; не является browser-проверкой нового DOM layout |
| `selection` | 11 сценариев: приоритет одиночного A, настоящий B repeat и оплаченная стройка, OK, invalid/successful placement, single commit, отмена у источника/до выбора/во время выбора, возврат из modal |
| `actions_special` | 4 сценария: clear сохраняет Devastator countdown, native Die10 через B, приоритет обычного юнита над оставшимся Yard, настоящее MCV→Construction Yard развёртывание |
| `selection_combat` | 2 сценария: оригинальный снаряд уменьшил enemy HP20→18; оригинальный Harvester увеличил cargo0→1 после одиночного A |
| `ready` | 5 проверок original OK на копии CPU, отсутствие дубликата, подавление во время drag, сохранность paid/BF60 состояния и родная фаза мигания |
| `present` | 12 проверок: настоящая red focus рамка, read-only CPU, preview/second purchase, Starport, original selection sound25 без дубля, sound-off, hidden map cursor при сохранённом selected marker и drag footprint |
| `menu_select` | 14 сценариев first-tap preview / second-tap purchase, смены товара, reentry, immediate EXIT/FIX/STOP, реального ремонта/оплаты, Upgrade и Starport с native stock guard и настоящей доставкой Unit_Create |
| `menu_animation` | 4 независимые последовательности по320 оригинальных кадров: Yard/Starport с обычного checkpoint и середины scanline100; **0 adapted mismatch на1280кадрах** |
| `building_ui` | **60 native captures**, все15 enterable producer types ×3дома; whole-CPU/mouse/preview-adapter read-only проверки; guarded intents; реальные Windtrap/STOP, Upgrade, FIX, Starport пути каждого дома |
| `menus` | 5 дополнительных legacy-сценариев Options/password/restart-NO/возврата; modern campaign UI этим тестом не подтверждается |

В clock-тесте все четыре refresh режима выполнили3,221,590,512 master clocks
и3595 native NTSC кадров за60секунд синтетического host-времени. Это проверка
математики pacing; она не является измерением FPS или аудио на телефоне.

Native focus проверен как208 оригинальных border pixels в32×24 клетке.
Например, Windtrap preview использует ровно x64..95,y72..95. Поэтому live crop
клетки сохраняет всю настоящую рамку, а её цвет/мигание не создаются новым UI.

Temporal тест также сохраняет диагностические mismatch старого shadow renderer
(например,187/320кадров Starport). Эти значения относятся к прежнему способу
перерисовки, не принимаются за результат современной оболочки и объясняют
использование живого completed-native RGB. Проверяемый live/adapted путь имеет
нулевое расхождение во всех четырёх последовательностях; четыре native color
phases представлены по80кадров в каждой.

## Здания и границы fixture-подготовки

У каждого дома открыты настоящие меню типов
`2,3,4,5,7,8,9,10,11,12,13,15,16,17,18`. Concrete0/1, IX6 и Wall14 не имеют
обычного enterable menu; искусственные меню для них не создавались.

Каждый дом проходит first/second-tap Windtrap с реальной оплатой и immediate
STOP. Upgrade действительно повышает level0→1 и списывает150credits.
FIX увеличивает Windtrap HP300→342 и уменьшает реальный банк1199→1181.
Starport списывает именно текущую native цену, уменьшает stock2→1 и создаёт
купленный MCV оригинальной Unit_Create. Текущий ordered byte может вернуться
в0 после штатной доставки; тест наблюдает его увеличение в исходной purchase
ветке, не требует постоянной выдуманной корзины.

Недостающие producers добавляются **только в offline fixtures** оригинальной
Building_Create в scenario-init режиме. Upgrade fixture добавляет настоящий
Outpost prerequisite; FIX fixture повреждён до входа в родное меню. Тесты не
подменяют menu grid, техдоступность, стоимость, stock, урон, cargo, оплату,
production ticks либо результат placement.

JSON getter проверен побайтным сравнением всей структуры CPU, mouse queue и
purchase adapter до/после чтения. Отклонённые stale context/producer и
out-of-grid intents не изменяют эти структуры. Все непустые native клетки,
включая disabled команды и sold-out товары, продолжают идти через оригинальные
guards; frontend metadata не подменяет решение исходной игры.

Экспорт60states использует существующий нормальный v2 save serializer. Raw CPU
loader в runtime не добавлен. Штатный v2 сохраняет оригинальную машину, но не
transient host preview arming; после загрузки preview fixture браузер честно
начинает новый first-tap цикл. Это ограничение записано в fixture manifest.

## Что эта серия не подтверждает

- Новые DOM/CSS экраны, pointer-events и responsive-поведение проверяются
  отдельной browser QA, которой занимается основной агент.
- Физические iPhone/Android, Safari/Chrome на телефоне, multitouch и safe-area
  поведение реального устройства в этой серии не проверялись.
- Большие поздние армии, длительная нагрузка, звук при перегрузке и аппаратные
  sprite-limit артефакты не проходили отдельный стресс-тест.
- 27 оригинальных campaign starts и campaign input/text/reentry имеют отдельную
  серию проверок. Здесь они не пересобирались и не объявляются заново пройденными.
- Outcome scene fixtures — настоящие оригинальные ветки после controlled
  offline win/lose conditions; они не доказывают заработанную игроком победу
  или полное прохождение кампании. Их QA manifest явно сохраняет эту подпись.

Весь запуск локальный. Оригинальный ROM, игровые инструкции, UI-файлы и
campaign header при этой проверке не изменялись.

## Дополнительные before-outcome fixtures

Отдельный campaign-агент подготовил `house1-mission01-pre-victory` и
`house1-mission01-pre-defeat` через `tools/capture_campaign_before_outcome.c`.
В обоих снимках настоящий scheduler естественно достиг PC `$22AB2` до исполнения
scenarioFinished/victoryCondition: mapContext1, fault0, outcome none,
outcomeSeq0, activeRunArmed1. Исходное исполнение после каждого сохранения
прошло ровно одну соответствующую проверенную ветку победы/поражения;
журнал — `.local/campaign-analysis/test-pre-outcome.log`.

Оба снимка экспортированы без изменения native bytes в обычные v2 saves
по140,056байт через `tools/build_qa_scene_fixtures.py`. Scene QA manifest теперь
содержит27 fixtures: 3 original-flow, 22 controlled outcome screens и2 controlled
before-outcome states. Происхождение, SHA-256, ожидаемый исход и отсутствие уже
пройденной native edge записаны отдельно у каждого. Это controlled условия для
проверки progress-пути в изолированном `?qa` sessionStorage; заработанная игроком
победа и успешный browser-прогон этим дополнением не заявляются.
