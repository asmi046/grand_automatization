В теущем проекте подключи библиотеки для работы с .env, конфигурационными файлами.

Используя знания из скила casebook-api, реализуй получение api ключа. Данные о логине и пароле необходимые для этого хранятся в .env.

После получения ключа реализуй запрос на Получение списка отслеживаемых арбитражных дел.

---

Давай использовать Sequelize. Моя основная задача отслеживать Ближайшие заседания. База данных будет обновляться по принципу апдейтов:

- запуск скрипта
- получение данных о делах
- Добавление новых дел в таблицу
- Обновление ближайших заседаний по каждому делу

Я не хочу хранить полную информацию по каждому делу мне нужен информативный набор полей. А вот информацию по процессу давай хранить целиком.

Определи поля в структуре дел по которым можно однозначно идентифицировать дело и связать с этим делом ближайшие заседания.

На локальном компютере поднят контейнер с mysql, параметры подключения:

- хост: localhost
- порт: 3306
- пользователь: root
- пароль: root
- база данных: grand_pravo

параметры вынеси в .env файл и прокинь в конфиг.

---

Так же хочу завести в базе таблицу событий в которой будут фиксироваться следующие события:

**События**

## Начало сеанса проверки

Фиксируется когда в запускается скрипт

## Добавление нового дела

Фиксируется когда новое дело добавляется в базу данных

## Добавление нового заседания

Фиксируется когда новое заседание добавляется в базу данных

В таблицу событий добавь json поле в которыеое пиши сырые данные по событию.

В таблице событий по мимо прочих полей для дальнейшего поиска нужно добавить:

- идентификатор дела caseId
- номер дела caseNumber
- идентификатор заседания sessionId

В дальнейшем номенклатура событий может расширяться.

---

Данный пакет планируется к размещению на виртуальном сервере. Для контроля хочу добавить небольшой web интерфейс в котором можно будет просмотреть состояние базы данных.
В качестве реактивного фремворка хочу использовать vue. К vue хочу подключить какую то библиотекк готовых компонентов чтобы не реализовывать самомтоятельно.

Пердложи варианты реализации.

---

Смотри я бы холел закрыть интерфейс логином и паролем. Мне не нужен многоранговый доступ логин и пароль для доступа можно указать в env файле. Что можешь предложить?

---

В пайплайн проверки (src/index.js) нам нужно встроить автоматическую простановку галочки я иду, Вот cUrl пример запроса скопированный из интерфейса:

