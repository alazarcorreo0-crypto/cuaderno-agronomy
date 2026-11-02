# Cuaderno de Campo

PWA para gestionar muestras de campo desde el teléfono. El trabajador recibe una lista, marca cada muestra como **HECHA** o **NO HECHA**, ajusta sus detalles y envía la lista cuando tenga señal. El supervisor administra trabajadores, tipos de muestra, campos, asignaciones, reportes, historial y envíos recibidos.

## Funcionalidad

### Trabajador

- Ve únicamente sus muestras asignadas.
- Botones grandes de **HECHO** / **NO HECHO**, pensados para usar con guantes o bajo el sol.
- Puede editar los detalles de cada muestra según los campos configurados por el supervisor.
- Las marcas y los detalles quedan guardados en el teléfono (IndexedDB) hasta pulsar **ENVIAR LISTA**.
- Si no hay conexión, puede seguir marcando y editando; la app muestra el aviso de modo offline.
- Al enviar, el servidor registra la fecha/hora de marcado enviada por el dispositivo y actualiza el reporte maestro.
- Si una muestra marcada como **hecha** tiene campos obligatorios vacíos, el envío se detiene y la app indica qué muestra y qué campos faltan.
- La lista incluye las asignaciones del día y las muestras antiguas que todavía no hayan sido enviadas.

### Supervisor

- **Inicio:** resumen del día por estado y por trabajador.
- **Asignar:** asigna uno o varios números de muestra a un trabajador, con tipo, fecha y detalles iniciales opcionales.
- **Tipos:** crea, renombra, ordena, activa/desactiva y elimina tipos de muestra. Dentro de cada tipo se pueden crear, ordenar, editar y eliminar campos. Los campos pueden ser texto, número, selección o rango, con opciones y obligatoriedad configurables.
- **Reporte maestro:** consulta todas las muestras con filtros por fecha de asignación, trabajador, tipo, estado y número. Se actualiza automáticamente después de que un trabajador envía.
- **Historial:** consulta por día de marcado, trabajador, tipo y número. Conserva la fecha y hora de cada marcado.
- **Envíos:** bandeja de listas recibidas, con trabajador, fecha, hora y detalle.
- **Usuarios:** crea supervisores y trabajadores, cambia nombre/rol/PIN, restablece PIN, activa o desactiva cuentas. Un usuario desactivado no puede iniciar sesión, pero su historial se conserva.

Todo el modelo de tipos y campos es dinámico: no hay tipos ni campos hardcodeados en el código de la interfaz. **Cafos** viene como ejemplo con cuatro campos de profundidad independientes (Norte, Sur, Este y Oeste), y se puede ampliar o modificar desde **Tipos**.

## Stack

- **Frontend:** React 19, TypeScript, Vite, React Router (HashRouter), Tailwind CSS 3, lucide-react.
- **Backend:** Node.js, Express 4, `node:sqlite` (SQLite integrado en Node).
- **PWA:** `vite-plugin-pwa` con Workbox, manifest e iconos generados.
- **Persistencia local:** IndexedDB.
- **Autenticación:** token HMAC firmado + PIN con hash `scrypt`.

## Requisitos

- **Node.js 24 o superior** (probado con Node 24.22.1). El proyecto usa el módulo nativo `node:sqlite`.
- npm 11 o superior.
- Para instalar la PWA en un teléfono: HTTPS o `localhost`. Los service workers no se registran en HTTP sobre una IP de red local.

## Instalación

```bash
npm install
```

La base de datos se crea automáticamente en `data/cuaderno.db` la primera vez que arranca el servidor, junto con los datos de ejemplo.

## Ejecución

### Desarrollo

```bash
npm run dev
```

Esto levanta:

- API en `http://localhost:3001`
- Interfaz Vite en `http://localhost:5173` (con proxy `/api` hacia el puerto 3001)

### Producción local

```bash
npm run build
npm start
```

La PWA compilada se sirve desde Express en `http://localhost:3001`.

También se puede ejecutar por separado:

```bash
npm run dev:server   # solo API, con reinicio automático
npm run dev:web      # solo Vite
```

## Credenciales iniciales

| Usuario | Rol | PIN |
| --- | --- | --- |
| Supervisor | Supervisor | `1234` |
| Juan Pérez | Trabajador | `1111` |
| María López | Trabajador | `2222` |
| Carlos Ruiz | Trabajador | `3333` |

Cambia los PIN desde **Usuarios** antes de usar el sistema con datos reales. El PIN puede tener entre 4 y 32 caracteres.

## Uso rápido

### Supervisor

1. Entra con el usuario **Supervisor**.
2. En **Tipos**, revisa o crea los tipos de muestra y sus campos.
3. En **Asignar**, elige trabajador, tipo, fecha y escribe los números de muestra (separados por comas, espacios o saltos de línea).
4. El trabajador verá la lista en su teléfono.
5. Cuando el trabajador envíe su lista, revisa **Reporte maestro**, **Historial** y **Envíos**.

### Trabajador

1. Entra con su nombre y PIN.
2. Marca cada muestra con **HECHO** o **NO HECHO**.
3. Si hace falta, abre **Ver / ajustar detalles** y completa los campos del tipo de muestra.
4. Pulsa **ENVIAR LISTA**. La app pide confirmación y envía solo las muestras marcadas.
5. Puede corregir una muestra ya enviada: la marca de nuevo y vuelve a enviar.

Las marcas se guardan primero en el teléfono. Cerrar la app o perder la conexión no borra los cambios pendientes. No borres los datos del navegador si tienes marcas sin enviar.

## Modo offline y PWA

