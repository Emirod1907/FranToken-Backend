# Ejecutar el MVP integrado

Actualizado: 2026-11-02. Se necesitan **los tres repositorios hermanos**: `frantoken-frontend`, `FranToken-Backend` y `FranToken_Blockchain`, sus dependencias instaladas, una base MySQL/PostgreSQL y una wallet EVM. El coordinador es Express; Next no usa claves administrativas. Solo Hardhat local y activos de prueba.

## Preparación

1. Blockchain: `npm run node` en una terminal y `npm run deploy:academic` en otra. Genera `deployments/academic-local.json` (ignorado por Git), cuatro proyectos ilustrativos, C3 firmado, C4, registry, mUSDC y la fábrica para solicitudes nuevas. El manifiesto contiene direcciones públicas, no claves.
2. Backend: copiar `.env.example` a `.env`, configurar SQL, `JWT_SECRET` y `CORS_ORIGIN=http://localhost:3000`. Mantener `DB_SYNC=false`; ejecutar `npm run db:migrate:mvp` para crear tablas/añadir campos sin borrar filas. Sobre una base existente, respaldarla antes. No se ejecutó esta migración contra tu base durante la implementación.
3. En el entorno **local del backend**, definir:

   ```dotenv
   BLOCKCHAIN_ENABLED=true
   BLOCKCHAIN_ALLOW_WRITES=true
   BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
   BLOCKCHAIN_CHAIN_ID=31337
   BLOCKCHAIN_MANIFEST_PATH=../FranToken_Blockchain/deployments/academic-local.json
   BLOCKCHAIN_USE_LOCAL_ACCOUNTS=true
   ```

   Las cuentas desbloqueadas solo se aceptan con RPC loopback y opt-in explícito. Alternativamente, `BLOCKCHAIN_ADMIN_PRIVATE_KEY` y `BLOCKCHAIN_VERIFIER_PRIVATE_KEY` deben corresponder a las direcciones distintas del manifiesto; solo en servidor. No reutilizar claves de Hardhat en otras redes.
4. Backend: `npm run mvp:import` vincula los cuatro proyectos de muestra con los contratos. No crea compras, ingresos ni tenencias; no reabre franquicias. Crea el administrador demo `demo@frantoken.test` / `demodemo8` si no existe, exclusivamente para esta presentación local. No se autoaprueba documentación. Ejecutar `npm run dev` en otra terminal; `GET http://localhost:4000/api/health` comprueba disponibilidad HTTP.
5. Frontend: copiar `.env.example` a `.env.local` o configurar `NEXT_PUBLIC_API_URL=http://localhost:4000`, sin `/api` al final. Ejecutar `pnpm dev`. Si esa variable queda vacía solo hay vista previa con datos locales; compra/publicación requieren Express.
6. Wallet: red local 31337, RPC `http://127.0.0.1:8545`, ETH de prueba. Importar solo una cuenta pública desechable del nodo. Las posiciones son: cuenta 0 admin técnico/fondeador; 1 vehículo C3; 2 plataforma C3; 3 verificador; 4+ usuarios. Las cuentas locales están preinscritas en registry como fixture; Express igualmente exige aprobación manual del perfil para comprar. No exponer el nodo desbloqueado a Internet.

Cada fixture tiene 1000 tokens enteros a USD 10. El admin técnico recibe mUSDC de prueba para repartir. Son parámetros ilustrativos, sin alianza con marcas ni ofertas reales. Las claves nunca van al repositorio ni al navegador como configuración de servidor.

## Presentación

