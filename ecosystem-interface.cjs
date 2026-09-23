module.exports = {
    apps: [
        {
            name: 'grand-pravo',
            script: 'server.js',
            cwd: '/home/user/grand-pravo',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            max_restarts: 10,
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'production',
                PORT: 3001,
            },
            // .env подхватится автоматически из cwd, dotenv сам его найдёт
            log_file: '/home/user/grand-pravo-logs/combined.log',
            error_file: '/home/user/grand-pravo-logs/error.log',
            out_file: '/home/user/grand-pravo-logs/out.log',
            time: true,
            merge_logs: true,
        },
    ],
};