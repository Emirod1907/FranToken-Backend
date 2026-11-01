import { createApp } from "./app";
import { assertDatabaseConnection } from "./config/database";
import { env } from "./config/env";
import { syncModels } from "./models";
import { seedAll } from "./seeders/seed";

async function bootstrap() {
  await assertDatabaseConnection();
  const target = env.db.url
    ? "(DATABASE_URL)"
    : `${env.db.host}:${env.db.port}/${env.db.name}`;
  console.log(`[db] Conectado (${env.db.dialect}) ${target}`);

  if (env.db.sync) {
    await syncModels();
    console.log("[db] Modelos sincronizados (DB_SYNC=true).");
  }

  if (env.db.seedOnBoot) {
    await seedAll();
    console.log("[db] Datos demo sembrados (SEED_ON_BOOT=true).");
  }

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[http] FranToken backend escuchando en http://localhost:${env.port}`);
    console.log(`[http] CORS permitido para: ${env.corsOrigin.join(", ") || "*"}`);
  });
}

bootstrap().catch((err) => {
  console.error("[fatal] No se pudo iniciar el servidor:", err);
  process.exit(1);
});