```bash
curl --url 'https://dela.pravo.tech/ms/UserData/CaseSessions/IWillNotGo' \
  -H 'accept: application/json, text/javascript, */*; q=0.01' \
  -H 'accept-language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'cache-control: no-cache' \
  -H 'content-type: application/json' \
  -b '_ym_uid=178904989478630806; _ym_d=1789049894; adtech_uid=a3b863d7-ff2d-452a-80f4-750b0fa9cf64%3Apravo.tech; top100_id=t1.7751215.304477952.1789050739661; __ddg1_=EsscQKI0YB3csMD9gMB7; _ymab_param=WV4iVYTNBxoaxpYVKvyLgSOWhe4gjlCMzcOjUnSSdb78zEyMlDRkYrFjlxK78tuZgxlsx2aIqv_G-7lCKyuVRLfioqk; popmechanic_sbjs_migrations=popmechanic_1418474375998%3D1%7C%7C%7C1471519752600%3D1%7C%7C%7C1471519752605%3D1; DEFAULT_COOKIE_NAME_STATISTIC_COUNT_VISITED_PAGES=[%22/login%22]; DEFAULT_COOKIE_NAME_FOR_POPUP_USER_VISITED=true; DEFAULT_COOKIE_NAME_SHOW_POPUP_COUNT_CHECK=true; _ym_isad=1; _ym_visorc=w; __ddg9_=5.101.113.146; DEFAULT_COOKIE_NAME_STATISTIC_COUNT_ALL_VISITS=20; .AuthEmail=grohotov@grand-kg.ru; .ASPXAUTH=CA527044BED1CFBA5C7DECA72D1110BE2E15EA545DE7274089B9B097EA6D96422E076D6AF8BCAE39465DB15B95BF56183F12192DE2EF6067A3C440F635C8B9A5B4427FD0847CBCE4DB562A398F1BF5C5B4C28E67; MLR_Session=d265ef2c-a6a6-46a7-93fd-7ca7eff4d6fe; .cbp=c77c3cec5466c9fb2c52967ac7f65313; .AuthToken=eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTI1NiIsInR5cCI6IkpXVCJ9.eyJVc2VySWQiOiI5MzU4ZjlhNC0xZjFhLTQ0YWQtOTJiYi01N2FjNmQ1NGQ1YjIiLCJMb2dpbiI6InNwc18zNjk5NjIiLCJFbWFpbCI6Imdyb2hvdG92QGdyYW5kLWtnLnJ1IiwiTm90aWZpY2F0aW9uRW1haWwiOiJncm9ob3RvdkBncmFuZC1rZy5ydSIsIkRpc3BsYXlOYW1lIjoi0JPRgNC-0YXQvtGC0L7QsiDQkNC70LXQutGB0LDQvdC00YAg0J3QuNC60L7Qu9Cw0LXQstC40YciLCJTZXNzaW9uSWQiOiJkMjY1ZWYyYy1hNmE2LTQ2YTctOTNmZC03Y2E3ZWZmNGQ2ZmUiLCJDb21wYW55SWQiOiIzMDgwNiIsIkNvbXBhbnlJbm4iOiI0NjMyMTAzNzIwIiwiU2Vzc2lvblR5cGUiOiJXZWIiLCJMaWNlbnNlSXNQYWlkIjoiVHJ1ZSIsIkxpY2Vuc2VJc0FjdGl2ZSI6IlRydWUiLCJMaWNlbnNlVHlwZSI6IkZ1bGwiLCJUYXJpZmZUeXBlIjoiUHJhdm9DYXNlc1BSTyIsImV4cCI6MTc4OTY1NTg3OCwiaXNzIjoiUHJhdm9UZWNoIiwiYXVkIjoiQ2FzZWJvb2sifQ.yA4vt-tBKdowZjApI_vQBClMMYp0mZFVZnpi4NiRzNM; t3_sid_7751215=s1.1329828256.1789655569314.1789655585043.4.5.1.1...1; mindboxDeviceUUID=42436953-4818-4769-8319-b282e8e88fff; directCrm-session=%7B%22deviceGuid%22%3A%2242436953-4818-4769-8319-b282e8e88fff%22%7D; __ddg8_=YuBZEsUyh1CMMOCx; __ddg10_=1789655670; ph_phc_VbLxjTRDBa82ZdKpJvcODT7FtInJ9cUE0s05HTKyvzQ_posthog=%7B%22distinct_id%22%3A%2201a0a794-b8a3-7cd8-b729-2f709aaa1d28%22%2C%22%24sesid%22%3A%5B1789655674801%2C%2201a0afc8-dc7a-7aac-a615-dedc3fffd695%22%2C1789655571578%5D%2C%22%24epp%22%3Atrue%2C%22%24initial_person_info%22%3A%7B%22r%22%3A%22https%3A%2F%2Fdela.pravo.tech%2Fapp%2Ffolder%2F335482%2Fcases%22%2C%22u%22%3A%22https%3A%2F%2Fdela.pravo.tech%2Fcard%2Fcase%2Freview%2F4b102db1-e627-4289-9465-38d12103260b%22%7D%7D' \
  -H 'origin: https://dela.pravo.tech' \
  -H 'pragma: no-cache' \
  -H 'priority: u=1, i' \
  -H 'referer: https://dela.pravo.tech/card/case/review/14f8c206-dca4-4773-bd0a-323e8b698844' \
  -H 'sec-ch-ua: "Google Chrome";v="153", "Not_A Brand";v="8", "Chromium";v="153"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36' \
  -H 'x-date-format: iso' \
  -H 'x-json-lowercase: 1' \
  -H 'x-requested-with: XMLHttpRequest' \
  --data-raw '{"sessionId":"4c2e95d1-69e2-4e4d-a028-a0e54d9c638f"}' ;
curl --url 'https://metrika.casebook.ru/?domain=dela.pravo.tech&email=grohotov%40grand-kg.ru&controller=UserData&action=CaseSessions.IWillNotGo&url=%2Fms%2FUserData%2FCaseSessions.IWillNotGo&originalUrl=%2Fms%2FUserData%2FCaseSessions%2FIWillNotGo&responseTime=1179&responseStatus=200&isAutoQuery=0&isMuteErrors=0&params=%7B%22sessionId%22%3A%224c2e95d1-69e2-4e4d-a028-a0e54d9c638f%22%7D' \
  -X 'POST' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'Referer: https://dela.pravo.tech/' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36' \
  -H 'Accept: */*' \
  -H 'sec-ch-ua: "Google Chrome";v="153", "Not_A Brand";v="8", "Chromium";v="153"' \
  -H 'sec-ch-ua-mobile: ?0' ;
curl --url 'https://dela.pravo.tech/app/posthog/i/v0/e/?ip=1&_=1789655677803&ver=1.207.0&compression=gzip-js' \
  -H 'accept: */*' \
  -H 'accept-language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'cache-control: no-cache' \
  -H 'content-type: text/plain' \
  -b '_ym_uid=178904989478630806; _ym_d=1789049894; adtech_uid=a3b863d7-ff2d-452a-80f4-750b0fa9cf64%3Apravo.tech; top100_id=t1.7751215.304477952.1789050739661; __ddg1_=EsscQKI0YB3csMD9gMB7; _ymab_param=WV4iVYTNBxoaxpYVKvyLgSOWhe4gjlCMzcOjUnSSdb78zEyMlDRkYrFjlxK78tuZgxlsx2aIqv_G-7lCKyuVRLfioqk; popmechanic_sbjs_migrations=popmechanic_1418474375998%3D1%7C%7C%7C1471519752600%3D1%7C%7C%7C1471519752605%3D1; DEFAULT_COOKIE_NAME_STATISTIC_COUNT_VISITED_PAGES=[%22/login%22]; DEFAULT_COOKIE_NAME_FOR_POPUP_USER_VISITED=true; DEFAULT_COOKIE_NAME_SHOW_POPUP_COUNT_CHECK=true; _ym_isad=1; _ym_visorc=w; __ddg9_=5.101.113.146; DEFAULT_COOKIE_NAME_STATISTIC_COUNT_ALL_VISITS=20; .AuthEmail=grohotov@grand-kg.ru; .ASPXAUTH=CA527044BED1CFBA5C7DECA72D1110BE2E15EA545DE7274089B9B097EA6D96422E076D6AF8BCAE39465DB15B95BF56183F12192DE2EF6067A3C440F635C8B9A5B4427FD0847CBCE4DB562A398F1BF5C5B4C28E67; MLR_Session=d265ef2c-a6a6-46a7-93fd-7ca7eff4d6fe; .cbp=c77c3cec5466c9fb2c52967ac7f65313; .AuthToken=eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTI1NiIsInR5cCI6IkpXVCJ9.eyJVc2VySWQiOiI5MzU4ZjlhNC0xZjFhLTQ0YWQtOTJiYi01N2FjNmQ1NGQ1YjIiLCJMb2dpbiI6InNwc18zNjk5NjIiLCJFbWFpbCI6Imdyb2hvdG92QGdyYW5kLWtnLnJ1IiwiTm90aWZpY2F0aW9uRW1haWwiOiJncm9ob3RvdkBncmFuZC1rZy5ydSIsIkRpc3BsYXlOYW1lIjoi0JPRgNC-0YXQvtGC0L7QsiDQkNC70LXQutGB0LDQvdC00YAg0J3QuNC60L7Qu9Cw0LXQstC40YciLCJTZXNzaW9uSWQiOiJkMjY1ZWYyYy1hNmE2LTQ2YTctOTNmZC03Y2E3ZWZmNGQ2ZmUiLCJDb21wYW55SWQiOiIzMDgwNiIsIkNvbXBhbnlJbm4iOiI0NjMyMTAzNzIwIiwiU2Vzc2lvblR5cGUiOiJXZWIiLCJMaWNlbnNlSXNQYWlkIjoiVHJ1ZSIsIkxpY2Vuc2VJc0FjdGl2ZSI6IlRydWUiLCJMaWNlbnNlVHlwZSI6IkZ1bGwiLCJUYXJpZmZUeXBlIjoiUHJhdm9DYXNlc1BSTyIsImV4cCI6MTc4OTY1NTg3OCwiaXNzIjoiUHJhdm9UZWNoIiwiYXVkIjoiQ2FzZWJvb2sifQ.yA4vt-tBKdowZjApI_vQBClMMYp0mZFVZnpi4NiRzNM; t3_sid_7751215=s1.1329828256.1789655569314.1789655585043.4.5.1.1...1; mindboxDeviceUUID=42436953-4818-4769-8319-b282e8e88fff; directCrm-session=%7B%22deviceGuid%22%3A%2242436953-4818-4769-8319-b282e8e88fff%22%7D; ph_phc_VbLxjTRDBa82ZdKpJvcODT7FtInJ9cUE0s05HTKyvzQ_posthog=%7B%22distinct_id%22%3A%2201a0a794-b8a3-7cd8-b729-2f709aaa1d28%22%2C%22%24sesid%22%3A%5B1789655674801%2C%2201a0afc8-dc7a-7aac-a615-dedc3fffd695%22%2C1789655571578%5D%2C%22%24epp%22%3Atrue%2C%22%24initial_person_info%22%3A%7B%22r%22%3A%22https%3A%2F%2Fdela.pravo.tech%2Fapp%2Ffolder%2F335482%2Fcases%22%2C%22u%22%3A%22https%3A%2F%2Fdela.pravo.tech%2Fcard%2Fcase%2Freview%2F4b102db1-e627-4289-9465-38d12103260b%22%7D%7D; __ddg8_=sCVTRwsBoMrN7Ji7; __ddg10_=1789655674' \
  -H 'origin: https://dela.pravo.tech' \
  -H 'pragma: no-cache' \
  -H 'priority: u=1, i' \
  -H 'referer: https://dela.pravo.tech/card/case/review/14f8c206-dca4-4773-bd0a-323e8b698844' \
  -H 'sec-ch-ua: "Google Chrome";v="153", "Not_A Brand";v="8", "Chromium";v="153"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36' \
  --data-raw $'\u001f�\u0008\u0000\u0000\u0000\u0000\u0000\u0000\u0003�Vݎ�F\u0014~\u0015��\u0002�u����U[(?ˊ\u0016�R\u0015��x~�il�\u0019���E\\\u0000\u000fо\u0002׽(�@E���\u0009�o�3N���\u001a(4�\u0012�|�oΜ��<|b������z�Ŝ`\'��$�\u00178i��\u000e\u000e9\u000e�x\u0001��\u001d��Y�A��)�&�\u001ek\u001a\u0021��\u000fDQ\\�\u0000�J�Li�\u001a{��}I\u009f���u��\u0013� @s��\r\u0000�;�Qb乒���ޱ�%32��0��j\u0006򫬙iY\u001b@��\u001d��H��&�x_6D.\u000cFZ� CԪ\u0002��u�;\u001eSV�Q��\\�4#�1���O��\n����\u000byJ|7v(��\u0013&I����N�\u0007,��,M�и��Ƭ��?��XO+\u000c���_�^�\u0005j�\u000e\u0008O�eޗ�PZ<�F�u\u0019\n)*-��W��J��ZW��\\�E(�b}]�\u0005{��=��Q���غ�w�`���U�\u0019��32�W�e��^\u0014�\\��a��X�lm�f�@wK\\�$��Z���m�5�jŸ8�U\u000c�\u0010�X��LL��6/\u000cݍt\u0021��ڻ~\u0014\u001b�)Z-�>U��l[���B?\u0002q\u0021r\u0008���Ӽl���w��k\u0000QAr\u001a�������B=>R\u0019=.\u001e�-h�\n\\&i\u0016GQ�����vl*\u001a-*���$�B\'Oq�$��N�������0�\u001e��e,�\u0005.\u0010�B#+$*.�<���PK�\u001esYP��A\u0010���7P\u0003���i�0�\\��\u0004��O��O3\'\u000b��\u0009R���\u001b����O7�u��,\u0009B\' @\u0000ID),\u000b\'��^즙�~\u0007��\u0014#RQQMP��B�\u0019��Q\u00211E\u0004׺UP�\'���{��T%�H/]\u001b@����ժe;f��\\h\\\u0000_p�=#B�(�QT2�\u0004\u0001��-��f\u0011\u0017\u0013"���f#��FQ���G��%�\u0007RXC2��\u0006�tDٖ����ͳ\u0089����J(Z�3�"[�J��K]�\u0001E�j�Z4���yћ(�F�\u0008\n\u0011�����4V\r��*��7X\u0002Pa���&�u�?�2�G� �O��D�9C���)/�\u0004�>|\u0004жl���M�{��[*\u000b��g@v\u001e��\u0013��:���N�`\u0012�(�Q����8\u0003����XY�}����L�Ej�\u000c8F�U\u0002�{��ݽ���^Y\'�N�w�N���8y\u0006��\u007f�������\u0017��Y����ɯV�\u0017h<\u0003���+0zkD\u007f\u001a�M��{cu�u/\u0021��3f��S�~�o\u001f�rp��78�\u007f�{��9�s� �N߬ne��5�q�\u001b\u0007{G��\u001f�gj�\u0010N�H`\u00101&\u000e��ȡ���sN�,2F\u000bQQ�8c�\u001d���I1�����ɸ�y~�c��e��3�h�As2��t͛�m�,\u0011�\u0005Z\u001dt}�kx�����<s>4�\u0013-\u00093�I�\u007f��\u0010\u0012��޷h@\u001f\u000e4�\u0005\u0004[�\u0001�\u0015\u0008,~M���E��\u0012��\u0019TT\u0000Uh�h��&��ؐ~�-)@#�"�S��\u007f]u��\'��T�\u000bo\u001e�����|�\u0006rz�|�&��Z]�F��\u0014x�9�Pɨh�A�\u0000�b1�\u0010�\u0019P�\u0005��p\u00060��E�\u0013 �\u000f�Q\u0012DL;��\u0000�\u001b�6�\\\u0010�a�\\�\u0001�bX��A\'eC�ـ\\/\u0006�\u000b�8^^7�\u0021b�L���A?����\u00085��fpQ���\u001d[r\u000eSe�\u0006��?}�/\u0005\u000c:&#\u000c\u0000\u0000'
