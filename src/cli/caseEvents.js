#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PravoClient, PravoError } = require('../pravoClient');

function usage() {
  console.error('Usage: npm run case-events -- <caseId> [options]');
  console.error('');
  console.error('Options:');
  console.error('  --save              сохранить сырой JSON в файл case-events-<caseId>-<ts>.json');
  console.error('  --from=YYYY-MM-DD   дата начала выборки (по умолчанию сегодня)');
  console.error('  --all               тянуть и прошлые, и будущие события (dateFrom=null)');
  console.error('  --json              вывести каждый event как JSON вместо текста');
  console.error('  --ids-only          вывести только sessionId построчно');
  console.error('  --no-truncate       не сокращать UUID в текстовом выводе (по умолчанию сокращаются)');
  console.error('');
  console.error('Examples:');
  console.error('  npm run case-events -- 8b7df381-9008-4afc-aa07-aad106a94356');
  console.error('  npm run case-events -- 8b7df381-... --save');
  console.error('  npm run case-events -- 8b7df381-... --all --no-truncate');
  console.error('  npm run case-events -- 8b7df381-... --ids-only > session-ids.txt');
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    save: false,
    dateFrom: null,
    all: false,
    caseId: null,
    json: false,
    idsOnly: false,
    noTruncate: false,
  };
  for (const a of argv.slice(2)) {
    if (a === '--save') args.save = true;
    else if (a === '--all') args.all = true;
    else if (a === '--json') args.json = true;
    else if (a === '--ids-only') args.idsOnly = true;
    else if (a === '--no-truncate') args.noTruncate = true;
    else if (a.startsWith('--from=')) args.dateFrom = a.slice(7);
    else if (!args.caseId) args.caseId = a;
    else usage();
  }
  if (!args.caseId) usage();
  return args;
}

