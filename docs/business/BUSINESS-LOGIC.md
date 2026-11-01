# Lógica de negocio de FranToken

Actualizado: 2026-11-01. Fuente canónica del modelo declarado en este repositorio. Ver [fuentes y precedencia](source/README.md), [ciclos de vida](LIFECYCLES.md), [estado frente al modelo](IMPLEMENTATION-STATUS.md) y [decisiones](DECISIONS.md).

## Autoridad y alcance

La actualización integra la presentación académica final de octubre de 2026, el informe «Estado vs. modelo de negocio» del 29-10-2026, los dos DTE aportados y la instrucción del usuario: **precio fijo de USD 10 por token más fees de la transacción en blockchain**. Esta instrucción sustituye el «valor estimativo» y los gastos adicionales genéricos de §6.4 de la presentación. El PDF corrige el alcance de C3 y C4 descrito en §§7.1 y 12 de esa presentación.

Se distingue modelo declarado, estado técnico observado y decisiones pendientes. El material no acredita constitución efectiva del vehículo, firma de contratos, ofertas habilitadas, operaciones reales, auditoría ni autorización regulatoria. Los manuales y ADR anteriores conservan valor histórico; sus ejemplos y propuestas no sustituyen estas reglas vigentes.

## Propuesta y actores

FranToken organiza financiación colectiva para adquirir derechos de explotación y poner en marcha unidades de franquicia. Cada proyecto identifica marca, unidad, ubicación, presupuesto, operadora, vehículo, emisión y documentación. Comprar un token representa los derechos económicos definidos en C4; no atribuye automáticamente propiedad sobre marca o local, voto, garantía de capital, rentabilidad ni liquidez.

| Actor | Responsabilidad | Separación necesaria |
|---|---|---|
| FranToken SAS | Estructuración, plataforma, tecnología, monitoreo y reporting; remuneración bajo C3. | No se presume fiduciario, custodio, emisor en nombre propio ni operadora. |
| Vehículo / fideicomiso | Recibir aportes y aplicar fondos al proyecto. | Patrimonio y cuentas identificados por proyecto; no son ingresos propios de la plataforma. |
| Fiduciario | Administrar el patrimonio conforme al instrumento y sus facultades. | No equivale a la gestión diaria de la franquicia. |
| Franquiciante | Otorgar derechos de franquicia y exigir los pagos y estándares de C1. | Sus regalías son distintas de las distribuciones al inversor. |
| Operadora | Personal, compras, ventas, proveedores, estándares y reportes bajo C2. | No es titular del patrimonio por su función operativa. |
| Inversor | Aportar y adquirir los derechos establecidos en C4. | Registrarse o vincular una wallet no compra ni reserva tokens. |
| Cliente final | Comprar productos o servicios de la unidad. | Su pago es ingreso comercial, no aporte de inversión. |
| Tercero / verificador externo | Gestionar cobro y conciliación; atestar pagos para emitir mediante C4. | Identidad, facultades, custodia, finalidad del pago y responsabilidades deben definirse. |

La presentación usa fideicomiso u otro vehículo aplicable y especifica **fideicomiso financiero** en §5.2. Se conserva este último como estructura declarada, con Argentina como jurisdicción de referencia del análisis académico. Tipo definitivo, instrumento, fiduciario, emisor, sujetos, encuadre y habilitaciones de una emisión concreta siguen pendientes; esta documentación no los valida jurídicamente.

## Relaciones C1–C4

| ID | Partes | Contenido del modelo |
|---|---|---|
| C1 | Franquiciante ↔ fideicomiso/vehículo | Marca, know-how, territorio, canon, regalías, publicidad, estándares, plazo y terminación. |
| C2 | Vehículo ↔ operadora | Administración, reportes, indicadores, honorarios, controles, auditoría, responsabilidad y reemplazo. |
| C3 | Vehículo ↔ FranToken SAS | Estructuración, tecnología, plataforma, reporting, monitoreo y remuneración contractual por servicios/gestión y, si se pacta, resultado. |
| C4 | Vehículo/emisor ↔ inversor | Aporte, instrumento, derechos económicos, información, distribución, plazo, riesgos, transferencia y salida. |

Son relaciones jurídicas y funcionales con prototipos Solidity asociados. El código no reemplaza documentos, firmantes, representación, controles externos ni el instrumento constitutivo del vehículo. El [estado técnico](IMPLEMENTATION-STATUS.md) distingue qué parte de cada relación está automatizada.

## Precio, aporte y fees

