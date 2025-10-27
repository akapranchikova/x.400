import http from 'node:http';
import { once } from 'node:events';

const PORT = 4123;
const TOTAL_REQUESTS = 200;
const CONCURRENCY = 20;

async function runSmoke() {
  const server = http.createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  });
  server.listen(PORT);
  await once(server, 'listening');

  let next = 0;
  const durations = [];

  const worker = async () => {
    while (true) {
      const current = next;
      next += 1;
      if (current >= TOTAL_REQUESTS) {
        return;
      }
      const started = performance.now();
      const response = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (!response.ok) {
        throw new Error(`Health request failed with status ${response.status}`);
      }
      await response.json();
      durations.push(performance.now() - started);
    }
  };

  const workers = Array.from({ length: CONCURRENCY }, () => worker());

  try {
    await Promise.all(workers);
  } finally {
    server.close();
  }

  durations.sort((a, b) => a - b);
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;

  console.log(`Health endpoint latency average: ${average.toFixed(2)}ms (p95=${p95.toFixed(2)}ms)`);

  if (p95 > 60) {
    throw new Error(`Latency regression detected (p95=${p95.toFixed(2)}ms)`);
  }
  if (average > 25) {
    throw new Error(`Average latency too high (${average.toFixed(2)}ms)`);
  }
}

runSmoke().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
