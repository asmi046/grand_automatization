# Grand Pravo

Внутренний инструмент для автоматической синхронизации арбитражных дел из личного кабинета [`dela.pravo.tech`](https://dela.pravo.tech) в локальную БД MySQL + веб-интерфейс для просмотра и управления.

## Что умеет

- **Синхронизация дел и заседаний** из личного кабинета через cookie-based авторизацию (Form-Auth → JWT).
- **Автоматическая простановка галочки «Я иду»** на новых заседаниях через `POST /ms/UserData/CaseSessions/IWillGo` — с логированием факта авто-простановки.
- **Ведение журнала прогонов** (Check) с историей успехов/ошибок и drill-down до созданных заседаний/событий.
- **Журнал событий** (`scan.session.start`, `case.added`, `session.added`, `session.iwillgo.auto_set`) с возможностью расширения.
- **Web-интерфейс** (Vue 3 + Element Plus) для просмотра дел, заседаний, событий, запуска прогонов в реальном времени с потоковым выводом лога.
- **Защита UI** логином/паролем из `.env` (Express-session, httpOnly cookie).

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                     Express (server.js)                         │
│  ┌─────────────────────┐   ┌─────────────────────────────────┐  │
│  │ /api/auth/*         │   │ /api/*  (requireAuth)           │  │
│  │  POST /login        │   │   /cases       /sessions        │  │
│  │  POST /logout       │   │   /events      /checks          │  │
│  │  GET  /status       │   │   /sync/run   /sync/stream SSE │  │
│  └─────────────────────┘   └─────────────────────────────────┘  │
│             ▲                          ▲                         │
│             │                          │                         │
│  ┌──────────┴──────────────────────────┴────────────────────┐  │
│  │  Sequelize (MySQL) — Case, Session, Event, Check        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
            ▲                                  ▲
            │                                  │
   ┌────────┴──────┐                  ┌────────┴────────┐
   │  Vue 3 SPA    │                  │  src/index.js   │
   │  (web/dist)   │                  │  (sync script)  │
   └───────────────┘                  └─────────┬───────┘
                                                 │
                                                 ▼
                                     ┌──────────────────────┐
                                     │  dela.pravo.tech     │
                                     │  (cookie jar client) │
                                     └──────────────────────┘
```

**Поток прогона (`src/index.js`):**

```
initSchema()
  └─ Check.create({ checkId: uuid(), status: 'running' })
       └─ login → JSONLogOn (.ASPXAUTH, MLR_Session)
            └─ Profile → (.AuthToken JWT)
                 └─ Folder/ListGroups
                      └─ для каждого отслеживаемого Cases-фолдера:
                           └─ Folder/Cases (пагинация)
                                ├─ Case.upsert()       → если новый: event CASE_ADDED
                                └─ Session.upsert()    → если новый: event SESSION_ADDED
                     └─ для каждого Session с iWillGo=false:
                          └─ CaseSessions/IWillGo → iWillGo=true, isAutoChecked=true
                               └─ event SESSION_IWILLGO_AUTO_SET
       └─ Check.update({ status: 'completed', result: stats })
```

---

## Структура проекта

```
grand_automatization/
├── server.js                  # Express entry point: API + SPA + sync orchestrator
├── package.json               # корневые deps и npm scripts
├── .env / .env.example        # секреты и конфигурация
├── config/
│   └── default.json           # не-секретная конфигурация (пути API, таймауты, пул БД)
├── src/
│   ├── config.js              # грузит .env + JSON, валидирует обязательные переменные
│   ├── db.js                  # Sequelize: Case, Session, Event, Check + helpers
│   ├── pravoClient.js         # axios + cookie-jar клиент к dela.pravo.tech
│   ├── index.js               # sync-скрипт (npm run sync)
│   └── api/
│       ├── routes/
│       │   ├── auth.js        # /api/auth/{login,logout,status}
│       │   ├── cases.js       # /api/cases
│       │   ├── sessions.js    # /api/sessions + /api/sessions/upcoming
│       │   ├── events.js      # /api/events
│       │   ├── checks.js      # /api/checks + /:id/sessions + /:id/events
│       │   └── sync.js        # /api/sync/{run,status,stream SSE}
└── web/                       # Vue 3 SPA (Vite + Element Plus)
    ├── package.json
    ├── vite.config.js         # dev-proxy /api → :3000
    └── src/
        ├── main.js            # Vue + Router + ElementPlus (ru locale) + icons
        ├── App.vue            # layout: sidebar + header + router-view (или чистый /login)
        ├── auth.js            # reactive auth state + checkAuth/logout/setAuthenticated
        ├── api.js             # axios + 401-интерсептор (редирект на /login)
        └── views/
            ├── LoginView.vue       # форма входа
            ├── SyncView.vue        # запуск прогона + live-лог (SSE)
            ├── ChecksView.vue      # история прогонов + drill-down
            ├── SessionsView.vue    # ближайшие заседания
            ├── CasesView.vue       # отслеживаемые дела
            └── EventsView.vue      # журнал событий
```

---

## Требования

- **Node.js ≥ 18** (используется `crypto.randomUUID`)
- **MySQL ≥ 8** (локально или в Docker)
- Аккаунт на [dela.pravo.tech](https://dela.pravo.tech) с активной лицензией

---

## Установка

```bash
# 1. Клонировать и установить backend deps
git clone <repo>
cd grand_automatization
npm install

# 2. Установить frontend deps
npm --prefix web install

# 3. Скопировать и заполнить .env
cp .env.example .env
# отредактировать .env — см. раздел "Конфигурация"

# 4. Создать БД (один раз)
docker run -d --name mysql-pravo \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=grand_pravo \
  -p 3306:3306 \
  mysql:8

# 5. Собрать SPA
npm run build:web
```

При первом запуске Sequelize в режиме `syncAlter: true` создаст таблицы и при последующих обновлениях будет аккуратно добавлять колонки.

---

## Конфигурация

Все секреты хранятся в `.env`. Не-секретная конфигурация — в `config/default.json`.

### `.env`

```env
# ─── dela.pravo.tech ───────────────────────────────────
PRAVO_BASE_URL=https://dela.pravo.tech
PRAVO_LOGIN=your_email@example.com
PRAVO_PASSWORD=your_password

# ─── MySQL ─────────────────────────────────────────────
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=grand_pravo

# ─── Web-интерфейс ─────────────────────────────────────
WEB_USERNAME=admin
WEB_PASSWORD=change-me
SESSION_SECRET=replace-with-long-random-string

# ─── Опции ─────────────────────────────────────────────
# DB_CLEAR_BEFORE_SYNC=true очищает все таблицы перед прогоном
DB_CLEAR_BEFORE_SYNC=false
```

`SESSION_SECRET` должен быть длинной случайной строкой (используется для подписи cookie сессии). Сгенерировать: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

### `config/default.json`

```json
{
  "pravo": {
    "loginPath":          "/ms/Account/v3/JSONLogOn",
    "profilePath":        "/api/Account/Profile",
    "listGroupsPath":     "/ms/UserData/Folder/ListGroups",
    "folderCasesPath":    "/ms/UserData/Folder/Cases",
    "iWillGoPath":        "/ms/UserData/CaseSessions/IWillGo",
    "requestTimeoutMs":   30000,
    "debug":              true,
    "defaultHeaders":     { "X-Requested-With": "XMLHttpRequest" }
  },
  "db": {
    "dialect":   "mysql",
    "syncAlter": true,
    "pool":      { "max": 5, "min": 0, "acquire": 30000, "idle": 10000 }
  },
  "web": {
    "session": {
      "cookieName": "grand_pravo.sid",
      "maxAgeMs":   86400000
    }
  }
}
```

---

## Команды

| Команда | Что делает |
|---|---|
| `npm start` | Запуск прод-режима: Express на `:3000`, раздаёт API и собранный SPA |
| `npm run dev` | Dev-режим: Vite на `:5173` + Express на `:3000` через `concurrently` (HMR для фронта) |
| `npm run dev:api` | Только Express с `nodemon` (auto-reload при изменениях в `src/`, `server.js`, `config/`) |
| `npm run dev:web` | Только Vite dev-сервер |
| `npm run build:web` | Сборка SPA в `web/dist/` |
| `npm run sync` | Однократный запуск скрипта синхронизации (`src/index.js`) |

---

## Использование

### 1. Открыть web-интерфейс

```
http://localhost:3000
```

Откроется форма логина — ввести `WEB_USERNAME` / `WEB_PASSWORD` из `.env`. После входа:

- **Запуск** — кнопка «Запустить» запускает sync-скрипт в фоне, в реальном времени стримит лог.
- **Заседания** — список ближайших заседаний с возможностью фильтрации (только будущие / диапазон дат / суд / судья).
- **Дела** — список отслеживаемых дел с фильтрами по номеру / статусу / суду / судье / группе / мониторингу.
- **События** — журнал событий с фильтрами по типу / делу / заседанию.
- **Прогоны** — история всех прогонов. Клик по строке → drawer с подробностями: статистика, ошибка (если была), список созданных заседаний и событий этого прогона.

### 2. Запуск из консоли

```bash
# обычный прогон (накопительно — добавляются только новые, существующие обновляются)
npm run sync

# с очисткой БД перед прогоном
DB_CLEAR_BEFORE_SYNC=true npm run sync
```

После прогона в БД создаётся запись в `checks` со статистикой:
```json
{
  "cases":    { "new": 5, "updated": 200 },
  "sessions": { "new": 3, "updated": 30 },
  "iWillGo":  { "ok": 2, "fail": 0 }
}
```

### 3. API напрямую

Все защищены `requireAuth` (нужна сессионная cookie, полученная через `/api/auth/login`).

| Метод | URL | Описание |
|---|---|---|
| `GET`  | `/api/health` | healthcheck (без auth) |
| `POST` | `/api/auth/login` | логин (`{ username, password }`) |
| `POST` | `/api/auth/logout` | логаут |
| `GET`  | `/api/auth/status` | текущая сессия |
| `GET`  | `/api/cases` | список дел (фильтры: `caseNumber`, `caseId`, `courtName`, `judgeName`, `status`, `groupName`, `isMonitored`) |
| `GET`  | `/api/sessions` | заседания (фильтры: `caseId`, `sessionId`, `court`, `judge`, `dateFrom`, `dateTo`) |
| `GET`  | `/api/sessions/upcoming` | только будущие |
| `GET`  | `/api/events` | журнал событий (фильтры: `eventType`, `caseId`, `caseNumber`, `sessionId`, `dateFrom`, `dateTo`) |
| `GET`  | `/api/checks` | история прогонов (фильтр: `status`) |
| `GET`  | `/api/checks/:checkId` | детали прогона |
| `GET`  | `/api/checks/:checkId/sessions` | заседания, **созданные в этом прогоне** |
| `GET`  | `/api/checks/:checkId/events` | события этого прогона |
| `POST` | `/api/sync/run` | запустить прогон (`{ clearDb?: true }`), 409 если уже идёт |
| `GET`  | `/api/sync/status` | статус текущего прогона |
| `GET`  | `/api/sync/stream` | SSE-поток логов текущего прогона |

Все list-endpoint'ы поддерживают `?page=N&size=M` (size ≤ 100) и возвращают:
```json
{ "items": [...], "total": 123, "page": 1, "size": 30, "pages": 5 }
```

---

## Схема БД

```
checks
──────
id              INT PK
checkId         VARCHAR(36) UNIQUE          ← uuid() при старте прогона
startedAt       DATETIME NOT NULL
endedAt         DATETIME NULL
status          ENUM('running','completed','failed')
result          JSON                         ← {cases:{new,updated}, sessions:{new,updated}, iWillGo:{ok,fail}}
error           TEXT NULL
createdAt, updatedAt

cases
─────
id                  INT PK
caseId              VARCHAR(36) UNIQUE      ← UUID дела из API
caseNumber          VARCHAR(64)
courtName, judgeName, status, caseTypeName, caseTypeCode
isMonitored         BOOLEAN
comment             TEXT                    ← стороны + категория
claimSum            DECIMAL(15,2)
versionDateUtc      DATETIME
groupName, folderId
createdAt, updatedAt

sessions
────────
id                  INT PK
sessionId           VARCHAR(36) UNIQUE      ← UUID из nextEvent.sessionId
caseId              VARCHAR(36) FK → cases
checkId             VARCHAR(36) FK → checks ← в каком прогоне создано
date                DATETIME NOT NULL
court, judge, judgeId, instanceLevel, instanceNumber
description, documentId
iWillGo             BOOLEAN                  ← фактическое состояние «я иду»
isAutoChecked       BOOLEAN DEFAULT false    ← мы автоматически поставили
autoCheckedTime     DATETIME NULL            ← когда автоматически поставили
rawEvent            JSON                     ← полный nextEvent из API
createdAt, updatedAt

events
──────
id           INT PK
eventType    VARCHAR(64)                   ← scan.session.start | case.added | session.added | session.iwillgo.auto_set
caseId       VARCHAR(36)
caseNumber   VARCHAR(64)
sessionId    VARCHAR(36)
checkId      VARCHAR(36) FK → checks
payload      JSON
createdAt
```

---

## Расширение

### Добавить новый тип события

1. `src/db.js` → `EVENT_TYPES.NEW_TYPE = 'new.type'`.
2. В нужном месте pipeline:
   ```js
   await logEvent({
     eventType: EVENT_TYPES.NEW_TYPE,
     caseId, caseNumber, sessionId,
     checkId: check.checkId,
     payload: { /* что угодно */ },
   });
   ```
3. В UI добавить опцию в `<el-select>` фильтра типов в `EventsView.vue` (если нужно).

### Добавить новый endpoint

1. `src/api/routes/<name>.js` — экспресс-роутер.
2. `server.js` → `app.use('/api/<name>', requireAuth, require('./src/api/routes/<name>'))`.
3. Опционально новая страница в `web/src/views/` + роут в `main.js`.

---

## Безопасность / прод-замечания

Перед выкаткой на VDS обязательно:

1. **Сменить** `WEB_PASSWORD`, `SESSION_SECRET`, `PRAVO_PASSWORD` в `.env`.
2. **`SESSION_SECRET`** — длинная случайная строка: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
3. **HTTPS** — в `server.js` установить `cookie.secure = true` (сейчас `false` для локального HTTP).
4. **MySQL** — завести отдельного пользователя с правами только на БД `grand_pravo`, не root.
5. **`dotenv` в проде** — не хранить `.env` в публичных местах; использовать секреты Docker / k8s / systemd.
6. **Session store** — `express-session` по умолчанию хранит сессии в памяти (теряются при рестарте, не масштабируется). Для горизонтального масштабирования переключиться на `connect-redis` или `connect-session-sequelize`.
7. **Rate limit** — публичные endpoint'ы (`/api/auth/login`) желательно закрыть `express-rate-limit`, чтобы не брутфорсили пароль.

---

## Troubleshooting

| Симптом | Причина | Решение |
|---|---|---|
| `SequelizeConnectionRefusedError` | MySQL не запущен | `docker start <mysql-контейнер>` |
| `401` при логине через UI | Опечатка в `.env` или не рестартнул `npm start` | Проверь `WEB_USERNAME`/`WEB_PASSWORD`, `Ctrl+C` + `npm start` |
| `404` на `/api/auth/login` | Запущена старая версия `server.js` без auth-роута | Перезапустить `npm start` после обновления |
| «Ошибка соединения» в UI | Бэкенд не запущен или SPA открыта с другого origin | `npm start`, открывать `http://localhost:3000` |
| Не приходят куки | `cookie.secure = true` без HTTPS, или разные origin | В dev — `secure: false`; в прод — настроить HTTPS |
| Логин в dela.pravo.tech возвращает 400 «Пользователь не найден» | Excel-артефакт `=` в `.env` (`PRAVO_LOGIN==...`) | Убрать лишний `=`, `config.js` теперь нормализует, но лучше починить |
| `npm run sync` падает на IWillGo | Изменился endpoint или требуется другой формат payload | Проверить через DevTools в браузере, обновить `iWillGoPath` в `config/default.json` |

---

## Лицензия

ISC
