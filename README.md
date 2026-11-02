# Cuaderno de Campo

PWA para gestionar muestras de campo desde el teléfono. El trabajador recibe una lista, marca cada muestra como **HECHA** o **NO HECHA**, ajusta sus detalles y envía la lista cuando tenga señal. El supervisor administra trabajadores, tipos de muestra, campos, asignaciones, reportes, historial y envíos recibidos.

La aplicación es **100 % frontend**: no hay servidor Express ni base SQLite. React se compila como sitio estático para **GitHub Pages** y todos los datos viven en **Firestore** (Firebase).

## Funcionalidad

### Trabajador

- Ve únicamente sus muestras asignadas.
- Botones grandes de **HECHO** / **NO HECHO**, pensados para usar con guantes o bajo el sol.
- Puede editar los detalles de cada muestra según los campos configurados por el supervisor.
- Las marcas y los detalles se guardan en la caché persistente de Firestore y se sincronizan automáticamente cuando vuelve la conexión.
- Si no hay conexión, puede seguir marcando, editando y enviando. Firestore deja las escrituras en cola local hasta que haya red.
- Al enviar, se registra la fecha/hora de marcado enviada por el dispositivo y se actualiza el reporte maestro.
- Si una muestra marcada como **hecha** tiene campos obligatorios vacíos, el envío se detiene y la app indica qué muestra y qué campos faltan.
- La lista incluye las asignaciones del día y las muestras antiguas que todavía no hayan sido enviadas.
- La lista se actualiza en tiempo real con `onSnapshot` cuando el supervisor asigna o modifica muestras.

### Supervisor

- **Inicio:** resumen del día por estado y por trabajador.
- **Asignar:** asigna uno o varios números de muestra a un trabajador, con tipo, fecha y detalles iniciales opcionales.
- **Tipos:** crea, renombra, ordena, activa/desactiva y elimina tipos de muestra. Dentro de cada tipo se pueden crear, ordenar, editar y eliminar campos. Los campos pueden ser texto, número, selección o rango, con opciones y obligatoriedad configurables.
- **Reporte maestro:** consulta todas las muestras con filtros por fecha de asignación, trabajador, tipo, estado y número.
- **Historial:** consulta por día de marcado, trabajador, tipo y número. Conserva la fecha y hora de cada marcado.
- **Envíos:** bandeja de listas recibidas, con trabajador, fecha, hora y detalle.
- **Usuarios:** crea supervisores y trabajadores, cambia nombre/rol/PIN, restablece PIN, activa o desactiva cuentas. Un usuario desactivado no puede iniciar sesión, pero su historial se conserva.

Todo el modelo de tipos y campos es dinámico: no hay tipos ni campos hardcodeados en el código de la interfaz. **Cafos** viene como ejemplo con cuatro campos de profundidad independientes (Norte, Sur, Este y Oeste), y se puede ampliar o modificar desde **Tipos**.

## Stack

- **Frontend:** React 19, TypeScript, Vite, React Router (`HashRouter`), Tailwind CSS 3, lucide-react.
- **Datos en la nube:** Firebase / Firestore Web SDK v13.
- **Modo offline:** caché persistente de Firestore (`initializeFirestore` + `persistentLocalCache` + `persistentMultipleTabManager`) y service worker de Workbox.
- **PWA:** `vite-plugin-pwa` con manifest e iconos generados.
- **Autenticación:** login por nombre + PIN contra la colección `usuarios`; el PIN se guarda como hash PBKDF2-SHA256, nunca en texto plano.
- **Despliegue:** GitHub Actions + GitHub Pages.

## Requisitos

- Node.js 20.19 o superior y npm.
- Un proyecto de Firebase con Firestore habilitado. La configuración ya está en `src/firebase.ts` para el proyecto `cuaderno-agronomy`.
- Para instalar la PWA en un teléfono: HTTPS o `localhost`. GitHub Pages sirve por HTTPS.

## Configurar Firebase

