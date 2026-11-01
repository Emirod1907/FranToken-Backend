# Decisiones y parámetros del negocio

Actualizado: 2026-11-01. Ver [modelo vigente](BUSINESS-LOGIC.md), [DTE](LIFECYCLES.md), [estado técnico](IMPLEMENTATION-STATUS.md) y [fuentes](source/README.md). «Declarado» describe el modelo aportado; no prueba contratos firmados ni habilitación operativa.

## Definiciones recibidas

| Definición | Estado y evidencia | Límite |
|---|---|---|
| Precio de suscripción | **Fijo: USD 10 por token + fees de transacción blockchain**, instrucción del usuario recibida para esta actualización. | Sustituye precio estimativo y gastos adicionales genéricos de §6.4; falta especificar pago efectivo del gas y conversión. |
| Vehículo y jurisdicción de referencia | La presentación final §5.2 declara fideicomiso financiero; Argentina es referencia académica. | Constitución, sujetos, instrumento y encuadre concreto pendientes. |
| Ciclos de vida | Ambos DTE recibidos definen estados, guardas y acciones de proyecto y token. | No implementan campaña, devolución, liquidación ni quema económica. |
| Transferencias y distribuciones | DTE: reglas de elegibilidad, conservación de devengados y reparto condicionado a caja/senior. | El código tiene diferencias y no define fórmula jurídica ni corte por período. |
| C3 sobre compras | PDF del 29-10-2026 y prototipo: cálculo y registro, ejemplo 0,5 %. | No es aprobación comercial definitiva; no cobra ni sustituye gestión/resultado. |

## Parámetros todavía abiertos

Los IDs `BUS-*` siguen el registro del frontend. Los D01–D12 de blockchain se corresponden numéricamente con BUS-01–BUS-12, sin convertir ambos registros en la misma evidencia histórica.

| ID | Aclarado por las nuevas fuentes | Pendiente para operación |
|---|---|---|
| BUS-01 / D01 | Argentina como referencia del análisis. | Jurisdicciones efectivas, residencia, encuadre y condiciones de admisión/oferta. |
| BUS-02 / D02 | Fideicomiso financiero declarado; C1–C4 separados y previos a publicación en el DTE. | Tipo/instrumento definitivo, fiduciario, fiduciante, emisor, firmantes y constitución. |
| BUS-03 / D03 | Derechos económicos definidos en C4, sin propiedad ni voto automáticos. | Naturaleza, obligado, fórmula, plazo y documentación concreta. |
| BUS-04 / D04 | Precio fijo no equivale a porcentaje de ganancias o propiedad. | Clases, denominadores, cantidad emitible, divisibilidad, decimales y asignación. |
| BUS-05 / D05 | Fin del período: objetivo alcanzado → financiado; no alcanzado → devolución/cancelación. | Meta, mínimo/máximo, plazo, excedentes, fondos reservados, procedimiento y responsable de devolución. |
| BUS-06 / D06 | Operación → C1 → C2/C3 → reservas → C4; caja positiva y sin senior vencida. | Base exacta, prioridades internas, reservas, pérdidas, impuestos, periodicidad, corte y uso de fondos por rubro. |
| BUS-07 / D07 | C1 vigente antes de desembolsos; local habilitado para activar C2. | Franquicia/operadora concretas, consentimientos, habilitaciones, presupuesto, sustitución y traspaso. |
| BUS-08 / D08 | Cobro externo para C4; pagos C1/C2 y reparto en token de pago en el prototipo. | Elegir modelo monetario, cuentas, activos, red, custodia, conversión, fees, finalidad de pago y conciliación. |
| BUS-09 / D09 | Transferencias condicionadas, congelamiento y salidas Redimido/Anulado modeladas. | Lock-up y umbrales, KYC bilateral, recuperación, sucesión, aceptación secundaria, rescate, devolución y liquidación; validar supuesto de quema y reclamos pendientes. |
| BUS-10 / D10 | Prototipo ERC-3643 y C1–C4 existentes; controlador de emisión configurable. | Registro autorizado, red real, permisos, administración, upgrades, identidad completa, auditoría e integración API/C4. |
| BUS-11 / D11 | Proyecto, emisión, vehículo y tenencias requieren identificación separada. | Unidad por vehículo, múltiples emisiones/cartera, segregación de fondos y unicidad de pagos entre emisiones. |
| BUS-12 / D12 | Precio fijo y fees separados; 0,5 % es ejemplo de comisión calculada del prototipo. | Tasa definitiva, gestión/resultado, bases, obligado, aprobador, pagador, registro de pago, impuestos y prelación C3. |
| BUS-13 | Ventas, remesas, aportes y distribuciones son flujos distintos. | Fuentes operativas, cuentas identificadas, conciliación y no duplicación de honorarios ya pagados. |
| BUS-14 | Operadora administra y FranToken monitorea; C2 contiene reportes/KPIs. | Indicadores concretos, verificación, auditoría, intervención, sustitución y desvíos de presupuesto. |

Ninguna fila queda completamente cerrada para operar con valor real. Registrar decisión, responsable, fecha, términos y evidencia antes de habilitar la operación afectada; conservar el historial de decisiones sustituidas.
