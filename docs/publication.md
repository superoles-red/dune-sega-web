# Публикация Dune Sega Web

Подготовка не выполняет публикацию. Публичный репозиторий и Pages создаются после финальной проверки принятой версии.

Проверено 3 ноября 2026: GitHub connector и `gh` авторизованы как `superoles-red`; у CLI есть `repo` и `workflow`, у аккаунта есть admin/push к существующим игровым репозиториям. `superoles-red/dune-sega-web` пока отсутствует. Предлагаемый адрес: `https://superoles-red.github.io/dune-sega-web/`.

## Отдельный исходный репозиторий

Этот проект находится внутри большого рабочего Git-каталога. Нельзя выполнять `git add .` или создавать `.git` в `Реверс инженерия`. Экспорт создаётся вне него:

```sh
python3 tools/export_publication_repository.py '/Users/oleskarpov/Documents/My Gamedev/Dune Sega Web'
```

Команда повторяемая: обновляет только перечисленные в `.publication-export.json` файлы, сохраняет собственный `.git`, отказывается перезаписывать чужой каталог. Git и сеть не вызывает. Перед релизом экспорт повторяется после завершения текущих изменений. В исходном экспорте остаются инструменты, тесты и небольшие материалы исследований; в публикуемый сайт они не попадают.

Предсобранные `web/engine/dune_web.js` и `.wasm` включены в экспорт и проверяются по `docs/wasm-build.json`. Развёртывание не требует Emscripten. Пересборка самого ядра требует отдельного закреплённого исходника ReArrakis и ROM, описанных в README; приватный `.local/source` не копируется и не подменяется обещанием полной сборки из клона.

## Проверка и пакет сайта

```sh
node --test tests/*.test.mjs
node tools/test_modern_tutorial.mjs
python3 tools/test_publication.py
python3 tools/build_publication.py --output _site
python3 tools/verify_publication.py _site
```

В сайт включены действующий интерфейс, PNG-графика/шрифты, оригинальные 33 описания обучения, EN/RU, чистый frontend snapshot, актуальная демонстрация Харконненов с 5000 кредитов, loader/WASM и лицензии. Исключены QA-панели/сохранения, исследовательские страницы, старые демонстрации, отключённое практическое обучение, сырые CPU-дампы, отдельные ROM, `.local`, ZIP и служебные файлы. Небольшой `base-prototype/layout.mjs` оставлен: он используется настоящим интерфейсом зданий.

`release.json` содержит SHA-256 и длину каждого файла, общий идентификатор пакета и SHA ядра. Повторная сборка одинаковых входов даёт одинаковые байты. В пакет не добавляются пароли/ключи GitHub. Встроенные в WASM игровые данные сохраняются намеренно; MIT движка не распространяется на оригинальную игру, графику и звук. Полные уведомления ReArrakis, YMFM, SDL и Emscripten приложены.

Обычный статический HTTP-сервер проверяется с префиксом `/dune-sega-web/`, без специальных COOP/COEP. Текущее ядро не использует `SharedArrayBuffer`/pthreads. AudioWorklet загружается отдельным относительным JS-файлом; HTTPS и корректный JavaScript MIME необходимы. Пакет также проверяет `application/wasm`. Сборщик останавливается при появлении threaded WASM, для которого потребуется отдельное решение по заголовкам.

## Первый релиз после финального сигнала

В отдельном экспорте (не в общем рабочем каталоге):

```sh
git init -b main
git add .
git commit -m 'Prepare Dune Sega web adaptation'
gh repo create superoles-red/dune-sega-web --public --source=. --remote=origin --push
gh api --method POST repos/superoles-red/dune-sega-web/pages -f build_type=workflow
gh workflow run pages.yml --ref main
gh run list --workflow pages.yml --limit 3
```

Если репозиторий/Pages уже существуют, повторно их не создавать: проверить origin и `gh api repos/superoles-red/dune-sega-web/pages`, затем обычный commit/push и ручной запуск workflow. Работающий origin не менять. В workflow push/PR только проверяют кандидат; deploy разрешён исключительно ручным `workflow_dispatch` из `main`. Все Actions закреплены по SHA.

После успешного deploy:

```sh
gh api repos/superoles-red/dune-sega-web/pages
python3 tools/verify_publication.py https://superoles-red.github.io/dune-sega-web/
```

Затем открыть реальный публичный адрес, проверить загрузку, оригинальную музыку после пользовательского нажатия, начало кампании, панораму/зум, магазин, возврат и Continue. Хеши/CI/HTTP не доказывают работу Safari на физическом iPhone: эта проверка проводится отдельно. Пока отдельного подтверждения телефона нет.

GitHub Pages поддерживает статические сайты, HTTPS и публикацию артефактов Actions. Текущий пакет существенно меньше лимита сайта 1 ГБ; действует мягкий лимит трафика 100 ГБ/месяц. Источники: [custom workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [лимиты](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https). После обновлений нужно снова сверять публичный `release.json` и файлы, а не считать зелёный workflow достаточной проверкой клиентского кэша.
