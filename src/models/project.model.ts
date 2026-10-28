import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { sequelize } from "../config/database";

/**
 * Proyecto del marketplace (DemoProject). Catálogo público.
 * NOTA: solo la existencia de las marcas y sus programas de franquicia está
 * verificada; los escenarios de ROI son simulaciones, no ofertas reales.
 */
export class Project extends Model<
  InferAttributes<Project>,
  InferCreationAttributes<Project>
> {
  declare id: string; // slug estable usado en /marketplace/[slug]
  declare name: string;
  declare sector: "Comida rápida" | "Cafetería" | "Restaurantes";
  declare format: string;
  declare descriptor: string;
  declare company: string;
  declare franchise: string;
  declare officialUrl: string;
  declare logoUrl: string | null;
  declare palette: "lime" | "peach" | "lavender" | "mint";
  declare annualizedRoiScenario: number[];
  declare featuredRank: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  toContract() {
    return {
      id: this.id,
      name: this.name,
      sector: this.sector,
      format: this.format,
      descriptor: this.descriptor,
      company: this.company,
      franchise: this.franchise,
      officialUrl: this.officialUrl,
      ...(this.logoUrl ? { logoUrl: this.logoUrl } : {}),
      palette: this.palette,
      annualizedRoiScenario: this.annualizedRoiScenario,
    };
  }
}

Project.init(
  {
    id: {
      type: DataTypes.STRING(80),
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(120), allowNull: false },
    sector: {
      type: DataTypes.ENUM("Comida rápida", "Cafetería", "Restaurantes"),
      allowNull: false,
    },
    format: { type: DataTypes.STRING(120), allowNull: false },
    descriptor: { type: DataTypes.TEXT, allowNull: false },
    company: { type: DataTypes.TEXT, allowNull: false },
    franchise: { type: DataTypes.TEXT, allowNull: false },
    officialUrl: { type: DataTypes.STRING(500), allowNull: false },
    logoUrl: { type: DataTypes.STRING(500), allowNull: true },
    palette: {
      type: DataTypes.ENUM("lime", "peach", "lavender", "mint"),
      allowNull: false,
    },
    annualizedRoiScenario: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    // Orden "featured" del catálogo; menor = primero.
    featuredRank: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "projects",
    modelName: "Project",
  },
);
