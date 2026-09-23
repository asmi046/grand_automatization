const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const PROJECT_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

function loadJsonConfig() {
  const configPath = path.join(PROJECT_ROOT, 'config', 'default.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function normalizeEnvValue(raw) {
  if (typeof raw !== 'string') return raw;
  let v = raw.trim();
  while (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (/^=[=+\-@]/.test(v)) v = v.slice(1);
  return v.trim();
}

function requireEnv(name) {
  const value = normalizeEnvValue(process.env[name]);
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Add it to .env (see .env.example).`,
    );
  }
  return value;
}

function optionalEnv(name, def) {
  const value = normalizeEnvValue(process.env[name]);
  return value === '' || value == null ? def : value;
}

function boolEnv(name, def) {
  const v = optionalEnv(name, '');
  if (v === '') return def;
  return /^(1|true|yes|on)$/i.test(v);
}

const fileConfig = loadJsonConfig();

const config = {
  pravo: {
    ...fileConfig.pravo,
    baseUrl: requireEnv('PRAVO_BASE_URL').replace(/\/+$/, ''),
    login: requireEnv('PRAVO_LOGIN'),
    password: requireEnv('PRAVO_PASSWORD'),
  },
  leadertask: (() => {
    const enabled = boolEnv('LEADERTASK_ENABLED', fileConfig.leadertask.enabled);
    return {
      ...fileConfig.leadertask,
      enabled,
      baseUrl: enabled
        ? requireEnv('LEADERTASK_BASE_URL').replace(/\/+$/, '')
        : optionalEnv('LEADERTASK_BASE_URL', fileConfig.leadertask.baseUrl || '').replace(/\/+$/, ''),
      login: optionalEnv('LEADERTASK_LOGIN', ''),
      password: optionalEnv('LEADERTASK_PASSWORD', ''),
    };
  })(),
  db: {
    ...fileConfig.db,
    host: requireEnv('DB_HOST'),
    port: Number(requireEnv('DB_PORT')),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
  },
  web: {
    ...fileConfig.web,
    username: requireEnv('WEB_USERNAME'),
    password: requireEnv('WEB_PASSWORD'),
    sessionSecret: requireEnv('SESSION_SECRET'),
    session: {
      ...fileConfig.web.session,
      secure: boolEnv('WEB_SESSION_SECURE', fileConfig.web.session.secure),
    },
  },
};

module.exports = config;
