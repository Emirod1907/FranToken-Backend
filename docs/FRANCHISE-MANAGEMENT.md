# Gestión de franquicias y superadmin

Actualizado: 2026-11-03. Implementa el plan confirmado por el usuario: gestión operativa del creador, admisión exclusiva de superadmin y propuestas de reparto con aprobación interna. Conserva emisión inicial en Hardhat; no habilita reventa ni transferencias entre inversores.

## Preparar el acceso interno

1. Aplicar `npm run db:migrate:franchises`. Es una migración aditiva e idempotente: agrega versión de solicitud, propuestas de reparto, auditoría, unicidad de publicación y el valor de rol `superadmin`. No promueve usuarios existentes ni reemplaza datos.
2. Completar `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` (única, mínimo 12 caracteres) y opcionalmente `SUPERADMIN_DISPLAY_NAME` en la configuración local ignorada o en variables del proceso.
3. Ejecutar `npm run superadmin:create`. Crea una cuenta interna nueva. Si el correo ya pertenece a un usuario común o un `admin` legado, falla sin cambiar su rol ni contraseña. Repetir con un superadmin existente conserva su contraseña.
4. Iniciar/reiniciar backend y frontend. Ingresar por `/ingresar` y acceder a `/administracion`.

El rol legado `admin` se conserva por compatibilidad de datos, pero no autoriza rutas internas. La cuenta del seed demo no es un superadmin. Las cuentas creadoras se reconocen mediante `franchise_applications.user_id`; no reciben un rol global adicional. Las credenciales del firmante técnico blockchain siguen exclusivamente en servidor y no son las credenciales de inicio de sesión del superadmin.

## Permisos y pantallas

| Capacidad | Creador | Superadmin |
|---|---|---|
| Solicitud y corrección antes de publicar | Propias | Todas |
| Observar, aprobar y publicar token+C4 | No | Sí |
| Gestión operativa y cierre | Propias publicadas | Todas, incluidos fixtures |
| Proponer y corregir repartos | Propias en operación | Todas en operación |
| Observar y ejecutar repartos | No | Sí |
| Usuarios y habilitación de perfiles | No | Sí |

- `/mi-cuenta/solicitudes/[id]`: detalle, observaciones, versión, historial y corrección/reenvío.
- `/mi-cuenta/franquicias`: listado propio; para superadmin incluye todo el catálogo.
- `/mi-cuenta/franquicias/[projectId]`: datos admitidos protegidos, estado, avance de emisión, operación, propuestas, distribuciones e historial.
- `/administracion`: acceso interno y revisión de perfiles.
- `/administracion/franquicias`: admisión, publicaciones, catálogo de gestión y revisión global de propuestas.

Los endpoints validan al actor del JWT contra SQL en cada petición. Modificar IDs, roles o botones en el navegador no cambia los permisos. Los recursos ajenos responden 404; las rutas internas responden 403 sin superadmin. Los proyectos ilustrativos sin solicitud asociada solo admiten gestión de superadmin.

## Contrato HTTP

Todas estas rutas son privadas y requieren Bearer. Los importes de reparto viajan como texto decimal y se conservan como enteros de seis decimales mUSDC. `version` es un entero positivo devuelto por el servidor.

