# Decisiones técnicas

Este documento resume las decisiones de arquitectura del cuaderno de campo y los criterios usados para resolver los puntos abiertos.

## 1. Aplicación frontend-only con Firestore

La versión actual elimina por completo el backend Express y la base SQLite local. La app se compila como sitio estático y se publica en GitHub Pages; Firestore es la única fuente de verdad.

Motivos:

- GitHub Pages solo sirve archivos estáticos: no ejecuta Node ni mantiene una base SQLite.
- Firestore ofrece persistencia en la nube, sincronización en tiempo real y caché offline sin levantar un servidor propio.
- Se conserva React + TypeScript + Vite, que ya cubrían la interfaz móvil y la PWA.

Consecuencias:

- El cliente habla directamente con Firestore usando la configuración pública de Firebase.
- Las validaciones de negocio se ejecutan en el cliente. No hay una segunda validación en servidor.
- Las reglas de seguridad de Firestore son la única barrera de acceso. Como el login no usa Firebase Auth, actualmente las reglas permiten lectura y escritura global.
- Los reportes se calculan en el cliente, no con SQL.

## 2. Inicialización de Firebase y caché offline

`src/firebase.ts` inicializa la app con la configuración del proyecto `cuaderno-agronomy` y crea Firestore con:

```ts
initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})
```

Motivos:

- `persistentLocalCache` mantiene una caché en IndexedDB que permite leer y escribir sin red.
- `persistentMultipleTabManager` evita conflictos cuando la PWA se abre en varias pestañas.
- Las escrituras hechas sin conexión quedan en cola y Firestore las sincroniza automáticamente.
- Se exporta también `analytics` con `getAnalytics(app)` para habilitar Google Analytics.

La primera carga de un dispositivo necesita conexión para descargar el shell y la configuración de Firebase. La caché no sustituye una base local completa: si se borran los datos del navegador, se pierden los cambios que aún no se hayan sincronizado.

## 3. Autenticación por PIN

No se usa Firebase Authentication. El login consulta la colección `usuarios`, busca el nombre de forma normalizada y verifica el PIN contra un hash PBKDF2-SHA256.

- Los PIN **no** se guardan en texto plano.
- Cada hash incluye salt aleatorio, iteraciones y el digest en Base64.
- La sesión se guarda en `localStorage` solo con el ID del usuario, y `api.auth.me` vuelve a comprobar que el usuario exista y esté activo.
- La vigencia de la sesión es indefinida hasta que el usuario cierre sesión o el navegador borre `localStorage`.
- Un supervisor no puede desactivarse ni cambiarse a trabajador a sí mismo.
- Los usuarios se desactivan con `activo: false`; no se borran, para conservar asignaciones, envíos e historial.

### Limitaciones de seguridad

Al no haber Firebase Auth, Firestore no puede identificar al usuario en las reglas. Las reglas de `firestore.rules` permiten lectura y escritura global para que la app funcione. Esto significa que:

- Cualquier persona con la configuración pública de Firebase puede leer todos los documentos.
- Los hashes de PIN son legibles y podrían atacarse con fuerza bruta offline.
- Cualquier cliente podría escribir o borrar datos.

Es una solución de demo o despliegue controlado. Para producción hay que activar Firebase Auth, cambiar el login para obtener un ID token y reescribir las reglas con `request.auth`.

## 4. Modelo de datos

Se usan colecciones de Firestore con IDs de tipo string generados en el cliente:

- `usuarios`
- `tipos`
- `muestras`
- `envios`
- `pendientes`

Decisiones:

- **Campos dentro del documento del tipo** (`tipos/{id}.campos[]`), no una subcolección. Los tipos tienen pocos campos, se leen siempre juntos y así se evita una lectura adicional por cada tipo.
- **IDs string** en todos los documentos. El ID del documento también se guarda como campo `id` para simplificar la hidratación y las referencias en la interfaz.
- **Valores dinámicos** de cada muestra en un mapa `valores: { [campoId]: string }`. Si un campo se elimina, el valor se limpia de muestras y pendientes.
- **Nombres derivados** (`tipo_nombre`, `trabajador_nombre`, `campos[]`) se calculan al leer, no se duplican en cada muestra, para evitar datos inconsistentes.
- **Envíos con snapshot** (`detalle.items[]`) para conservar qué se envió aunque luego se corrija una muestra.
- **Fechas/hora en ISO** generadas por el dispositivo y guardadas como strings. La fecha de marcado se separa de la fecha de envío.

Los filtros de reportes, historial y listados se aplican en memoria después de `getDocs`. Para el volumen previsto de un cuaderno de campo es más simple que mantener índices compuestos; si el volumen crece, habría que paginar y mover filtros a consultas de Firestore.

## 5. Seed automático

El seed vive en `src/lib/seed.ts` y se ejecuta al intentar iniciar sesión. Antes de buscar al usuario comprueba si `usuarios` está vacía; si lo está, crea en un batch:

