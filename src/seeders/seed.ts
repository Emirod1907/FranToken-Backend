import { assertDatabaseConnection, sequelize } from "../config/database";
import {
  Profile,
  Project,
  TokenActivity,
  TokenHolding,
  User,
  syncModels,
} from "../models";
import { hashPassword } from "../utils/password";

// Catálogo del marketplace (espejo de marketplace.constants.ts del frontend).
// Solo la existencia de las marcas y sus programas de franquicia está verificada;
// los escenarios de ROI son simulaciones, no ofertas reales.
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
  },
  {
    id: "burger-king",
    name: "Burger King",
    sector: "Comida rápida" as const,
    format: "Restaurante de servicio rápido",
    descriptor: "Una unidad de restaurante cuyo territorio todavía no se definió.",
    company: "Burger King publica un programa de franquicias para operadores.",
    franchise:
      "La marca describe un proceso de selección y condiciones propias; no hay autorización para este proyecto de muestra.",
    officialUrl: "https://franchising.bk.com/",
    logoUrl: "https://cdn.simpleicons.org/burgerking/D62300",
    palette: "peach" as const,
    annualizedRoiScenario: [-5, 1, 4, 6, 5],
    featuredRank: 1,
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
  },
];

const DEMO_EMAIL = "demo@frantoken.test";
const DEMO_PASSWORD = "demodemo8"; // solo para el entorno de demostración

async function seedProjects() {
  for (const project of projects) {
    await Project.upsert(project);
  }
  console.log(`[seed] ${projects.length} proyectos del marketplace listos.`);
}

async function seedDemoUser() {
  const [user] = await User.findOrCreate({
    where: { email: DEMO_EMAIL },
    defaults: {
      email: DEMO_EMAIL,
      displayName: "Inversor demo",
      passwordHash: await hashPassword(DEMO_PASSWORD),
      // Rol admin solo para la demo local: permite probar las rutas de agente
      // on-chain (que además exigen BLOCKCHAIN_ALLOW_WRITES y una clave de agente).
      role: "admin",
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

  // Tenencias de ejemplo (espejo de demoHoldings). En un sistema real provienen
  // de un proceso de pago/emisión conciliado, no de la UI.
  const existing = await TokenHolding.count({ where: { userId: user.id } });
  if (existing === 0) {
    const miga = await TokenHolding.create({
      userId: user.id,
      projectName: "Miga",
      symbol: "MIGA · demo",
      quantity: 18,
      currency: "USD",
      investedAmount: 4500,
    });
    await TokenActivity.bulkCreate([
      {
        holdingId: miga.id,
        occurredAt: "2026-09-12",
        kind: "Compra de ejemplo",
        quantity: 8,
        unitPrice: 250,
        amount: 2000,
        currency: "USD",
        reference: "DEMO-MIG-002",
      },
      {
        holdingId: miga.id,
        occurredAt: "2026-07-04",
        kind: "Compra de ejemplo",
        quantity: 10,
        unitPrice: 250,
        amount: 2500,
        currency: "USD",
        reference: "DEMO-MIG-001",
      },
    ]);

    const casa = await TokenHolding.create({
      userId: user.id,
      projectName: "Casa Norte",
      symbol: "CASA · demo",
      quantity: 6,
      currency: "USD",
      investedAmount: 1800,
    });
    await TokenActivity.create({
      holdingId: casa.id,
      occurredAt: "2026-08-21",
      kind: "Compra de ejemplo",
      quantity: 6,
      unitPrice: 300,
      amount: 1800,
      currency: "USD",
      reference: "DEMO-CAS-001",
    });
  }

  console.log(`[seed] Usuario demo listo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

async function run() {
  await assertDatabaseConnection();
  await syncModels();
  await seedProjects();
  await seedDemoUser();
  await sequelize.close();
  console.log("[seed] Completado.");
}

run().catch((err) => {
  console.error("[seed] Error:", err);
  process.exit(1);
});