1. Entra en la consola de Firebase del proyecto `cuaderno-agronomy`.
2. Crea una base de datos **Firestore** (modo producción o prueba).
3. Publica las reglas de `firestore.rules`. La app no usa Firebase Auth, así que las reglas actuales permiten lectura y escritura desde el cliente. Puedes pegarlas en **Firestore → Reglas** o desplegarlas con Firebase CLI:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

El archivo `.firebaserc` ya apunta al proyecto `cuaderno-agronomy`.

> Las reglas abiertas son necesarias para que funcione el login por PIN actual, pero **no son seguras para producción**. Consulta la sección [Seguridad](#seguridad).

El seed se ejecuta solo cuando la colección `usuarios` está vacía. No hace falta ejecutar ningún comando: en el primer inicio de sesión la app crea los usuarios y los tipos de muestra iniciales.

## Instalación y desarrollo

```bash
npm install
npm run dev
```

Vite sirve la app en:

```text
http://localhost:5173/cuaderno-agronomy/
```

La ruta incluye `/cuaderno-agronomy/` porque `vite.config.ts` define `base: '/cuaderno-agronomy/'`, igual que en GitHub Pages.

### Compilar y probar la PWA

```bash
npm run build
npm run preview
```

La PWA compilada queda en `dist/`. `npm run preview` la sirve con la misma base.

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
4. El trabajador verá la lista en su teléfono; si está abierto, se actualiza en tiempo real.
5. Cuando el trabajador envíe su lista, revisa **Reporte maestro**, **Historial** y **Envios**.

### Trabajador

1. Entra con su nombre y PIN.
2. Marca cada muestra con **HECHO** o **NO HECHO**.
3. Si hace falta, abre **Ver / ajustar detalles** y completa los campos del tipo de muestra.
4. Pulsa **ENVIAR LISTA**. La app pide confirmación y envía solo las muestras marcadas.
5. Puede corregir una muestra ya enviada: la marca de nuevo y vuelve a enviar.

Las marcas se guardan primero en la caché local de Firestore. Cerrar la app o perder la conexión no borra los cambios pendientes. No borres los datos del navegador si tienes marcas sin sincronizar.

## Despliegue en GitHub Pages

El workflow `.github/workflows/deploy.yml` compila y publica la app en cada push a la rama principal, ya sea `main` o `master`.

1. Sube el repositorio a GitHub.
2. En **Settings → Pages**, elige **GitHub Actions** como origen.
3. Haz push a `main` o `master`.
4. La app quedará en `https://<usuario>.github.io/cuaderno-agronomy/`.

El nombre del repositorio debe ser `cuaderno-agronomy` para que coincida con `base: '/cuaderno-agronomy/'`. Si usas otro nombre, cambia `base` en `vite.config.ts` y las rutas del manifest.

## Modo offline y PWA

- Firestore mantiene una caché persistente en IndexedDB. Las lecturas y escrituras se encolan si no hay red y se sincronizan automáticamente al recuperar la conexión.
- Las marcas pendientes del trabajador se guardan en la colección `pendientes` y se eliminan al confirmar el envío.
- La app usa `onSnapshot` para la lista del trabajador y `getDocs` para las pantallas de supervisor/reportes.
- Workbox precachea el shell (HTML, JS, CSS, iconos y manifest) para abrir la app sin red después de la primera carga.
- La primera carga de un dispositivo necesita conexión para descargar el shell y la configuración de Firebase.
- La actualización de la PWA es automática (`autoUpdate`).
- La app se puede instalar desde el navegador con **Instalar aplicación** o **Agregar a pantalla de inicio**.
- No hay notificaciones push ni sincronización en segundo plano; el envío siempre lo inicia el trabajador.

## Modelo de datos en Firestore

| Colección | Contenido |
| --- | --- |
| `usuarios` | `id`, `nombre`, `rol`, `activo`, `pin_hash`, `actualizado_en` |
| `tipos` | `id`, `nombre`, `activo`, `orden`, `campos[]`, `actualizado_en` |
| `muestras` | `id`, `numero_muestra`, `tipo_muestra_id`, `asignado_a`, fecha/hora, estado, `enviado`, `valores`, auditoría |
| `envios` | `id`, `trabajador_id`, fecha/hora, `cantidad_muestras`, `detalle.items[]` |
| `pendientes` | Borradores por usuario/muestra: `usuario_id`, `muestra_id`, estado, fecha/hora y `valores` |

Los campos de un tipo se guardan dentro del documento del tipo (`campos[]`) para simplificar las lecturas. Los IDs son cadenas generadas en el cliente y también son el ID del documento de Firestore.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Inicia Vite con la base `/cuaderno-agronomy/` |
| `npm run build` | Comprueba TypeScript y compila la PWA en `dist/` |
| `npm run preview` | Sirve la PWA compilada |
| `npm run icons` | Regenera los iconos PWA en `public/icons/` |

No hay scripts de backend, SQLite ni pruebas de humo del API.

## Estructura del proyecto

```text
.github/workflows/deploy.yml   Build y despliegue a GitHub Pages
.firebaserc                    Proyecto por defecto de Firebase CLI
firebase.json                  Configuración de Firebase CLI
firestore.rules                Reglas de Firestore
src/
  firebase.ts                  Inicialización de Firebase y caché persistente
  lib/api.ts                   Repositorio Firestore (auth, usuarios, tipos, muestras, envíos, reportes)
  lib/pin.ts                   Hash y verificación PBKDF2-SHA256
  lib/seed.ts                  Seed automático de usuarios y tipos
  pages/trabajador/            Lista, marcado offline y envío
  pages/supervisor/            Dashboard, asignación, tipos, reporte, historial, envíos y usuarios
  components/                  UI reutilizable e inputs dinámicos
  context/                     Sesión y autenticación
scripts/generate-icons.mjs     Generación de iconos PWA
public/icons/                  Iconos de la PWA
```

## Solución de problemas

- **`Firestore rechazó la operación. Revisa las reglas de seguridad del proyecto.`**: faltan publicar las reglas de `firestore.rules`. Es el error que aparece con las reglas predeterminadas de Firestore.
- **`The database (default) does not exist`**: falta crear la base de datos Firestore en la consola de Firebase.
- **No aparece el seed**: solo se ejecuta si `usuarios` está vacío. Si ya hay usuarios, inicia sesión con uno existente o borra la colección desde la consola para volver a sembrar.
- **La app no abre sin conexión**: la primera visita debe completarse con red para instalar el service worker y descargar la configuración de Firebase.
- **Los cambios offline no aparecen en otro dispositivo**: todavía no se sincronizaron. Abre la app con red y espera a que Firestore procese la cola local.
- **El PIN no funciona después de borrar datos del navegador**: el hash vive en Firestore, pero la sesión local se pierde; vuelve a iniciar sesión. Si se borró la colección `usuarios`, el siguiente login vuelve a sembrar las credenciales de ejemplo.
- **El service worker no se actualiza**: recarga con red; la app usa `autoUpdate` y Workbox elimina las cachés antiguas.

## Seguridad

La autenticación actual es **del lado del cliente**: se consulta `usuarios` y se verifica el hash PBKDF2 del PIN. Los PIN no se guardan en texto plano, pero **cualquier cliente con la configuración pública de Firebase puede leer los hashes y las colecciones** porque no hay Firebase Auth ni reglas restrictivas.

Esto es aceptable para una demo o un despliegue controlado, no para datos sensibles de producción. Para endurecerlo:

1. Activa Firebase Authentication (por ejemplo, autenticación anónima o por email).
2. Cambia el login para obtener un ID token de Firebase.
3. Reescribe `firestore.rules` usando `request.auth` y un documento de roles.
4. Deja de permitir lectura/escritura global.

También conviene limitar el acceso a la consola de Firebase y cambiar los PIN de ejemplo.

Para las decisiones técnicas y sus motivos, consulta [DECISIONES.md](DECISIONES.md).
