const config = require('./config');
const { LeaderTaskClient, LeaderTaskError } = require('./leadertaskClient');
const { Session, Case, Event, logEvent, EVENT_TYPES } = require('./db');

function pickSide(sides, type) {
  if (!Array.isArray(sides)) return null;
  return (
    sides.find(
      (s) => s?.typeEnum === type || s?.nSideTypeEnum === type || s?.type === (type === 'Plaintiff' ? 0 : 1),
    ) ?? null
  );
}

function sideDisplayName(side) {
  if (!side) return null;
  return side.shortName || side.name || null;
}

function formatTaskName(session, caseRow) {
  const parts = [];
  const caseNumber = caseRow?.caseNumber ?? null;
  const court = session?.court ?? caseRow?.courtName ?? null;
  const judge = session?.judge ?? caseRow?.judgeName ?? null;

  if (caseNumber && court) {
    parts.push(`${caseNumber} в ${court}`);
  } else if (caseNumber) {
    parts.push(caseNumber);
  } else if (court) {
    parts.push(court);
  }

  if (judge) {
    parts.push(`Судья ${judge}`);
  }

  return parts.length > 0 ? parts.join('. ') : `Заседание ${session?.sessionId?.slice(0, 8) ?? ''}`;
}

function formatTaskComment(session, caseRow) {
  const lines = [];

  const sides = caseRow?.caseSides ?? [];
  const plaintiff = sideDisplayName(pickSide(sides, 'Plaintiff'));
  const respondent = sideDisplayName(pickSide(sides, 'Respondent'));

  if (plaintiff && respondent) {
    lines.push(`${plaintiff} против ${respondent}.`);
  } else if (plaintiff) {
    lines.push(`Истец: ${plaintiff}.`);
  } else if (respondent) {
    lines.push(`Ответчик: ${respondent}.`);
  } else if (caseRow?.comment) {
    lines.push(`${caseRow.comment}.`);
  }

  const caseTypeName = caseRow?.caseTypeName;
  const caseCategory = caseRow?.caseCategory;
  const categoryText = [caseTypeName, caseCategory].filter(Boolean).join('. ');
  if (categoryText) {
    lines.push(`${categoryText}.`);
  }

  if (session?.caseId && config.leadertask.caseUrlPattern) {
    lines.push(
      config.leadertask.caseUrlPattern.replace('{caseId}', session.caseId),
    );
  }

  const respondentSide = pickSide(sides, 'Respondent');
  const plaintiffSide = pickSide(sides, 'Plaintiff');
  const addressParts = [];
  const address = respondentSide?.address || plaintiffSide?.address;
  if (address) addressParts.push(address);
  if (session?.description) addressParts.push(session.description);

  if (addressParts.length > 0) {
    lines.push('📍');
    for (const a of addressParts) lines.push(` ${a}`);
  }

  return lines.join('\n');
}

function formatMskForLeaderTask(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (!d || Number.isNaN(d.getTime())) {
    return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 19);
  }
  const pad = (n) => String(n).padStart(2, '0');
  const msk = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return `${msk.getUTCFullYear()}-${pad(msk.getUTCMonth() + 1)}-${pad(msk.getUTCDate())}T${pad(msk.getUTCHours())}:${pad(msk.getUTCMinutes())}:${pad(msk.getUTCSeconds())}`;
}

async function resolveAutoTag(client) {
  const tagName = config.leadertask.autoTagName || 'Авто';
  const tagColor = config.leadertask.autoTagColor || '#A020F0';
  try {
    const { tag, created } = await client.ensureTag(tagName, { backColor: tagColor });
    const tagUid = tag?.uid ?? tag?.Uid;
    if (!tagUid) throw new Error('LeaderTask: метка не вернула uid');
    console.log(`  → метка «${tagName}» (${tagColor}): uid=${tagUid} (${created ? 'создана' : 'найдена'})`);
    return tagUid;
  } catch (err) {
    const detail =
      err instanceof LeaderTaskError
        ? `HTTP ${err.status} ${JSON.stringify(err.body)}`
        : err.message || String(err);
    console.error(`  ! не удалось зарезолвить метку «${tagName}»: ${detail}`);
    return null;
  }
}

