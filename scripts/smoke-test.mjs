// Prueba de humo del API. Uso: node scripts/smoke-test.mjs (requiere el servidor en el puerto 3001)
const BASE = process.env.API_URL || 'http://localhost:3001'

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

function check(condition, message) {
  if (!condition) throw new Error(`FALLO: ${message}`)
  console.log(`OK: ${message}`)
}

const sup = await call('/api/auth/login', {
  method: 'POST',
  body: { nombre: 'Supervisor', pin: '1234' },
})
check(sup.status === 200 && sup.data.usuario.rol === 'supervisor', 'login supervisor')
const token = sup.data.token

const juan = await call('/api/auth/login', {
  method: 'POST',
  body: { nombre: 'Juan Pérez', pin: '1111' },
})
check(juan.status === 200, 'login trabajador con nombre acentuado')

const tipos = await call('/api/tipos', { token })
const cafos = tipos.data.tipos.find((tipo) => tipo.nombre === 'Cafos')
check(cafos && cafos.campos.length === 4, 'tipos y campos dinámicos cargados')

const numero = String(Date.now()).slice(-5)
const asignacion = await call('/api/muestras', {
  method: 'POST',
  token,
  body: {
    tipo_muestra_id: cafos.id,
    asignado_a: 2,
    numeros: [numero, `${numero}1`],
    valores: { [cafos.campos[0].id]: '1-3 pies' },
  },
})
check(asignacion.status === 201 && asignacion.data.muestras.length === 2, 'asignar 2 muestras')

const duplicate = await call('/api/muestras', {
  method: 'POST',
  token,
  body: { tipo_muestra_id: cafos.id, asignado_a: 2, numeros: [numero] },
})
check(duplicate.status === 409 && duplicate.data.duplicados.includes(numero), 'bloquear muestra repetida')

const mine = await call('/api/muestras/mias', { token: juan.data.token })
const muestra = mine.data.muestras.find((item) => item.numero_muestra === numero)
check(Boolean(muestra), 'el trabajador ve su muestra')

const incomplete = await call('/api/envios', {
  method: 'POST',
  token: juan.data.token,
  body: {
    fecha: new Date().toISOString().slice(0, 10),
    hora: '16:50:00',
    items: [
      {
        muestra_id: muestra.id,
        estado: 'hecha',
        fecha_marcado: new Date().toISOString().slice(0, 10),
        hora_marcado: '16:45:00',
        valores: { [cafos.campos[0].id]: '1-3 pies' },
      },
    ],
  },
})
check(incomplete.status === 400, 'rechazar envío sin campos obligatorios')

const envio = await call('/api/envios', {
  method: 'POST',
  token: juan.data.token,
  body: {
    fecha: new Date().toISOString().slice(0, 10),
    hora: '17:00:00',
    items: [
      {
        muestra_id: muestra.id,
        estado: 'hecha',
        fecha_marcado: new Date().toISOString().slice(0, 10),
        hora_marcado: '16:45:00',
        valores: {
          [cafos.campos[0].id]: '1-3 pies',
          [cafos.campos[1].id]: '1-5 pies',
          [cafos.campos[2].id]: '3-5 pies',
          [cafos.campos[3].id]: '1-3 pies',
        },
      },
    ],
  },
})
check(envio.status === 201 && envio.data.cantidad === 1, 'enviar lista del trabajador')

const report = await call(`/api/muestras?numero=${numero}`, { token })
const updated = report.data.muestras.find((item) => item.numero_muestra === numero)
check(updated.estado === 'hecha' && updated.enviado && updated.hora_marcado === '16:45:00', 'reporte maestro actualizado')

const history = await call(`/api/reportes/historial?numero=${numero}`, { token })
check(history.data.muestras.length >= 1, 'historial por número de muestra')

const inbox = await call('/api/envios', { token })
check(inbox.data.envios.length >= 1, 'bandeja de envíos')

const users = await call('/api/usuarios', { token })
check(users.data.usuarios.length >= 4, 'listado de usuarios')

console.log('\nPrueba de humo completada.')
