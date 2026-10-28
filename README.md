# FranToken · Backend

API REST en **Node.js + Express + TypeScript + MySQL + Sequelize** que implementa las capacidades que el frontend (`frantoken-frontend`) hoy resuelve con repositorios demo en `localStorage`. Reemplaza, uno a uno, los contratos descritos en `docs/architecture/ACCOUNT-DEMO.md` del frontend:

| Capacidad | Contrato del frontend | Implementación aquí |
|---|---|---|
| Sesión | `SessionRepository` | `POST /auth/login`, `register`, `GET /auth/session`, `PATCH /auth/display-name` (JWT) |
| Perfil | `AccountRepository.getProfile/saveProfile` | `GET/PUT /account/profile` |
| Tenencias | `AccountRepository.getHoldings` | `GET /account/holdings` (solo lectura) |
| Solicitudes y borrador | `getApplications/saveApplication/getDraft/saveDraft/clearDraft` | `GET/POST /account/applications`, `GET/PUT/DELETE /account/draft` |
| Marketplace | `getDemoProjects` | `GET /projects`, `GET /projects/:slug` |

> **Alcance.** Es un prototipo técnico alineado al estado del proyecto FranToken: las marcas y sus escenarios de ROI son datos de muestra, no ofertas reales. Las tenencias demo (`TokenHolding`) se sirven como datos de solo lectura; en un sistema real una posición debe provenir de un proceso de pago/emisión conciliado, nunca de la UI. Importes en `DECIMAL`, nunca float. El módulo blockchain (abajo) conecta con los contratos ERC-3643 del repo `FranToken`: las lecturas on-chain están disponibles al configurarse, pero la emisión, los pagos y las distribuciones están **apagados por defecto** y requieren aprobación, autorización y auditoría antes de usarse con valores reales.

## Requisitos

- Node.js ≥ 18 (probado con v24)
- MySQL ≥ 8 en ejecución

## Puesta en marcha

```bash
# 1. Variables de entorno
cp .env.example .env        # editá credenciales de MySQL y JWT_SECRET

# 2. Crear la base (una vez)
#    mysql -u root -p -e "CREATE DATABASE frantoken CHARACTER SET utf8mb4;"

# 3. Dependencias
npm install

# 4. Sembrar catálogo + usuario demo (crea tablas con DB_SYNC)
npm run db:seed

# 5. Desarrollo (recarga en caliente)
npm run dev
```

El servidor queda en `http://localhost:4000`. Health check: `GET /api/health`.

Con `DB_SYNC=true` (desarrollo) los modelos se sincronizan al arrancar. En producción, desactivá `DB_SYNC` y usá migraciones.

Usuario demo tras el seed: `demo@frantoken.test` / `demodemo8`.

### Producción

```bash
npm run build     # compila a dist/
npm run db:seed:prod
npm start
```

## Autenticación

JWT Bearer. `register`/`login` devuelven `{ token, session }`. El cliente guarda el token y lo envía en cada petición protegida:

```
Authorization: Bearer <token>
```

`session = { userId, email, displayName }`, exactamente el `DemoSession` del frontend.

## Endpoints

Base: `/api`

### Auth
| Método | Ruta | Auth | Cuerpo | Respuesta |
|---|---|---|---|---|
| POST | `/auth/register` | — | `{ displayName, email, password }` | `201 { token, session }` |
| POST | `/auth/login` | — | `{ email, password }` | `{ token, session }` |
| POST | `/auth/logout` | — | — | `{ ok: true }` (el cliente descarta el token) |
| GET | `/auth/session` | Bearer | — | `{ session }` |
| PATCH | `/auth/display-name` | Bearer | `{ displayName }` | `{ session }` |

### Cuenta (requiere Bearer)
| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/account/profile` | — | `{ profile \| null }` |
| PUT | `/account/profile` | `UserProfile` | `{ profile }` |
| GET | `/account/holdings` | — | `{ holdings: TokenHolding[] }` |
| GET | `/account/applications` | — | `{ applications: FranchiseApplication[] }` |
| POST | `/account/applications` | `FranchiseFormValues` | `201 { application }` |
| GET | `/account/draft` | — | `{ draft \| null }` |
| PUT | `/account/draft` | `{ payload: {...} }` | `{ draft }` |
| DELETE | `/account/draft` | — | `204` |

Además, para la integración on-chain:
| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/account/wallet` | — | `{ walletAddress \| null }` |
| PUT | `/account/wallet` | `{ walletAddress }` | `{ walletAddress }` (checksum; 409 si ya está vinculada a otra cuenta) |

