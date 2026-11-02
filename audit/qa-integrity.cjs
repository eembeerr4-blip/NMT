const {DatabaseSync}=require('node:sqlite');
const path=require('node:path');
if(!process.cwd().endsWith('nmt-beta'))throw Error('QA worktree required');
const db=new DatabaseSync(path.resolve('audit/tests/beta-chrome.db'),{readOnly:true});
const settings=db.prepare("SELECT scheduleJson FROM UserSettings WHERE userId='student_b'").get();
console.log(JSON.stringify({studentBSettingsRestored:Boolean(JSON.parse(settings.scheduleJson).days),integrity:db.prepare('PRAGMA integrity_check').all(),foreignKeys:db.prepare('PRAGMA foreign_key_check').all(),triggers:db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all()},null,2));db.close();
