/* Prueba cliente frontend -> Express (middlewares reales) -> Sequelize/SQLite real
 * -> contratos reales en Hardhat. Reemplaza únicamente transportes de socket y
 * el driver sqlite3 por node:sqlite. No usa una base o cadena existente. */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Duplex } = require("node:stream");
const { IncomingMessage, ServerResponse } = require("node:http");
const Module = require("node:module");
const back = path.resolve(__dirname, ".."),
  front = path.resolve(back, "../frantoken-frontend"),
  chain = path.resolve(back, "../FranToken_Blockchain");
process.chdir("/tmp");
Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: "sqlite::memory:",
  DB_DIALECT: "sqlite",
  DB_SSL: "false",
  DB_SYNC: "false",
  JWT_SECRET: "synthetic-integration-only",
  BLOCKCHAIN_ENABLED: "true",
  BLOCKCHAIN_ALLOW_WRITES: "true",
  BLOCKCHAIN_USE_LOCAL_ACCOUNTS: "true",
  BLOCKCHAIN_ADMIN_PRIVATE_KEY: "",
  BLOCKCHAIN_VERIFIER_PRIVATE_KEY: "",
  BLOCKCHAIN_RPC_URL: "http://127.0.0.1:8545",
  NEXT_PUBLIC_API_URL: "http://localhost:4000",
});
const load = Module._load;
Module._load = function (name, ...rest) {
  if (name === "sqlite3") return require("./support/node-sqlite.cjs");
  if (name.startsWith("@/")) name = path.join(front, "src", name.slice(2));
  return load.call(this, name, ...rest);
};
require(path.join(back, "node_modules/ts-node")).register({
  project: path.join(back, "tsconfig.json"),
  transpileOnly: true,
  compilerOptions: { jsx: "react-jsx" },
});
const models = require(path.join(back, "src/models"));
const { createApp } = require(path.join(back, "src/app"));
const { hashPassword } = require(path.join(back, "src/utils/password"));
const { apiSessionRepository } = require(
  path.join(front, "src/core/repositories/apiSession.repository"),
);
const { apiAccountRepository } = require(
  path.join(front, "src/features/account/repositories/apiAccount.repository"),
);
const accountService = require(
  path.join(front, "src/features/account/services/account.service"),
);
const wallet = require(
  path.join(
    front,
    "src/features/investment/repositories/academicWallet.repository",
  ),
);
const investments = require(
  path.join(
    front,
    "src/features/investment/services/academicInvestment.service",
  ),
);
const adminClient = require(
  path.join(
    front,
    "src/features/investment/repositories/adminReview.repository",
  ),
);
const app = createApp();
async function dispatch(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error(`HTTP no finalizó: ${method} ${url}`)),
      10000,
    );
    const chunks = [];
    const socket = new Duplex({
      read() {},
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });
    Object.defineProperty(socket, "remoteAddress", { value: "127.0.0.1" });
    const req = new IncomingMessage(socket);
    req._read = () => {};
    req.complete = true;
    req.method = method;
    req.url = url;
    const payload = body === undefined ? "" : JSON.stringify(body);
    req.headers = {
      host: "localhost:4000",
      origin: "http://localhost:3000",
      ...(payload
        ? {
            "content-type": "application/json",
            "content-length": String(Buffer.byteLength(payload)),
          }
        : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    };
    const res = new ServerResponse(req);
    res.assignSocket(socket);
    res.on("finish", () => {
      clearTimeout(timeout);
      const raw = Buffer.concat(chunks).toString();
      const data = raw.slice(raw.indexOf("\r\n\r\n") + 4);
      resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
    });
    res.on("error", reject);
    app.handle(req, res);
    if (payload) req.push(payload);
    req.push(null);
  });
}
async function main() {
  process.chdir(chain);
  const hardhat = require(path.join(chain, "node_modules/hardhat"));
  await hardhat.run("compile");
  const { deployAcademic } = require(
    path.join(chain, "scripts/deploy-academic"),
  );
  const manifest = await deployAcademic({ writeManifest: false });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "frantoken-integrated-"));
  process.env.BLOCKCHAIN_MANIFEST_PATH = path.join(dir, "manifest.json");
  await fs.writeFile(
    process.env.BLOCKCHAIN_MANIFEST_PATH,
    JSON.stringify(manifest),
  );
  // env se importó antes de crear el manifiesto: este objeto configurable es solo fixture.
  const { env } = require(path.join(back, "src/config/env"));
  env.blockchain.manifestPath = process.env.BLOCKCHAIN_MANIFEST_PATH;
  for (const ethers of [
    hardhat.ethers,
    require(path.join(back, "node_modules/ethers")),
  ])
    ethers.JsonRpcProvider.prototype._send = async function (payload) {
      return Promise.all(
        (Array.isArray(payload) ? payload : [payload]).map(async (p) => {
          try {
            return {
              id: p.id,
              jsonrpc: "2.0",
              result: await hardhat.network.provider.send(p.method, p.params),
            };
          } catch (e) {
            return {
              id: p.id,
              jsonrpc: "2.0",
              error: {
                code: e.code || -32000,
                message: e.message,
                data: e.data,
              },
            };
          }
        }),
      );
    };
  await models.sequelize.sync();
  const signers = await hardhat.ethers.getSigners();
  let activeWallet = signers[4].address;
  const storage = new Map();
  global.window = {
    location: { origin: "http://localhost:3000" },
    localStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, v),
      removeItem: (k) => storage.delete(k),
    },
    dispatchEvent() {},
    addEventListener() {},
    removeEventListener() {},
    ethereum: {
      request: async ({ method, params = [] }) => {
        if (method === "eth_accounts" || method === "eth_requestAccounts")
          return [activeWallet];
        if (method === "personal_sign")
          return hardhat.network.provider.send("eth_sign", [
            params[1],
            params[0],
          ]);
        return hardhat.network.provider.send(method, params);
      },
    },
  };
  let loseResponse = false;
  global.fetch = async (url, options = {}) => {
    const u = new URL(url, "http://localhost:4000");
    const headers = new Headers(options.headers);
    const token = headers.get("Authorization")?.replace("Bearer ", "");
    const result = await dispatch(
      options.method || "GET",
      u.pathname + u.search,
      options.body ? JSON.parse(options.body) : undefined,
      token,
    );
    if (
      loseResponse &&
      u.pathname.endsWith("/purchases") &&
      result.status === 201
    ) {
      loseResponse = false;
      throw Error("Respuesta perdida tras emitir");
    }
    return new Response(
      result.data === null ? null : JSON.stringify(result.data),
      {
        status: result.status,
        headers: { "Content-Type": "application/json" },
      },
    );
  };
  for (const item of manifest.projects)
    await models.Project.create({
      id: item.id,
      name: item.name,
      sector: "Cafetería",
      format: "Académica",
      descriptor: "Franquicia de prueba",
      company: "Demo",
      franchise: "Demo",
      officialUrl: "",
      logoUrl: null,
      palette: "mint",
      annualizedRoiScenario: [],
      unitPriceMinor: "1000",
      currency: "USD",
      currencyDecimals: 2,
      tokenSymbol: "TEST",
      tokenAddress: item.token,
      investmentAgreementAddress: item.investment,
      totalUnits: "1000",
      unitsSold: "0",
    });
  const admin = await models.User.create({
    email: "admin@example.test",
    displayName: "Admin demo",
    passwordHash: await hashPassword("testpass8"),
    role: "admin",
  });
  let count = 0;
  async function check(name, fn) {
    await fn();
    console.log(`OK ${++count}: ${name}`);
  }
  let user, userToken, adminToken, snapshot, application;
  const token = () => storage.get("frantoken:token:v1");
  const asUser = () => storage.set("frantoken:token:v1", userToken);
  const asAdmin = () => storage.set("frantoken:token:v1", adminToken);
  await check(
    "registro real, sesión validada y permisos de usuario",
    async () => {
      user = await apiSessionRepository.register({
        email: "user@example.test",
        displayName: "Usuario demo",
        password: "testpass8",
      });
      userToken = token();
      assert.equal(user.role, "investor");
      assert.equal(
        (await apiSessionRepository.getSession()).userId,
        user.userId,
      );
      assert.equal(
        (await dispatch("GET", "/api/admin/users", undefined, userToken))
          .status,
        403,
      );
    },
  );
  await check(
    "sin documentación no se compra ni se envía solicitud",
    async () => {
      assert.equal(
        (
          await dispatch(
            "POST",
            "/api/account/purchases",
            {
              projectId: "havanna",
              units: "1",
              requestId: crypto.randomUUID(),
            },
            userToken,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await dispatch(
            "POST",
            "/api/account/applications",
            {
              franchiseName: "Solicitud sin perfil",
              sector: "Servicios",
              city: "Ciudad demo",
              country: "Argentina",
              totalCost: 10000,
              currency: "USD",
              operatorName: "Demo",
              estimatedOpening: "2027-01",
              description:
                "Una propuesta académica sin documentación personal.",
            },
            userToken,
          )
        ).status,
        409,
      );
      assert.equal((await dispatch("GET", "/api/account/profile")).status, 401);
    },
  );
  const profile = {
    fullName: "Persona de prueba",
    phone: "000000000",
    country: "Argentina",
    investorUpdates: false,
    dni: "00000000",
    cuil: "00000000000",
    birthDate: "2000-01-01",
    province: "Provincia de prueba",
    city: "Ciudad de prueba",
    address: "Domicilio de prueba 123",
    postalCode: "0000",
  };
  await check(
    "perfil completo persistido, validación de fecha y sin aprobación automática",
    async () => {
      const notifications = [];
      const unsubscribe = apiSessionRepository.subscribe((value) =>
        notifications.push(value),
      );
      try {
        const saved = await accountService.saveProfile(
          user.userId,
          {
            ...profile,
            fullName: `  ${profile.fullName}  `,
            cuil: "00-00000000-0",
          },
          apiAccountRepository,
        );
        assert.deepEqual(saved, profile);
        assert.equal(notifications.length, 1);
        assert.equal(notifications[0].displayName, profile.fullName);
        assert.equal(notifications[0].kycApproved, false);
      } finally {
        unsubscribe();
      }
      assert.equal(
        (await models.User.findByPk(user.userId)).displayName,
        profile.fullName,
      );
      assert.equal(
        JSON.parse(storage.get("frantoken:session:v1")).displayName,
        profile.fullName,
      );
      assert.equal(
        (await apiSessionRepository.getSession()).displayName,
        profile.fullName,
      );
      assert.equal(
        (await apiAccountRepository.getProfile(user.userId)).dni,
        profile.dni,
      );
      assert.equal(
        (
          await dispatch(
            "PUT",
            "/api/account/profile",
            { ...profile, birthDate: "2999-01-01" },
            userToken,
          )
        ).status,
        400,
      );
      assert.equal(
        (await models.User.findByPk(user.userId)).kycApproved,
        false,
      );
    },
  );
  await check(
    "validación del perfil coincide entre frontend y backend",
    async () => {
      const frontendSchema = require(
        path.join(front, "src/features/account/schemas/profile.schema"),
      ).profileSchema;
      const backendSchema = require(
        path.join(back, "src/validators/account.validator"),
      ).profileSchema;
      const normalized = {
        ...profile,
        fullName: ` ${profile.fullName} `,
        cuil: "00-00000000-0",
        province: ` ${profile.province} `,
      };
      assert.deepEqual(
        frontendSchema.parse(normalized),
        backendSchema.parse(normalized),
      );
      for (const invalid of [
        { dni: "123456" },
        { cuil: "1234567890" },
        { birthDate: "2026-02-30" },
        { birthDate: "2999-01-01" },
        { province: "  " },
        { city: "a".repeat(101) },
        { address: "a".repeat(201) },
        { postalCode: "12" },
        { fullName: "a".repeat(101) },
        { phone: "1".repeat(31) },
        { country: "a".repeat(61) },
      ]) {
        assert.equal(
          frontendSchema.safeParse({ ...profile, ...invalid }).success,
          false,
        );
        assert.equal(
          backendSchema.safeParse({ ...profile, ...invalid }).success,
          false,
        );
      }
    },
  );
  await check(
    "error al actualizar usuario revierte todo el perfil y no altera la sesión",
    async () => {
      const before = await apiAccountRepository.getProfile(user.userId);
      const cachedSession = storage.get("frantoken:session:v1");
      const failureName = "Nombre que simula fallo de usuario";
      models.User.addHook("beforeSave", "profile-rollback-test", (value) => {
        if (value.displayName === failureName)
          throw Error("Fallo simulado del usuario");
      });
      try {
        await assert.rejects(
          accountService.saveProfile(
            user.userId,
            {
              ...profile,
              fullName: failureName,
              address: "Dirección que debe revertirse 456",
            },
            apiAccountRepository,
          ),
          /Error interno del servidor/,
        );
      } finally {
        models.User.removeHook("beforeSave", "profile-rollback-test");
      }
      assert.deepEqual(
        await apiAccountRepository.getProfile(user.userId),
        before,
      );
      assert.equal(
        (await models.User.findByPk(user.userId)).displayName,
        profile.fullName,
      );
      assert.equal(storage.get("frantoken:session:v1"), cachedSession);
    },
  );
  await check(
    "error de usuario en el primer guardado no deja un perfil creado parcialmente",
    async () => {
      const registered = await dispatch("POST", "/api/auth/register", {
        email: "rollback@example.test",
        displayName: "Usuario sin perfil",
        password: "testpass8",
      });
      assert.equal(registered.status, 201);
      const newUser = registered.data.session;
      models.User.addHook(
        "beforeSave",
        "profile-create-rollback-test",
        (value) => {
          if (value.id === newUser.userId)
            throw Error("Fallo simulado en alta de perfil");
        },
      );
      try {
        assert.equal(
          (
            await dispatch(
              "PUT",
              "/api/account/profile",
              profile,
              registered.data.token,
            )
          ).status,
          500,
        );
      } finally {
        models.User.removeHook("beforeSave", "profile-create-rollback-test");
      }
      assert.equal(
        await models.Profile.count({ where: { userId: newUser.userId } }),
        0,
      );
      assert.equal(
        (await models.User.findByPk(newUser.userId)).displayName,
        newUser.displayName,
      );
    },
  );
  await check(
    "guardar contactos conserva aprobación y cambiar identidad la revoca en sesión y SQL",
    async () => {
      await models.User.update(
        { kycApproved: true },
        { where: { id: user.userId } },
      );
      await accountService.saveProfile(
        user.userId,
        { ...profile, phone: "123456789", investorUpdates: true },
        apiAccountRepository,
      );
      assert.equal((await models.User.findByPk(user.userId)).kycApproved, true);
      assert.equal(
        JSON.parse(storage.get("frantoken:session:v1")).kycApproved,
        true,
      );
      await accountService.saveProfile(
        user.userId,
        { ...profile, fullName: "Otro nombre de prueba" },
        apiAccountRepository,
      );
      assert.equal(
        (await models.User.findByPk(user.userId)).kycApproved,
        false,
      );
      assert.equal(
        JSON.parse(storage.get("frantoken:session:v1")).kycApproved,
        false,
      );
      await accountService.saveProfile(
        user.userId,
        profile,
        apiAccountRepository,
      );
    },
  );
  await check(
    "cualquier usuario presenta franquicia sin historial y recibe ID del servidor",
    async () => {
      application = await accountService.submitFranchise(
        user.userId,
        {
          franchiseName: "Franquicia nueva",
          sector: "Servicios",
          city: "Ciudad demo",
          country: "Argentina",
          totalCost: 10000,
          currency: "USD",
          operatorName: "Operador demo",
          estimatedOpening: "2027-01",
          description:
            "Proyecto ficticio para presentar una franquicia académica.",
          performanceSource: "No aplica: proyecto nuevo",
        },
        apiAccountRepository,
      );
      const stored = await models.FranchiseApplication.findByPk(application.id);
      assert.equal(stored.userId, user.userId);
      assert.equal(application.status, "Enviada");
      assert.equal(application.performance.length, 0);
      assert.equal(
        (await apiAccountRepository.getApplications(user.userId)).length,
        1,
      );
    },
  );
  await check(
    "vincular wallet exige prueba firmada y no habilita KYC automáticamente",
    async () => {
      assert.equal(await wallet.connectAcademicWallet(), activeWallet);
      assert.equal(
        (await models.User.findByPk(user.userId)).walletAddress,
        activeWallet,
      );
      assert.equal(
        (
          await dispatch(
            "POST",
            "/api/account/purchases",
            {
              projectId: "havanna",
              units: "1",
              requestId: crypto.randomUUID(),
            },
            userToken,
          )
        ).status,
        409,
      );
    },
  );
  await check(
    "administrador revisa perfil y habilita wallet en el registro",
    async () => {
      await apiSessionRepository.signIn({
        email: "admin@example.test",
        password: "testpass8",
      });
      adminToken = token();
      const reviews = await adminClient.readAdminReviews();
      assert.equal(reviews.applications[0].id, application.id);
      await adminClient.approveReviewUser(user.userId, true);
      assert.equal((await models.User.findByPk(user.userId)).kycApproved, true);
    },
  );
  await check(
    "compra por Express exige términos y emite mediante C4 con precio exacto",
    async () => {
      asUser();
      snapshot = await wallet.fetchAcademicSnapshot(null);
      const project = snapshot.projects.find((p) => p.id === "havanna");
      await assert.rejects(
        investments.buyAcademicTokens(snapshot, "havanna", "1"),
        /términos/,
      );
      await wallet.acceptAcademicTerms(project, activeWallet);
      await investments.buyAcademicTokens(snapshot, "havanna", "1");
      snapshot = await wallet.fetchAcademicSnapshot(null);
      assert.equal(
        snapshot.projects.find((p) => p.id === "havanna").balance,
        "1",
      );
      assert.equal(
        await models.Purchase.count({ where: { status: "confirmed" } }),
        1,
      );
      assert.equal(
        (await apiAccountRepository.getHoldings(user.userId))[0].quantity,
        1,
      );
    },
  );
  await check(
    "respuesta perdida recupera la compra sin doble emisión y rechaza payload distinto",
    async () => {
      loseResponse = true;
      await assert.rejects(
        investments.buyAcademicTokens(snapshot, "havanna", "2"),
        /Respuesta perdida/,
      );
      await assert.rejects(
        investments.buyAcademicTokens(snapshot, "havanna", "3"),
        /pendiente/,
      );
      assert.equal(
        (await investments.buyAcademicTokens(snapshot, "havanna", "2"))
          .recovered,
        true,
      );
      snapshot = await wallet.fetchAcademicSnapshot(null);
      assert.equal(
        snapshot.projects.find((p) => p.id === "havanna").balance,
        "3",
      );
      assert.equal(
        await models.Purchase.count({ where: { status: "confirmed" } }),
        2,
      );
    },
  );
  await check(
    "operación y distribución mensual sincronizadas; período e importe protegidos",
    async () => {
      asAdmin();
      let adm = await wallet.fetchAcademicSnapshot(null);
      await assert.rejects(
        investments.submitAcademicOperation(adm, {
          action: "distribute",
          projectId: "havanna",
          period: "2026-11",
          amount: "30",
        }),
        /operación/,
      );
      await investments.submitAcademicOperation(adm, {
        action: "state",
        projectId: "havanna",
        status: 2,
      });
      await investments.submitAcademicOperation(adm, {
        action: "distribute",
        projectId: "havanna",
        period: "2026-11",
        amount: "30",
      });
      await investments.submitAcademicOperation(adm, {
        action: "distribute",
        projectId: "havanna",
        period: "2026-11",
        amount: "30",
      });
      await assert.rejects(
        investments.submitAcademicOperation(adm, {
          action: "distribute",
          projectId: "havanna",
          period: "2026-11",
          amount: "31",
        }),
      );
      assert.equal(
        await models.Distribution.count({ where: { status: "confirmed" } }),
        1,
      );
    },
  );
  await check(
    "saldo e ingresos vienen de cadena, cobro firmado y sin doble pago",
    async () => {
      asUser();
      snapshot = await wallet.fetchAcademicSnapshot(null);
      const p = snapshot.projects.find((p) => p.id === "havanna");
      assert.equal(p.withdrawable, "30.0");
      const guidance = await dispatch(
        "POST",
        "/api/account/revenue/claim",
        { projectId: "havanna" },
        userToken,
      );
      assert.equal(guidance.data.availableMinor, "30000000");
      await wallet.claimAcademicRevenue(p, activeWallet);
      await assert.rejects(wallet.claimAcademicRevenue(p, activeWallet));
      snapshot = await wallet.fetchAcademicSnapshot(null);
      assert.equal(
        snapshot.projects.find((p) => p.id === "havanna").withdrawn,
        "30.0",
      );
    },
  );
  await check(
    "aprobación y publicación crean proyecto, token y C4; retry no duplica",
    async () => {
      asAdmin();
      await adminClient.reviewFranchise(
        application.id,
        "Aprobada",
        "Aprobación de prueba",
      );
      await adminClient.publishFranchise(application.id, "NUEVA", "100");
      await adminClient.publishFranchise(application.id, "NUEVA", "100");
      const app = await models.FranchiseApplication.findByPk(application.id);
      assert.equal(app.status, "Publicada");
      const p = await models.Project.findByPk(app.projectId);
      assert.ok(p.tokenAddress);
      assert.equal(p.sector, "Servicios");
      const response = await dispatch("GET", `/api/projects/${p.id}`);
      assert.equal(response.status, 200);
      assert.equal(response.data.project.availability.unitsAvailable, "100");
      assert.equal(JSON.stringify(response.data).includes(profile.dni), false);
      assert.equal(
        (await dispatch("GET", `/api/projects`)).data.projects.length,
        5,
      );
    },
  );
  await check(
    "franquicia recién publicada admite compra, reparto y cobro en sus contratos propios",
    async () => {
      asUser();
      snapshot = await wallet.fetchAcademicSnapshot(null);
      const project = snapshot.projects.find(
        (p) => p.name === "Franquicia nueva",
      );
      await wallet.acceptAcademicTerms(project, activeWallet);
      await investments.buyAcademicTokens(snapshot, project.id, "2");
      const requestId = crypto.randomUUID();
      const duplicates = await Promise.all([
        dispatch(
          "POST",
          "/api/account/purchases",
          { projectId: project.id, units: "2", requestId },
          userToken,
        ),
        dispatch(
          "POST",
          "/api/account/purchases",
          { projectId: project.id, units: "2", requestId },
          userToken,
        ),
      ]);
      assert.deepEqual(duplicates.map((r) => r.status).sort(), [200, 201]);
      asAdmin();
      const adm = await wallet.fetchAcademicSnapshot(null);
      await investments.submitAcademicOperation(adm, {
        action: "state",
        projectId: project.id,
        status: 2,
      });
      await investments.submitAcademicOperation(adm, {
        action: "distribute",
        projectId: project.id,
        period: "2026-12",
        amount: "12.345678",
      });
      asUser();
      snapshot = await wallet.fetchAcademicSnapshot(null);
      const updated = snapshot.projects.find((p) => p.id === project.id);
      assert.equal(updated.balance, "4");
      assert.equal(updated.withdrawable, "12.345678");
      await wallet.claimAcademicRevenue(updated, activeWallet);
    },
  );
  await check(
    "migración aditiva ejecutable dos veces preserva usuarios y compras",
    async () => {
      const { migrateMvp } = require(path.join(back, "scripts/migrate-mvp"));
      const purchases = await models.Purchase.count();
      // Simula un perfil anterior a la migración, con filas reales conservadas.
      for (const column of ["dni", "cuil", "birth_date"]) {
        await models.sequelize.query(
          `ALTER TABLE profiles DROP COLUMN ${column}`,
        );
      }
      await migrateMvp();
      await migrateMvp();
      assert.equal(await models.Purchase.count(), purchases);
      const migratedProfile = await models.Profile.findOne({
        where: { userId: user.userId },
      });
      assert.equal(migratedProfile.fullName, profile.fullName);
      assert.equal(migratedProfile.dni, null);
      assert.ok(await models.User.findByPk(user.userId));
    },
  );
  await check(
    "editar identidad revoca aprobación para nuevas compras y sesión expirada se elimina",
    async () => {
      asUser();
      await accountService.saveProfile(
        user.userId,
        { ...profile, address: "Otro domicilio de prueba 555" },
        apiAccountRepository,
      );
      assert.equal(
        (await models.User.findByPk(user.userId)).kycApproved,
        false,
      );
      assert.equal(
        (
          await dispatch(
            "POST",
            "/api/account/purchases",
            {
              projectId: "havanna",
              units: "1",
              requestId: crypto.randomUUID(),
            },
            userToken,
          )
        ).status,
        409,
      );
      storage.set("frantoken:token:v1", "invalid-token");
      assert.equal(await apiSessionRepository.getSession(), null);
      assert.equal(token(), undefined);
    },
  );
  await models.sequelize.close();
  await fs.rm(dir, { recursive: true, force: true });
  console.log(
    `${count} escenarios completos: frontend -> Express/JWT -> SQL real -> Hardhat.`,
  );
}
const watchdog = setTimeout(() => {
  console.error("La integración no terminó dentro de 90 segundos.");
  process.exit(1);
}, 90000);
main()
  .then(() => {
    clearTimeout(watchdog);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
