# Decisiones técnicas

Este documento resume las decisiones de arquitectura y los criterios usados para resolver los puntos abiertos del cuaderno de campo.

## 1. Stack y ejecución

### Backend Node + Express + `node:sqlite`

Se eligió Node.js con Express y el módulo SQLite nativo (`node:sqlite`, `DatabaseSync`) en lugar de un ORM o de `better-sqlite3`:

- No requiere módulos nativos adicionales ni compilación de dependencias.
- El archivo SQLite es fácil de respaldar y trasladar.
- El modelo es pequeño y relacional; un ORM habría añadido complejidad sin beneficio.
- El acceso es síncrono y el servidor es de un solo proceso, suficiente para el volumen previsto de un cuaderno de campo.

La base de datos se migra con `server/schema.sql` al arrancar. El esquema usa `CREATE TABLE IF NOT EXISTS` e índices, y `npm run db:init` permite inicializarla fuera del arranque normal. `npm run db:reset` borra el archivo y vuelve a sembrar datos de ejemplo.

### Frontend React + TypeScript + Vite + Tailwind

- React 19 y TypeScript permiten tipar el contrato del API y los inputs dinámicos.
- Vite ofrece una PWA estática sencilla de compilar y servir desde Express.
- Tailwind acelera una interfaz mobile-first con botones grandes.
- No se añadió una librería de estado global: la sesión vive en un contexto y cada pantalla carga lo que necesita. El tamaño del dominio no justifica Redux/Zustand.
- React Router usa **HashRouter** porque el servidor sirve una SPA estática; con hash las rutas profundas no necesitan reglas de reescritura adicionales y funcionan al abrir la PWA.

### Node 24

El proyecto exige Node 24 o superior porque usa `node:sqlite` sin flags experimentales y `import.meta.dirname`. El entorno de referencia es Node 24.22.1 / npm 11.19.1.

## 2. Modelo dinámico de tipos y campos

El requisito principal era que **nada de tipos o campos estuviera hardcodeado**. El modelo es:

- `tipos_muestra`: nombre, activo y orden.
- `campos_tipo`: pertenece a un tipo, tiene nombre, tipo de dato (`texto`, `numero`, `seleccion`, `rango`), opciones JSON, obligatoriedad y orden.
- `valores_muestra`: valor de un campo para una muestra concreta, con clave única `(muestra_id, campo_tipo_id)`.

Consecuencias:

- La interfaz de trabajador y supervisor se genera a partir de los campos que devuelve el API.
- Cambiar el nombre de un campo no rompe valores anteriores porque el valor se guarda por ID de campo.
- Cambiar las opciones de una selección no borra valores ya guardados; simplemente se muestran como texto si ya no coinciden con una opción actual.
- Reordenar campos solo cambia el orden de presentación.
- Al eliminar un tipo o un campo se eliminan en cascada sus valores, porque el campo deja de existir en el modelo. Para conservar historial se recomienda **desactivar** el tipo en lugar de borrarlo.
- La validación de campos obligatorios se hace al enviar: una muestra marcada como **hecha** no se envía si le falta un campo obligatorio. El cliente muestra qué muestra y qué campos faltan, y el servidor aplica la misma regla como respaldo.

### Cafos con profundidades independientes

“Cafos” no se modeló como un campo fijo con cuatro atributos en código. Se cargó como un tipo normal con cuatro campos independientes:

- Profundidad Norte
- Profundidad Sur
- Profundidad Este
- Profundidad Oeste

Cada uno es un campo `rango` con sus propias opciones y obligatoriedad. Si mañana se necesita otra orientación, otra profundidad o un campo adicional, se crea desde **Tipos** sin tocar el código ni migrar la base. El trabajador ve y completa cada profundidad por separado.

## 3. Autenticación y usuarios

### PIN con hash y tokens firmados

