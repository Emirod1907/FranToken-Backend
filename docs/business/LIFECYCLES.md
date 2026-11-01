# Ciclos de vida del proyecto y del token

Actualizado: 2026-11-01. Transcripción funcional de los [dos DTE recibidos](source/README.md). Notación: evento `[condición] / acción`. Son reglas del modelo; no implican una máquina de estados implementada. Ver [modelo](BUSINESS-LOGIC.md) y [brechas técnicas](IMPLEMENTATION-STATUS.md).

## Proyecto de franquicia

| Origen → destino | Evento / guarda | Acción |
|---|---|---|
| Inicio → Originación | Inicio | Identificar marca y unidad. |
| Originación → Evaluación | Oportunidad documentada | Solicitar evaluación económica y escenarios. |
| Evaluación → Estructuración | Fin de evaluación y proyecto viable | Emitir informe y definir vehículo y contratos. |
| Evaluación → Descartado | Fin de evaluación y proyecto no viable | Emitir informe y archivar oportunidad; salida anticipada. |
| Estructuración → Suscripción | C1–C4 firmados y fideicomiso constituido | Publicar oportunidad; C4 individual se acepta antes de cada emisión. |
| Suscripción → Suscripción | Aporte recibido; KYC vigente y límites de tenencia cumplidos | Registrar aporte y emitir tokens tras conciliación externa mediante C4. |
| Suscripción → Financiado | Fin del período y objetivo alcanzado | Cerrar suscripción; fondos en el fideicomiso. |
| Suscripción → Cancelado | Fin del período y objetivo no alcanzado | Devolver aportes; salida anticipada. |
| Financiado → Puesta en marcha | C1 vigente | Pagar canon y obras; gestionar equipamiento, permisos y preapertura. |
| Puesta en marcha → En operación | Local habilitado | Activar C2 con la operadora. |
| En operación → En operación | Venta al cliente | Registrar cobro. |
| En operación → En distribución | Cierre de período; caja distribuible > 0 y ninguna obligación senior vencida | Conciliar, reportar y aplicar prelación de pagos. |
| En operación → En operación | Cierre de período; sin caja distribuible o alguna obligación senior vencida | Conciliar, reportar, bloquear distribución y constituir reservas según reglas. |
| En distribución → En operación | Pagos acreditados | Actualizar registro de titulares. |
| En operación → En liquidación | Vence plazo C4 o termina C1 | Notificar inversores y cancelar obligaciones. |
| En liquidación → Proyecto cerrado | Obligaciones canceladas | Distribuir remanente y extinguir fideicomiso; cierre normal. |

```mermaid
stateDiagram-v2
    [*] --> Originacion
    Originacion --> Evaluacion: oportunidad documentada
    Evaluacion --> Estructuracion: viable / emitir informe
    Evaluacion --> Descartado: no viable / archivar
    Estructuracion --> Suscripcion: C1-C4 firmados y vehículo constituido
    Suscripcion --> Suscripcion: aporte conciliado y elegibilidad / emitir con C4
    Suscripcion --> Financiado: fin del período y objetivo alcanzado
    Suscripcion --> Cancelado: fin del período y objetivo no alcanzado / devolver
    Financiado --> PuestaEnMarcha: C1 vigente / canon y obras
    PuestaEnMarcha --> EnOperacion: local habilitado / activar C2
    EnOperacion --> EnOperacion: venta / registrar cobro
    EnOperacion --> EnDistribucion: cierre y caja positiva y sin senior vencida
    EnOperacion --> EnOperacion: cierre sin caja o senior vencida / bloquear reparto
    EnDistribucion --> EnOperacion: pagos acreditados / actualizar registro
    EnOperacion --> EnLiquidacion: vence C4 o termina C1 / notificar
    EnLiquidacion --> Cerrado: obligaciones canceladas / remanente y extinción
    Cerrado --> [*]
    Descartado --> [*]
    Cancelado --> [*]
```

El DTE diferencia fin anticipado de cierre normal; el Mermaid usa nodos finales para los tres, conservando esa distinción en nombres y tabla. No agrega cancelaciones arbitrarias desde cualquier etapa. El token tiene una salida por «proyecto cancelado», pero los motivos adicionales de cancelación del proyecto no están definidos en el DTE.

## Token emitido a un inversor