- **Precio unitario fijo de suscripción: USD 10.** Para `N` tokens, el principal es `N × USD 10`; el total a desembolsar agrega los fees de la transacción blockchain informados por separado.
- Los fees de red son variables y no integran el precio unitario, el capital aportado ni el rendimiento del inversor. Registrar activo de pago del fee, estimación, importe efectivo y responsable. No asumir paridad USD/USDC ni una cotización de gas.
- Esta definición no autoriza sumar al inversor gastos de emisión, estructuración, plataforma o intermediación por defecto. Los costos presupuestados del proyecto y la remuneración C3 son conceptos separados.
- El precio no determina porcentaje de propiedad, resultados o voto, ni precio de reventa, rescate o valor de mercado. Fraccionamiento y unidades/decimales de cada emisión deben especificarse antes de operar.
- C4 verifica el principal exacto, excluyendo gas. En el ejemplo local con moneda USD y escala de centavos, son 1.000 centavos por token. C4 parametriza el precio: la documentación por sí sola no lo impone a todos los despliegues.
- El prototipo C3 calcula una comisión sobre compras, con ejemplo de **0,5 % del principal**: USD 0,05 para plataforma y USD 9,95 netos para vehículo por token. Es un parámetro histórico del prototipo, no una tasa comercial definitiva ni un fee adicional al comprador. No confundirlo con comisiones por gestión o resultado, pendientes de definición e implementación.

Para importes operativos: enteros en unidades mínimas o decimal exacto, moneda y escala explícitas, redondeo definido y serialización decimal como texto. Los getters demo que convierten a `number` no son una base válida para liquidación monetaria exacta.

## Secuencia y flujo de fondos

1. **Originar y evaluar:** documentar marca y unidad; analizar canon, obra, equipamiento, inventario, permisos, alquileres, preapertura, capital de trabajo, contingencias y escenarios. Un caso no viable se descarta.
2. **Estructurar:** definir vehículo y contratos. El DTE exige C1–C4 firmados y fideicomiso constituido antes de publicar la oportunidad. La aceptación individual de C4 debe acreditarse para cada inversor antes de emitir; no se presume por la publicación.
3. **Suscribir:** recibir y conciliar aportes externos, verificar elegibilidad y límites, y emitir una sola vez por compra mediante C4. El pago externo y la emisión no son atómicos.
4. **Cerrar campaña:** al fin del período, objetivo alcanzado → financiado; objetivo no alcanzado → cancelado y devolución de aportes. Meta, mínimo, máximo, plazo, excedentes, devolución y responsables requieren términos concretos. Registrar un token no implementa estas reglas.
5. **Poner en marcha:** con C1 vigente, aplicar fondos al canon y obras según presupuesto y comprobantes; incluir equipamiento, permisos y preapertura. Con local habilitado, activar C2 y comenzar operación.
6. **Operar y conciliar:** la operadora registra ventas y costos; se concilian medios de pago, bancos, facturas, tributos, remesas, honorarios y desvíos. Blockchain no verifica por sí sola ventas, obras ni balances.
7. **Distribuir:** al cierre del período, aplicar prelación y reservas. Solo con caja distribuible positiva y sin obligación senior vencida se habilita el reparto a inversores. Sin esas condiciones, bloquear distribución y constituir reservas según corresponda. Acreditar pagos y actualizar el registro de titulares sin reasignar derechos previamente devengados.
8. **Liquidar:** por vencimiento C4 o terminación C1, notificar inversores, cancelar obligaciones, distribuir remanente y extinguir el vehículo conforme a los documentos. La quema al cancelar o cerrar es un supuesto del DTE, no un procedimiento económico implementado.

La cascada declarada es: **operación → regalías C1 → honorarios C2 y C3 → reservas → inversores C4**. Faltan bases, tasas, orden detallado dentro de cada nivel, responsables, impuestos, periodicidad y reglas de pérdidas. EBITDA, utilidad contable y caja distribuible no son equivalentes. Una remesa de la unidad al vehículo y su distribución no son dos ganancias; un honorario ya pagado no se vuelve a descontar.

## Estados y derechos

Proyecto y token son objetos diferentes. El proyecto recorre originación, evaluación, estructuración, suscripción, financiación, puesta en marcha, operación, distribución y liquidación; también puede ser descartado o cancelado. El token vigente puede estar en lock-up, transferible o congelado. Un token congelado conserva derechos económicos; sus restricciones de reclamo se describen en el estado técnico.

Las transferencias ordinarias del modelo requieren KYC vigente de ambas partes, wallets no congeladas, país permitido, límites de tenencia e inversores y lock-up finalizado; aplican a `transfer` y `transferFrom`. Transferibilidad no garantiza intercambio contra pago ni liquidez. Una transferencia posterior no reasigna distribuciones ya devengadas. La duración del lock-up, los umbrales y el corte de titulares requieren definición por emisión. Ver [transiciones y excepciones](LIFECYCLES.md).

## Información, riesgos y aceptación

Cada oportunidad debe identificar derechos, vehículo, operadora, uso de fondos, documentos y versiones, condiciones de cierre, precio, fees, estado, fuentes y fecha. Mostrar riesgos comerciales, financieros, operativos, tecnológicos, jurídicos, cambiarios, fiscales y de liquidez. No convertir ejemplos de USD 500.000, marcas mencionadas o escenarios de ROI en una oferta real o promesa de retorno.

Una acción sensible debe conservar actor autorizado, proyecto/emisión, regla y versión, evidencia, fecha, referencia idempotente y resultado. Distinguir aporte recibido, conciliación, derecho constituido, emisión confirmada, distribución acreditada y reclamo pagado. Una discrepancia requiere incidencia y conciliación; nunca ajuste silencioso de saldos.
