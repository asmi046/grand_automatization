const { PravoClient, PravoError } = require('./pravoClient');
const { Case, Session, Event, Check, EVENT_TYPES, logEvent, initSchema, clearDatabase } = require('./db');
const { Op } = require('sequelize');
const { randomUUID } = require('crypto');
const config = require('./config');

async function tryStep(label, fn) {
  console.log(`\n=== ${label} ===`);
  try {
    const result = await fn();
    console.log('OK');
    return { ok: true, result };
  } catch (err) {
    if (err instanceof PravoError) {
      console.error(`FAIL (HTTP ${err.status}):`, err.body);
    } else {
      console.error('FAIL:', err.message || err);
    }
    return { ok: false, error: err };
  }
}

function projectCase(c) {
  return {
    caseId: c.caseId,
    caseNumber: c.caseNumber ?? null,
    courtName: c.lastInstance?.court ?? null,
    judgeName: c.lastInstance?.judgeName ?? null,
    status: c.status ?? null,
    caseTypeName: c.caseTypeName ?? null,
    caseTypeCode: c.caseType ?? null,
    isMonitored: !!c.isMonitored,
    comment: c.comment ?? null,
    claimSum: c.claimSum ?? null,
    versionDateUtc: c.versionDateUtc ? new Date(c.versionDateUtc) : null,
    groupName: c._group ?? null,
    folderId: c._folderId ?? null,
  };
}

async function upsertCase(c, checkId) {
  const data = projectCase(c);
  const [, created] = await Case.upsert(data, { returning: false });

  if (created && checkId) {
    await Case.update({ checkId }, { where: { caseId: data.caseId } });
  }

  return { created };
}

async function upsertCase(c, checkId) {
  const data = projectCase(c);

  if (!data.checkId) data.checkId = checkId;

  const [, created] = await Case.upsert(data, { returning: false });

  if (created) {
    await Case.update({ checkId }, { where: { caseId: data.caseId } });
  }

  return { created };
}

async function autoSetIWillGo(client, checkId, stats) {
  const now = new Date();
  const candidates = await Session.findAll({
    where: { iWillGo: false, date: { [Op.gte]: now } },
    include: [{ model: Case, attributes: ['caseNumber'] }],
    order: [['date', 'ASC']],
  });

  if (candidates.length === 0) {
    console.log('Нет заседаний без галочки — пропускаем авто-простановку.');
    return { ok: 0, fail: 0 };
  }

  console.log(`\n=== [5/7] Авто-простановка «я иду» (${candidates.length} шт.) ===`);
  let ok = 0;
  let fail = 0;

  for (const s of candidates) {
    try {
      await client.iWillGo(s.sessionId);
      const t = new Date();
      await s.update({
        iWillGo: true,
        isAutoChecked: true,
        autoCheckedTime: t,
        checkId: s.checkId ?? checkId,
      });
      await logEvent({
        eventType: EVENT_TYPES.SESSION_IWILLGO_AUTO_SET,
        caseId: s.caseId,
        caseNumber: s.Case?.caseNumber,
        sessionId: s.sessionId,
        checkId,
        payload: {
          sessionId: s.sessionId,
          date: s.date,
          court: s.court,
          judge: s.judge,
          autoCheckedTime: t.toISOString(),
        },
      });
      console.log(`  + ${s.sessionId.slice(0, 8)}… ${s.date.toISOString()}  [${s.Case?.caseNumber ?? ''}]`);
      ok++;
      if (stats) stats.iWillGo.ok++;
    } catch (err) {
      fail++;
      if (stats) stats.iWillGo.fail++;
      const detail = err instanceof PravoError ? `${err.status} ${JSON.stringify(err.body)}` : err.message;
      console.error(`  ! ${s.sessionId.slice(0, 8)}… FAIL: ${detail}`);
    }
  }

  console.log(`Auto-check итог: ${ok} ok, ${fail} fail`);
  return { ok, fail };
}

