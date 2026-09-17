<template>
  <div>
    <el-form :inline="true" :model="filters" @submit.prevent="load(1)">
      <el-form-item label="Тип">
        <el-select v-model="filters.eventType" clearable placeholder="Любой" style="width: 240px">
          <el-option label="scan.session.start" value="scan.session.start" />
          <el-option label="case.added" value="case.added" />
          <el-option label="session.added" value="session.added" />
        </el-select>
      </el-form-item>
      <el-form-item label="Дело">
        <el-input v-model="filters.caseNumber" clearable />
      </el-form-item>
      <el-form-item label="Session">
        <el-input v-model="filters.sessionId" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="load(1)">Применить</el-button>
        <el-button @click="reset">Сбросить</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="rows" v-loading="loading" stripe border>
      <el-table-column label="Время" width="180">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column prop="eventType" label="Тип" width="200">
        <template #default="{ row }">
          <el-tag :type="tagType(row.eventType)" size="small">{{ row.eventType }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="caseNumber" label="Дело" width="180" />
      <el-table-column prop="caseId" label="caseId" width="280">
        <template #default="{ row }">
          <code v-if="row.caseId" style="font-size: 11px">{{ row.caseId.slice(0, 8) }}…</code>
        </template>
      </el-table-column>
      <el-table-column prop="sessionId" label="sessionId" width="280">
        <template #default="{ row }">
          <code v-if="row.sessionId" style="font-size: 11px">{{ row.sessionId.slice(0, 8) }}…</code>
        </template>
      </el-table-column>
      <el-table-column label="Payload" width="80">
        <template #default="{ row }">
          <el-button v-if="row.payload" link size="small" @click="showPayload(row)">JSON</el-button>
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

    <el-dialog v-model="dialogVisible" title="Payload события" width="700px">
      <pre style="max-height: 500px; overflow: auto; font-size: 12px">{{ dialogContent }}</pre>
    </el-dialog>
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
const dialogVisible = ref(false);
const dialogContent = ref('');

const filters = reactive({ eventType: '', caseNumber: '', sessionId: '' });

function tagType(t) {
  if (t === 'scan.session.start') return 'info';
  if (t === 'case.added') return 'success';
  if (t === 'session.added') return 'warning';
  return '';
}

function showPayload(row) {
  dialogContent.value = JSON.stringify(row.payload, null, 2);
  dialogVisible.value = true;
}

async function load(p) {
  if (p) page.value = p;
  loading.value = true;
  try {
    const params = { page: page.value, size: size.value };
    if (filters.eventType) params.eventType = filters.eventType;
    if (filters.caseNumber) params.caseNumber = filters.caseNumber;
    if (filters.sessionId) params.sessionId = filters.sessionId;
    const { data } = await api.get('/events', { params });
    rows.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function reset() {
  filters.eventType = '';
  filters.caseNumber = '';
  filters.sessionId = '';
  load(1);
}

onMounted(load);
</script>
