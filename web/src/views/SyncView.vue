<template>
  <div>
    <el-card>
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <strong>Запуск прогона</strong>
          <el-tag v-if="status.running" type="warning">выполняется…</el-tag>
          <el-tag v-else-if="status.exitCode === 0" type="success">завершён (ok)</el-tag>
          <el-tag v-else-if="status.exitCode != null" type="danger">завершён (код {{ status.exitCode }})</el-tag>
          <el-tag v-else type="info">простаивает</el-tag>
        </div>
      </template>

      <el-form :inline="true">
        <el-form-item label="Очистить БД перед прогоном">
          <el-switch v-model="clearDb" />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :disabled="status.running"
            :loading="status.running"
            @click="run"
          >
            {{ status.running ? 'Выполняется…' : 'Запустить' }}
          </el-button>
          <el-button @click="clearLog" :disabled="status.running">Очистить лог</el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="lastCheckId"
        type="success"
        :closable="false"
        style="margin-bottom: 12px"
      >
        Прогон завершён:
        <router-link :to="`/checks`" style="color: var(--el-color-primary)">
          {{ lastCheckId.slice(0, 8) }}… (открыть в «Прогоны»)
        </router-link>
      </el-alert>
    </el-card>

    <el-card style="margin-top: 16px">
      <template #header>Лог</template>
      <pre ref="logEl" class="log">{{ displayed }}</pre>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { api } from '../api';

const clearDb = ref(false);
const log = ref('');
const status = reactive({ running: false, checkId: null, exitCode: null });
const lastCheckId = ref(null);
const logEl = ref(null);

let eventSource = null;
let pollHandle = null;

const displayed = computed(() => log.value || '(пусто)');

async function refreshStatus() {
  try {
    const { data } = await api.get('/sync/status');
    Object.assign(status, data);
  } catch (e) {
    console.error(e);
  }
}

function append(chunk) {
  log.value += chunk;
  nextTick(() => {
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight;
  });
}

function clearLog() {
  log.value = '';
}

async function run() {
  clearLog();
  lastCheckId.value = null;
  try {
    await api.post('/sync/run', { clearDb: clearDb.value });
    await refreshStatus();
    openStream();
  } catch (e) {
    if (e.response?.status === 409) {
      append(`\n[error] ${e.response.data.error}\n`);
      await refreshStatus();
      openStream();
    } else {
      append(`\n[error] ${e.message}\n`);
    }
  }
}

function openStream() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource('/api/sync/stream');

  eventSource.onmessage = (ev) => {
    try {
      append(JSON.parse(ev.data));
    } catch {
      append(ev.data);
    }
  };
  eventSource.addEventListener('done', async (ev) => {
    try {
      const info = JSON.parse(ev.data);
      if (info.checkId) lastCheckId.value = info.checkId;
    } catch {}
    await refreshStatus();
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  });
  eventSource.onerror = () => {
    // EventSource auto-reconnects; ignore
  };
}

onMounted(async () => {
  await refreshStatus();
  pollHandle = setInterval(refreshStatus, 2000);
  if (status.running) openStream();
});

onUnmounted(() => {
  if (eventSource) eventSource.close();
  if (pollHandle) clearInterval(pollHandle);
});
</script>

<style scoped>
.log {
  background: #0b1220;
  color: #d6deeb;
  padding: 12px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  max-height: 60vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>