function projectEvent(e, caseRow) {
  const judge =
    e.judges?.find?.((j) => j.role === 'MainJudge' || j.role === 'Судья-докладчик')?.name ??
    e.judges?.[0]?.name ??
    e.judge ?? e.Judge ?? e.judgeName ?? e.JudgeName ?? null;
  const judgeId =
    e.judges?.find?.((j) => j.role === 'MainJudge' || j.role === 'Судья-докладчик')?.id ??
    e.judges?.[0]?.id ??
    e.judgeId ?? e.JudgeId ?? null;
  return {
    sessionId: e.id ?? e.Id ?? e.sessionId ?? e.SessionId,
    caseId: caseRow.caseId,
    date: new Date(e.hearingDate ?? e.date ?? e.Date),
    court: e.courtName ?? e.CourtName ?? e.court ?? e.Court ?? null,
    courtTag: e.courtTag ?? e.CourtTag ?? null,
    judge,
    judgeId,
    instanceLevel: e.instanceLevel ?? e.InstanceLevel ?? null,
    instanceNumber: e.instanceNumber ?? e.InstanceNumber ?? null,
    description: e.hearingPlace ?? e.description ?? e.Description ?? null,
    documentId: e.reasonDocumentId ?? e.documentId ?? e.DocumentId ?? null,
    iWillGo: !!(e.iWillGo ?? e.IWillGo),
    rawEvent: e,
  };
}

async function ingestCaseEvents(client, checkId, stats) {
  const today = new Date().toISOString().slice(0, 10);

  const cases = await Case.findAll({
    attributes: ['caseId', 'caseNumber', 'checkId'],
    order: [['versionDateUtc', 'DESC']],
  });

  if (cases.length === 0) {
    console.log('\n=== [5] Нет дел — пропускаем Event/List ===');
    return { added: 0, existed: 0, fail: 0 };
  }

  const newCases = cases.filter((c) => c.checkId === checkId).length;
  console.log(`\n=== [5] Event/List для ${cases.length} дел (${newCases} новых) ===`);
  let added = 0;
  let existed = 0;
  let fail = 0;

  for (const c of cases) {
    try {
      let page = 1;
      while (true) {
        const res = await client.listCaseEvents(c.caseId, {
          dateFrom: today,
          page,
          count: 50,
        });

        const items = res?.result?.items ?? res?.result?.Items ?? res?.items ?? [];
        const total = res?.result?.totalCount ?? items.length;
        const pages = res?.result?.pagesCount ?? 1;
        console.log(`    case=${c.caseNumber}: items=${items.length} total=${total} pages=${pages}`);

        for (const e of items) {
          const data = projectEvent(e, c);
          if (!data.sessionId) continue;

          const existing = await Session.findOne({
            where: { sessionId: data.sessionId },
            attributes: ['id'],
          });
          if (existing) {
            existed++;
            continue;
          }
          try {
            await Session.create({ ...data, checkId });
            added++;
            stats.sessions.new++;
          } catch (err) {
            console.error(`      DB ERROR for ${data.sessionId}:`);
            console.error(JSON.stringify(err.errors || err, null, 2));
            throw err;
          }
          await logEvent({
            eventType: EVENT_TYPES.SESSION_ADDED,
            caseId: c.caseId,
            caseNumber: c.caseNumber,
            sessionId: data.sessionId,
            checkId,
            payload: e,
          });
          console.log(`    + ${data.sessionId.slice(0, 8)}… ${data.date.toISOString()}  [${c.caseNumber}]`);
        }

        if (page >= pages) break;
        page++;
      }
    } catch (err) {
      fail++;
      const detail = err instanceof PravoError ? `${err.status} ${JSON.stringify(err.body)}` : err.message;
      console.error(`    ! case=${c.caseNumber} FAIL: ${detail}`);
    }
  }

  console.log(`Event/List итог: +${added} added, ~${existed} existed, !${fail} fail`);
  return { added, existed, fail };
}

