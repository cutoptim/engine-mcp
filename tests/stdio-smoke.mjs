// Starts the built server (dist/cli.js) over stdio with no API key and checks the MCP handshake and the tool list.
// No network: tools/list never calls the API. Run after `npm run build`: node tests/stdio-smoke.mjs
import { spawn } from 'node:child_process';

const EXPECTED = ['optimize_2d', 'optimize_1d', 'optimize_wood', 'optimize_nest', 'validate_2d', 'validate_1d', 'validate_wood', 'validate_nest', 'get_job', 'get_usage'];
const child = spawn(process.execPath, ['dist/cli.js'], { stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, CUTOPTIM_API_KEY: '' } });
const send = (msg) => child.stdin.write(JSON.stringify(msg) + '\n');
const timer = setTimeout(() => { console.error('stdio smoke: timeout'); child.kill(); process.exit(1); }, 15000);

let buf = '';
child.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.id === 1) {
      if (msg.result?.serverInfo?.name !== 'cutoptim') fail(`unexpected initialize answer: ${line}`);
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    } else if (msg.id === 2) {
      const names = (msg.result?.tools ?? []).map((t) => t.name);
      if (JSON.stringify(names) !== JSON.stringify(EXPECTED)) fail(`tool list differs: ${names.join(',')}`);
      console.log(`stdio smoke ok: ${names.length} tools`);
      clearTimeout(timer); child.kill(); process.exit(0);
    }
  }
});
function fail(m) { console.error(`stdio smoke: ${m}`); child.kill(); process.exit(1); }

send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'stdio-smoke', version: '0' } } });