- Los PIN no se guardan en texto plano. Se usa `scrypt` con salt aleatorio por usuario y comparación `timingSafeEqual`.
- El inicio de sesión devuelve un token firmado con HMAC-SHA256. El token incluye `uid`, `rol`, `nombre` y `exp`.
- La vigencia es de 30 días para permitir trabajar varios días en campo sin volver a introducir el PIN. Cada petición vuelve a comprobar que el usuario exista y siga activo.
- El secreto se toma de `AUTH_SECRET` o se genera una vez en `data/auth-secret.key` con permisos restringidos.
- No se usa JWT de terceros para evitar una dependencia y mantener el formato explícito.

### Soft delete y protección del supervisor

- Desactivar un usuario cambia `activo = 0`; no borra la fila. Así se conservan asignaciones, envíos e historial.
- El login y cada petición autenticada rechazan usuarios inactivos.
- Un supervisor no puede desactivarse ni cambiarse a trabajador a sí mismo, para evitar dejar el sistema sin administrador.
- Los supervisores pueden crear otros supervisores, tal como se pidió.
- El PIN se puede restablecer desde **Usuarios**; no existe recuperación automática ni envío por correo. La persona que administra comparte el nuevo PIN directamente.
- El PIN admite de 4 a 32 caracteres, no solo números, para permitir contraseñas algo más fuertes sin complicar el ingreso en campo.

### Limitaciones asumidas

- No hay revocación individual de tokens: al desactivar al usuario se invalidan sus peticiones, pero un token de un usuario activo sigue vigente hasta su expiración.
- No hay límite de intentos de login ni bloqueo por fuerza bruta. Para una exposición pública se recomienda añadir rate limiting en el reverse proxy o en Express.
- No hay recuperación de PIN por el propio usuario; el flujo es asistido por el supervisor.

## 4. Offline-first del trabajador

### IndexedDB, no localStorage

Se usan dos almacenes en IndexedDB:

- `listas`: última lista recibida por usuario, con fecha y muestras.
- `pendientes`: marcas y detalles aún no enviados, con clave `usuario_id:muestra_id` e índice por usuario.

La lista cacheada permite abrir la app y seguir trabajando sin red después de una primera carga. Los pendientes se separan por usuario para que dos personas que compartan un teléfono no mezclen marcas.

### Flujo de marcado

1. El trabajador pulsa HECHO o NO HECHO.
2. Se crea o actualiza un pendiente con fecha/hora del dispositivo y los valores actuales de la muestra.
3. El pendiente se guarda en IndexedDB y se refleja de inmediato en la lista.
4. La lista visible combina la base del servidor/caché con los pendientes locales.
5. Al pulsar **ENVIAR LISTA**, se envían **solo las muestras marcadas** (hechas o no hechas), no toda la lista.
6. El servidor actualiza esas muestras y sus valores en una transacción, registra un `envio` con un snapshot del detalle y responde con la cantidad.
7. Solo después de la confirmación del servidor se eliminan los pendientes locales.

### Fecha y hora

La fecha y hora de marcado se generan en el dispositivo, que es el que estaba en campo. El servidor las valida (`YYYY-MM-DD` y `HH:MM:SS`) y, si faltan, usa la fecha/hora local del servidor como respaldo. La fecha de envío se guarda aparte, de modo que el reporte distingue cuándo se marcó de cuándo se sincronizó.

### Lista del día y pendientes antiguos

El endpoint del trabajador devuelve las muestras asignadas para la fecha consultada **más** cualquier muestra suya con `enviado = 0`, aunque sea de un día anterior. Esto evita que una marca quede inaccesible si el trabajador no envió la lista ese día.

### Sin sincronización automática

No se implementó Background Sync ni envío automático. El envío es una acción explícita del trabajador, con confirmación, porque en campo interesa que la persona sepa cuándo se sincronizó su lista y pueda corregir antes de enviar. Tampoco se añadieron notificaciones push, que quedaron fuera del alcance.

### Conflictos

