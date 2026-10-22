/**
 * Prisma generate without overwriting a locked Windows query_engine DLL.
 * Generates into node_modules/.prisma/client-staging, then copies JS/metadata into client/.
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = path.join(root, "prisma", "schema.prisma");
const generateSchemaPath = path.join(root, "prisma", "schema.generate.prisma");
const staging = path.join(root, "node_modules", ".prisma", "client-staging");
const target = path.join(root, "node_modules", ".prisma", "client");

const baseSchema = readFileSync(schemaPath, "utf8");
const outputLine = `  output   = "../node_modules/.prisma/client-staging"`;
const generateSchema = baseSchema.includes("output   =")
  ? baseSchema
  : baseSchema.replace(/generator client \{[^}]*\}/, (block) => {
      if (block.includes("output")) return block;
      return block.replace(/\}\s*$/, `\n${outputLine}\n}`);
    });

writeFileSync(generateSchemaPath, generateSchema, "utf8");
rmSync(staging, { recursive: true, force: true });

execSync("npx prisma generate --schema prisma/schema.generate.prisma", {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

mkdirSync(target, { recursive: true });
const skipped = [];
for (const name of readdirSync(staging)) {
  const from = path.join(staging, name);
  const to = path.join(target, name);
  if (/query_engine/i.test(name) && existsSync(to)) {
    skipped.push(name);
    continue;
  }
  try {
    cpSync(from, to, { force: true, recursive: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    if ((code === "EPERM" || code === "EIO") && /query_engine/i.test(name)) {
      skipped.push(name);
      continue;
    }
    throw error;
  }
}

if (skipped.length) {
  console.warn(
    `[prisma-generate-safe] Skipped locked engine file(s): ${skipped.join(", ")}. Client JS/types were updated; restart dev server to refresh the native engine when convenient.`,
  );
}

if (!existsSync(path.join(target, "index.js"))) {
  throw new Error("Prisma client index.js missing after generate.");
}

rmSync(generateSchemaPath, { force: true });
console.log("[prisma-generate-safe] OK");
