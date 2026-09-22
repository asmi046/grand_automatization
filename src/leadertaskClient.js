const axios = require('axios');
const { randomUUID } = require('crypto');
const config = require('./config');

class LeaderTaskError extends Error {
  constructor(status, body) {
    const text =
      typeof body === 'string'
        ? body.slice(0, 500)
        : JSON.stringify(body).slice(0, 500);
    super(`LeaderTask ${status}: ${text}`);
    this.name = 'LeaderTaskError';
    this.status = status;
    this.body = body;
  }
}

class LeaderTaskClient {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || config.leadertask.baseUrl).replace(/\/+$/, '');
    this.apiPrefix = options.apiPrefix ?? config.leadertask.apiPrefix;
    this.timeout = options.timeout || config.leadertask.requestTimeoutMs;
    this.defaultHeaders = options.defaultHeaders || config.leadertask.defaultHeaders;
    this.debug = options.debug ?? config.leadertask.debug ?? false;

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...this.defaultHeaders,
      },
      validateStatus: () => true,
      transitional: {
        silentJSONParsing: false,
        forcedJSONParsing: true,
      },
    });

    if (this.debug) {
      this.http.interceptors.request.use((req) => {
        const body =
          typeof req.data === 'string' ? req.data : JSON.stringify(req.data);
        console.log(
          `\n>>> ${req.method?.toUpperCase()} ${this.baseUrl}${req.url}`,
        );
        console.log('>>> Headers:', JSON.stringify(req.headers, null, 2));
        if (body) console.log('>>> Body:', body);
        return req;
      });
      this.http.interceptors.response.use((res) => {
        console.log(
          `<<< ${res.status} ${res.config.method?.toUpperCase()} ${res.config.url}`,
        );
        return res;
      });
    }

    this.accessToken = null;
    this.refreshToken = null;
    this.account = null;
  }

  _fullPath(path) {
    if (path.startsWith('http')) return path;
    const prefix = this.apiPrefix ?? '';
    if (path.startsWith(prefix)) return path;
    return `${prefix}${path.startsWith('/') ? path : `/${path}`}`;
  }

  _dumpTokens(label) {
    const mask = (t) => (t ? `${t.slice(0, 12)}…${t.slice(-6)}` : '—');
    console.log(`\n[tokens after: ${label}]`);
    console.log(`  access_token  = ${mask(this.accessToken)}`);
    console.log(`  refresh_token = ${mask(this.refreshToken)}`);
  }

  _handle(res) {
    if (res.status >= 200 && res.status < 300) {
      return res.data;
    }
    throw new LeaderTaskError(res.status, res.data);
  }

  setTokens({ access_token, refresh_token } = {}) {
    if (access_token) this.accessToken = access_token;
    if (refresh_token) this.refreshToken = refresh_token;
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.account = null;
  }

  _authHeaders(extra = {}) {
    const h = { ...extra };
    if (this.accessToken) h.Authorization = this.accessToken;
    if (this.refreshToken) h.RefreshToken = this.refreshToken;
    return h;
  }

  async login({ login, password, system, type_device } = {}) {
    const payload = {
      login: login ?? config.leadertask.login,
      password: password ?? config.leadertask.password,
      system: system ?? config.leadertask.system,
      type_device: type_device ?? config.leadertask.typeDevice,
    };

    if (!payload.login || !payload.password) {
      throw new Error(
        'LeaderTask: не задан login/password. Проверьте LEADERTASK_LOGIN и LEADERTASK_PASSWORD в .env.',
      );
    }

    const res = await this.http.post(this._fullPath(config.leadertask.authPath), payload);
    const data = this._handle(res);

    this.setTokens({
      access_token: data?.access_token,
      refresh_token: data?.refresh_token,
    });

    return data;
  }

  async refreshTokens() {
    if (!this.refreshToken) {
      throw new Error('LeaderTask: refresh_token отсутствует — сначала вызовите login()');
    }
    const res = await this.http.post(
      this._fullPath(config.leadertask.refreshPath),
      undefined,
      { headers: { RefreshToken: this.refreshToken } },
    );
    const data = this._handle(res);
    this.setTokens({
      access_token: data?.access_token,
      refresh_token: data?.refresh_token,
    });
    return data;
  }

  async exists(login) {
    const email = login ?? config.leadertask.login;
    const res = await this.http.get(this._fullPath(config.leadertask.existsPath), {
      params: { email },
    });
    return this._handle(res);
  }

  async accountInfo() {
    const res = await this.http.get(this._fullPath(config.leadertask.accountInfoPath), {
      headers: this._authHeaders(),
    });
    const data = this._handle(res);
    this.account = data;
    return data;
  }

  async logout() {
    const res = await this.http.get(this._fullPath(config.leadertask.accountExitPath), {
      headers: this._authHeaders(),
    });
    const data = this._handle(res);
    this.clearTokens();
    return data;
  }

  async rights() {
    const res = await this.http.get(this._fullPath(config.leadertask.accountRightsPath), {
      headers: this._authHeaders(),
    });
    return this._handle(res);
  }

  async navigatorInfo(localDate) {
    const date = localDate ?? formatLocalDate(new Date());
    const res = await this.http.get(this._fullPath(config.leadertask.navigatorInfoPath), {
      headers: this._authHeaders({ LocalDate: date }),
    });
    return this._handle(res);
  }

  async listTags(localDate) {
    const nav = await this.navigatorInfo(localDate);
    return nav?.tags?.items ?? nav?.tags?.Items ?? [];
  }

  findTagByName(tags, name) {
    const target = String(name).trim().toLowerCase();
    return (tags ?? []).find(
      (t) => String(t?.name ?? t?.Name ?? '').trim().toLowerCase() === target,
    );
  }

  async createTag(tag = {}, { localDate } = {}) {
    const ZERO_UID = '00000000-0000-0000-0000-000000000000';
    const payload = {
      uid_parent: tag.uid_parent ?? ZERO_UID,
      back_color: tag.back_color ?? tag.backColor ?? '#FFFFFF',
      comment: tag.comment ?? '',
      collapsed: tag.collapsed ?? 0,
      order: tag.order ?? 1,
      group: tag.group ?? 0,
      show: tag.show ?? 1,
      favorite: tag.favorite ?? 0,
      uid: tag.uid ?? randomUUID(),
      name: tag.name,
      bold: tag.bold ?? 0,
    };

    if (!payload.name) {
      throw new Error('LeaderTask.createTag: поле "name" обязательно');
    }

    const date = localDate ?? formatLocalDate(new Date());
    const res = await this.http.post(this._fullPath(config.leadertask.tagPath), payload, {
      headers: this._authHeaders({ LocalDate: date }),
    });
    return this._handle(res);
  }

  async ensureTag(name, { backColor = '#A020F0', localDate } = {}) {
    const tags = await this.listTags(localDate);
    const existing = this.findTagByName(tags, name);
    if (existing) {
      return { tag: existing, created: false };
    }
    const created = await this.createTag({ name, back_color: backColor }, { localDate });
    return { tag: created, created: true };
  }

  async createTask(task = {}, { localDate } = {}) {
    const ZERO_UID = '00000000-0000-0000-0000-000000000000';
    const nowIso = new Date().toISOString();

    const payload = {
      uid: task.uid ?? randomUUID(),
      uid_parent: task.uid_parent ?? ZERO_UID,
      uid_customer: task.uid_customer ?? ZERO_UID,
      uid_project: task.uid_project ?? ZERO_UID,
      date_create: task.date_create ?? nowIso,
      email_performer: task.email_performer ?? '',
      name: task.name,
      comment: task.comment ?? '',
      status: task.status ?? 0,
      order_new: task.order_new ?? 1.0,
      emails: task.emails ?? '',
      checklist: task.checklist ?? '',
      uid_marker: task.uid_marker ?? ZERO_UID,
      date_begin: task.date_begin ?? nowIso,
      date_reminder: task.date_reminder ?? '0001-01-01T00:00:00',
      date_end: task.date_end ?? nowIso,
      focus: task.focus ?? 1,
      tags: task.tags ?? [],
      ...task,
    };

    if (!payload.name) {
      throw new Error('LeaderTask.createTask: поле "name" обязательно');
    }

    const date = localDate ?? formatLocalDate(new Date());
    const res = await this.http.post(this._fullPath(config.leadertask.taskPath), payload, {
      headers: this._authHeaders({ LocalDate: date }),
    });
    return this._handle(res);
  }

  async get(path, { params, headers = {} } = {}) {
    const res = await this.http.get(this._fullPath(path), {
      params,
      headers: this._authHeaders(headers),
    });
    return this._handle(res);
  }

  async post(path, body = {}, { headers = {} } = {}) {
    const res = await this.http.post(this._fullPath(path), body, {
      headers: this._authHeaders(headers),
    });
    return this._handle(res);
  }

  async patch(path, body = {}, { headers = {} } = {}) {
    const res = await this.http.patch(this._fullPath(path), body, {
      headers: this._authHeaders(headers),
    });
    return this._handle(res);
  }

  async delete(path, { headers = {} } = {}) {
    const res = await this.http.delete(this._fullPath(path), {
      headers: this._authHeaders(headers),
    });
    return this._handle(res);
  }
}

function formatLocalDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

module.exports = { LeaderTaskClient, LeaderTaskError, formatLocalDate };
