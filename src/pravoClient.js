const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const tough = require('tough-cookie');
const config = require('./config');

class PravoError extends Error {
  constructor(status, body) {
    const text =
      typeof body === 'string'
        ? body.slice(0, 500)
        : JSON.stringify(body).slice(0, 500);
    super(`Pravo ${status}: ${text}`);
    this.name = 'PravoError';
    this.status = status;
    this.body = body;
  }
}

class PravoClient {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || config.pravo.baseUrl).replace(/\/+$/, '');
    this.timeout = options.timeout || config.pravo.requestTimeoutMs;
    this.defaultHeaders = options.defaultHeaders || config.pravo.defaultHeaders;
    this.debug = options.debug ?? config.pravo.debug ?? false;

    this.jar = new tough.CookieJar();

    this.http = wrapper(
      axios.create({
        baseURL: this.baseUrl,
        timeout: this.timeout,
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
          ...this.defaultHeaders,
        },
        jar: this.jar,
        withCredentials: true,
        validateStatus: () => true,
        transitional: {
          silentJSONParsing: false,
          forcedJSONParsing: true,
        },
      }),
    );

    if (this.debug) {
      this.http.interceptors.request.use((req) => {
        const body =
          typeof req.data === 'string' ? req.data : JSON.stringify(req.data);
        console.log(
          `\n>>> ${req.method?.toUpperCase()} ${this.baseUrl}${req.url}`,
        );
        console.log('>>> Headers:', JSON.stringify(req.headers, null, 2));
        console.log('>>> Body:', body);
        return req;
      });
      this.http.interceptors.response.use((res) => {
        console.log(
          `<<< ${res.status} ${res.config.method?.toUpperCase()} ${res.config.url}`,
        );
        return res;
      });
    }

    this.isAuthenticated = false;
    this.profile = null;
  }

  _dumpCookies(label) {
    const cookies = this.jar.getCookiesSync(this.baseUrl);
    console.log(`\n[cookies after: ${label}] (${cookies.length})`);
    for (const c of cookies) {
      const v = c.value.length > 40 ? `${c.value.slice(0, 40)}...` : c.value;
      console.log(`  ${c.key} = ${v}`);
    }
  }

  _handle(res) {
    if (res.status >= 200 && res.status < 300) {
      const data = res.data;
      if (data && typeof data === 'object' && data.success === false) {
        throw new PravoError(res.status, data);
      }
      return data;
    }
    throw new PravoError(res.status, res.data);
  }

  async login({ login, password, rememberMe = true } = {}) {
    const payload = {
      email: login || config.pravo.login,
      password: password || config.pravo.password,
      rememberMe,
    };

    const res = await this.http.post(config.pravo.loginPath, payload);
    const data = this._handle(res);

    if (!data?.success) {
      throw new PravoError(res.status, data);
    }

    this.isAuthenticated = true;
    this.profile = data?.result ?? null;
    return data;
  }

  async getProfile() {
    const res = await this.http.post(config.pravo.profilePath, {});
    return this._handle(res);
  }

  async listGroups(payload = {}) {
    const res = await this.http.get(config.pravo.listGroupsPath);
    return this._handle(res);
  }

  extractCasesFolders(groupsResponse) {
    const groups = groupsResponse?.result || groupsResponse?.Result || [];
    const out = [];
    for (const g of groups) {
      const folders = g.folders || g.Folders || [];
      for (const f of folders) {
        if ((f.folderType || f.FolderType) === 'Cases') {
          out.push({
            groupId: g.id ?? g.Id,
            groupName: g.name ?? g.Name,
            folderId: f.id ?? f.Id,
            entitiesCount: f.entitiesCount ?? f.EntitiesCount,
            isNeedTracking: f.isNeedTracking ?? f.IsNeedTracking ?? false,
          });
        }
      }
    }
    return out;
  }

  async folderCases(folderId, { searchRequest, page = 1, count = 30 } = {}) {
    const payload = {
      id: folderId,
      searchRequest: searchRequest ?? {
        condition: 'and',
        items: [],
        sorts: [
          { field: 'StartDate', order: 'Descending' },
          { field: 'CaseNumber', order: 'Descending' },
        ],
      },
      page,
      count,
    };
    const res = await this.http.post(config.pravo.folderCasesPath, payload);
    return this._handle(res);
  }

  async get(path, params = {}) {
    const res = await this.http.get(path, { params });
    return this._handle(res);
  }

  async iWillGo(sessionId) {
    const res = await this.http.post(config.pravo.iWillGoPath, { sessionId });
    return this._handle(res);
  }

  async listCaseEvents(caseId, {
    dateFrom,
    dateTo = null,
    eventTypes = ['AllSessions'],
    page = 1,
    count = 50,
  } = {}) {
    const payload = {
      caseId,
      eventFilter: {
        dateFilter: { dateFrom, dateTo },
        eventTypes,
      },
      paging: { page, count },
      sort: [{ field: 'Date', order: 'Ascending', index: 0 }],
    };
    const res = await this.http.post(config.pravo.caseEventsPath, payload, {
      headers: { Referer: `https://dela.pravo.tech/card/case/review/${caseId}` },
    });
    return this._handle(res);
  }

  async post(path, payload = {}, extraHeaders = {}) {
    const res = await this.http.post(path, payload, { headers: extraHeaders });
    return this._handle(res);
  }

  async getCookiesAsHeader() {
    const cookies = this.jar.getCookiesSync(this.baseUrl);
    return cookies.map((c) => `${c.key}=${c.value}`).join('; ');
  }
}

module.exports = { PravoClient, PravoError };
