#!/usr/bin/env node
const { randomUUID } = require('crypto');
const { LeaderTaskClient, LeaderTaskError } = require('../leadertaskClient');

function formatMsk(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  const msk = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return `${msk.getUTCFullYear()}-${pad(msk.getUTCMonth() + 1)}-${pad(msk.getUTCDate())}T${pad(msk.getUTCHours())}:${pad(msk.getUTCMinutes())}:${pad(msk.getUTCSeconds())}`;
}

function parseArgs(argv) {
  const args = {
    login: null,
    password: null,
    noAccountInfo: false,
    noTask: false,
    noTag: false,
    taskName: null,
    taskPerformer: null,
    tagName: 'Авто',
    tagColor: '#A020F0',
    json: false,
  };
  for (const a of argv.slice(2)) {
    if (a === '--no-account') args.noAccountInfo = true;
    else if (a === '--no-task') args.noTask = true;
    else if (a === '--no-tag') args.noTag = true;
    else if (a === '--json') args.json = true;
    else if (a.startsWith('--login=')) args.login = a.slice(8);
    else if (a.startsWith('--password=')) args.password = a.slice(11);
    else if (a.startsWith('--task-name=')) args.taskName = a.slice(12);
    else if (a.startsWith('--task-performer=')) args.taskPerformer = a.slice(17);
    else if (a.startsWith('--tag-name=')) args.tagName = a.slice(11);
    else if (a.startsWith('--tag-color=')) args.tagColor = a.slice(12);
    else if (!args.login && a.includes('@')) args.login = a;
    else usage();
  }
  return args;
}

function usage() {
  console.error('Usage: npm run leadertask:auth -- [options]');
  console.error('');
  console.error('Options:');
  console.error('  --login=EMAIL            переопределить логин из .env');
  console.error('  --password=PASS          переопределить пароль из .env');
  console.error('  --no-account             не вызывать /account/info после логина');
  console.error('  --no-task                не создавать тестовую задачу');
  console.error('  --no-tag                 не добавлять метку к задаче');
  console.error('  --task-name=NAME         имя тестовой задачи (по умолчанию "Тестовая задача из grand_automatization")');
  console.error('  --task-performer=EMAIL   email_performer (по умолчанию берётся из /account/info)');
  console.error('  --tag-name=NAME          имя метки (по умолчанию "Авто")');
  console.error('  --tag-color=#RRGGBB      цвет метки при создании (по умолчанию "#A020F0" — фиолетовый)');
  console.error('  --json                   вывести финальный JSON вместо человекочитаемого вывода');
  console.error('');
  console.error('Examples:');
  console.error('  npm run leadertask:auth');
  console.error('  npm run leadertask:auth -- --login=user@mail.com --password=secret');
  console.error('  npm run leadertask:auth -- --json');
  console.error('  npm run leadertask:auth -- --task-name="Проверка API"');
  console.error('  npm run leadertask:auth -- --tag-name="Срочно" --tag-color="#FF0000"');
  process.exit(1);
}

function maskToken(t) {
  if (!t) return null;
  if (t.length <= 24) return t;
  return `${t.slice(0, 12)}…${t.slice(-6)}`;
}

