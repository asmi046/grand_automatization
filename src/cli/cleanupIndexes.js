#!/usr/bin/env node
require('dotenv').config();
const { sequelize } = require('../db');

// Какие индексы KEEP'ить — основные (те, что в моделях сейчас).
// Скрипт удалит ВСЕ остальные дубликаты.
const KEEP_BY_TABLE = {
  cases: [
    'PRIMARY',
    'caseId',
    'cases_case_number',
    'cases_group_name_folder_id',
    'cases_check_id',
    'cases_version_date_utc',
  ],
  sessions: [
    'PRIMARY',
    'sessionId',
    'sessions_case_id',
    'sessions_date',
    'sessions_check_id',
  ],
  events: [
    'PRIMARY',
    'events_event_type',
    'events_case_id',
    'events_session_id',
    'events_check_id',
    'events_created_at',
  ],
  checks: [
    'PRIMARY',
    'checkId',
    'checks_status',
    'checks_started_at',
  ],
};

(async () => {
  console.log('Подключаюсь к MySQL...');
  try {
    await sequelize.authenticate();
  } catch (e) {
    console.error('Не удалось подключиться:', e.message);
    process.exit(1);
  }

  let droppedTotal = 0;

  for (const [table, keepNames] of Object.entries(KEEP_BY_TABLE)) {
    const [rows] = await sequelize.query(`SHOW INDEXES FROM \`${table}\``);
    const seen = new Set();
    for (const r of rows) {
      if (keepNames.includes(r.Key_name)) continue;
      if (seen.has(r.Key_name)) continue;
      seen.add(r.Key_name);
      try {
        await sequelize.query(`DROP INDEX \`${r.Key_name}\` ON \`${table}\``);
        console.log(`  ${table}: dropped \`${r.Key_name}\``);
        droppedTotal++;
      } catch (e) {
        console.error(`  ${table}: FAILED \`${r.Key_name}\`: ${e.message.split('\n')[0]}`);
      }
    }
  }

  console.log(`\nИтого удалено: ${droppedTotal} индексов.`);
  await sequelize.close();
})();