- Supervisor / PIN `1234`.
- Juan Pérez `1111`, María López `2222`, Carlos Ruiz `3333`.
- Tipos iniciales: Nematodos, Grid sample y Cafos.
- Cafos con cuatro campos `rango` independientes: Profundidad Norte, Sur, Este y Oeste.

Motivos:

- No hay backend que ejecute un script de inicialización.
- GitHub Pages no puede ejecutar Node en el servidor.
- Hacer el seed al primer login evita que un usuario nuevo se quede sin credenciales.
- Es idempotente para el caso normal: si ya hay usuarios, no escribe nada.
- Los IDs del seed son estables y los PIN se hashean en el navegador.

Si se borra toda la colección `usuarios`, el siguiente login vuelve a sembrar los datos de ejemplo. Si solo se borran tipos, no se recrean automáticamente porque se considera una acción deliberada del supervisor.

## 6. Flujo offline del trabajador

La app usa la caché persistente de Firestore y una colección `pendientes` para los borradores.

1. El trabajador marca HECHO o NO HECHO.
2. Se crea o actualiza un documento `pendientes/{usuarioId}__{muestraId}`.
3. La lista visible combina la muestra de Firestore con el pendiente.
4. Al pulsar **ENVIAR LISTA**, se escriben las muestras actualizadas, se crea el envío y se borran los pendientes.
5. Si no hay red, todas esas escrituras quedan en la cola local de Firestore y se sincronizan al volver la conexión.

Decisiones:

- Los pendientes van a Firestore, no a un almacén local separado, para que toda la lógica de datos use el mismo mecanismo y la misma caché offline.
- La clave del pendiente incluye el usuario para que dos personas que compartan un teléfono no mezclen marcas.
- La fecha/hora de marcado se genera en el dispositivo, porque es el que estaba en campo.
- El envío es explícito. No se usa Background Sync ni un envío automático.
- Se valida en el cliente que una muestra HECHA tenga todos los campos obligatorios antes de escribir.
- La escritura del envío se reparte en lotes de 400 operaciones para respetar el límite de 500 escrituras por batch de Firestore.

La lista del trabajador usa `onSnapshot` con una consulta por `asignado_a`. El supervisor y los reportes usan `getDocs` al entrar o al pulsar actualizar; no se mantiene un websocket para todas las pantallas.

## 7. Asignaciones y duplicados

- Los números se normalizan, se deduplican y se limitan a 200 por asignación.
- Se bloquea una asignación si ya existe una muestra con el mismo número y tipo en estado `pendiente` o `hecha`.
- Una muestra `no_hecha` se puede volver a asignar.
- No hay una restricción única en Firestore porque se conserva el historial de reasignaciones. La regla se aplica en la capa de API del cliente.
- Solo se puede asignar a trabajadores activos.

## 8. Reportes, historial y envíos

- El reporte maestro consulta las muestras por fecha de asignación y filtra por trabajador, tipo, estado, número y si fueron enviadas.
- El historial filtra por fecha de marcado, trabajador, tipo y número.
- La bandeja de envíos lee la colección `envios` y muestra el snapshot del detalle.
- Todo se calcula en el cliente. No hay API ni SQL.
- El supervisor ve los cambios cuando Firestore sincroniza y la pantalla vuelve a leer. La lista del trabajador sí es reactiva mediante `onSnapshot`.

## 9. PWA y GitHub Pages

- `vite.config.ts` define `base: '/cuaderno-agronomy/'`.
- El manifest usa ese mismo `start_url`, `scope`, iconos y accesos directos.
- `index.html` y las imágenes usan `%BASE_URL%` o `publicAsset()` para respetar el subdirectorio.
- Workbox precachea el shell con `navigateFallback` en `/cuaderno-agronomy/index.html`.
- `registerSW({ immediate: true })` registra el service worker.
- El workflow `.github/workflows/deploy.yml` usa `actions/checkout`, `actions/setup-node`, `npm install`, `npm run build`, `actions/upload-pages-artifact` y `actions/deploy-pages`.
- En GitHub hay que seleccionar **GitHub Actions** como origen de Pages.
- La app debe servirse por HTTPS o `localhost` para que el service worker y `crypto.subtle` funcionen en móviles.

## 10. Interfaz y estilo

- Interfaz completamente en español.
- Mobile-first: el trabajador usa botones grandes y una barra fija de envío; el supervisor tiene navegación inferior en móvil y lateral en pantallas amplias.
- Paleta cálida (stone) con verde para acciones positivas y rojo para negativas.
- Los campos dinámicos se renderizan con el mismo componente en la vista del trabajador y en los detalles iniciales de asignación.
- No se añadieron gráficos, reportes avanzados, exportaciones ni funciones fuera del alcance solicitado.

## 11. Posibles mejoras futuras

- Firebase Authentication y reglas de seguridad por usuario/rol.
- App Check para limitar el uso de la configuración pública.
- Paginación e índices para muestras cuando el volumen crezca.
- Exportación CSV/PDF del reporte.
- Sincronización en segundo plano y notificaciones.
- Panel de auditoría de cambios.
