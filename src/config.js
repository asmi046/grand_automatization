const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function loadJsonConfig() {
  const configPath = path.resolve(process.cwd(), 'config', 'default.json');
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

const fileConfig = loadJsonConfig();

const config = {
  pravo: {
    ...fileConfig.pravo,
    baseUrl: requireEnv('PRAVO_BASE_URL').replace(/\/+$/, ''),
    login: requireEnv('PRAVO_LOGIN'),
    password: requireEnv('PRAVO_PASSWORD'),
  },
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
  },
};

module.exports = config;
