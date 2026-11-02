// Adaptador de prueba para ejecutar el dialecto SQLite de Sequelize con node:sqlite.
// No se usa en el servidor ni requiere instalar un driver nuevo.
const { DatabaseSync } = require("node:sqlite");
class Database {
  constructor(filename, flags, callback) {
    this.filename = filename;
    this.db = new DatabaseSync(filename);
    queueMicrotask(() => callback?.(null));
  }
  serialize(fn) {
    fn();
  }
  configure() {}
  all(sql, bindings, callback) {
    this.execute("all", sql, bindings, callback);
  }
  run(sql, bindings, callback) {
    this.execute("run", sql, bindings, callback);
  }
  exec(sql, callback) {
    try {
      this.db.exec(sql);
      queueMicrotask(() => callback?.(null));
    } catch (error) {
      queueMicrotask(() => callback?.(error));
    }
  }
  execute(method, sql, bindings, callback) {
    if (typeof bindings === "function") {
      callback = bindings;
      bindings = [];
    }
    try {
      const statement = this.db.prepare(sql);
      const normalize = (v) => (typeof v === "boolean" ? Number(v) : v);
      const args = Array.isArray(bindings)
        ? bindings.map(normalize)
        : bindings
          ? Object.fromEntries(
              Object.entries(bindings).map(([k, v]) => [k, normalize(v)]),
            )
          : [];
      const result = Array.isArray(args)
        ? statement[method](...args)
        : statement[method](args);
      const context =
        method === "run"
          ? {
              lastID: Number(result.lastInsertRowid),
              changes: Number(result.changes),
            }
          : {};
      queueMicrotask(() =>
        callback?.call(context, null, method === "all" ? result : undefined),
      );
    } catch (error) {
      if (
        error.errcode === 2067 ||
        error.errcode === 1555 ||
        error.message.includes("UNIQUE constraint")
      )
        error.code = "SQLITE_CONSTRAINT";
      queueMicrotask(() => callback?.(error));
    }
  }
  close(callback) {
    try {
      this.db.close();
      queueMicrotask(() => callback?.(null));
    } catch (error) {
      callback?.(error);
    }
  }
}
module.exports = { Database, OPEN_READWRITE: 2, OPEN_CREATE: 4 };