- La lista del trabajador se guarda en IndexedDB para poder abrirla sin conexión después de una primera carga.
- Las marcas pendientes se guardan por usuario y por muestra; nunca se mezclan con las de otro trabajador en el mismo teléfono.
- Al enviar, la app manda solo las muestras marcadas y elimina los pendientes locales después de que el servidor confirma el envío.
- Fecha y hora de marcado se generan en el dispositivo y se envían al servidor.
- La app se puede instalar desde el navegador (Chrome/Edge/Safari) usando **Instalar aplicación** o **Agregar a pantalla de inicio**.
- Para que el service worker funcione en teléfonos reales, sirve la app por **HTTPS** o desde `localhost`. En una red local por HTTP el navegador puede bloquear el registro del service worker.
- La actualización de la PWA es automática (`autoUpdate`): al abrir una versión nueva, Workbox actualiza la caché en segundo plano.
- No hay notificaciones push ni sincronización en segundo plano; el envío siempre lo inicia el trabajador.

## Datos y configuración

Por defecto:

- Base de datos: `data/cuaderno.db`
- Clave de firma de sesiones: `data/auth-secret.key` (se crea automáticamente)
- Datos de ejemplo: se insertan solo si la tabla `usuarios` está vacía

Variables de entorno opcionales (se leen directamente de `process.env`, no se necesita archivo `.env`):

| Variable | Descripción | Valor por defecto |
| --- | --- | --- |
| `PORT` | Puerto HTTP del servidor | `3001` |
| `DATA_DIR` | Carpeta para datos y clave de autenticación | `./data` |
| `DB_PATH` | Ruta explícita del archivo SQLite | `DATA_DIR/cuaderno.db` |
| `AUTH_SECRET` | Secreto para firmar tokens; si no se define se usa/crea `data/auth-secret.key` | generado |

Ejemplo en PowerShell:

```powershell
$env:PORT = "8080"
npm start
```

### Copia de seguridad

Con el servidor detenido, copia el archivo `data/cuaderno.db` (y, si existe, `data/auth-secret.key`). Para restaurar, deja ambos archivos en su sitio antes de arrancar. Si solo restauras la base de datos y cambias el secreto, las sesiones antiguas dejarán de ser válidas, pero los usuarios podrán volver a entrar con su PIN.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | API con recarga + Vite en paralelo |
| `npm run dev:server` | Solo API con `node --watch` |
| `npm run dev:web` | Solo interfaz Vite |
| `npm run build` | Comprueba TypeScript y compila la PWA en `dist/` |
| `npm start` | Sirve API + PWA compilada desde `dist/` |
| `npm run db:init` | Crea la base de datos y siembra datos si está vacía |
| `npm run db:reset` | **Elimina** la base de datos y la vuelve a crear con los datos de ejemplo |
| `npm run icons` | Regenera los iconos PWA en `public/icons/` |

> En Windows, detén el servidor antes de ejecutar `npm run db:reset`, porque SQLite mantiene el archivo abierto.

### Prueba de humo del API

Con el servidor arrancado:

```bash
node scripts/smoke-test.mjs
```

La prueba crea asignaciones y envíos de prueba. Después conviene ejecutar `npm run db:reset` para dejar la base limpia.

## Estructura del proyecto

```text
server/
  index.js           Entrada de Express, rutas y servicio de la PWA compilada
  schema.sql         Esquema SQLite e índices
  db.js              Conexión SQLite y migración
  init-db.js         Inicialización y reset de la base de datos
  seed.js            Usuarios, tipos y campos de ejemplo
  auth.js            Tokens, hash de PIN y guards de autenticación
  data.js            Consultas y armado de muestras/tipos
  routes/            auth, usuarios, tipos, muestras, envíos y reportes
src/
  pages/trabajador/  Flujo offline del trabajador
  pages/supervisor/  Dashboard, asignación, tipos, reporte, historial, envíos y usuarios
  components/        UI reutilizable e inputs dinámicos
  lib/               API, IndexedDB, fechas y utilidades
  context/           Sesión y autenticación
scripts/
  generate-icons.mjs Generación de iconos PWA
  smoke-test.mjs     Prueba de humo del API
public/
  icons/             Iconos de la PWA
```

## API resumida

Todas las rutas van bajo `/api`. Las rutas protegidas requieren `Authorization: Bearer <token>`.

| Método y ruta | Uso |
| --- | --- |
| `POST /auth/login` | Iniciar sesión |
| `GET /auth/me` | Validar sesión y obtener usuario |
| `GET/POST/PUT/DELETE /usuarios` | Administración de usuarios (solo supervisor) |
| `GET/POST/PUT/DELETE /tipos` | Tipos de muestra (solo supervisor para escritura) |
| `POST /tipos/:id/campos` | Crear campo de un tipo |
| `PUT/DELETE /tipos/campos/:id` | Editar o eliminar campo |
| `POST /tipos/:id/campos/reordenar` | Reordenar campos |
| `POST /muestras` | Asignar muestras (supervisor) |
| `GET /muestras/mias` | Lista del trabajador autenticado |
| `GET /muestras` | Reporte maestro (supervisor) |
| `POST /envios` | Enviar lista marcada (trabajador) |
| `GET /envios` | Bandeja de envíos (supervisor) |
| `GET /reportes/resumen` | Resumen del día (supervisor) |
| `GET /reportes/historial` | Historial de marcados (supervisor) |

## Notas de alcance

Esta versión incluye exactamente el flujo de campo solicitado: asignación, marcado offline, envío, reporte, historial y administración de usuarios/tipos. No incluye gráficos, reportes avanzados, exportación CSV/PDF, notificaciones push ni sincronización automática en segundo plano.

Para las decisiones técnicas y sus motivos, consulta [DECISIONES.md](DECISIONES.md).
