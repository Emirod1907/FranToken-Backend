# Estado técnico frente al modelo de negocio

Actualizado: 2026-11-01. Fuentes: [informe recibido](source/estado-vs-modelo.pdf), [presentación](source/presentacion-final.md), [DTE](LIFECYCLES.md) y lectura estática del código de los tres repositorios. Esta revisión no ejecutó contratos, desplegó servicios ni certificó cumplimiento ERC-3643, seguridad o validez jurídica.

## Evidencia y cronología

El PDF está fechado el 29-10-2026: informa C1–C4 en `develop`, 51 tests pasando y pendientes de integración a `main`. Es un reporte histórico, no el estado de ramas ni una ejecución de pruebas de esta actualización. La revisión documental partió de los `main` actualizados por el usuario: blockchain `bf7f970`, frontend `51f85b7`, backend `b10d1f7`. C3 y C4 están presentes en ese código blockchain. Las ramas de documentación no modifican contratos ni servicios.

## Contratos y capacidades

Rutas de código relativas al repositorio blockchain `FranToken_Blockchain`.

| Componente | Estado observado / informado | Brecha frente al modelo |
|---|---|---|
| C1 · `contracts/agreements/FranchiseAgreement.sol` | Marca, know-how versionado, territorio, duración/renovación, canon, regalías/publicidad, inspecciones y terminación; pagos en token de pago. | No constituye por sí solo un contrato jurídico firmado ni acredita ventas, estándares físicos o compra real. |
| C2 · `contracts/agreements/OperatingAgreement.sol` | Reportes de ventas/costos/personal, KPIs, proveedores/compras, honorarios fijo + éxito, auditorías, seguro y terminación ligada a C1. | Reemplazo/traspaso de operadora y control de desvíos presupuestarios pendientes. |
| C3 · `contracts/agreements/PlatformServicesAgreement.sol` | Firmas y cálculo de comisión sobre compra, con ejemplo local de 0,5 %; C4 registra el cálculo por emisión. | No cobra fondos; no implementa remuneración por gestión/resultado ni su aprobación y pago. No es obligación senior en el flujo actual. |
| C4 · `contracts/agreements/InvestmentAgreement.sol` | Términos aceptados por wallet; verificador externo llama `issueAfterPayment`; valida principal exacto, C3 activo, unicidad de compra y referencia; emite mediante `mint`. | No recibe fondos, custodia, cierra campañas ni devuelve aportes; no define fórmula económica, plazo, salida ni aceptación por comprador secundario. Unicidad entre emisiones depende del conciliador. |
| Token · `contracts/token/FranchiseToken.sol` | Transferencias ordinarias condicionadas, congelamiento total/parcial, pausa, quema, recuperación/transferencia forzada; ingresos a prorrata con correcciones que conservan devengados al transferir. | No calcula caja distribuible ni implementa corte contractual por período, campaña o liquidación económica. Las facultades administrativas no equivalen a transferencias ordinarias del DTE. |
| Control de emisión | `setIssuanceController` fija una vez el controlador antes del primer mint; C4 exige estar vinculado. | «Solo C4 emite» es cierto si está configurado como controlador y agente. Sin controlador, el token conserva mint de agentes. |
| Obligaciones senior | `addSeniorObligation` registra obligaciones; `distributeRevenue` rechaza si alguna registrada informa pagos vencidos. C1/C2 pueden registrarse. | Registrar no calcula ni cobra C3; no implementa toda la cascada, reservas o controles de obligaciones no registradas. |
| Cobro inicial | Externo, conciliado y atestado antes de emitir por C4. | No es entrega contra pago atómica. Un pago final cuya emisión falla necesita incidencia y reintento idempotente. |
| Mercado secundario | `transfer` y `transferFrom` mueven tokens sujetos a controles. | No hay intercambio atómico token ↔ USDC/pago, garantía de liquidez ni precio de reventa. |
| Devolución / remanente | El token dispone de quema por agente. | No existe flujo completo que pruebe devolución o pago de remanente antes de quemar ni extinción del vehículo. |

