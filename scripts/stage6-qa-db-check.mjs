import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("prisma/stage6-qa-signoff.db");
const u = db.prepare("SELECT id, nickname, role, accountStatus, onboarded FROM User WHERE nickname='stage6_qa_student'").get();
console.log(JSON.stringify({ student: u, ready: db.prepare("SELECT COUNT(*) c FROM Topic WHERE coverage='READY' AND id LIKE 'ukr-lex-01%'").get() }));
db.close();
