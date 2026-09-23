<template>
  <div>
    <el-form :inline="true" :model="filters" @submit.prevent="load(1)">
      <el-form-item label="Поиск">
        <el-input v-model="filters.q" placeholder="Номер / статус / суд / судья" clearable @keyup.enter="load(1)" @clear="load(1)" />
      </el-form-item>
      <el-form-item label="Группа">
        <el-input v-model="filters.groupName" clearable @keyup.enter="load(1)" />
      </el-form-item>
      <el-form-item label="Мониторинг">
        <el-select v-model="filters.isMonitored" clearable placeholder="Любой" style="width: 140px">
          <el-option label="Да" value="true" />
          <el-option label="Нет" value="false" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="load(1)">Применить</el-button>
        <el-button @click="reset">Сбросить</el-button>
      </el-form-item>
    </el-form>

    <el-table
      :data="rows"
      v-loading="loading"
      stripe
      border
      :row-class-name="rowClass"
      style="cursor: pointer"
      @row-click="(row) => open(row)"
    >
      <el-table-column label="Номер дела / caseId" width="260">
        <template #default="{ row }">
          <div>{{ row.caseNumber || '—' }}</div>
          <div style="color: #888; font-size: 11px; font-family: ui-monospace, monospace">
            {{ row.caseId || '' }}
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="courtName" label="Суд" />
      <el-table-column prop="judgeName" label="Судья" width="200" />
      <el-table-column prop="status" label="Статус" width="240" />
      <el-table-column prop="groupName" label="Группа" width="160" />
      <el-table-column label="Мониторинг" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.isMonitored" type="success" size="small">да</el-tag>
          <el-tag v-else type="info" size="small">нет</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Обновлено" width="180">
        <template #default="{ row }">{{ formatDate(row.versionDateUtc) }}</template>
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
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api, formatDate } from '../api';

const router = useRouter();
const rows = ref([]);
const total = ref(0);
const page = ref(1);
const size = ref(30);
const loading = ref(false);

const filters = reactive({ q: '', groupName: '', isMonitored: '' });

function open(row) {
  if (row?.caseId) router.push({ name: 'case-detail', params: { caseId: row.caseId } });
}

function rowClass({ row }) {
  return row?.caseId ? 'clickable-row' : '';
}

async function load(p) {
  if (p) page.value = p;
  loading.value = true;
  try {
    const params = { page: page.value, size: size.value };
    if (filters.q) {
      params.caseNumber = filters.q;
    }
    if (filters.groupName) params.groupName = filters.groupName;
    if (filters.isMonitored) params.isMonitored = filters.isMonitored;
    const { data } = await api.get('/cases', { params });
    rows.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function reset() {
  filters.q = '';
  filters.groupName = '';
  filters.isMonitored = '';
  load(1);
}

onMounted(load);
</script>

<style scoped>
:deep(.clickable-row:hover) td {
  background-color: #ecf5ff !important;
}
</style>
