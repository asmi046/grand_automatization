<template>
  <div>
    <el-form :inline="true" :model="filters" @submit.prevent="load(1)">
      <el-form-item label="Статус">
        <el-select v-model="filters.status" clearable placeholder="Любой" style="width: 160px">
          <el-option label="running" value="running" />
          <el-option label="completed" value="completed" />
          <el-option label="failed" value="failed" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="load(1)">Применить</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="rows" v-loading="loading" stripe border @row-click="open">
      <el-table-column label="Статус" width="120">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Начало" width="180">
        <template #default="{ row }">{{ formatDate(row.startedAt) }}</template>
      </el-table-column>
      <el-table-column label="Конец" width="180">
        <template #default="{ row }">{{ formatDate(row.endedAt) }}</template>
      </el-table-column>
      <el-table-column label="Длительность" width="140">
        <template #default="{ row }">{{ duration(row) }}</template>
      </el-table-column>
      <el-table-column label="Дела (new / upd)" width="160">
        <template #default="{ row }">
          <span v-if="row.result">{{ row.result.cases?.new || 0 }} / {{ row.result.cases?.updated || 0 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="Заседания (new / upd)" width="180">
        <template #default="{ row }">
          <span v-if="row.result">{{ row.result.sessions?.new || 0 }} / {{ row.result.sessions?.updated || 0 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="Я иду (ok / fail)" width="160">
        <template #default="{ row }">
          <span v-if="row.result">{{ row.result.iWillGo?.ok || 0 }} / {{ row.result.iWillGo?.fail || 0 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="checkId" min-width="280">
        <template #default="{ row }">
          <code style="font-size: 11px">{{ row.checkId }}</code>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="size"
      :total="total"
      :page-sizes="[20, 50, 100]"
      layout="total, sizes, prev, pager, next"
      style="margin-top: 16px; justify-content: flex-end"
      @current-change="load()"
      @size-change="load(1)"
    />

    <el-drawer v-model="drawerVisible" :title="`Прогон ${active?.checkId?.slice(0, 8) || ''}`" size="70%">
      <div v-if="active" style="padding: 0 16px">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="Статус">
            <el-tag :type="statusType(active.status)" size="small">{{ active.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="checkId"><code>{{ active.checkId }}</code></el-descriptions-item>
          <el-descriptions-item label="Начало">{{ formatDate(active.startedAt) }}</el-descriptions-item>
          <el-descriptions-item label="Конец">{{ formatDate(active.endedAt) }}</el-descriptions-item>
          <el-descriptions-item v-if="active.error" label="Ошибка" :span="2">
            <pre style="white-space: pre-wrap; color: #c00">{{ active.error }}</pre>
          </el-descriptions-item>
          <el-descriptions-item v-if="active.result" label="Результат" :span="2">
            <pre style="font-size: 12px">{{ JSON.stringify(active.result, null, 2) }}</pre>
          </el-descriptions-item>
        </el-descriptions>

        <h3 style="margin-top: 24px">Заседания, добавленные в этом прогоне ({{ sessionsTotal }})</h3>
        <el-table :data="sessions" size="small" stripe>
          <el-table-column label="Дата" width="160">
            <template #default="{ row }">{{ formatDate(row.date) }}</template>
          </el-table-column>
          <el-table-column prop="Case.caseNumber" label="Дело" width="200" />
          <el-table-column prop="court" label="Суд" />
          <el-table-column prop="judge" label="Судья" width="180" />
          <el-table-column prop="description" label="Описание" />
        </el-table>

        <h3 style="margin-top: 24px">События прогона ({{ eventsTotal }})</h3>
        <el-table :data="events" size="small" stripe>
          <el-table-column label="Время" width="180">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column prop="eventType" label="Тип" width="220">
            <template #default="{ row }">
              <el-tag :type="eventTagType(row.eventType)" size="small">{{ row.eventType }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="caseNumber" label="Дело" width="180" />
          <el-table-column prop="sessionId" label="sessionId">
            <template #default="{ row }">
              <code v-if="row.sessionId" style="font-size: 11px">{{ row.sessionId.slice(0, 12) }}…</code>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { api, formatDate } from '../api';

const rows = ref([]);
const total = ref(0);
const page = ref(1);
const size = ref(30);
const loading = ref(false);

const filters = reactive({ status: '' });

const drawerVisible = ref(false);
const active = ref(null);
const sessions = ref([]);
const sessionsTotal = ref(0);
const events = ref([]);
const eventsTotal = ref(0);

function statusType(s) {
  if (s === 'completed') return 'success';
  if (s === 'running') return 'warning';
  if (s === 'failed') return 'danger';
  return '';
}

function eventTagType(t) {
  if (t === 'scan.session.start') return 'info';
  if (t === 'case.added') return 'success';
  if (t === 'session.added') return 'success';
  if (t === 'session.iwillgo.auto_set') return 'warning';
  return '';
}

function duration(row) {
  if (!row.startedAt || !row.endedAt) return '—';
  const ms = new Date(row.endedAt) - new Date(row.startedAt);
  if (ms < 1000) return `${ms} мс`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}м ${rs}с`;
}

async function load(p) {
  if (p) page.value = p;
  loading.value = true;
  try {
    const params = { page: page.value, size: size.value };
    if (filters.status) params.status = filters.status;
    const { data } = await api.get('/checks', { params });
    rows.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

async function open(row) {
  active.value = row;
  drawerVisible.value = true;
  sessions.value = [];
  events.value = [];
  sessionsTotal.value = 0;
  eventsTotal.value = 0;

  try {
    const [s, e] = await Promise.all([
      api.get(`/checks/${row.checkId}/sessions`, { params: { size: 100 } }),
      api.get(`/checks/${row.checkId}/events`, { params: { size: 100 } }),
    ]);
    sessions.value = s.data.items;
    sessionsTotal.value = s.data.total;
    events.value = e.data.items;
    eventsTotal.value = e.data.total;
  } catch (err) {
    console.error(err);
  }
}

onMounted(load);
</script>
