import { readFileSync, realpathSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';
const fixture = JSON.parse(readFileSync(path.join(process.env.STATION5_PRIVATE_ROOT, 'fixture-location.json'), 'utf8'));
const folder = realpathSync(fixture.folder);
if (!fixture.station5 || !fixture.synthetic || path.dirname(folder) !== path.resolve(tmpdir()) || !path.basename(folder).startsWith('nmt-station5-') || path.resolve(fixture.database) !== path.join(folder, 'qa.db')) throw Error('Refusing non-fixture database');
const child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3155'], { env: { ...process.env, DATABASE_URL: 'file:' + fixture.database.replaceAll('\\', '/') + '?connection_limit=1', NEXT_TELEMETRY_DISABLED: '1' }, stdio: 'inherit', windowsHide: true });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (process.platform === 'win32' && child.pid) spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  else child.kill(signal);
});
child.on('exit', code => process.exit(code ?? 1));
