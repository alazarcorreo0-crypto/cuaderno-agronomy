import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DB_PATH, DATA_DIR } from './config.js'

export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

const schemaSql = fs.readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf8')

export function migrate() {
  db.exec(schemaSql)
}

export function isEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS total FROM usuarios').get()
  return Number(row.total) === 0
}

export { DB_PATH, DATA_DIR }
