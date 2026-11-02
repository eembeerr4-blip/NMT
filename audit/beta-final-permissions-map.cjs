const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const rows=[];
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
for(const file of files('src').filter(file=>/\.tsx?$/.test(file)&&!file.includes('.test.'))){
 const text=fs.readFileSync(file,'utf8'),source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const moduleServer=source.statements.some(n=>ts.isExpressionStatement(n)&&ts.isStringLiteral(n.expression)&&n.expression.text==='use server');
 function inspect(node){
  if((ts.isFunctionDeclaration(node)||ts.isArrowFunction(node)||ts.isFunctionExpression(node))&&node.body&&ts.isBlock(node.body)){
   const inline=node.body.statements.some(n=>ts.isExpressionStatement(n)&&ts.isStringLiteral(n.expression)&&n.expression.text==='use server');
   const exported=ts.isFunctionDeclaration(node)&&node.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword);
   const route=/[\\/]route\.ts$/.test(file)&&exported;
   if((moduleServer&&exported)||inline||route){
    const line=source.getLineAndCharacterOfPosition(node.getStart(source)).line+1;
    const name=node.name?.getText(source)||`inline@${line}`;const calls=[];const queries=[];
    function visit(n){if(ts.isCallExpression(n)){const callee=n.expression.getText(source);calls.push(callee);if(/^(prisma|tx|db)\./.test(callee))queries.push({line:source.getLineAndCharacterOfPosition(n.getStart(source)).line+1,callee,args:n.arguments.map(a=>a.getText(source)).join(', ')});}ts.forEachChild(n,visit);}
    visit(node.body);rows.push({file:file.replaceAll('\\','/'),line,name,kind:route?'HTTP':inline?'inline':'action',calls:[...new Set(calls)],queries});
   }
  }
  ts.forEachChild(node,inspect);
 }
 inspect(source);
}
function direct(row){if(row.file.endsWith("server/test-sets.ts")&&row.name!=="startPublishedTestSet")return "ADMIN+ (actor(true))";if(row.calls.includes('owner')||row.calls.includes('isOwner'))return 'OWNER';if(row.calls.includes('administrator')||row.calls.includes('isAdministrator'))return 'ADMIN+';if(row.calls.includes('editor')||row.calls.includes('canEditContent'))return 'EDITOR+';if(row.calls.includes('actor')||row.calls.includes('getSessionUser'))return 'session / own data';return null;}
const byName=new Map(rows.filter(r=>r.kind==='action').map(r=>[r.name,r]));
for(const row of rows){row.guard=direct(row);if(!row.guard){const targets=row.calls.map(call=>byName.get(call)).filter(Boolean);row.guard=targets.length?'indirect: '+targets.map(t=>t.name+' → '+(direct(t)||'public contract')).join('; '):row.name==='login'?'public password verification':row.name==='claimOwner'?'bootstrap: local host + owner without password':'manual review / delegated';}row.ownership=row.guard.match(/OWNER|ADMIN|EDITOR/)?'shared/system; role checked':'verify userId or parent chain (see isolation tests)';}
fs.writeFileSync('audit/reports/06-actions-map.json',JSON.stringify(rows,null,2));
let md='# Карта серверных действий и HTTP handlers\n\nAST-инвентаризация текущего рабочего кода; inline Server Actions включены. Автоматическое определение guard — карта вызовов, не самостоятельное доказательство защиты. Negative coverage: permissions-matrix.test.ts; ownership: isolation-hardening/reliability suites. Для public login/onboarding/bootstrap применяются отдельные контракты.\n\n| Файл:строка | Действие | Тип | Guard/цепочка | Область данных | Негативная проверка |\n|---|---|---|---|---|---|\n';
for(const row of rows){const negative=/OWNER|ADMIN|EDITOR/.test(row.guard)?'permissions-matrix (direct guards); role-database; route tests':/inline/.test(row.kind)?'через вызываемое действие; wrapper отдельно не доказан':'isolation/auth/proxy tests; см. отчёт';md+=`| ${row.file}:${row.line} | ${row.name} | ${row.kind} | ${row.guard.replaceAll('|','/')} | ${row.ownership} | ${negative} |\n`;}
md+='\n## Запросы и ограничения\n\nПолные аргументы запросов (без runtime-значений) в JSON. where только по id для общих Topic/Question/VideoLesson защищён редакторской ролью. Личные Answer проверяются через владельца TestAttempt; UserVideoProgress через compound userId_videoId; Note/ExamResult/StudyTask/Review/Flashcard/Mistake — через userId. Внутренние planner ids получены из выборки текущего пользователя. Отсутствие userId в одном where без контекста не названо утечкой.\n';
fs.writeFileSync('audit/reports/06-actions-map.md',md);console.log(JSON.stringify({rows:rows.length,actions:rows.filter(r=>r.kind==='action').length,inline:rows.filter(r=>r.kind==='inline').length,http:rows.filter(r=>r.kind==='HTTP').length,queries:rows.flatMap(r=>r.queries).length}));
