import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT ?? "3117";
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
const dbFile = path.join(root, "prisma", "stage6-final-qa.db").replaceAll("\\", "/");
const databaseUrl = `file:${dbFile}`;

const child = spawn(process.execPath, [nextCli, "start", "-p", port, "-H", "127.0.0.1"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: port,
    DATABASE_URL: databaseUrl,
  },
});

child.on("exit", (code) => process.exit(code ?? 1));
