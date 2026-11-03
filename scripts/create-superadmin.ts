import { sequelize } from "../src/models";
import { createSuperadmin } from "../src/services/superadmin.service";
import { ApiError } from "../src/utils/ApiError";

createSuperadmin({
  email: process.env.SUPERADMIN_EMAIL,
  password: process.env.SUPERADMIN_PASSWORD,
  displayName: process.env.SUPERADMIN_DISPLAY_NAME,
})
  .then((result) =>
    console.log(
      result.created
        ? "Superadmin creado. Las credenciales permanecen en la configuración local."
        : "El superadmin ya existe. Se conservaron su contraseña y sus datos.",
    ),
  )
  .catch((error) => {
    console.error(
      error instanceof ApiError
        ? error.message
        : "No se pudo crear el superadmin. Revisá la conexión y la migración.",
    );
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