function pick(obj, ...keys) {
  for (const k of keys) if (obj?.[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
}

function normalize(e) {
  const id = pick(e, 'sessionId', 'SessionId', 'id', 'Id');
  const idStr = id == null ? null : (typeof id === 'string' ? id : String(id));
  return {
    sessionId: idStr,
    date: pick(e, 'date', 'Date') ?? null,
    court: pick(e, 'court', 'Court') ?? null,
    judge: pick(e, 'judge', 'Judge', 'judgeName', 'JudgeName') ?? null,
    judgeId: pick(e, 'judgeId', 'JudgeId') ?? null,
    instanceLevel: pick(e, 'instanceLevel', 'InstanceLevel') ?? null,
    instanceNumber: pick(e, 'instanceNumber', 'InstanceNumber') ?? null,
    description: pick(e, 'description', 'Description') ?? null,
    documentId: pick(e, 'documentId', 'DocumentId') ?? null,
    eventType: pick(e, 'eventType', 'EventType') ?? null,
    iWillGo: Boolean(pick(e, 'iWillGo', 'IWillGo')),
    caseId: pick(e, 'caseId', 'CaseId') ?? null,
    isResolution: pick(e, 'isResolution', 'IsResolution') ?? null,
    hasFile: pick(e, 'hasFile', 'HasFile') ?? null,
    needJudges: pick(e, 'needJudges', 'NeedJudges') ?? null,
  };
}

function pad(s, n) {
  s = String(s ?? '');
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function short(s, head = 8) {
  if (!s || typeof s !== 'string') return '—';
  return s.length > head * 2 + 3 ? `${s.slice(0, head)}…${s.slice(-4)}` : s;
}

function full(s) {
  return s && typeof s === 'string' ? s : '—';
}

function printHuman(events, noTruncate) {
  const rows = events.map(normalize);
  if (rows.length === 0) {
    console.log('\nСобытий не найдено.');
    return;
  }

  const W_DATE = 21;
  const W_SESSION = noTruncate ? 38 : 14;
  const W_DOC = noTruncate ? 38 : 14;
  const W_JUDGE = 22;
  const W_COURT = 30;
  const W_INST = 14;

  console.log('');
  console.log(pad('№', 4) + pad('дата', W_DATE) + pad('iWillGo', 8) + pad('заседание', W_SESSION) + pad('суд', W_COURT) + pad('судья', W_JUDGE) + pad('инстанция', W_INST) + pad('описание', 30));
  console.log('-'.repeat(4 + W_DATE + 8 + W_SESSION + W_COURT + W_JUDGE + W_INST + 30));

  rows.forEach((e, i) => {
    const sid = noTruncate ? full(e.sessionId) : short(e.sessionId);
    const date = e.date ? String(e.date).replace('T', ' ').slice(0, W_DATE) : '—';
    const iwg = e.iWillGo ? 'да' : 'нет';
    const court = e.court ? String(e.court).slice(0, W_COURT) : '—';
    const judge = e.judge ? String(e.judge).slice(0, W_JUDGE) : '—';
    const inst = e.instanceNumber ? String(e.instanceNumber).slice(0, W_INST) : (e.instanceLevel != null ? `lvl ${e.instanceLevel}` : '—');
    const desc = e.description ? String(e.description).slice(0, 30) : '—';
    console.log(
      pad(i + 1, 4) +
      pad(date, W_DATE) +
      pad(iwg, 8) +
      pad(sid, W_SESSION) +
      pad(court, W_COURT) +
      pad(judge, W_JUDGE) +
      pad(inst, W_INST) +
      desc,
    );
  });

  console.log('');
  console.log(`=== Детали по событиям ===\n`);
  rows.forEach((e, i) => {
    console.log(`[${i + 1}] sessionId:    ${full(e.sessionId)}`);
    if (e.eventType) console.log(`    eventType:    ${e.eventType}`);
    console.log(`    date:         ${e.date || '—'}`);
    console.log(`    description:  ${e.description || '—'}`);
    console.log(`    court:        ${e.court || '—'}`);
    console.log(`    judge:        ${e.judge || '—'}`);
    if (e.judgeId) console.log(`    judgeId:      ${full(e.judgeId)}`);
    if (e.instanceLevel != null) console.log(`    instanceLvl:  ${e.instanceLevel}`);
    if (e.instanceNumber) console.log(`    instanceNum:  ${e.instanceNumber}`);
    if (e.documentId) console.log(`    documentId:   ${full(e.documentId)}`);
    console.log(`    iWillGo:      ${e.iWillGo ? 'да' : 'нет'}`);
    if (e.hasFile != null) console.log(`    hasFile:      ${e.hasFile}`);
    if (e.needJudges != null) console.log(`    needJudges:   ${e.needJudges}`);
    if (e.isResolution != null) console.log(`    isResolution: ${e.isResolution}`);
    console.log('');
  });
}

function printIds(events) {
  for (const e of events) {
    const id = normalize(e).sessionId;
    if (id) console.log(id);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const client = new PravoClient();

  console.log('[1/2] Логин в dela.pravo.tech...');
  await client.login();

  console.log(`[2/2] Event/List для ${args.caseId}` + (args.all ? ' (все события)' : ` (с ${args.dateFrom || 'сегодня'})`));

  const all = [];
  let page = 1;
  while (true) {
    const res = await client.listCaseEvents(args.caseId, {
      dateFrom: args.all ? null : (args.dateFrom || new Date().toISOString().slice(0, 10)),
      dateTo: null,
      page,
      count: 50,
    });
    const data = res?.result ?? res ?? {};
    const items = data.items ?? data.Items ?? [];
    const total = data.totalCount ?? data.TotalCount ?? items.length;
    const pages = data.pagesCount ?? data.PagesCount ?? 1;
    all.push(...items);
    console.log(`  стр.${page}/${pages}: ${items.length} из ${total}`);
    if (page >= pages) break;
    page++;
  }

  console.log(`\n=== Найдено: ${all.length} ===`);

  if (args.idsOnly) {
    printIds(all);
  } else if (args.json) {
    for (const raw of all) console.log(JSON.stringify(normalize(raw)));
  } else {
    printHuman(all, args.noTruncate);
  }

  if (args.save) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.resolve(process.cwd(), `case-events-${args.caseId.slice(0, 8)}-${ts}.json`);
    fs.writeFileSync(file, JSON.stringify(all, null, 2));
    console.error(`\nСохранено в ${file}`);
  }
}

main().catch((err) => {
  if (err instanceof PravoError) {
    console.error(`\nAPI ${err.status}:`, JSON.stringify(err.body, null, 2));
  } else {
    console.error(err.stack || err.message || err);
  }
  process.exit(1);
});
