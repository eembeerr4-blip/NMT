// Copy an explicitly identified synthetic fixture. No migrations, seed or working DB.
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync, backup } from 'node:sqlite';

const sourceFile = process.env.STATION5_SOURCE_FIXTURE;
const targetRoot = process.env.STATION5_PRIVATE_ROOT;
if (!sourceFile || !targetRoot || ![sourceFile, targetRoot].every(path.isAbsolute)) throw Error('Explicit absolute fixture paths required');
if (path.resolve(targetRoot).startsWith(process.cwd() + path.sep) || path.resolve(targetRoot) === process.cwd()) throw Error('Private metadata must stay outside the repository');
const metadataFile = path.join(targetRoot, 'fixture-location.json');
if (fs.existsSync(metadataFile)) throw Error('Existing fixture preserved; choose a fresh private directory');
const fixture = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
const sourceFolder = fs.realpathSync(fixture.folder);
if (!fixture.station5 || !fixture.synthetic || path.dirname(sourceFolder) !== fs.realpathSync(tmpdir()) || !path.basename(sourceFolder).startsWith('nmt-station5-') || fs.realpathSync(fixture.database) !== path.join(sourceFolder, 'qa.db')) throw Error('Source must be an existing synthetic Station5 fixture');
const source = new DatabaseSync(fixture.database, { readOnly: true });
try {
  const users = source.prepare('SELECT id FROM User').all();
  if (users.length !== 2 || users.some(row => !['s5_student', 's5_other'].includes(String(row.id)))) throw Error('Unexpected accounts in synthetic fixture');
  const folder = fs.mkdtempSync(path.join(tmpdir(), 'nmt-station5-'));
  const database = path.join(folder, 'qa.db');
  await backup(source, database);
  const copy = new DatabaseSync(database);
  try {
    if (Object.values(copy.prepare('PRAGMA integrity_check').get())[0] !== 'ok') throw Error('Invalid fixture copy');
    if (copy.prepare('PRAGMA foreign_key_check').all().length) throw Error('Fixture foreign-key violation');
  } finally { copy.close(); }
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.writeFileSync(metadataFile, JSON.stringify({ ...fixture, folder, database, copiedFromSyntheticFixture: sourceFile }), { flag: 'wx' });
  console.log(JSON.stringify({ syntheticFixtureCopied: true, migrations: false, seed: false, productionAccessed: false }));
} finally { source.close(); }
