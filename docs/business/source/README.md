# Fuentes de la actualización de negocio

Recibidas del usuario; incorporadas el 2026-11-01. Copias sin modificación de los archivos originales, con nombres portables. Los tres repositorios contienen el mismo conjunto de fuentes y las mismas especificaciones de modelo, ciclos y estado técnico. Cada copia es autónoma; al cambiar una regla compartida, reconciliar las otras dos.

| Archivo | Procedencia y alcance |
|---|---|
| [Presentación final](presentacion-final.md) | `FranToken_Presentacion_Final.md`, presentación académica, octubre de 2026. Modelo de negocio; §§6.4, 7.1 y 12 requieren las correcciones indicadas abajo. |
| [Estado vs. modelo](estado-vs-modelo.pdf) | `FranToken estado vs. modelo de negocio.pdf`, 29-10-2026. Estado técnico histórico y brechas; no es resultado de pruebas de esta actualización. |
| [DTE del token](dte-token.jpeg) | Primera imagen de la solicitud: estados del token emitido y reglas ERC-3643. |
| [DTE del proyecto](dte-proyecto.jpeg) | Segunda imagen de la solicitud: ciclo del proyecto de franquicia y relaciones C1–C4. |
| [Transcripción del PDF](estado-vs-modelo-transcripcion.txt) | Extracción local por página del texto del PDF; facilita búsquedas. El PDF original prevalece ante diferencias de formato. |

## Precedencia y reconciliación

1. La instrucción directa del usuario fija **USD 10 por token + fees de transacción blockchain**. Prevalece sobre el precio estimativo y los gastos genéricos de §6.4. No autoriza otros cargos por defecto.
2. El PDF corrige la presentación: C4 emite después de atestación de conciliación externa; C3 calcula/registra comisión sobre compras sin cobrarla. Gestión y resultado siguen pendientes.
3. Los DTE modelan comportamiento esperado. Las diferencias con código, incluido KYC bilateral, se registran en [estado técnico](../IMPLEMENTATION-STATUS.md). La quema por cierre/cancelación es un supuesto explícito del DTE.
4. El 0,5 % del PDF es un parámetro del prototipo; la instrucción de precio fijo no lo ratifica como comisión comercial definitiva.
5. El PDF informa 51 tests y trabajo en develop al 29-10-2026. Esos datos históricos no describen las ramas actuales ni prueban una ejecución nueva.
6. No se reescriben manuales, ADR ni contexto importado anteriores. Su consulta debe partir del [modelo vigente](../BUSINESS-LOGIC.md) y de sus decisiones. Las referencias legales/competitivas de la presentación quedan como material aportado, sin verificación externa en esta tarea.

## Integridad de las copias

| Archivo original | SHA-256 |
|---|---|
| `FranToken_Presentacion_Final.md` | `69146d8475f2df376fe8e6ff6761c8f3f327b4d80531b645363a829f907d489d` |
| `FranToken estado vs. modelo de negocio.pdf` | `12e09539fbfb89bf145c3a4db83ad355726f62df97204ccd2bf939e841455872` |
| `WhatsApp Image 2026-10-31 at 20.32.28.jpeg` | `d4ed76f2c0f3f5c79087110475211e742cc723fcd5cdff15318969d53b1d7e3a` |
| `WhatsApp Image 2026-10-31 at 20.32.31.jpeg` | `f98af57e9c1a19f98ece78215f14f93cf88fb63048835956e38bd97db26c51a8` |
