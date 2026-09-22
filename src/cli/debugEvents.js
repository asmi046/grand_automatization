#!/usr/bin/env node
require('dotenv').config();
const { PravoClient } = require('../pravoClient');

(async () => {
  const caseId = process.argv[2];
  if (!caseId) {
    console.error('Usage: npm run debug-events -- <caseId>');
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const client = new PravoClient();

  console.log('Logging in...');
  await client.login();

  console.log('--- request payload (exactly as pipeline sends) ---');
  const payload = {
    caseId,
    eventFilter: {
      dateFilter: { dateFrom: today, dateTo: null },
      eventTypes: ['AllSessions'],
    },
    paging: { page: 1, count: 50 },
    sort: [{ field: 'Date', order: 'Ascending', index: 0 }],
  };
  console.log(JSON.stringify(payload, null, 2));

  console.log('\n--- response (page 1) ---');
  const res = await client.listCaseEvents(caseId, {
    dateFrom: today,
    dateTo: null,
    eventTypes: ['AllSessions'],
    page: 1,
    count: 50,
  });

  const data = res?.result || res || {};
  console.log('top-level keys:', Object.keys(data));
  console.log('items.length:', data.items?.length);
  console.log('totalCount:', data.totalCount);
  console.log('pagesCount:', data.pagesCount);
  console.log('first item KEYS:', Object.keys(data.items?.[0] || {}));
  console.log('first item FULL:', JSON.stringify(data.items?.[0], null, 2));

  console.log('\n--- all pages ---');
  let page = 1;
  let total = 0;
  while (page <= (data.pagesCount || 1)) {
    const r = await client.listCaseEvents(caseId, {
      dateFrom: today,
      dateTo: null,
      eventTypes: ['AllSessions'],
      page,
      count: 50,
    });
    const items = r?.result?.items || [];
    total += items.length;
    console.log(`page ${page}: ${items.length} items`);
    page++;
  }
  console.log('TOTAL across pages:', total);

  console.log('\n--- compare: same call without eventTypes ---');
  const resNoTypes = await client.http.post(
    'https://dela.pravo.tech/ms/CaseCard/api/v1/Event/List',
    {
      caseId,
      eventFilter: { dateFilter: { dateFrom: today, dateTo: null }, eventTypes: [] },
      paging: { page: 1, count: 50 },
      sort: [{ field: 'Date', order: 'Ascending', index: 0 }],
    },
  );
  const data2 = resNoTypes.data?.result || {};
  console.log('no eventTypes items.length:', data2.items?.length);
  console.log('no eventTypes totalCount:', data2.totalCount);
})().catch((e) => {
  console.error('ERR:', e.message);
  console.error(JSON.stringify(e.body || e, null, 2));
  process.exit(1);
});
