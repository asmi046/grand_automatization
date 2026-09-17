const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const { EventEmitter } = require('events');

const router = express.Router();

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

const state = {
  running: false,
  checkId: null,
  exitCode: null,
  startedAt: null,
  endedAt: null,
  lines: [],
};

function append(text) {
  state.lines.push(text);
  emitter.emit('line', text);
}

function reset() {
  state.running = false;
  state.checkId = null;
  state.exitCode = null;
  state.startedAt = null;
  state.endedAt = null;
  state.lines = [];
}

router.post('/run', (req, res) => {
  if (state.running) {
    return res.status(409).json({ error: 'Sync уже выполняется', checkId: state.checkId });
  }
  reset();

  const env = { ...process.env };
  if (req.body && req.body.clearDb === true) {
    env.DB_CLEAR_BEFORE_SYNC = 'true';
  }

  state.running = true;
  state.startedAt = new Date();

  const child = spawn('node', ['src/index.js'], {
    cwd: path.resolve(__dirname, '..', '..', '..'),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const onChunk = (stream) => (chunk) => {
    const text = chunk.toString();
    const m = text.match(/Check started: ([a-f0-9-]+)/);
    if (m) state.checkId = m[1];
    if (stream === 'stderr' && !state.checkId) {
      const m2 = text.match(/Check (?:started|failed|completed): ([a-f0-9-]+)/);
      if (m2) state.checkId = m2[1];
    }
    append(text);
  };
  child.stdout.on('data', onChunk('stdout'));
  child.stderr.on('data', onChunk('stderr'));

  child.on('error', (err) => {
    append(`\n[spawn error] ${err.message}\n`);
  });

  child.on('exit', (code) => {
    state.running = false;
    state.exitCode = code;
    state.endedAt = new Date();
    append(`\n[exit code: ${code}]\n`);
    emitter.emit('done', { checkId: state.checkId, exitCode: code });
  });

  res.status(202).json({ ok: true, startedAt: state.startedAt });
});

router.get('/status', (req, res) => {
  res.json({
    running: state.running,
    checkId: state.checkId,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    exitCode: state.exitCode,
    lineCount: state.lines.length,
  });
});

router.get('/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  for (const line of state.lines) {
    res.write(`data: ${JSON.stringify(line)}\n\n`);
  }

  if (!state.running) {
    res.write(
      `event: done\ndata: ${JSON.stringify({
        checkId: state.checkId,
        exitCode: state.exitCode,
      })}\n\n`,
    );
    return res.end();
  }

  const onLine = (line) => {
    res.write(`data: ${JSON.stringify(line)}\n\n`);
  };
  const onDone = (info) => {
    res.write(`event: done\ndata: ${JSON.stringify(info)}\n\n`);
    res.end();
  };

  emitter.on('line', onLine);
  emitter.once('done', onDone);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    emitter.off('line', onLine);
    emitter.off('done', onDone);
  });
});

module.exports = router;
