import { DatabaseSync } from "node:sqlite";
import { verifyPasswordAsync } from "../src/lib/auth.ts";

const db = new DatabaseSync("prisma/stage6-qa-signoff.db");
const row = db.prepare("SELECT passwordHash FROM User WHERE nickname='stage6_qa_student'").get();
const ok = row?.passwordHash ? await verifyPasswordAsync("stage6-qa-pass-2026", row.passwordHash) : false;
console.log(JSON.stringify({ passwordMatchesFixture: ok }));
db.close();
