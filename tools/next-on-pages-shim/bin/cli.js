#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

console.log('⚡️ @cloudflare/next-on-pages CLI v.1.13.16 (local shim)');
console.log('⚡️ Delegating to OpenNext Pages build pipeline...');

const result = spawnSync('npm', ['run', 'cf:pages:build'], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