async function pushToLeaderTask({ checkId, stats } = {}) {
  const ltConfig = config.leadertask;
  if (!ltConfig.enabled) {
    console.log('\n=== [7] LeaderTask: выключено (LEADERTASK_ENABLED=false) ===');
    return { ok: 0, fail: 0, skipped: 0 };
  }

  const pending = await Session.findAll({
    where: { loadToLiderTask: false },
    include: [{ model: Case, attributes: ['caseId', 'caseNumber', 'courtName', 'judgeName', 'caseTypeName', 'caseCategory', 'caseSides', 'comment'] }],
    order: [['date', 'ASC']],
  });

  if (pending.length === 0) {
    console.log('\n=== [7] LeaderTask: нет заседаний с loadToLiderTask=false — пропускаем ===');
    return { ok: 0, fail: 0, skipped: 0 };
  }

  console.log(`\n=== [7] LeaderTask: пуш ${pending.length} заседаний в LeaderTask ===`);

  const client = new LeaderTaskClient();
  console.log('  → логин в LeaderTask...');
  await client.login();

  const tagUid = await resolveAutoTag(client);

  let ok = 0;
  let fail = 0;

  for (const s of pending) {
    const caseRow = s.Case;
    const caseNumber = caseRow?.caseNumber ?? '—';
    const sessionShort = s.sessionId.slice(0, 8);

    const payload = {
      uid: s.sessionId,
      name: formatTaskName(s, caseRow),
      comment: formatTaskComment(s, caseRow),
      date_begin: formatMskForLeaderTask(s.date),
      date_end: formatMskForLeaderTask(s.date),
      focus: 1,
      status: 0,
      tags: tagUid ? [tagUid] : [],
    };

    try {
      await client.createTask(payload);
      await s.update({ loadToLiderTask: true });
      ok++;
      if (stats) stats.leadertask.ok++;
      await logEvent({
        eventType: EVENT_TYPES.LEADERTASK_TASK_PUSHED,
        caseId: s.caseId,
        caseNumber,
        sessionId: s.sessionId,
        checkId: checkId ?? null,
        payload: {
          name: payload.name,
          tagUid,
          leadertaskUid: s.sessionId,
        },
      });
      console.log(`  + ${sessionShort}… ${caseNumber} → «${payload.name.slice(0, 60)}${payload.name.length > 60 ? '…' : ''}»`);
    } catch (err) {
      const body = err.body;
      const bodyText = typeof body === 'string' ? body : JSON.stringify(body ?? {});
      const isAlreadyExists =
        err instanceof LeaderTaskError &&
        /uid already (present|exists)/i.test(bodyText);

      if (isAlreadyExists) {
        await s.update({ loadToLiderTask: true });
        ok++;
        if (stats) stats.leadertask.ok++;
        await logEvent({
          eventType: EVENT_TYPES.LEADERTASK_TASK_PUSHED,
          caseId: s.caseId,
          caseNumber,
          sessionId: s.sessionId,
          checkId: checkId ?? null,
          payload: {
            name: payload.name,
            tagUid,
            leadertaskUid: s.sessionId,
            alreadyExisted: true,
          },
        });
        console.log(`  = ${sessionShort}… ${caseNumber} уже в LeaderTask — помечено как synced`);
        continue;
      }

      fail++;
      if (stats) stats.leadertask.fail++;
      const detail =
        err instanceof LeaderTaskError
          ? `HTTP ${err.status} ${JSON.stringify(err.body)}`
          : err.message || String(err);
      await logEvent({
        eventType: EVENT_TYPES.LEADERTASK_TASK_FAILED,
        caseId: s.caseId,
        caseNumber,
        sessionId: s.sessionId,
        checkId: checkId ?? null,
        payload: {
          name: payload.name,
          error: detail,
        },
      });
      console.error(`  ! ${sessionShort}… ${caseNumber} FAIL: ${detail}`);
    }
  }

  console.log(`\n=== [7] LeaderTask итог: +${ok} ok, !${fail} fail ===`);
  return { ok, fail, skipped: 0 };
}

module.exports = {
  pushToLeaderTask,
  formatTaskName,
  formatTaskComment,
};
