import { env } from "../config/env";
import { academicRuntime, projectContracts } from "../blockchain/academic";
import { assertDatabaseConnection, sequelize } from "../config/database";
import { Profile, Project, User, syncModels } from "../models";

import { hashPassword } from "../utils/password";

// Catálogo del marketplace (espejo de marketplace.constants.ts del frontend).
// Solo la existencia de las marcas y sus programas de franquicia está verificada;
// los escenarios de ROI son simulaciones, no ofertas reales. Precio MVP: USD 10.
const projects = [
  {
    id: "mcdonalds",
    name: "McDonald's",
    sector: "Comida rápida" as const,
    format: "Restaurante de servicio rápido",
    descriptor: "Una unidad de restaurante en una zona aún por evaluar.",
    company:
      "McDonald's es una cadena de restaurantes con un programa oficial de franquicias.",
    franchise:
      "El proceso de franquicia y la disponibilidad de restaurantes dependen de McDonald's y del mercado correspondiente.",
    officialUrl:
      "https://corporate.mcdonalds.com/corpmcd/franchising-overview/global-franchising.html",
    logoUrl: "https://cdn.simpleicons.org/mcdonalds/FFC72C",
    palette: "lime" as const,
    annualizedRoiScenario: [-3, 2, 5, 4, 7],
    featuredRank: 0,
    status: "publicada" as const,
    tokenSymbol: "MCD",
    unitPriceMinor: "1000",
  },
  {
    id: "burger-king",
    name: "Burger King",
    sector: "Comida rápida" as const,
    format: "Restaurante de servicio rápido",
    descriptor:
      "Una unidad de restaurante cuyo territorio todavía no se definió.",
    company: "Burger King publica un programa de franquicias para operadores.",
    franchise:
      "La marca describe un proceso de selección y condiciones propias; no hay autorización para este proyecto de muestra.",
    officialUrl: "https://franchising.bk.com/",
    logoUrl: "https://cdn.simpleicons.org/burgerking/D62300",
    palette: "peach" as const,
    annualizedRoiScenario: [-5, 1, 4, 6, 5],
    featuredRank: 1,
    status: "publicada" as const,
    tokenSymbol: "BK",
    unitPriceMinor: "1000",
  },
  {
    id: "havanna",
    name: "Havanna",
    sector: "Cafetería" as const,
    format: "Havanna Café",
    descriptor: "Un café de marca conocida en una plaza a definir.",
    company:
      "Havanna comercializa productos de cafetería y confitería y presenta Havanna Café.",
    franchise:
      "Su sitio oficial describe el formato de franquicia Havanna Café; inversión y ubicación requieren evaluación específica.",
    officialUrl: "https://havanna.com.ar/atencion-al-cliente/franquicias",
    logoUrl: null,
    palette: "lavender" as const,
    annualizedRoiScenario: [-2, 3, 6, 5, 8],
    featuredRank: 2,
    // El inicio de operación se confirma desde administración.
    status: "publicada" as const,
    tokenSymbol: "HAV",
    unitPriceMinor: "1000",
  },
  {
    id: "pizza-hut",
    name: "Pizza Hut",
    sector: "Restaurantes" as const,
    format: "Restaurante de pizza",
    descriptor: "Un posible restaurante, sujeto a formato y mercado.",
    company:
      "Pizza Hut opera una red internacional de restaurantes y ofrece franquicias.",
    franchise:
      "La marca presenta distintos formatos; costos y requisitos dependen del acuerdo y la jurisdicción.",
    officialUrl: "https://franchise.pizzahut.com/",
    logoUrl: "https://cdn.simpleicons.org/pizzahut/EE3D43",
    palette: "mint" as const,
    annualizedRoiScenario: [-4, 0, 3, 5, 6],
    featuredRank: 3,
    status: "publicada" as const,
    tokenSymbol: "PZH",
    unitPriceMinor: "1000",
  },
];

const DEMO_EMAIL = "demo@frantoken.test";
const DEMO_PASSWORD = "demodemo8"; // solo para el entorno de demostración

async function seedProjects() {
  for (const project of projects) {
    await Project.findOrCreate({
      where: { id: project.id },
      defaults: project,
    });
  }
  console.log(`[seed] ${projects.length} proyectos del marketplace listos.`);
}

async function seedDemoUserAndCircuit() {
  const [user] = await User.findOrCreate({
    where: { email: DEMO_EMAIL },
    defaults: {
      email: DEMO_EMAIL,
      displayName: "Inversor demo",
      passwordHash: await hashPassword(DEMO_PASSWORD),
      // Administrador de demostración; no habilita inversiones sin revisión.
      role: "admin",
      kycApproved: false,
    },
  });

  await Profile.findOrCreate({
    where: { userId: user.id },
    defaults: {
      userId: user.id,
      fullName: "Inversor Demo",
      phone: "",
      country: "Argentina",
      investorUpdates: true,
    },
  });

  console.log(`[seed] Administrador demo listo: ${DEMO_EMAIL}`);
}

/** Siembra idempotente, reutilizable desde el arranque del server (SEED_ON_BOOT). */
export async function seedAll() {
  await seedProjects();
  await seedDemoUserAndCircuit();
  if (env.blockchain.enabled) await importAcademicCatalog();
}

async function runCli() {
  await assertDatabaseConnection();
  await syncModels();
  await seedAll();
  await sequelize.close();
  console.log("[seed] Completado.");
}

// Solo se ejecuta cuando se corre como script (no al importarlo desde el server).
if (require.main === module) {
  runCli().catch((err) => {
    console.error("[seed] Error:", err);
    process.exit(1);
  });
}

export async function importAcademicCatalog() {
  const { manifest } = await academicRuntime();
  for (const item of manifest.projects) {
    const project = await Project.findByPk(item.id);
    if (!project) continue;
    await project.update({
      tokenAddress: item.token,
      investmentAgreementAddress: item.investment,
      unitPriceMinor: "1000",
      currencyDecimals: 2,
      currency: "USD",
    });
    const { token } = await projectContracts(project);
    await project.update({
      tokenSymbol: await token.symbol(),
      totalUnits: (await token.maxSupply()).toString(),
    });
  }
}
