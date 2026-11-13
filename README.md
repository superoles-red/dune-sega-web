# Dune — The Battle for Arrakis

[Играть / Play](https://superoles-red.github.io/dune-sega-web/) ·
[Отзывы / Feedback](https://github.com/superoles-red/dune-sega-web/discussions/1) ·
[Скачать исходники / Source ZIP](https://github.com/superoles-red/dune-sega-web/archive/refs/heads/main.zip)

Неофициальный веб-порт Dune для Sega Genesis (USA), адаптированный прежде всего для телефонов. Проект собран из существующих наработок, чтобы в оригинальную Dune можно было играть касаниями на iPhone и Android. В браузере выполняется рекомпилированная программа Sega. Она управляет кампаниями, картами, экономикой, боем и поведением противников. Веб-интерфейс добавляет сенсорное управление, масштабирование карты и меню для разных размеров экрана.

An unofficial, touch-friendly web adaptation of the USA Sega Genesis release, designed for phones and playable on desktop. The port brings together existing work to make the original game comfortable to play on iPhone and Android. The recompiled Sega game runs in the browser and handles the original campaigns, maps, economy, combat and AI.

## Как играть / How to play

Откройте игру по ссылке в браузере. Доступны английский и русский языки. В **Настройках** кнопка **Как играть?** открывает памятку и справочник, а кнопка **Отзыв** ведёт в обсуждение порта.

На телефоне одно касание выбирает объект, двойное касание отдаёт приказ выбранному юниту. Тяните карту пальцем для перемещения и сведите или разведите два пальца для изменения масштаба. На компьютере левый клик выбирает, правый отдаёт приказ. Карту можно тянуть мышью и масштабировать колёсиком.

На iPhone игру можно добавить на экран «Домой» из Safari. На совместимых Android-браузерах доступна установка через **Install Game**. Офлайн-копия и экспорт или импорт сохранений доступны в **Files & Offline**. [Установка, офлайн и сохранения](docs/pwa-and-saves.md)

## Исходники и благодарности / Source and credits

В основе веб-порта — [dune2-sega-web](https://github.com/andvolodko/dune2-sega-web) и [ReArrakis](https://github.com/kruzeman/ReArrakis). Русский шрифт и часть интерфейсной графики взяты из перевода Shedevr. В проекте сохранены сведения об исходной игре и авторах использованных наработок. [Полный список благодарностей](web/CREDITS.txt)

- [Локальный запуск и участие в разработке](CONTRIBUTING.md)
- [Технические заметки, сборка и проверки](docs/implementation-notes.md)
- [Происхождение и сборка ядра](vendor/rearrakis/README.md)

[Лицензия MIT](LICENSE) распространяется на код и документацию адаптации. Оригинальная игра, её графика и звук принадлежат своим правообладателям. У сторонних компонентов действуют их собственные лицензии. [Сторонние лицензии и уведомления](THIRD_PARTY_NOTICES.md)
