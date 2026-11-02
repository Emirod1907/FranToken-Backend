# FranToken · Backend

Express + TypeScript + Sequelize (MySQL/PostgreSQL), JWT y conexión a Hardhat local. Coordina el MVP académico: registro y documentación, vínculo de wallet, compra simulada con emisión C4, solicitudes de franquicia y publicación, estados y repartos mensuales. Cualquier usuario puede invertir y presentar solicitudes; solo admin aprueba/publica/distribuye.

**Guía de configuración, migración y endpoints:** [MVP-INTEGRATION.md](docs/MVP-INTEGRATION.md). **Negocio:** [alcance académico](docs/business/MVP-ACADEMICO.md), [estado técnico](docs/business/IMPLEMENTATION-STATUS.md), [modelo completo](docs/business/BUSINESS-LOGIC.md) y [decisiones](docs/business/DECISIONS.md).

## Preparación local

Requisitos: dependencias instaladas con el lockfile, SQL MySQL/PostgreSQL, Node compatible con dependencias (validado Node 24), frontend y blockchain como repositorios hermanos. No se requiere proveedor bancario ni KYC real.

1. En blockchain ejecutar `npm run node` y `npm run deploy:academic` en terminales separadas.
2. Copiar `.env.example` a `.env`; configurar SQL, JWT y CORS. Para la demo activar `BLOCKCHAIN_ENABLED`, `BLOCKCHAIN_ALLOW_WRITES` y `BLOCKCHAIN_USE_LOCAL_ACCOUNTS`, con RPC loopback 31337 y el manifiesto generado. Ver la guía; no copiar claves al frontend.
3. `npm run db:migrate:mvp`: migración aditiva, sin borrar compras/perfiles. Mantener `DB_SYNC=false` en una base existente.
4. `npm run mvp:import`: importa catálogo/direcciones, sin compras ni repartos ficticios. Crea administrador local demo si falta: `demo@frantoken.test` / `demodemo8`. Es un acceso público de prueba, sin aprobación automática de identidad.
5. `npm run dev`: API `http://localhost:4000/api`, salud en `/api/health`. Frontend usa `NEXT_PUBLIC_API_URL=http://localhost:4000` sin `/api` al final.

No se ejecutaron migraciones sobre tu base de datos durante esta implementación. El seed no resetea estados. Reiniciar Hardhat pierde sus derechos/eventos: para una nueva presentación usar otra base de prueba, migrar e importar de nuevo; no mezclar despliegues ni borrar historial automáticamente.

## Unidades y autoridad

USD 10 por token = **1000 centavos USD**, dos decimales en C4. Ingresos **mUSDC, seis decimales**. Cantidades exactas como texto/BigInt; gas separado en ETH de prueba. La compra tiene pago simulado, pero se confirma solo después de emisión en cadena. No hay fallback que fabrique tokens en SQL.

`GET /api/account/investment` devuelve el snapshot utilizado por la UI. `/api/account/purchases` recibe `{projectId,units,requestId}` y recupera la misma referencia sin doble emisión. `/api/admin` exige JWT con rol admin; servidor firma con admin/verificador distintos. La wallet del titular firma `acceptTerms` y `claimRevenue`.

`POST /api/account/revenue/claim` solo informa cómo reclamar y saldo, no transfiere ni marca cobros. Las escrituras antiguas `/api/blockchain/*` y el gateway Next `/api/mvp` responden 410. Las lecturas blockchain históricas mantienen su configuración opcional, sin coordinar el MVP.

La documentación básica permanece privada en SQL. `kycApproved` representa revisión manual de demostración, no KYC legal. El catálogo expone datos de franquicia y contratos, sin DNI/CUIL/domicilio del solicitante. El nuevo proyecto se compra y cobra con el mismo flujo que los fixtures.

## Verificación

```bash
npm run build
npm run test:mvp
```

**14 escenarios integrados** frontend → Express/JWT → Sequelize/SQLite real → EVM Hardhat real en memoria, incluida publicación nueva con compra y cobro y migración idempotente. Requiere Node 24 por `node:sqlite` y los tres repositorios/dependencias. El adaptador SQLite es exclusivo del test; el servidor sigue usando MySQL/PostgreSQL. No se comprobaron esos servidores ni una extensión real de navegador en este entorno, que restringe sockets. Blockchain conserva 58 pruebas de contrato.

`npm run mvp:sync-artifact` actualiza ABI/bytecode público de compliance después de compilar el checkout blockchain. No copia variables de entorno ni manifiestos.

Capas: routes → middlewares JWT/admin/validación → controllers → services → models y adaptador blockchain. [Documentación adicional](docs/README.md).
