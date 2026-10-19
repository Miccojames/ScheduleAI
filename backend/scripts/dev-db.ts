/**
 * Local development database via the embedded Postgres 17 binaries that ship
 * with the `embedded-postgres` package (dev-only). No root, no Docker.
 *
 * Key detail: we call initdb/pg_ctl directly instead of the package's JS
 * wrapper — the wrapper spawns postgres as a child of the npm script, which
 * gets killed when the script exits. pg_ctl daemonizes properly, so the
 * server survives after `npm run db:start` returns.
 *
 * - data dir: ./.pgdata (gitignored)
 * - user: postgres, password: password, port: 5433
 * - creates the `scheduleai` database on first start
 *
 * Usage:  npm run db:start | db:stop | db:reset
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PG_PORT = 5433;
const PG_USER = "postgres";
const PG_PASSWORD = "password";
const PG_DB = "scheduleai";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseDir = path.join(backendRoot, ".pgdata");
const binDir = path.join(
  backendRoot,
  "node_modules",
  "@embedded-postgres",
  "linux-x64",
  "native",
  "bin"
);
const initdbBin = path.join(binDir, "initdb");
const pgCtlBin = path.join(binDir, "pg_ctl");

function run(bin: string, args: string[]): { code: number; output: string } {
  const res = spawnSync(bin, args, { encoding: "utf8" });
  return { code: res.status ?? 1, output: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

function isRunning(): boolean {
  const { code, output } = run(pgCtlBin, ["-D", databaseDir, "status"]);
  // pg_ctl status: 0 = running, 3 = not running, 4 = no data dir
  return code === 0 && !/no server running|Is server running\?/i.test(output);
}

async function createDatabaseIfMissing(): Promise<void> {
  // `pg` is a transitive dependency of @prisma/adapter-pg — always present.
  const { default: pg } = await import("pg");
  const client = new pg.Client({
    host: "localhost",
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: "postgres", // maintenance database
  });
  await client.connect();
  try {
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [PG_DB]);
    if ((res.rowCount ?? 0) === 0) {
      // Identifier can't be parameterized; PG_DB is a hardcoded constant here.
      await client.query(`CREATE DATABASE "${PG_DB}"`);
      console.log(`✅ Database "${PG_DB}" created.`);
    } else {
      console.log(`ℹ️  Database "${PG_DB}" already exists.`);
    }
  } finally {
    await client.end();
  }
}

function start(): void {
  const initialized = fs.existsSync(path.join(databaseDir, "PG_VERSION"));

  if (!initialized) {
    console.log(`📦 Initializing embedded Postgres at ${databaseDir} ...`);
    fs.mkdirSync(databaseDir, { recursive: true });
    // initdb needs a password file for the superuser.
    const pwFile = path.join(os.tmpdir(), `scheduleai-pgpass-${process.pid}`);
    fs.writeFileSync(pwFile, `${PG_PASSWORD}\n`);
    try {
      const { code, output } = run(initdbBin, [
        `--pgdata=${databaseDir}`,
        `--username=${PG_USER}`,
        `--pwfile=${pwFile}`,
        "--auth=password", // scram for host + local TCP connections
        "--encoding=UTF8",
      ]);
      if (code !== 0) {
        throw new Error(`initdb failed:\n${output}`);
      }
    } finally {
      fs.rmSync(pwFile, { force: true });
    }
    console.log("✅ initdb complete.");
  } else {
    console.log("📦 Postgres data directory already initialized.");
  }

  if (isRunning()) {
    console.log(`ℹ️  Postgres already running on port ${PG_PORT}.`);
  } else {
    console.log(`🚀 Starting embedded Postgres on port ${PG_PORT} ...`);
    // pg_ctl daemonizes: it starts postgres in the background and returns.
    const { code, output } = run(pgCtlBin, [
      "-D",
      databaseDir,
      "-o",
      `-p ${PG_PORT}`,
      "-w", // wait until server accepts connections
      "-t",
      "60",
      "start",
    ]);
    if (code !== 0) {
      throw new Error(`pg_ctl start failed:\n${output}`);
    }
    console.log("✅ Postgres started (daemonized).");
  }

  // createDatabaseIfMissing is async; chain it.
  createDatabaseIfMissing()
    .then(() => {
      console.log(
        `\nDone. Connection string:\n  postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}\n\nNext:\n  npx prisma migrate dev --name init\n`
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Failed to create database:", err);
      process.exit(1);
    });
}

function stop(): void {
  if (!fs.existsSync(path.join(databaseDir, "PG_VERSION"))) {
    console.log("ℹ️  No data directory — nothing to stop.");
    return;
  }
  if (!isRunning()) {
    console.log("ℹ️  Postgres is not running.");
    return;
  }
  console.log("🛑 Stopping embedded Postgres ...");
  const { code, output } = run(pgCtlBin, ["-D", databaseDir, "-m", "fast", "-w", "stop"]);
  if (code !== 0) {
    throw new Error(`pg_ctl stop failed:\n${output}`);
  }
  console.log("✅ Stopped.");
}

function reset(): void {
  stop();
  if (fs.existsSync(databaseDir)) {
    console.log(`🗑️  Removing ${databaseDir} ...`);
    fs.rmSync(databaseDir, { recursive: true, force: true });
  }
  console.log("✅ Reset complete. Run `npm run db:start` to re-initialize.");
}

const command = process.argv[2];
try {
  switch (command) {
    case "start":
      start();
      break;
    case "stop":
      stop();
      break;
    case "reset":
      reset();
      break;
    default:
      console.error("Usage: tsx scripts/dev-db.ts <start|stop|reset>");
      process.exit(1);
  }
} catch (err) {
  console.error("❌ dev-db error:", err instanceof Error ? err.message : err);
  process.exit(1);
}
