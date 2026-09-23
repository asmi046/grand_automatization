<template>
  <div v-loading="loading">
    <div style="margin-bottom: 16px">
      <el-button @click="goBack" size="small" plain>
        <el-icon><ArrowLeft /></el-icon>
        <span style="margin-left: 4px">К списку дел</span>
      </el-button>
    </div>

    <template v-if="caseRow">
      <el-card shadow="never" style="margin-bottom: 16px">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap">
          <div>
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
              <h2 style="margin: 0">{{ caseRow.caseNumber || '—' }}</h2>
              <el-tag v-if="caseRow.isMonitored" type="success" size="small">мониторинг</el-tag>
              <el-tag v-if="caseRow.status" size="small" effect="plain">{{ caseRow.status }}</el-tag>
            </div>
            <div style="color: #888; font-size: 12px; font-family: ui-monospace, monospace; margin-top: 6px">
              {{ caseRow.caseId }}
            </div>
          </div>
          <div style="display: flex; gap: 8px">
            <el-button
              tag="a"
              :href="`https://dela.pravo.tech/card/case/review/${caseRow.caseId}`"
              target="_blank"
              type="primary"
              plain
            >
              <el-icon><Link /></el-icon>
              <span style="margin-left: 4px">Открыть в Право</span>
            </el-button>
          </div>
        </div>
      </el-card>

      <el-row :gutter="16" style="margin-bottom: 16px">
        <el-col :xs="24" :md="12">
          <el-card shadow="never" header="Основные сведения">
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="Суд">{{ caseRow.courtName || '—' }}</el-descriptions-item>
              <el-descriptions-item label="Судья">{{ caseRow.judgeName || '—' }}</el-descriptions-item>
              <el-descriptions-item label="Тип дела">{{ caseRow.caseTypeName || '—' }}</el-descriptions-item>
              <el-descriptions-item label="Код">{{ caseRow.caseTypeCode || '—' }}</el-descriptions-item>
              <el-descriptions-item label="Категория">{{ caseRow.caseCategory || '—' }}</el-descriptions-item>
              <el-descriptions-item label="Сумма иска">
                <span v-if="caseRow.claimSum != null">{{ formatMoney(caseRow.claimSum) }} ₽</span>
                <span v-else>—</span>
              </el-descriptions-item>
              <el-descriptions-item label="Группа">{{ caseRow.groupName || '—' }}</el-descriptions-item>
              <el-descriptions-item label="Обновлено (UTC)">{{ formatDate(caseRow.versionDateUtc) }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>

        <el-col :xs="24" :md="12">
          <el-card shadow="never" header="Стороны">
            <div v-if="!sides.length" style="color: #888">Нет данных о сторонах</div>
            <div v-for="group in sidesByRole" :key="group.role" style="margin-bottom: 12px">
              <div style="font-weight: 600; margin-bottom: 6px; color: #555">{{ group.role }}</div>
              <el-card
                v-for="(side, i) in group.items"
                :key="i"
                shadow="never"
                style="margin-bottom: 6px; background: #fafafa"
                body-style="padding: 10px 12px"
              >
                <div style="font-weight: 500">{{ side.shortName || side.name || '—' }}</div>
                <div v-if="side.shortName && side.name && side.shortName !== side.name" style="color: #666; font-size: 12px; margin-top: 2px">
                  {{ side.name }}
                </div>
                <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-top: 6px; font-size: 12px; color: #666">
                  <span v-if="side.inn">ИНН: {{ side.inn }}</span>
                  <span v-if="side.ogrn">ОГРН: {{ side.ogrn }}</span>
                </div>
                <div v-if="side.address" style="margin-top: 4px; font-size: 12px; color: #666">📍 {{ side.address }}</div>
              </el-card>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-card v-if="caseRow.comment" shadow="never" header="Комментарий" style="margin-bottom: 16px">
        <div style="white-space: pre-wrap; line-height: 1.5">{{ caseRow.comment }}</div>
      </el-card>

      <el-card shadow="never" header="Заседания">
        <div v-if="sessionsLoading" v-loading="true" style="min-height: 60px"></div>
        <div v-else-if="!sessions.length" style="color: #888">Заседаний пока нет</div>
        <el-table v-else :data="sessions" stripe size="small">
          <el-table-column label="Дата" width="190">
            <template #default="{ row }">{{ formatDate(row.date) }}</template>
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
          <el-table-column label="В LeaderTask" width="120">
            <template #default="{ row }">
              <el-tag v-if="row.loadToLiderTask" type="success" size="small">да</el-tag>
              <el-tag v-else type="info" size="small">нет</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>

    <el-empty v-else-if="!loading" description="Дело не найдено" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Link } from '@element-plus/icons-vue';
import { api, formatDate } from '../api';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const sessionsLoading = ref(false);
const caseRow = ref(null);
const sessions = ref([]);

const sides = computed(() => (Array.isArray(caseRow.value?.caseSides) ? caseRow.value.caseSides : []));

const sidesByRole = computed(() => {
  const s = sides.value;
  const groups = { Plaintiff: [], Respondent: [], Other: [] };
  for (const side of s) {
    const role =
      side?.typeEnum === 'Plaintiff' || side?.nSideTypeEnum === 'Plaintiff'
        ? 'Plaintiff'
        : side?.typeEnum === 'Respondent' || side?.nSideTypeEnum === 'Respondent' || side?.type === 1
          ? 'Respondent'
          : 'Other';
    groups[role].push(side);
  }
  const labels = { Plaintiff: 'Истец', Respondent: 'Ответчик', Other: 'Другие' };
  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([role, items]) => ({ role: labels[role], items }));
});

function formatMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function goBack() {
  if (window.history.length > 1) router.back();
  else router.push('/cases');
}

async function loadCase() {
  const caseId = route.params.caseId;
  if (!caseId) return;
  loading.value = true;
  caseRow.value = null;
  sessions.value = [];
  try {
    const { data } = await api.get(`/cases/${encodeURIComponent(caseId)}`);
    caseRow.value = data;
  } catch (err) {
    if (err.response?.status === 404) caseRow.value = null;
    else throw err;
  } finally {
    loading.value = false;
  }
}

async function loadSessions() {
  const caseId = route.params.caseId;
  if (!caseId) return;
  sessionsLoading.value = true;
  try {
    const { data } = await api.get('/sessions', { params: { caseId, size: 200 } });
    sessions.value = (data.items ?? []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch {
    sessions.value = [];
  } finally {
    sessionsLoading.value = false;
  }
}

onMounted(async () => {
  await loadCase();
  if (caseRow.value) await loadSessions();
});

watch(
  () => route.params.caseId,
  async () => {
    await loadCase();
    if (caseRow.value) await loadSessions();
  },
);
</script>

<style scoped>
.el-descriptions :deep(table) {
  width: 100%;
}
</style>
