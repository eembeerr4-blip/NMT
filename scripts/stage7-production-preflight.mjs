import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { captureFingerprints } from "./stage7b-fingerprints.mjs";
import { STAGE7B_ALLOWLIST, STAGE6_READY_TOPICS } from "./stage7b-allowlist.mjs";
import { STAGE7_PRODUCTION_DB } from "./stage7-final-production-path.mjs";

const dbPath = STAGE7_PRODUCTION_DB;
const db = new DatabaseSync(dbPath, { readOnly: true });
const fp = captureFingerprints(dbPath);

const allow = STAGE7B_ALLOWLIST;
const stage7Topics = db
  .prepare(`SELECT id, coverage, parentId FROM Topic WHERE id IN (${allow.map(() => "?").join(",")}) ORDER BY id`)
  .all(...allow);

const stage6 = db
  .prepare(`SELECT id, coverage FROM Topic WHERE id IN (${STAGE6_READY_TOPICS.map(() => "?").join(",")}) ORDER BY id`)
  .all(...STAGE6_READY_TOPICS);

const s7aQ = db
  .prepare(`SELECT verificationStatus, COUNT(*) AS c FROM Question WHERE id LIKE 's7a-%' GROUP BY verificationStatus`)
  .all();

const verifiedTotal = db.prepare(`SELECT COUNT(*) AS c FROM Question WHERE verificationStatus='VERIFIED'`).get().c;
const readyTotal = db.prepare(`SELECT COUNT(*) AS c FROM Topic WHERE coverage='READY'`).get().c;

const hierarchyChildren = db
  .prepare(
    `SELECT id, parentId FROM Topic WHERE parentId IN ('ukr-lexicology-section-01','bio-cell-sec-01','zcode-biology-molecular-02') ORDER BY id`,
  )
  .all();

const integrity = db.prepare("PRAGMA integrity_check").get();
const fk = db.prepare("PRAGMA foreign_key_check").all();

db.close();

console.log(
  JSON.stringify(
    {
      dbPath,
      sha256: createHash("sha256").update(readFileSync(dbPath)).digest("hex"),
      integrity,
      foreignKeyViolations: fk.length,
      fingerprints: fp,
      stage7Topics,
      stage6Ready: stage6,
      s7aQuestions: s7aQ,
      verifiedTotal,
      readyTotal,
      hierarchyChildren,
    },
    null,
    2,
  ),
);
