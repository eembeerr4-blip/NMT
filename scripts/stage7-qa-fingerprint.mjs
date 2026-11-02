import { writeFileSync } from "node:fs";
import path from "node:path";
import { captureFingerprints } from "./stage7b-fingerprints.mjs";

const qaDb = process.argv[2];
if (!qaDb) throw new Error("usage: node stage7-qa-fingerprint.mjs <dbPath> [outJson]");
const fp = captureFingerprints(path.resolve(qaDb));
const out = process.argv[3];
if (out) writeFileSync(out, JSON.stringify(fp, null, 2));
console.log(JSON.stringify({ verified: fp.verifiedQuestionCount, digests: fp.digests }, null, 2));
