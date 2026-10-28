import { Sequelize } from "sequelize";
import { env } from "./env";

export const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: "mysql",
  logging: env.db.logging ? (msg) => console.log(`[sql] ${msg}`) : false,
  define: {
    // Tablas y columnas en snake_case; timestamps createdAt/updatedAt presentes.
    underscored: true,
    timestamps: true,
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  // Importes como DECIMAL: mysql2 los devuelve como string; los convertimos a
  // número en la capa de serialización de cada modelo para respetar el contrato
  // del frontend (que espera `number`).
  dialectOptions: {
    decimalNumbers: false,
  },
});

export async function assertDatabaseConnection(): Promise<void> {
  await sequelize.authenticate();
}
