# Шаурма-лавка

Idle-кликер про ларёк с шаурмой для Яндекс Игр. Тапай по ларьку, нанимай помощников, переезжай в кафе.

## Запуск

Нужен Node.js 20 или новее.

```bash
npm install
npm run dev      # откроет игру на http://localhost:5173
npm test         # тесты экономики
npm run build    # сборка в dist/
npm run zip      # архив shawarma-idle.zip для консоли Яндекс Игр
```

## Где что лежит

- `src/core/` — логика игры и тесты
- `src/scenes/` — сцена Phaser с ларьком
- `src/ui.ts`, `index.html`, `src/style.css` — интерфейс
- `src/game.ts` — контроллер игры
- `src/i18n.ts` — тексты на русском и английском
- `src/platform/` — сохранения, реклама и покупки (браузер и Яндекс Игры)
- `promo/` — иконка, обложка и скриншоты
- `docs/yandex-publish.md` — как выложить игру
- `docs/design.md` — дизайн игры
- `docs/roadmap.md` — план по неделям
- `CLAUDE.md` — правила для ИИ-помощника
