import { DataTypes } from "sequelize";
import { sequelize } from "../src/models";

// Migración aditiva e idempotente; no borra perfiles, compras ni solicitudes previas.
export async function migrateMvp() {
  await sequelize.sync();
  const qi = sequelize.getQueryInterface();
  const additions: [string, string, object][] = [
    ["profiles", "dni", { type: DataTypes.STRING(12), allowNull: true }],
    ["profiles", "cuil", { type: DataTypes.STRING(11), allowNull: true }],
    ["profiles", "birth_date", { type: DataTypes.DATEONLY, allowNull: true }],
    ["profiles", "province", { type: DataTypes.STRING(100), allowNull: true }],
    ["profiles", "city", { type: DataTypes.STRING(100), allowNull: true }],
    ["profiles", "address", { type: DataTypes.STRING(200), allowNull: true }],
    [
      "profiles",
      "postal_code",
      { type: DataTypes.STRING(20), allowNull: true },
    ],
    [
      "franchise_applications",
      "review_note",
      { type: DataTypes.STRING(500), allowNull: true },
    ],
    [
      "franchise_applications",
      "project_id",
      { type: DataTypes.STRING(80), allowNull: true },
    ],
  ];
  for (const [table, column, definition] of additions) {
    const columns = await qi.describeTable(table);
    if (!columns[column]) await qi.addColumn(table, column, definition);
  }
  const distribution = await qi.describeTable("distributions");
  if (/\(3\)$/.test(distribution.currency?.type ?? ""))
    await qi.changeColumn("distributions", "currency", {
      type: DataTypes.STRING(12),
      allowNull: false,
    });
  const columns = await qi.describeTable("projects");
  if (
    sequelize.getDialect() === "postgres" &&
    columns.sector?.type === "USER-DEFINED"
  ) {
    await sequelize.query(
      'ALTER TABLE "projects" ALTER COLUMN "sector" TYPE VARCHAR(80) USING "sector"::text',
    );
  } else if (columns.sector?.type.includes("ENUM"))
    await qi.changeColumn("projects", "sector", {
      type: DataTypes.STRING(80),
      allowNull: false,
    });
}
if (require.main === module)
  migrateMvp()
    .then(() => sequelize.close())
    .catch((error) => {
      console.error(
        "Migración MVP no completada",
        error instanceof Error ? error.name : "error",
      );
      process.exitCode = 1;
    });
