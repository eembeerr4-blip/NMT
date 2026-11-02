import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
// Explicit read-only connection; no sessions, learner actions or personal tables.
const db = new DatabaseSync('D:/НМТ Сайт/NMT-academy/prisma/dev.db', { readOnly: true });
db.exec('PRAGMA query_only=ON');
const ids = ['math', 'ukrainian', 'history', 'biology'];
const topics = db.prepare('SELECT id,subjectId,title,coverage,lessonJson FROM Topic WHERE subjectId IN (?,?,?,?)').all(...ids);
const questions = db.prepare('SELECT id,topicId,type,difficulty,verificationStatus,length(explanation) AS explanationLength FROM Question WHERE subjectId IN (?,?,?,?)').all(...ids);
const videos = db.prepare('SELECT topicId,reviewStatus FROM VideoLesson').all();
const sets = db.prepare('SELECT topicId,subjectId,kind,configJson FROM Test').all().map(s=>{let config={};try{config=JSON.parse(s.configJson);}catch{ /* Invalid configuration stays unpublished. */ }return {...s,publicationStatus:config.publication};});
const report = ids.map(subjectId => {
  const rows = topics.filter(t => t.subjectId === subjectId).map(t => {
    let lesson = {}; try { lesson = JSON.parse(t.lessonJson || '{}'); } catch { /* invalid lesson is unavailable */ }
    const q = questions.filter(q => q.topicId === t.id && q.verificationStatus === 'VERIFIED');
    const v = videos.filter(v => v.topicId === t.id && v.reviewStatus === 'CONFIRMED');
    const available = t.coverage !== 'DRAFT' && Boolean(lesson.theory?.trim() || q.length || v.length);
    return { id:t.id,title:t.title,coverage:t.coverage,available,theoryChars:lesson.theory?.length || 0,notesChars:lesson.notes?.length || 0,summaryChars:lesson.summary?.length || 0,examples:lesson.examples?.length || 0,interactiveExamples:lesson.examples?.filter(e=>e.answerCheck).length || 0,verifiedQuestions:q.length,shortExplanations:q.filter(q=>q.explanationLength<80).length,confirmedVideos:v.length,publishedSets:sets.filter(s=>s.topicId===t.id && s.publicationStatus==='PUBLISHED').map(s=>s.kind) };
  });
  return {subjectId,topics:rows,available:rows.filter(t=>t.available).length,publishedMixedSets:sets.filter(s=>s.subjectId===subjectId && !s.topicId && s.publicationStatus==='PUBLISHED').length};
});
db.close();
mkdirSync('content/station4', {recursive:true});
writeFileSync('content/station4/live-content-audit.json', JSON.stringify({checkedAt:new Date().toISOString(),mode:'SQLITE_READ_ONLY_QUERY_ONLY',personalTablesRead:false,subjectAudit:report,limitations:['Availability uses the application lessonAccess rules; no login or syncPlan executed on working database.','This is a content audit, not a fresh full independent verification of every legacy key.']},null,2)+'\n');
console.log(JSON.stringify(report.map(s=>({...s,topics:s.topics.filter(t=>t.available)})),null,2));
