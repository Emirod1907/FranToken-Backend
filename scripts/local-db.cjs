// MariaDB de desarrollo para Ubuntu 24.04/WSL. No instala servicios del sistema.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { randomBytes } = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

const root = path.resolve(__dirname, "..");
const home = path.join(root, ".local/mariadb");
const runtime = path.join(home, "runtime/usr");
const data = path.join(home, "data");
const socketPath = path.join(home, "mysql.sock");
const log = path.join(home, "server.log");
const credentialsFile = path.join(home, "credentials.json");
const daemonEnv = {
  ...process.env,
  LD_LIBRARY_PATH: path.join(runtime, "lib/x86_64-linux-gnu"),
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`${command} terminó con código ${result.status}`);
}

async function admin() {
  return mysql.createConnection({ socketPath, user: os.userInfo().username });
}

async function running() {
  try {
    const connection = await admin();
    await connection.ping();
    await connection.end();
    return true;
  } catch (error) {
    if (["ENOENT", "ECONNREFUSED"].includes(error.code)) return false;
    throw error;
  }
}

function portInUse() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: 3306 });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", (error) => {
      if (error.code === "ECONNREFUSED") resolve(false);
      else reject(error);
    });
  });
}

function install() {
  if (fs.existsSync(path.join(runtime, "sbin/mariadbd"))) return;
  const release = fs.readFileSync("/etc/os-release", "utf8");
  if (process.arch !== "x64" || !/^ID=ubuntu$/m.test(release) || !/^VERSION_ID="24\.04"$/m.test(release)) {
    throw Error("db:setup requiere Ubuntu 24.04 x64 (también WSL). En otros sistemas configurar MySQL/PostgreSQL en .env.");
  }
  const packages = path.join(home, "packages");
  fs.mkdirSync(packages, { recursive: true });
  run("apt-get", ["download", "mariadb-server-core", "mariadb-client-core", "mariadb-server",
    "libaio1t64", "liburing2", "libnuma1", "libpcre2-8-0", "libncurses6", "libtinfo6",
    "libedit2", "libbsd0", "libmd0", "libssl3t64"], { cwd: packages });
  for (const file of fs.readdirSync(packages).filter((name) => name.endsWith(".deb"))) {
    run("dpkg-deb", ["-x", path.join(packages, file), path.join(home, "runtime")]);
  }
}

async function start() {
  if (await running()) {
    console.log("[db] MariaDB local ya está iniciado en 127.0.0.1:3306.");
    return;
  }
  if (!fs.existsSync(path.join(data, "mysql"))) throw Error("Primero ejecutar npm run db:setup.");
  if (await portInUse()) throw Error("El puerto 3306 está ocupado por otro servidor; no se modificó.");
  const output = fs.openSync(log, "a", 0o600);
  const child = spawn(path.join(runtime, "sbin/mariadbd"), ["--no-defaults",
    `--basedir=${runtime}`, `--datadir=${data}`, `--socket=${socketPath}`,
    `--pid-file=${path.join(home, "mysql.pid")}`, `--log-error=${log}`,
    `--lc-messages-dir=${path.join(runtime, "share/mysql")}`,
    `--plugin-dir=${path.join(runtime, "lib/mysql/plugin")}`,
    "--bind-address=127.0.0.1", "--port=3306", "--skip-name-resolve",
    "--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci",
  ], { cwd: home, env: daemonEnv, detached: true, stdio: ["ignore", output, output] });
  const spawned = new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
  fs.closeSync(output);
  await spawned;
  child.unref();
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await running()) {
      console.log("[db] MariaDB local iniciado en 127.0.0.1:3306.");
      return;
    }
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw Error(`MariaDB no inició. Consultar ${log}`);
}

async function setup() {
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  fs.chmodSync(home, 0o700);
  install();
  if (!fs.existsSync(path.join(data, "mysql"))) {
    run(path.join(runtime, "bin/mariadb-install-db"), ["--no-defaults",
      `--basedir=${runtime}`, `--datadir=${data}`, "--auth-root-authentication-method=socket",
      `--auth-root-socket-user=${os.userInfo().username}`, "--skip-test-db", "--skip-name-resolve",
    ], { env: daemonEnv });
  }
  await start();
  const credentials = fs.existsSync(credentialsFile)
    ? JSON.parse(fs.readFileSync(credentialsFile, "utf8"))
    : { database: "frantoken", user: "frantoken", password: randomBytes(24).toString("hex") };
  // Persistir antes de cambiar SQL: una interrupción permite repetir el setup.
  fs.writeFileSync(credentialsFile, JSON.stringify(credentials), { mode: 0o600 });
  const connection = await admin();
  try {
    await connection.query("CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", [credentials.database]);
    await connection.query("CREATE USER IF NOT EXISTS ?@'127.0.0.1' IDENTIFIED BY ?", [credentials.user, credentials.password]);
    await connection.query("ALTER USER ?@'127.0.0.1' IDENTIFIED BY ?", [credentials.user, credentials.password]);
    await connection.query("GRANT ALL PRIVILEGES ON ??.* TO ?@'127.0.0.1'", [credentials.database, credentials.user]);
  } finally {
    await connection.end();
  }
  const envPath = path.join(root, ".env.local");
  let contents = fs.readFileSync(fs.existsSync(envPath) ? envPath : path.join(root, ".env.example"), "utf8");
  const values = { DB_DIALECT: "mysql", DATABASE_URL: "", DB_HOST: "127.0.0.1", DB_PORT: "3306",
    DB_NAME: credentials.database, DB_USER: credentials.user, DB_PASSWORD: credentials.password,
    DB_SSL: "false", DB_SYNC: "false", SEED_ON_BOOT: "false" };
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    contents = pattern.test(contents) ? contents.replace(pattern, line) : `${contents.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(envPath, contents, { mode: 0o600 });
  fs.chmodSync(envPath, 0o600);
  // Cargar configuración local para los subprocesos, sin heredar una URL remota.
  const localEnv = { ...process.env, ...dotenv.parse(contents), NODE_ENV: "development" };
  run("npm", ["run", "db:migrate:mvp"], { env: localEnv });
  // Reutilizar el importador sin sync({ alter: true }) del CLI db:seed.
  run("npm", ["run", "mvp:import"], {
    env: { ...localEnv, BLOCKCHAIN_ENABLED: "false" },
  });
  console.log("[db] Base frantoken y datos demo listos. Ejecutar npm run dev.");
}

async function main() {
  switch (process.argv[2]) {
    case "setup": return setup();
    case "start": return start();
    case "status": {
      const active = await running();
      console.log(active ? "[db] MariaDB local activo en 127.0.0.1:3306." : "[db] MariaDB local detenido.");
      process.exitCode = active ? 0 : 1;
      return;
    }
    case "stop": {
      if (!await running()) { console.log("[db] MariaDB local ya está detenido."); return; }
      const connection = await admin();
      try { await connection.query("SHUTDOWN"); } finally { await connection.end(); }
      for (let attempt = 0; attempt < 60; attempt++) {
        if (!await running()) { console.log("[db] MariaDB local detenido; datos conservados."); return; }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw Error(`MariaDB no terminó de detenerse. Consultar ${log}`);
    }
    default: throw Error("Usar npm run db:setup, db:start, db:stop o db:status.");
  }
}

main().catch((error) => { console.error(`[db] ${error.message}`); process.exitCode = 1; });
