import { Router } from 'express'
import { db } from '../db.js'
import { hydrateMuestras } from '../data.js'
import { isValidDate, localDate } from '../helpers.js'

const router = Router()

// Resumen del día para el dashboard del supervisor.
router.get('/resumen', (req, res) => {
  const fecha = req.query.fecha && isValidDate(req.query.fecha) ? req.query.fecha : localDate()

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS asignadas,
              SUM(CASE WHEN estado = 'hecha' THEN 1 ELSE 0 END) AS hechas,
              SUM(CASE WHEN estado = 'no_hecha' THEN 1 ELSE 0 END) AS no_hechas,
              SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
              SUM(CASE WHEN enviado = 1 THEN 1 ELSE 0 END) AS enviadas
         FROM muestras
        WHERE fecha_asignacion = ?`
    )
    .get(fecha)

  const trabajadores = db
    .prepare(
      `SELECT u.id, u.nombre,
              COUNT(*) AS asignadas,
              SUM(CASE WHEN m.estado = 'hecha' THEN 1 ELSE 0 END) AS hechas,
              SUM(CASE WHEN m.estado = 'no_hecha' THEN 1 ELSE 0 END) AS no_hechas,
              SUM(CASE WHEN m.estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes
         FROM muestras m
         JOIN usuarios u ON u.id = m.asignado_a
        WHERE m.fecha_asignacion = ?
        GROUP BY u.id
        ORDER BY u.nombre COLLATE NOCASE`
    )
    .all(fecha)
    .map((row) => ({
      id: Number(row.id),
      nombre: row.nombre,
      asignadas: Number(row.asignadas),
      hechas: Number(row.hechas ?? 0),
      no_hechas: Number(row.no_hechas ?? 0),
      pendientes: Number(row.pendientes ?? 0),
    }))

  res.json({
    fecha,
    totales: {
      asignadas: Number(totals.asignadas ?? 0),
      hechas: Number(totals.hechas ?? 0),
      no_hechas: Number(totals.no_hechas ?? 0),
      pendientes: Number(totals.pendientes ?? 0),
      enviadas: Number(totals.enviadas ?? 0),
    },
    trabajadores,
  })
})

// Historial de muestras marcadas, con fecha y hora.
router.get('/historial', (req, res) => {
  const conditions = ["m.estado != 'pendiente'"]
  const params = []

  if (req.query.fecha && isValidDate(req.query.fecha)) {
    conditions.push('m.fecha_marcado = ?')
    params.push(req.query.fecha)
  }
  if (req.query.trabajador) {
    conditions.push('m.asignado_a = ?')
    params.push(Number(req.query.trabajador))
  }
  if (req.query.numero) {
    conditions.push('m.numero_muestra LIKE ?')
    params.push(`%${String(req.query.numero).trim()}%`)
  }
  if (req.query.tipo) {
    conditions.push('m.tipo_muestra_id = ?')
    params.push(Number(req.query.tipo))
  }

  const rows = db
    .prepare(
      `SELECT m.*, u.nombre AS trabajador_nombre, s.nombre AS asignado_por_nombre
         FROM muestras m
         JOIN usuarios u ON u.id = m.asignado_a
         JOIN usuarios s ON s.id = m.asignado_por
        WHERE ${conditions.join(' AND ')}
        ORDER BY m.fecha_marcado DESC, m.hora_marcado DESC, m.id DESC`
    )
    .all(...params)

  res.json({ muestras: hydrateMuestras(rows) })
})

export default router
