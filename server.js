const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const config = require('./src/config');
const { initSchema } = require('./src/db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use(
  session({
    name: config.web.session.cookieName,
    secret: config.web.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: config.web.session.maxAgeMs,
    },
  }),
);

app.use('/api/auth', require('./src/api/routes/auth'));

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use('/api/cases', requireAuth, require('./src/api/routes/cases'));
app.use('/api/sessions', requireAuth, require('./src/api/routes/sessions'));
app.use('/api/events', requireAuth, require('./src/api/routes/events'));
app.use('/api/checks', requireAuth, require('./src/api/routes/checks'));
app.use('/api/sync', requireAuth, require('./src/api/routes/sync'));

app.use((err, req, res, next) => {
  console.error('[api error]', err);
  res.status(500).json({ error: err.message });
});

const spaDist = path.resolve(__dirname, 'web', 'dist');
if (fs.existsSync(spaDist)) {
  app.use(express.static(spaDist));

  app.get('/login', (req, res) =>
    res.sendFile(path.join(spaDist, 'index.html')),
  );

  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    if (req.session && req.session.user) {
      return res.sendFile(path.join(spaDist, 'index.html'));
    }
    res.redirect('/login');
  });
} else {
  app.get('/', (req, res) => {
    res.send('API is running. Build the SPA with `npm run build:web` to enable the UI.');
  });
}

(async () => {
  try {
    await initSchema();
    console.log('[server] DB schema synced.');
    app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));
  } catch (err) {
    console.error('[server] failed to start:', err);
    process.exit(1);
  }
})();