| Ruta | Acción |
|---|---|
| GET `/api/account/applications/:id` | `{application,capabilities,history}` del creador o superadmin. |
| PATCH `/api/account/applications/:id` | Campos editables + `version`; devuelve detalle actualizado. No acepta propietario, estado, contratos ni cupo. |
| GET `/api/franchises` | `{franchises}` filtradas por propiedad o acceso global. No depende del RPC. |
| GET `/api/franchises/:id` | Metadatos, estado de cadena, permisos, propuestas, distribuciones e historial. Si falla RPC conserva SQL, `chain:null` y mensaje de disponibilidad. |
| PATCH `/api/franchises/:id/operation` | `{status:"en_operacion"|"cerrada"}`. Confirma contrato antes de actualizar SQL. |
| GET/POST `/api/franchises/:id/distribution-requests` | Listado propio / `{periodId:"AAAA-MM",amount:string,memo?:string}`. Solo propone; no mueve fondos. |
| PATCH `/api/franchises/:id/distribution-requests/:requestId` | `{version,amount,memo?}` antes de ejecutar. No admite cambiar proyecto ni mes. |
| GET `/api/admin/distribution-requests` | Revisión global de propuestas. |
| PATCH `/api/admin/distribution-requests/:id/review` | `{version,note}`; observa una propuesta pendiente. |
| POST `/api/admin/distribution-requests/:id/execute` | `{version}`; autoriza y ejecuta el contenido almacenado. No acepta importes alternativos. |
| PATCH `/api/admin/applications/:id/review` | `{version,status:"Aprobada"|"Observada",note}`. |
| POST `/api/admin/applications/:id/publish` | `{symbol,totalUnits}`. Reintentos conservan símbolo y cupo reservados. |

Todo `/api/admin/*`, incluidas las rutas anteriores de KYC, estado y distribución directa, exige superadmin. El endpoint directo de distribución respeta una propuesta existente del mismo proyecto/mes y no permite reemplazar su importe ni ejecutar una propuesta observada.

## Estados y concurrencia

Editar una solicitud la devuelve a `Enviada`, elimina la aprobación vigente y registra una nueva versión. Una revisión antigua falla con 409. Al reservar `projectId` comienza la publicación: desde entonces se bloquea la edición, incluso si el RPC falla antes de desplegar. La publicación se recupera con los mismos parámetros y no reabre una franquicia que después fue cerrada.

El inicio operativo y el cierre respetan los estados del contrato. El cierre es definitivo: impide compras y repartos nuevos y conserva ingresos ya asignados. No confiere al creador facultades para admitir la emisión, aumentar el cupo o cambiar los contratos.

Propuestas: `pending → observed → pending` para correcciones; `pending → executing → confirmed` para ejecución. Solo se propone en operación y para meses desde 2000-01. Proyecto/mes son únicos. La observación, corrección y primera aprobación requieren la versión vigente y bloqueo de fila SQL. Una vez iniciada la ejecución no se edita el importe. Un fallo deja `executing`, pendiente de conciliación con el mismo contenido; el reintento recupera el reparto existente por proyecto/mes y evento de cadena, sin pagarlo otra vez. La confirmación de una propuesta no equivale al cobro individual, que continúa firmado por cada inversor.

Auditoría privada: presentación, reenvío, revisión, reserva/publicación, cambios operativos y propuestas/repartos registran actor, rol, fecha y resultado. Se preservan observaciones anteriores. No se publican documentos personales ni secretos en catálogo o cadena.

## Verificación

`npm run test:mvp` ejecuta los 21 escenarios previos y diez escenarios de gestión, usando clientes reales del frontend, Express/JWT, SQLite y Hardhat en memoria. Incluye aislamiento entre propietarios, rechazo del admin legado, bootstrap sin promoción, versiones, publicación interrumpida, propuesta/corrección/observación, ejecución exclusiva, recuperación sin duplicados, cierre terminal y migración repetida. Ejecutar también `npm run build`, `npm run typecheck:scripts`, tipos/lint/arquitectura del frontend y su build.

La migración también se aplicó en MariaDB local comprobando que se conservaran los recuentos de usuarios, perfiles, compras, solicitudes y proyectos. El alta del superadmin y sus accesos internos se comprobaron por HTTP. Las escrituras funcionales del runner integrado son aisladas: no se aprobaron ni cerraron franquicias ni se distribuyeron fondos en la base del usuario. Falta verificar la migración contra PostgreSQL.

Chromium automatizado comprobó acceso anónimo, login real y listados de superadmin por HTTP. Con API controlada validó corrección de solicitud, disponibilidad parcial, operación, ciclo de propuesta/observación/corrección/ejecución y cancelación del cierre sin modificar franquicias existentes. Se revisaron escritorio y móvil de 390 px, sin desborde horizontal ni errores JavaScript. La extensión real de wallet sigue pendiente.