### Marketplace (público)
| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/projects` | `{ projects: DemoProject[] }` |
| GET | `/projects/:slug` | `{ project }` (404 si no existe) |

### Blockchain (ERC-3643)
Puente con los contratos del repo `FranToken` (Hardhat). Requiere `BLOCKCHAIN_ENABLED=true` y las direcciones desplegadas; si no, responde `503`.

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/blockchain/status` | — | Estado del módulo: habilitado, escrituras, red y direcciones |
| GET | `/blockchain/token` | — | Info del `FranchiseToken`: supply, holders, pausa, datos de la franquicia |
| GET | `/blockchain/compliance` | — | Parámetros de `FranchiseCompliance` (máx. holders, tenencia, lock-up) |
| GET | `/blockchain/holders/:address` | — | Saldo, congelamiento, ingresos reclamables y KYC de una wallet |
| GET | `/blockchain/me` | Bearer | Lo mismo para la wallet vinculada del usuario |
| POST | `/blockchain/kyc` | admin+agente | `registerIdentity(address, identity, country)` |
| POST | `/blockchain/mint` | admin+agente | Emite participaciones a una wallet verificada |
| POST | `/blockchain/freeze` | admin+agente | Congela/descongela una wallet |
| POST | `/blockchain/pause` | admin+agente | Pausa/reanuda el token |
| POST | `/blockchain/distribute` | admin+agente | `approve` + `distributeRevenue(amount, memo)` |

Las operaciones de escritura (`kyc/mint/freeze/pause/distribute`) exigen las **tres** condiciones: usuario con rol `admin`, `BLOCKCHAIN_ALLOW_WRITES=true` y `BLOCKCHAIN_AGENT_PRIVATE_KEY` configurada (la clave firma como agente del contrato). Responden `202` con los hashes de transacción. Las cantidades se envían como texto decimal (p. ej. `"100"`) y se escalan con los decimales del contrato. **El reclamo de ingresos (`claimRevenue`) lo hace el inversor desde su propia wallet, no el servidor.**

> Estado del repo de contratos: **no auditado**. Emisión, pagos y distribuciones requieren reglas aprobadas, autorización por actor, conciliación y revisión legal antes de operar con valores reales. Por eso las escrituras están apagadas por defecto.

Las validaciones (Zod) replican las del frontend (`account.service.ts`, `session.service.ts`), incluida la regla de años de rendimiento en orden ascendente.

## Errores

Formato uniforme: `{ "error": { "message": string, "details"?: [...] } }`. Códigos: `400` validación, `401` no autenticado, `404` no encontrado, `409` conflicto (p. ej. email duplicado).

## Arquitectura

```
src/
  config/       env + conexión Sequelize
  models/       User, Profile, FranchiseApplication(+Performance),
                ApplicationDraft, TokenHolding(+Activity), Project
  blockchain/   ABIs + cliente ethers (provider/signer/contratos)
  validators/   esquemas Zod (espejo del frontend)
  services/     lógica de negocio (incl. blockchain.service)
  controllers/  adaptadores HTTP
  routes/       definición de rutas
  middleware/   auth (JWT), admin, validación, errores
  utils/        ApiError, jwt, password, asyncHandler
  seeders/      datos demo (catálogo + usuario)
```

## Los tres repos

```
frantoken-frontend/   Next.js (UI) — consume esta API
frantoken-backend/    este repo — API REST + puente blockchain
FranToken/            contratos Solidity ERC-3643 (Hardhat)
```

Para probar el puente on-chain en local: compilá y desplegá los contratos en el repo `FranToken` (`npm run node` + `npm run deploy:local`), copiá las direcciones que imprime el deploy a las variables `*_ADDRESS` del `.env` de este backend, poné `BLOCKCHAIN_ENABLED=true` y `BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545`. Para operaciones de agente, además `BLOCKCHAIN_ALLOW_WRITES=true` y una `BLOCKCHAIN_AGENT_PRIVATE_KEY` que sea agente del token/registry.

Capas: `routes → middleware → controllers → services → models`. Las vistas del frontend no deben acceder a almacenamiento; consumen esta API.

## Conexión desde el frontend

Implementá un `SessionRepository` y un `AccountRepository` que llamen a estos endpoints (guardando el token), y un servicio de marketplace que haga `fetch` a `/api/projects`. El resto del frontend no cambia: los contratos de datos son los mismos.
