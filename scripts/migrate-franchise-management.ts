import { DataTypes, QueryTypes } from "sequelize";
import { sequelize } from "../src/models";
import { migrateMvp } from "./migrate-mvp";

/** Amplía permisos y datos sin promover usuarios ni reemplazar registros. */
export async function migrateFranchiseManagement() {
  await migrateMvp();
  const qi = sequelize.getQueryInterface();
  const applications = await qi.describeTable("franchise_applications");
  if (!applications.version)
    await qi.addColumn("franchise_applications", "version", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
  const dialect = sequelize.getDialect();
  const users = await qi.describeTable("users");
  if (dialect === "mysql" && !users.role.type.includes("superadmin")) {
    await qi.changeColumn("users", "role", {
      type: DataTypes.ENUM("investor", "admin", "superadmin"),
      allowNull: false,
      defaultValue: "investor",
    });
  } else if (dialect === "postgres") {
    const types = await sequelize.query(
      "SELECT typname FROM pg_type WHERE typname = 'enum_users_role'",
      { type: QueryTypes.SELECT },
    );
    if (types.length)
      await sequelize.query(
        "ALTER TYPE \"enum_users_role\" ADD VALUE IF NOT EXISTS 'superadmin'",
      );
  }
  const indexes = (await qi.showIndex("franchise_applications")) as {
    name: string;
  }[];
  if (
    !indexes.some(
      (index) => index.name === "franchise_applications_project_id_unique",
    )
  )
    await qi.addIndex("franchise_applications", ["project_id"], {
      unique: true,
      name: "franchise_applications_project_id_unique",
    });
}
if (require.main === module)
  migrateFranchiseManagement()
    .then(() => {
      console.log("Migración de gestión de franquicias completada.");
    })
    .catch((error) => {
      console.error(
        "No se pudo completar la migración:",
        error instanceof Error ? error.name : "error",
      );
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
