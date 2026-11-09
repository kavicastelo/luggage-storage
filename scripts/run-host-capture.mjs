import { spawn } from 'node:child_process';
import http from 'node:http';

function waitForServer(url, timeoutMs = 20000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      http
        .get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            retry();
          }
        })
        .on('error', () => {
          retry();
        });
    }

    function retry() {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Timeout waiting for ${url}`));
      } else {
        setTimeout(check, 400);
      }
    }

    check();
  });
}

async function main() {
  console.log('Starting Vite preview server on port 5173...');
  const server = spawn('cmd.exe', ['/c', 'pnpm', '--filter', '@luggage-storage/web', 'preview', '--port', '5173'], {
    stdio: 'inherit',
    env: process.env,
  });

  try {
    await waitForServer('http://localhost:5173');
    console.log('Server is ready. Spawning capture script...');

    await new Promise((resolve, reject) => {
      const capture = spawn('node', ['scripts/capture-host-web.mjs'], {
        stdio: 'inherit',
        env: process.env,
      });

      capture.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Capture script exited with code ${code}`));
      });
      capture.on('error', reject);
    });

    console.log('Screenshot capture finished successfully.');
  } finally {
    console.log('Stopping preview server...');
    // Kill child processes on Windows
    spawn('cmd.exe', ['/c', 'taskkill', '/F', '/T', '/PID', String(server.pid)], {
      stdio: 'ignore',
    });
  }
}

main().catch((err) => {
  console.error('Capture pipeline failed:', err);
  process.exit(1);
});
