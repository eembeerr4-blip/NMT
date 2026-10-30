/** Addressed math corrections. Working apply deliberately unavailable in this preparation stage. */
import {DatabaseSync} from 'node:sqlite';
import {existsSync,readFileSync,realpathSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,integrity,tableHashes,createBackup} from './stage8-fix-published-questions.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const raw=readFileSync(path.join(root,'content/stage8/math-addressed-plan.json'));
if(createHash('sha256').update(raw).digest('hex')!=='ebe9fe9b98d3e9db5d97bf95a36710a50c4d8c3df2d71c826048b367a78018b7')throw Error('Math plan hash mismatch');
const plan=JSON.parse(raw);
function inspect(db){
  for(const t of plan.topics)if(hash(db.prepare('SELECT * FROM Topic WHERE id=?').get(t.id))!==t.sha256)throw Error('Changed math lesson: '+t.id);
  for(const c of plan.changes){const q=db.prepare('SELECT * FROM Question WHERE id=?').get(c.id);if(hash(q)!==c.expectedRowSha256||q.verificationStatus!=='DRAFT')throw Error('Changed math question: '+c.id);for(const table of ['TestQuestion','Answer','Mistake'])if(db.prepare('SELECT count(*) n FROM '+table+' WHERE questionId=?').get(c.id).n)throw Error('Math question has saved dependencies');}
}
async function main(){
  const args=process.argv.slice(2),options={};
  for(let i=0;i<args.length;i++){const flag=args[i];if(flag==='--apply-qa'&&!options.apply)options.apply=true;else if(['--database','--backup'].includes(flag)&&args[i+1]&&!args[i+1].startsWith('--')&&!(flag in options))options[flag]=args[++i];else throw Error('Unknown/duplicate/incomplete argument');}
  if(!options['--database']||!path.isAbsolute(options['--database']))throw Error('Explicit absolute database required');
  const database=realpathSync(options['--database']);
  if(options.apply){const folder=path.dirname(database),workPath=path.join(root,'prisma/dev.db'),work=existsSync(workPath)?realpathSync(workPath):workPath,a=statSync(database),b=existsSync(work)?statSync(work):null;if(database.toLowerCase()===work.toLowerCase()||(b&&a.dev===b.dev&&a.ino===b.ino)||path.dirname(folder)!==realpathSync(tmpdir())||!path.basename(folder).startsWith('nmt-stage8-math-'))throw Error('Apply is permitted only in a private nmt-stage8-math-* QA directory');}
  const source=new DatabaseSync(database,{readOnly:true});let before;
  try{source.exec('BEGIN');integrity(source);inspect(source);before=tableHashes(source);if(!options.apply)return {status:'eligible',readOnly:true,questionUpdates:3,topicUpdates:0,preservedAnswerChecks:19};if(!options['--backup'])throw Error('Explicit new backup required');const saved=await createBackup(source,options['--backup']);const copy=new DatabaseSync(saved,{readOnly:true});try{if(JSON.stringify(tableHashes(copy))!==JSON.stringify(before))throw Error('Backup mismatch');}finally{copy.close();}}finally{source.close();}
  const db=new DatabaseSync(database);let transaction=false;
  try{db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');transaction=true;if(JSON.stringify(tableHashes(db))!==JSON.stringify(before))throw Error('Database changed since backup');inspect(db);const stamp=Date.now();const old=db.prepare('SELECT * FROM Question ORDER BY id').all();for(const c of plan.changes){const fields=Object.keys(c.fields);if(fields.some(f=>!['prompt','explanation'].includes(f)))throw Error('Invalid field');if(db.prepare('UPDATE Question SET '+fields.map(k=>k+'=?').join(',')+',updatedAt=? WHERE id=?').run(...fields.map(k=>c.fields[k]),stamp,c.id).changes!==1)throw Error('Unexpected count');}
    const expected=old.map(q=>{const c=plan.changes.find(c=>c.id===q.id);return c?{...q,...c.fields,updatedAt:stamp}:q;});if(JSON.stringify(db.prepare('SELECT * FROM Question ORDER BY id').all())!==JSON.stringify(expected))throw Error('Unexpected question mutation');const after=tableHashes(db);for(const t of Object.keys(before))if(t!=='Question'&&JSON.stringify(before[t])!==JSON.stringify(after[t]))throw Error('Unexpected table mutation');integrity(db);db.exec('COMMIT');transaction=false;return {status:'QA_ONLY_APPLIED',questionUpdates:3,topicUpdates:0,preservedAnswerChecks:19,unchangedOtherTables:Object.keys(before).length-1,integrity:'ok',foreignKeyViolations:0};
  }catch(error){if(transaction)db.exec('ROLLBACK');throw error;}finally{db.close();}
}
main().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
