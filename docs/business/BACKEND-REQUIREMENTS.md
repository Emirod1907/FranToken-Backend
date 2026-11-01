# Requisitos de dominio para el backend

Actualizado: 2026-11-01. Requisitos derivados del [modelo](BUSINESS-LOGIC.md) y los [DTE](LIFECYCLES.md), no funcionalidades incorporadas por esta actualización. Consultar [brechas actuales](IMPLEMENTATION-STATUS.md) antes de integrar o exponer una operación con dinero.

## Objetos y estados separados

| Objeto | Datos / estados requeridos | Situación actual |
|---|---|---|
| Proyecto | Identidad de unidad/marca, vehículo, contratos versionados, presupuesto; estados del DTE del proyecto. | `Project` es catálogo demo; no contiene la máquina DTE. |
| Emisión / campaña | Proyecto y token asociados, objetivo, límites, plazo, condiciones de cierre, precio USD 10, documentos C4. | No hay campaña con cierre/devolución. |
| Suscripción / compra | Inversor, emisión, cantidad, principal, fees separados, términos aceptados y referencia única. | No hay circuito de compra conciliada en la API. |
| Pago | Recibido, pendiente de conciliación, conciliado/final, incidencia, devuelto; evidencia y actor. | El endpoint mint no prueba un pago. |
| Emisión técnica | Pendiente, enviada, confirmada o fallida; red, contrato, hash y evento relacionado con compra. | La escritura disponible llama a `FranchiseToken.mint`, no a C4. |
| Posición / token | Saldo, restricciones de lock-up/congelamiento, elegibilidad y titularidad; estado económico separado del hash de transacción. | `TokenHolding` es lectura demo y `getHolder` consulta cadena si está configurada. |
| Distribución | Período, reglas, caja, obligaciones, reservas, corte, aprobación, fondeo, asignación y reclamo. | Hay puente `approve` + `distributeRevenue`; no calcula caja ni aplica cascada completa. |
| Liquidación / devolución | Obligaciones, importe por titular, evidencia de pago, remanente, reclamos pendientes y quema autorizada. | Sin orquestación. Quema económica del DTE sujeta a validación. |

Estos nombres de estados de pago y emisión son una propuesta de diseño derivada, no enums existentes ni ampliaciones aprobadas de los DTE. La persistencia futura debe separar cada emisión y conservar historia, autor y evidencias de transición.

## Autoridad y controles requeridos

- El fiduciario/representante habilitado controla vehículo, términos y cierre; el verificador designado atesta pagos; owner/agentes ejecutan las facultades del contrato según configuración. Identificar personas, permisos y separación de aprobación/pago antes de implementarlos.
- El usuario autenticado o un administrador de la API no adquiere por ese solo rol la facultad de emitir, aprobar honorarios o liberar fondos. El puente actual exige configuración y firma de agente; eso no valida las precondiciones económicas del DTE.
- Publicar suscripción exige evidencia de vehículo constituido y C1–C4 firmados según DTE; emitir exige aceptación de términos C4 del inversor, elegibilidad y pago conciliado. Mantener referencias privadas y hashes sin publicar identidad sensible.
- Cada compra y referencia de pago produce como máximo una emisión. Validar unicidad también entre emisiones: C4 solo la garantiza dentro de su instancia. Un reintento de emisión fallida conserva la referencia y no vuelve a cobrar.
- Cierre financiado y devolución de la misma campaña no pueden consumir simultáneamente los mismos fondos. Documentar bloqueos de concurrencia y tratamiento de aportes pendientes al corte.
- No derivar «financiado» de un saldo de tokens ni «redimido» de una quema. Exigir la evidencia económica correspondiente y autorización de la transición.

## Importes, conciliación y respuesta al frontend

El principal de `N` tokens es `N × USD 10`; registrar gas aparte con activo, estimación/importe real y responsable. No agregar otros cargos por defecto ni presentar el 0,5 % del prototipo como cargo adicional. Evitar convertir importes precisos a `number`: definir escala, redondeo y representación decimal en texto. Los getters actuales de `TokenHolding` requieren revisión antes de usarse para liquidación exacta.

No equiparar USD con USDC, aporte recibido con pago final, envío de transacción con emisión confirmada, asignación de ingresos con retiro o una fila demo con un derecho constituido. La política de confirmaciones/finalidad, reorganizaciones y conciliación sigue pendiente. El servicio actual espera `tx.wait()` antes de devolver hashes; eso no establece por sí solo la política operativa de finalización.

El frontend necesita estados provenientes de una fuente autorizada, precio y fees separados, condiciones y documentos vigentes y acciones permitidas para el usuario. Esta documentación no modifica contratos HTTP ni promete nuevos endpoints. No habilitar compras, devoluciones o liquidación a partir de controles visuales.

## Criterios de aceptación para una implementación futura

1. Una misma compra/pago, incluso con reintentos o concurrencia, no emite dos veces ni financia dos emisiones.
2. Un pago conciliado cuya emisión falla abre incidencia; el reintento no repite cobro ni altera principal/fees.
3. Una campaña fallida devuelve conforme a sus términos; una financiada aplica fondos sin permitir devolución duplicada.
4. Lock-up, KYC y congelamiento producen las restricciones esperadas; renovar KYC no levanta una orden de autoridad sin resolución.
5. Una transferencia posterior conserva ingresos ya asignados al titular anterior y no sustituye el corte contractual pendiente.
6. Caja no positiva o una obligación senior vencida bloquea distribución; no se paga dos veces un honorario ni se exceden fondos reservados.
7. Devolución/remanente, quema y reclamos pendientes se concilian sin declarar cierre por una transacción aislada.

Son criterios para pruebas futuras, no pruebas ejecutadas ni garantías del backend actual. Las decisiones monetarias, C4 y demás bloqueos se siguen en [DECISIONS.md](DECISIONS.md).
