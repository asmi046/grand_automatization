import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import ru from 'element-plus/es/locale/lang/ru';
import * as ElIcons from '@element-plus/icons-vue';
import App from './App.vue';
import LoginView from './views/LoginView.vue';
import CasesView from './views/CasesView.vue';
import SessionsView from './views/SessionsView.vue';
import EventsView from './views/EventsView.vue';
import ChecksView from './views/ChecksView.vue';
import SyncView from './views/SyncView.vue';
import { auth, checkAuth } from './auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, name: 'login', meta: { public: true } },
    { path: '/', redirect: '/sync' },
    { path: '/sync', component: SyncView, name: 'sync' },
    { path: '/cases', component: CasesView, name: 'cases' },
    { path: '/sessions', component: SessionsView, name: 'sessions' },
    { path: '/events', component: EventsView, name: 'events' },
    { path: '/checks', component: ChecksView, name: 'checks' },
  ],
});

router.beforeEach(async (to) => {
  if (!auth.ready) await checkAuth();
  if (to.meta.public) return true;
  if (!auth.authenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  return true;
});

const app = createApp(App);
app.use(router);
app.use(ElementPlus, { locale: ru });
for (const [name, comp] of Object.entries(ElIcons)) {
  app.component(name, comp);
}
app.mount('#app');
