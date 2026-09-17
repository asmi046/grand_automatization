const express = require('express');
const config = require('../../config');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username !== config.web.username ||
    password !== config.web.password
  ) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  req.session.user = { username };
  res.json({ ok: true, user: req.session.user });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(config.web.session.cookieName);
    res.json({ ok: true });
  });
});

router.get('/status', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ authenticated: true, user: req.session.user });
  }
  res.status(401).json({ authenticated: false });
});

module.exports = router;
