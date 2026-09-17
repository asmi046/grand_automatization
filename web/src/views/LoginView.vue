<template>
  <div class="login-page">
    <el-card class="login-card" shadow="always">
      <h2 style="text-align: center; margin-top: 0">Grand Pravo</h2>
      <p style="text-align: center; color: #888; margin-bottom: 24px">Вход в панель мониторинга</p>
      <el-form @submit.prevent="submit" :model="form" label-position="top">
        <el-form-item label="Логин">
          <el-input v-model="form.username" :prefix-icon="User" autofocus @keyup.enter="submit" />
        </el-form-item>
        <el-form-item label="Пароль">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            :prefix-icon="Lock"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-alert v-if="error" type="error" :title="error" :closable="false" style="margin-bottom: 16px" />
        <el-button type="primary" native-type="submit" :loading="loading" style="width: 100%">
          Войти
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { User, Lock } from '@element-plus/icons-vue';
import { api } from '../api';
import { setAuthenticated } from '../auth';

const router = useRouter();
const route = useRoute();
const form = reactive({ username: '', password: '' });
const loading = ref(false);
const error = ref('');

async function submit() {
  if (!form.username || !form.password) {
    error.value = 'Введите логин и пароль';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.post('/auth/login', form);
    setAuthenticated(data.user || { username: form.username });
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    router.replace(redirect);
  } catch (e) {
    console.error('[login error]', e);
    if (e.response?.status === 401) {
      error.value = 'Неверный логин или пароль';
    } else if (e.code === 'ERR_NETWORK' || !e.response) {
      error.value = `Ошибка соединения: ${e.message || 'сервер недоступен'}. Проверьте, что бэкенд запущен (npm start) и SPA собрана (npm run build:web).`;
    } else {
      error.value = `Ошибка: ${e.response?.status} ${e.message}`;
    }
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #001428 0%, #1f3a5f 100%);
}
.login-card {
  width: 380px;
  padding: 12px 8px;
}
</style>