No hay resolución de conflictos multiusuario sobre la misma muestra: la asignación duplicada se bloquea y cada muestra pertenece a un trabajador. Si un supervisor reasigna una muestra `no_hecha`, la nueva asignación es una fila nueva; el historial anterior se conserva. Si el trabajador corrige una muestra ya enviada, el servidor vuelve a actualizar esa misma fila y registra un nuevo envío, que es el comportamiento esperado para campo.

## 5. Asignaciones y duplicados

- Los números se normalizan, se deduplican y se limitan a 200 por asignación.
- Se bloquea una asignación si ya existe una muestra con el mismo `numero_muestra` y `tipo_muestra_id` en estado `pendiente` o `hecha`.
- Una muestra `no_hecha` sí puede volver a asignarse, porque el trabajo todavía está pendiente en la práctica.
- No se impone una restricción única en la base de datos porque el historial de reasignaciones debe conservarse. La regla se aplica en la ruta de asignación.
- La asignación solo admite trabajadores activos.

## 6. Reportes e historial

- El **Reporte maestro** consulta las muestras por fecha de asignación y muestra estado, fecha/hora de marcado, valores dinámicos y si fueron enviadas.
- Se actualiza al entrar, al pulsar actualizar y con un refresco periódico mientras la pantalla está abierta. No se usan websockets para mantener el sistema simple.
- **Historial** filtra por fecha de marcado, trabajador, tipo y número; está pensado para auditoría y consulta posterior.
- **Envíos** guarda un snapshot JSON del detalle enviado, además de la cantidad y fecha/hora. Así queda registro de lo que el trabajador envió aunque luego se corrija la muestra.
- El servidor es la fuente de verdad; el trabajador solo modifica sus propias filas.

## 7. PWA

- `vite-plugin-pwa` en modo `generateSW` con `autoUpdate`.
- Workbox precachea el shell (HTML, JS, CSS, iconos y webmanifest) para abrir la app sin red.
- Las llamadas `/api` quedan fuera de la navegación precacheada (`navigateFallbackDenylist`) y no se cachean respuestas del API.
- El manifest usa `display: standalone`, orientación vertical, tema verde y accesos directos a la lista del trabajador y al reporte.
- Los iconos se generan localmente con `scripts/generate-icons.mjs` (192, 512, maskable 512, apple-touch 180 y favicon SVG).
- La PWA debe servirse por HTTPS o `localhost` para que el service worker se registre en teléfonos. En una red local por HTTP puede funcionar en el escritorio de desarrollo, pero no cumple los requisitos de instalación de los navegadores móviles.
- La app no incluye notificaciones push ni background sync, tal como se acordó.

## 8. Interfaz y estilo

- Interfaz completamente en español.
- Mobile-first: el trabajador usa botones grandes y una barra fija de envío; el supervisor tiene navegación inferior en móvil y lateral en pantallas amplias.
- Paleta cálida (stone) con verde para acciones positivas y rojo para negativas.
- Los campos dinámicos se renderizan con el mismo componente en la vista del trabajador y en los detalles iniciales de asignación.
- No se añadieron gráficos, reportes avanzados, exportaciones ni funciones fuera del alcance solicitado.

## 9. Datos de ejemplo

El seed crea:

- Supervisores: `Supervisor` / PIN `1234`.
- Trabajadores: Juan Pérez `1111`, María López `2222`, Carlos Ruiz `3333`.
- Tipos: Nematodos, Grid sample y Cafos.
- Campos de Cafos: cuatro `rango` independientes para Norte, Sur, Este y Oeste.

El seed solo se ejecuta si la tabla `usuarios` está vacía. `npm run db:reset` es la forma explícita de volver al estado inicial.

## 10. Posibles mejoras futuras (fuera de alcance)

- Rate limiting y bloqueo temporal de login.
- Revocación de tokens por dispositivo.
- Exportación CSV/PDF del reporte.
- Sincronización automática en segundo plano.
- Múltiples capas de profundidad para Cafos si el negocio lo pide (se resolvería con más campos, no con código nuevo).
