import { Options, Sequelize } from "sequelize";
import { env } from "./env";

const logging = env.db.logging ? (msg: string) => console.log(`[sql] ${msg}`) : false;

// Opciones comunes a ambos dialectos.
const common: Options = {
  dialect: env.db.dialect,
  logging,
  define: {
    // Tablas y columnas en snake_case; timestamps createdAt/updatedAt presentes.
    underscored: true,
    timestamps: true,
  },
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  dialectOptions: {
    // Importes DECIMAL como string (los convertimos a número en cada modelo).
    ...(env.db.dialect === "mysql" ? { decimalNumbers: false } : {}),
    // SSL para hosts administrados (Supabase, Railway, Aiven, etc.).
    ...(env.db.ssl
      ? {
          ssl:
            env.db.dialect === "postgres"
              ? { require: true, rejectUnauthorized: false }
              : { rejectUnauthorized: false },
        }
      : {}),
  },
};

// Con DATABASE_URL (lo habitual en producción) Sequelize parsea host/credenciales.
// Si no, se arma desde los campos sueltos (desarrollo local).
export const sequelize = env.db.url
  ? new Sequelize(env.db.url, common)
  : new Sequelize(env.db.name, env.db.user, env.db.password, {
      ...common,
      host: env.db.host,
      port: env.db.port,
    });

export async function assertDatabaseConnection(): Promise<void> {
  await sequelize.authenticate();
}
