module.exports = {
  apps: [
    {
      name: 'grand-pravo-sync',
      script: 'index.js',
      cwd: '/home/user/grand-pravo',
      cron_restart: '*/3 * * * *',
      autorestart: false,
      exec_interpreter: 'node',
      max_memory_restart: '512M',
      out_file: '/home/user/grand-pravo-logs/sync.out.log',
      error_file: '/home/user/grand-pravo-logs/sync.err.log',
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