1. `/registro`: crear una cuenta de usuario; `/mi-cuenta/configuracion`: completar documentación ficticia y domicilio. Si esa ruta cambia, usar el enlace «Mi perfil» en la cuenta.
2. Desde una ficha en `/marketplace`, vincular la wallet: desafío de Express firmado por el usuario. En otra sesión de navegador, ingresar como admin en `/administracion`, revisar el perfil y aprobar la habilitación. No es necesario conectar la wallet 0 para que el admin web ordene operaciones; el backend firma con sus cuentas técnicas.
3. Usuario: aceptar términos en la wallet, ingresar cantidad y confirmar pago simulado. El backend usa JWT y la wallet vinculada; C4 emite y devuelve hash. No hay débito USD ni transferencia de mUSDC al comprar.
4. `/mi-cuenta/tokens` muestra balances e ingresos desde cadena. Ante respuesta perdida, usar «Recuperar compra pendiente»; no borrar referencias ni cambiar la cantidad para resolver un resultado incierto.
5. Admin: iniciar operación y registrar mes `YYYY-MM` e importe mUSDC con hasta seis decimales. La cuenta técnica aprueba fondos y distribuye. Repetir el mismo mes/importe recupera el resultado; otro importe se rechaza.
6. Usuario: actualizar y cobrar. La wallet del titular firma `claimRevenue`, recibe mUSDC y cambia disponible/cobrado. Aceptación y cobro consumen gas de esa wallet; emisión consume gas del verificador; fondeo/reparto, del admin técnico.
7. El mismo usuario puede ir a «Abrir una franquicia», completar la solicitud básica sin tres ejercicios históricos y verla en `/mi-cuenta/solicitudes`. La confirmación muestra el ID real y el estado.
8. Admin: aprobar/observar con nota; publicar una solicitud aprobada con símbolo y cupo entero. Se crea token+C4 y aparece automáticamente en el catálogo, comprable con el mismo flujo. La inversión estimada no calcula el cupo. Una publicación pendiente admite reintento con los mismos parámetros.
9. Cerrar detiene nuevas compras/repartos; conserva cobro de ingresos anteriores. El cierre no se revierte ni liquida un vehículo real.

## Reintentos, datos y reinicios

- SQL guarda compras/repartos y cadena guarda balances/eventos. `pending` significa resultado no confirmado, no fracaso demostrado. No editar esas filas para aparentar una emisión/cobro.
- Editar identidad/domicilio revoca aprobación para nuevas compras. El admin vuelve a revisar; tokens e ingresos existentes permanecen. No se permite cambiar la wallet cuando hay compras pendientes/confirmadas.
- El seed conserva filas existentes y no reabre proyectos. Cambiar manifiesto importa los fixtures, no migra tokens, derechos, usuarios ni solicitudes de una cadena anterior.
- **Reiniciar Hardhat pierde la cadena.** Para una presentación nueva, redesplegar y usar una base de prueba nueva, volver a migrar/importar y reiniciar backend/frontend. No mezclar compras/distribuciones de otro despliegue con los contratos nuevos ni borrar automáticamente datos existentes. El `deploymentId` cambia las referencias de compras del navegador; por sí solo no migra SQL.
- No hay banco, scheduler ni índice histórico externo. Las consultas de eventos desde `fromBlock` son suficientes para la cadena pequeña de la demo. No ejecutar múltiples procesos escritores como configuración de este MVP.
- Los endpoints antiguos de escritura `/api/blockchain/*` y `/api/mvp` están retirados (410). No usarlos para habilitar wallets, emitir o repartir.

## Verificación

Backend: `npm run build`, `npm run typecheck:scripts` y `npm run test:mvp`. Blockchain: `npm test`. Frontend: `pnpm typecheck`, `node scripts/check-architecture.mjs`, `pnpm lint` sobre el alcance y `pnpm build`. Para el runner integrado se requiere **Node 24** por `node:sqlite`; llama los clientes reales de frontend, Express/JWT, Sequelize/SQL y contratos Hardhat en memoria, sin abrir puertos. El mismo test se invoca desde frontend con `node scripts/test-academic-integration.cjs`.

Ver evidencia y limitaciones en el documento de pruebas del frontend. Falta la comprobación manual con navegador y extensión real; la prueba en memoria no verifica render visual ni transporte TCP. No se usan fondos reales.

## Contrato HTTP

Base `/api`. `register/login` entregan `{token,session}`. Session incluye `userId,email,displayName,role,walletAddress,kycApproved`. Las rutas de cuenta usan Bearer y nunca aceptan `userId` como autoridad del cuerpo. Todo `/admin` exige además rol admin.