## Diferencias entre DTE y controles actuales

- **KYC de ambas partes:** el DTE lo requiere. `_checkTransfer` comprueba expresamente `isVerified(to)`; no comprueba vigencia KYC del emisor de la transferencia. El compliance consulta el país del receptor. No describir la regla bilateral como plenamente implementada.
- **Congelamiento:** existe `setAddressFrozen`, pero el vencimiento KYC no congela una wallet automáticamente. La descongelación no acredita por sí sola renovación KYC ni levantamiento de una orden.
- **Lock-up:** `canTransfer` bloquea transferencias secundarias antes de `lockupEnd`, sin bloquear mint. Emitir en estado «En lock-up» es el modelo DTE; requiere un lock-up configurado y vigente para esa emisión.
- **Congelado y distribución:** los saldos congelados participan del reparto técnico. `claimRevenue` rechaza una wallet congelada o una pausa; preservar asignación no significa permitir cobro inmediato.
- **Distribución y pago:** `distributeRevenue` fondea/asigna ingresos; `claimRevenue` ejecuta el retiro del titular. Las correcciones de saldos conservan lo ya asignado, pero no crean un corte por período ni validan la caja fuera de cadena.

## Flujos de dinero y decisiones previas

Conviven cobros de compra en USD fuera de cadena (C3/C4) y pagos en token de pago dentro de cadena (C1/C2/distribuciones). Definir moneda, custodia, conversión y conciliación antes de construir campaña, reservas o devoluciones:

| Alternativa del PDF | Consecuencia que debe decidirse |
|---|---|
| Todo en stablecoin | Incorporar cobro y entrega contra pago, comisiones y devoluciones on-chain; no es el estado actual. |
| Todo externo | Bancos/tercero custodian y la cadena registra atestaciones; adaptar pagos C1/C2 y reparto. |
| Mixto | Cobro externo y conversión para pagar en cadena; identificar ejecutor, tipos de cambio, costos y conciliación. |

El PDF prioriza moneda/custodia y derecho económico, luego campaña, prelación/reservas/corte, remuneraciones C3, uso de fondos/reemplazo de operadora y mercado secundario. Es una propuesta de orden de trabajo, no autorización de implementación o de movimientos de fondos.

## Fronteras entre repositorios

| Repositorio | Observado en esta revisión | No debe inferirse |
|---|---|---|
| Blockchain | C1–C4, token, registry, compliance, pruebas y despliegue local de ejemplo. | Auditoría, despliegue real, conciliación bancaria o máquina completa de estados DTE. |
| Frontend | Catálogo/cuenta y recorridos demo, documentación de negocio y contexto Solidity archivado. | Compra real, tenencias verificadas, estados operativos o rentabilidades porque haya datos en pantalla. |
| Backend | API de cuenta/proyectos y puente de lectura/escritura blockchain sujeto a configuración/permisos. `Project` es catálogo demo y `TokenHolding` es una posición servida en lectura. | Campaña, tesorería, pago conciliado, máquina DTE o derecho constituido por una fila en base de datos. |

El backend llama directamente `token.mint` en su endpoint de emisión; no integra `InvestmentAgreement.issueAfterPayment`. Con C4 configurado como controlador exclusivo, ese mint directo del agente será rechazado. La API no acredita conciliación de compra. El servicio de distribución envía `approve` y `distributeRevenue` como dos transacciones; requiere manejar fallos y conciliación, y el inversor reclama desde su wallet.

Las tablas demo usan `DECIMAL`, pero `TokenHolding` convierte cantidades e importes a `Number` en getters: esa salida no garantiza exactitud monetaria. Los métodos on-chain usan cantidades como texto y `parseUnits`/`formatUnits`. Unificar el contrato monetario es trabajo pendiente; esta actualización solo lo documenta.