(async () => {
  console.log('=== DB ===');
  await initSchema();
  console.log('Connected & schema synced.');

  if (process.env.DB_CLEAR_BEFORE_SYNC === 'true') {
    console.log('DB_CLEAR_BEFORE_SYNC=true → очищаю таблицы...');
    await clearDatabase();
    console.log('Tables cleared.');
  }

  const check = await Check.create({
    checkId: randomUUID(),
    startedAt: new Date(),
    status: 'running',
  });
  console.log(`Check started: ${check.checkId}`);

  const stats = {
    cases: { new: 0, updated: 0 },
    sessions: { new: 0, updated: 0 },
    iWillGo: { ok: 0, fail: 0 },
  };

  try {
    const client = new PravoClient();

    const loginRes = await tryStep(
      `[1] POST ${config.pravo.baseUrl}${config.pravo.loginPath}`,
      () => client.login(),
    );
    if (!loginRes.ok) throw new Error('Login failed');

    await tryStep('[2] POST /api/Account/Profile', () => client.getProfile());

    const groupsRes = await tryStep(
      '[3] GET /ms/UserData/Folder/ListGroups',
      () => client.listGroups(),
    );
    if (!groupsRes.ok) throw new Error('listGroups failed');

    const casesFolders = client.extractCasesFolders(groupsRes.result);
    const tracked = casesFolders.filter((f) => f.isNeedTracking);
    const targets = tracked.length > 0 ? tracked : casesFolders;

    for (const f of targets) {
      console.log(
        `\n=== [4] folder=${f.folderId} (${f.groupName}, ${f.entitiesCount} дел) ===`,
      );
      let page = 1;
      while (true) {
        const res = await tryStep(
          `    page ${page}`,
          () => client.folderCases(f.folderId, { page, count: 30 }),
        );
        if (!res.ok) break;

        const items = res.result?.result?.items ?? [];
        const pages = res.result?.result?.pagesCount ?? 1;
        console.log(`    -> ${items.length} items`);

        for (const c of items) {
          c._group = f.groupName;
          c._folderId = f.folderId;

          const { created: caseCreated } = await upsertCase(c, check.checkId);
          if (caseCreated) {
            stats.cases.new++;
            await logEvent({
              eventType: EVENT_TYPES.CASE_ADDED,
              caseId: c.caseId,
              caseNumber: c.caseNumber,
              checkId: check.checkId,
              payload: c,
            });
          } else {
            stats.cases.updated++;
          }
        }

        if (page >= pages) break;
        page++;
      }
    }

    console.log(
      `\n=== Sync summary ===\n` +
        `Cases:    +${stats.cases.new} new, ~${stats.cases.updated} updated`,
    );

    await autoSetIWillGo(client, check.checkId, stats);

    const events = await ingestCaseEvents(client, check.checkId, stats);
    stats.events = events;

    const autoPost = await autoSetIWillGo(client, check.checkId, stats);
    const postAdded = autoPost.ok;
    console.log(
      `Auto-check итоговый: +${postAdded} после Event/List (всего ok=${stats.iWillGo.ok} fail=${stats.iWillGo.fail})`,
    );

    await check.update({
      endedAt: new Date(),
      status: 'completed',
      result: stats,
    });
    console.log(`Check completed: ${check.checkId}`);

    const recentEvents = await Event.findAll({
      where: { checkId: check.checkId },
      order: [['id', 'ASC']],
    });
    console.log(`\n=== События этого прогона: ${recentEvents.length} ===\n`);
    for (const e of recentEvents) {
      const caseRef = e.caseNumber ? ` case=${e.caseNumber}` : '';
      const sessRef = e.sessionId ? ` session=${e.sessionId.slice(0, 8)}` : '';
      console.log(`${e.createdAt.toISOString()}  ${e.eventType}${caseRef}${sessRef}`);
    }
  } catch (err) {
    await check.update({
      endedAt: new Date(),
      status: 'failed',
      error: err.message || String(err),
      result: stats,
    });
    console.error(`Check failed: ${check.checkId}`);
    throw err;
  }
})().catch((err) => {
  console.error('Unexpected:', err.message || err);
  process.exit(1);
});