| Método y ruta | Cuerpo / resultado |
|---|---|
| POST `/auth/register`, `/auth/login` | Registro/login; contraseña y email validados. |
| GET `/auth/session` | Sesión vigente del JWT; 401 elimina sesión del cliente. |
| GET/PUT `/account/profile` | Perfil completo; guardar identidad distinta revoca aprobación en SQL. |
| POST `/account/wallet/challenge` | `{walletAddress}` → mensaje con cuenta, nonce y vencimiento. |
| PUT `/account/wallet` | `{walletAddress,signature}` → vínculo único comprobado. |
| GET `/account/investment` | Snapshot para UI: wallet vinculada, habilitación efectiva, proyectos, balances y eventos. |
| GET `/account/holdings` | `{holdings}` compatible con el DTO de cuenta anterior, proyectado desde balances on-chain; cantidad y principal USD enteros (cap 1e6). Historial/ingresos exactos en `/investment`. |
| GET/POST `/account/purchases` | Listado propio / `{projectId,units,requestId:UUID}`. 201 al emitir; 200 al recuperar; `{purchase,txHash,gasFeeEth,recovered}`. Cantidades serializadas como texto. |
| POST `/account/revenue/claim` | `{projectId}` → instrucciones y `availableMinor`; **no transfiere ni registra cobro**. El titular firma en cadena. |
| GET/POST `/account/applications` | Listado propio / formulario básico → `{application}` con ID del servidor. |
| GET/PUT/DELETE `/account/draft` | Borrador propio; PUT `{payload}`. Envío de solicitud lo limpia dentro de la transacción. |
| GET `/admin/users`, `/admin/applications` | Revisión privada de perfiles/solicitudes; sin hashes de contraseña. |
| POST `/admin/users/:id/kyc` | `{approved:boolean}` → registry y aprobación SQL. Perfil completo + wallet para aprobar. |
| PATCH `/admin/applications/:id/review` | `{status:"Aprobada"|"Observada",note?:string}`. |
| POST `/admin/applications/:id/publish` | `{symbol,totalUnits:string}` → proyecto publicado; reintento con los mismos parámetros. |
| PATCH `/admin/projects/:slug` | Solo `{status:"publicada"|"en_operacion"|"cerrada"}`; confirma transición on-chain. No modifica precio/cableado desde UI. |
| POST `/admin/distributions` | `{projectId,periodId:"YYYY-MM",amount:string,memo?:string}`. `amount` en mUSDC mayor, hasta 6 decimales. 201 nuevo / 200 recuperado. |
| GET `/admin/projects/:slug/distributions` | Auditoría SQL del período, amountMinor y escala explícita 6. |
| GET `/projects`, `/projects/:slug` | Catálogo público publicado/cableado; supply, cupo y estado leídos de cadena. Sin perfil del solicitante. |
| POST/PUT/PATCH/DELETE `/blockchain/*` | 410. Las lecturas históricas conservan su configuración opcional de direcciones. |

Errores: `{error:{message,details?}}`; 400 validación, 401 sesión inválida, 403 permisos, 404 recurso ausente/no publicado, 409 requisito/conflicto on-chain, 503 integración deshabilitada/red inaccesible. Sin stack/SQL/PII en respuestas 500. Mantener el mismo requestId al recuperar una compra.

## Persistencia y migración

`db:migrate:mvp` usa sync sin alter para tablas nuevas, agrega campos nullable de perfil y revisión/vínculo de solicitud, ensancha la moneda de distribución para `mUSDC` y convierte sector enum a texto. No convierte tenencias simuladas en tokens, no aprueba usuarios y no elimina historial. Verificar especialmente la conversión enum en MySQL/PostgreSQL antes de aplicarla a una base compartida; aquí se probó SQL SQLite, no un servidor de esos dialectos.

`src/blockchain/generated/compliance.json` contiene ABI y bytecode públicos de `FranchiseCompliance`, compilado con Solidity 0.8.24 del checkout blockchain. Si ese contrato cambia, recompilar y ejecutar `npm run mvp:sync-artifact` en backend para actualizar ABI/bytecode del mismo build; no incluye claves ni manifiestos del entorno.