(async () => {
  const args = parseArgs(process.argv);
  const client = new LeaderTaskClient();

  const startedAt = new Date();

  console.log('[1/4] POST /api/v1/users/authjson');
  const tokens = await client.login({
    login: args.login,
    password: args.password,
  });
  console.log('OK — получены токены:');
  console.log(`  access_token  = ${maskToken(tokens.access_token)}`);
  console.log(`  refresh_token = ${maskToken(tokens.refresh_token)}`);

  let account = null;
  if (!args.noAccountInfo) {
    console.log('\n[2/4] GET /api/v1/account/info');
    try {
      account = await client.accountInfo();
      console.log('OK — данные аккаунта:');
      console.log(`  owner_title      = ${account.owner_title ?? '—'}`);
      console.log(`  owner_email      = ${account.owner_email ?? '—'}`);
      console.log(`  current_user     = ${account.current_user_name ?? '—'} <${account.current_user_email ?? '—'}>`);
      console.log(`  current_user_uid = ${account.current_user_uid ?? '—'}`);
      console.log(`  license_type     = ${account.license_type ?? '—'}`);
      console.log(`  tarif            = ${account.tarif ?? '—'}`);
      console.log(`  date_expired     = ${account.date_expired ?? '—'}`);
      console.log(`  days_left        = ${account.days_left ?? '—'}`);
      console.log(`  total_mb / %     = ${account.total_mb ?? '—'} / ${account.percent_mb ?? '—'}`);
    } catch (err) {
      if (err instanceof LeaderTaskError) {
        console.error(`FAIL (HTTP ${err.status}):`, JSON.stringify(err.body));
      } else {
        console.error('FAIL:', err.message || err);
      }
    }
  }

  let createdTask = null;
  let createTaskError = null;
  let resolvedTag = null;
  let tagResolveError = null;
  if (!args.noTask) {
    console.log('\n[3/4] POST /api/v1/task (создание тестовой задачи)');
    const now = new Date();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const nowIso = now.toISOString();
    const tomorrowIso = tomorrow.toISOString();
    const nowMsk = formatMsk(now);
    const tomorrowMsk = formatMsk(tomorrow);

    let taskTagUids = [];
    if (!args.noTag) {
      console.log(`  → резолвлю метку «${args.tagName}» (${args.tagColor})`);
      try {
        const { tag, created } = await client.ensureTag(args.tagName, {
          backColor: args.tagColor,
        });
        resolvedTag = tag;
        const tagUid = tag?.uid ?? tag?.Uid;
        if (tagUid) taskTagUids = [tagUid];
        console.log(`  метка: uid=${tagUid} name="${tag?.name ?? tag?.Name}" back_color="${tag?.back_color ?? tag?.backColor ?? '—'}" (${created ? 'создана' : 'найдена'})`);
      } catch (err) {
        tagResolveError = err instanceof LeaderTaskError
          ? { status: err.status, body: err.body }
          : { message: err.message || String(err) };
        console.error(`  ! не удалось зарезолвить метку:`, err instanceof LeaderTaskError
          ? `HTTP ${err.status} ${JSON.stringify(err.body)}`
          : err.message || err);
      }
    }

    const taskPayload = {
      uid: randomUUID(),
      uid_parent: '00000000-0000-0000-0000-000000000000',
      uid_customer: account?.current_user_uid ?? '00000000-0000-0000-0000-000000000000',
      uid_project: '00000000-0000-0000-0000-000000000000',
      date_create: nowIso,
      email_performer: args.taskPerformer ?? account?.current_user_email ?? '',
      name: args.taskName ?? 'Тестовая задача из grand_automatization',
      comment: 'Создано через src/cli/leadertaskAuth.js для отладки.',
      status: 0,
      order_new: 1.0,
      emails: '',
      checklist: '',
      uid_marker: '00000000-0000-0000-0000-000000000000',
      date_begin: nowMsk,
      date_reminder: '0001-01-01T00:00:00',
      date_end: tomorrowMsk,
      focus: 1,
      tags: taskTagUids,
    };

    console.log('  payload:');
    console.log('  ' + JSON.stringify(taskPayload, null, 2).replace(/\n/g, '\n  '));

    try {
      createdTask = await client.createTask(taskPayload);
      console.log('OK — задача создана:');
      console.log(`  uid             = ${createdTask?.uid ?? createdTask?.Uid ?? '—'}`);
      console.log(`  name            = ${createdTask?.name ?? createdTask?.Name ?? '—'}`);
      console.log(`  status          = ${createdTask?.status ?? createdTask?.Status ?? '—'}`);
      console.log(`  email_performer = ${createdTask?.email_performer ?? createdTask?.EmailPerformer ?? '—'}`);
      console.log(`  date_create     = ${createdTask?.date_create ?? createdTask?.DateCreate ?? '—'}`);
      console.log(`  tags (req)      = ${JSON.stringify(taskPayload.tags)}`);
      const respTags = createdTask?.tags ?? createdTask?.Tags;
      if (respTags) console.log(`  tags (resp)     = ${JSON.stringify(respTags)}`);
    } catch (err) {
      createTaskError = err instanceof LeaderTaskError
        ? { status: err.status, body: err.body }
        : { message: err.message || String(err) };
      if (err instanceof LeaderTaskError) {
        console.error(`FAIL (HTTP ${err.status}):`, JSON.stringify(err.body));
      } else {
        console.error('FAIL:', err.message || err);
      }
    }
  }

  const finishedAt = new Date();
  console.log('\n[4/4] Итог');
  console.log(`  длительность:    ${finishedAt - startedAt} мс`);
  console.log(`  isAuthenticated: ${!!client.accessToken}`);
  console.log(`  taskCreated:     ${createdTask ? 'да' : (args.noTask ? 'пропущено' : 'нет')}`);
  if (createdTask) {
    console.log(`  taskUid:         ${createdTask?.uid ?? createdTask?.Uid ?? '—'}`);
  }
  if (resolvedTag) {
    console.log(`  tagResolved:     uid=${resolvedTag?.uid ?? resolvedTag?.Uid} name="${resolvedTag?.name ?? resolvedTag?.Name}" color=${resolvedTag?.back_color ?? resolvedTag?.backColor ?? '—'}`);
  } else if (args.noTag) {
    console.log(`  tagResolved:     пропущено (--no-tag)`);
  } else if (tagResolveError) {
    console.log(`  tagResolved:     ошибка`);
  }
  console.log('OK — отработано.');

  if (args.json) {
    const out = {
      ok: true,
      login: args.login ?? require('../config').leadertask.login,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      account,
      tag: resolvedTag,
      tagError: tagResolveError,
      task: createdTask,
      taskError: createTaskError,
    };
    console.log('\n[JSON]');
    console.log(JSON.stringify(out, null, 2));
  }
})().catch((err) => {
  if (err instanceof LeaderTaskError) {
    console.error(`\nAPI ${err.status}:`, JSON.stringify(err.body, null, 2));
  } else {
    console.error('\nОшибка:', err.stack || err.message || err);
  }
  process.exit(1);
});
