import { sequelize } from "../src/models";
import { seedAll } from "../src/seeders/seed";
seedAll()
  .then(() => sequelize.close())
  .catch(() => {
    console.error(
      "No se pudo importar el catálogo académico. Revisá manifiesto y conexión.",
    );
    process.exitCode = 1;
  });