**Vigente** es un estado compuesto: contiene En lock-up, Transferible y Congelado. En cualquiera de ellos el titular conserva los derechos económicos definidos en C4.

| Origen → destino | Evento / guarda | Acción |
|---|---|---|
| Inicio → Vigente / En lock-up | Pago externo; KYC vigente | Registrar conciliación y emitir al inversor mediante C4. |
| En lock-up → En lock-up | `transfer()` con lock-up activo | Revertir. |
| En lock-up → Transferible | Vence plazo de lock-up | Habilitar transferencias ordinarias sujetas al resto de controles. |
| Transferible → Transferible | `transfer()` / `transferFrom()`; reglas cumplidas | Mover tokens y actualizar titular. |
| Transferible → Transferible | Intento de transferencia; alguna regla incumplida | Revertir sin cambiar titular ni saldo. |
| En lock-up → Congelado | Congelar wallet; KYC vencido u orden de autoridad | Bloquear operaciones según facultades y procedimiento. |
| Transferible → Congelado | Congelar wallet; KYC vencido u orden de autoridad | Bloquear operaciones según facultades y procedimiento. |
| Congelado → En lock-up | Descongelar; KYC renovado y lock-up activo | Retirar congelamiento y mantener restricción temporal. |
| Congelado → Transferible | Descongelar; KYC renovado y lock-up finalizado | Retirar congelamiento; siguen vigentes las otras reglas. |
| Vigente → Vigente | Distribución periódica; caja distribuible > 0 y ninguna senior vencida | Acreditar al titular de ese momento; no reasignar derechos ya devengados por una transferencia posterior. |
| Vigente → Redimido | Liquidación del fideicomiso | Pagar remanente y quemar, bajo el supuesto señalado abajo; cierre normal. |
| Vigente → Anulado | Proyecto cancelado | Devolver aporte y quemar, bajo el supuesto señalado abajo; salida anticipada. |

Las salidas desde Vigente y su distribución periódica aplican a todos sus subestados, incluido Congelado. Una asignación de ingresos reclamables no equivale a un pago efectivo al inversor.

```mermaid
stateDiagram-v2
    [*] --> Vigente: pago conciliado y KYC / emisión
    state Vigente {
        [*] --> Lockup
        Lockup --> Lockup: transfer / revertir
        Lockup --> Transferible: vence lock-up
        Lockup --> Congelado: congelar wallet
        Transferible --> Congelado: congelar wallet
        Congelado --> Lockup: descongelar y lock-up activo
        Congelado --> Transferible: descongelar y lock-up finalizado
        Transferible --> Transferible: reglas cumplidas / mover y actualizar titular
        Transferible --> Transferible: regla incumplida / revertir
    }
    note right of Vigente
        Distribución habilitada: acreditar sin cambiar subestado
        ni reasignar ingresos ya devengados.
    end note
    Vigente --> Redimido: liquidación / remanente y quema supuesta
    Vigente --> Anulado: cancelación / devolución y quema supuesta
    Redimido --> [*]
    Anulado --> [*]
```

## Reglas y límites de interpretación

- El DTE enumera KYC vigente de ambas partes, wallets no congeladas, país permitido, tenencia ≤ máximo, inversores ≤ máximo y lock-up terminado. Es la regla esperada para `transfer` y `transferFrom`; el código tiene diferencias documentadas en [estado técnico](IMPLEMENTATION-STATUS.md).
- El vencimiento KYC es una condición para congelar en el modelo, no evidencia de una tarea automática que ejecute ese congelamiento. Una orden de autoridad tampoco se levanta automáticamente por renovar KYC: su resolución y autoridad de descongelamiento quedan pendientes.
- Terminar lock-up habilita temporalmente la transferencia; no garantiza que pase KYC u otros controles ni que haya compradores. En el código se consulta un timestamp, sin transacción automática de cambio de estado.
- **Quema al cancelar/cerrar: supuesto explícito del DTE.** El PDF no documenta esa secuencia económica. Existe `burn` técnico, pero faltan orquestación, autorizaciones, conciliación de devoluciones/remanentes y tratamiento de ingresos aún reclamables. No declarar «redimido» por observar solo una quema.
- El corte económico por período y la fórmula jurídica de C4 no están definidos. La preservación de ingresos ya asignados por el token no sustituye ese corte.
