// PM2 process definition. Previously started via a bare `pm2 start server.js`
// (fork mode, 1 process) -- every deploy's `pm2 restart` briefly dropped the
// listening port entirely. Cluster mode with 2 instances + `pm2 reload`
// (instead of `pm2 restart`) keeps at least one worker serving throughout a
// deploy. Real-time features only work correctly across multiple workers
// because server.js wires up a Redis-backed Socket.IO adapter -- see the
// comment there before ever bumping `instances` further or reverting to fork
// mode without also reverting that.
module.exports = {
  apps: [
    {
      name: 'habibi-backend',
      script: 'server.js',
      exec_mode: 'cluster',
      instances: 2,
      watch: false,
    },
  ],
};