```

Галочка ставится если она еще не стоит. Если мы ставим галочку автоматически то генерируем по этому поводу отдельное событие.
Так же давай добавим в таблицу с ближайшими заседаниями 2 служебных поля:

- `is_auto_checked` — флаг, указывающий, была ли галочка поставлена автоматически.
- `auto_checked_time` — время, когда галочка была поставлена автоматически.
  Эти поля отрази в интерфейсе пользователя, чтобы было видно, была ли галочка поставлена автоматически и когда это произошло.

---

session.updated — заседание уже было, но изменились поля (суд/дата/описание)
sync.error — критические сбои (login fail, API timeout)
iwillgo.auto_set.fail — не удалось поставить галочку (сейчас только пишется в консоль)

---

Я хочу завести отдельную сущьность в базе данных под названием 'Проверка'. Эта сущьность будет содержать информацию о начале проверки, ее конце и результатах. Эта сущьность будет иметь идентификатор, по которому будет связь с новыми заседаниями и событиями. Для чего это нужно? Я хочу иметь возможность после прогона получить заседания созданные в рамках этого прогона а так же события произошедшие в этот прогон. Что скажешь по поводу этой идеи?

---

Смотри а есть ли вариант запускать прогон из web интерфейса?

---

Сделай подробный README по проекту, опиши функции, запуск и настройку проекта.
