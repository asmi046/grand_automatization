<template>
  <div>
    <el-form :inline="true" :model="filters" @submit.prevent="load(1)">
      <el-form-item label="С">
        <el-date-picker v-model="filters.dateFrom" type="datetime" placeholder="от" value-format="YYYY-MM-DDTHH:mm:ss" />
      </el-form-item>
      <el-form-item label="По">
        <el-date-picker v-model="filters.dateTo" type="datetime" placeholder="до" value-format="YYYY-MM-DDTHH:mm:ss" />
      </el-form-item>
      <el-form-item label="Суд">
        <el-input v-model="filters.court" clearable />
      </el-form-item>
      <el-form-item label="Судья">
        <el-input v-model="filters.judge" clearable />
      </el-form-item>
      <el-form-item label="Только будущие">
        <el-switch v-model="filters.upcomingOnly" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="load(1)">Применить</el-button>
        <el-button @click="reset">Сбросить</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="rows" v-loading="loading" stripe border>
      <el-table-column label="Дата" width="180">
        <template #default="{ row }">{{ formatDate(row.date) }}</template>
      </el-table-column>
      <el-table-column label="Дело" width="200">
        <template #default="{ row }">
          <div>{{ row.Case?.caseNumber || '—' }}</div>
          <div style="color: #888; font-size: 12px">{{ row.Case?.status || '' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="court" label="Суд" />
      <el-table-column prop="judge" label="Судья" width="200" />
      <el-table-column prop="description" label="Описание" />
      <el-table-column label="Пойду" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.iWillGo" type="success" size="small">да</el-tag>
          <el-tag v-else type="info" size="small">нет</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Авто" width="80">
        <template #default="{ row }">
          <el-tooltip v-if="row.isAutoChecked" :content="`Поставлено автоматически: ${formatDate(row.autoCheckedTime)}`" placement="top">
            <el-tag type="warning" size="small">auto</el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="Время авто-простановки" width="200">
        <template #default="{ row }">
          <span v-if="row.isAutoChecked" style="font-size: 12px">{{ formatDate(row.autoCheckedTime) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="!filters.upcomingOnly"
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
import { api, formatDate } from '../api';

const rows = ref([]);
const total = ref(0);
const page = ref(1);
const size = ref(30);
const loading = ref(false);

const filters = reactive({
  dateFrom: '',
  dateTo: '',
  court: '',
  judge: '',
  upcomingOnly: true,
});

async function load(p) {
  if (p) page.value = p;
  loading.value = true;
  try {
    if (filters.upcomingOnly) {
      const { data } = await api.get('/sessions/upcoming', { params: { size: size.value } });
      rows.value = data.items;
      total.value = data.total;
      return;
    }
    const params = { page: page.value, size: size.value };
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.court) params.court = filters.court;
    if (filters.judge) params.judge = filters.judge;
    const { data } = await api.get('/sessions', { params });
    rows.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function reset() {
  filters.dateFrom = '';
  filters.dateTo = '';
  filters.court = '';
  filters.judge = '';
  filters.upcomingOnly = true;
  load(1);
}

onMounted(load);
</script>
