<template>
  <router-view v-if="isPublic" />
  <el-container v-else style="height: 100vh">
    <el-aside width="220px" style="background: #001428; color: #fff">
      <div style="padding: 20px; font-size: 18px; font-weight: bold; text-align: center">
        Grand Pravo
      </div>
      <el-menu
        :default-active="route.name"
        router
        background-color="#001428"
        text-color="#cfd3dc"
        active-text-color="#409EFF"
      >
        <el-menu-item index="sessions">
          <el-icon><Calendar /></el-icon>
          <span>Заседания</span>
        </el-menu-item>
        <el-menu-item index="cases">
          <el-icon><Folder /></el-icon>
          <span>Дела</span>
        </el-menu-item>
        <el-menu-item index="events">
          <el-icon><Bell /></el-icon>
          <span>События</span>
        </el-menu-item>
        <el-menu-item index="sync">
          <el-icon><VideoPlay /></el-icon>
          <span>Запуск</span>
        </el-menu-item>
        <el-menu-item index="checks">
          <el-icon><Document /></el-icon>
          <span>Прогоны</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header style="background: #fff; border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: space-between">
        <h2 style="margin: 0; line-height: 60px">{{ headerTitle }}</h2>
        <div>
          <span style="color: #888; margin-right: 12px">{{ auth.user?.username }}</span>
          <el-button size="small" @click="onLogout">Выйти</el-button>
        </div>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { auth, logout } from './auth';

const route = useRoute();
const router = useRouter();
const isPublic = computed(() => route.meta?.public === true);

const titles = {
  sessions: 'Ближайшие заседания',
  cases: 'Отслеживаемые дела',
  events: 'Журнал событий',
  checks: 'История прогонов',
  sync: 'Запуск прогона',
};
const headerTitle = computed(() => {
  if (route.name === 'case-detail') return `Дело: ${route.params.caseId}`;
  return titles[route.name] || '';
});

async function onLogout() {
  await logout();
  router.replace('/login');
}
</script>

<style>
html, body, #app { margin: 0; padding: 0; height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
</style>
