import type { Muestra, Pendiente } from '../types'

const DB_NAME = 'cuaderno-campo'
const DB_VERSION = 1
const STORE_LISTAS = 'listas'
const STORE_PENDIENTES = 'pendientes'

let dbPromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_LISTAS)) {
        db.createObjectStore(STORE_LISTAS, { keyPath: 'usuario_id' })
      }
      if (!db.objectStoreNames.contains(STORE_PENDIENTES)) {
        const store = db.createObjectStore(STORE_PENDIENTES, { keyPath: 'id' })
        store.createIndex('usuario_id', 'usuario_id', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB bloqueada por otra pestaña.'))
  })
  return dbPromise
}

function asPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export interface ListaCache {
  usuario_id: number
  fecha: string
  actualizado_en: string
  muestras: Muestra[]
}

export async function getListaCache(usuarioId: number): Promise<ListaCache | null> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_LISTAS, 'readonly')
  const result = await asPromise<ListaCache | undefined>(
    tx.objectStore(STORE_LISTAS).get(usuarioId)
  )
  return result ?? null
}

export async function setListaCache(
  usuarioId: number,
  fecha: string,
  muestras: Muestra[]
): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_LISTAS, 'readwrite')
  const data: ListaCache = {
    usuario_id: usuarioId,
    fecha,
    actualizado_en: new Date().toISOString(),
    muestras,
  }
  tx.objectStore(STORE_LISTAS).put(data)
  await transactionDone(tx)
}

export async function getPendientes(usuarioId: number): Promise<Pendiente[]> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_PENDIENTES, 'readonly')
  const index = tx.objectStore(STORE_PENDIENTES).index('usuario_id')
  return asPromise<Pendiente[]>(index.getAll(usuarioId))
}

export async function savePendiente(pendiente: Pendiente): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_PENDIENTES, 'readwrite')
  tx.objectStore(STORE_PENDIENTES).put(pendiente)
  await transactionDone(tx)
}

export async function deletePendiente(id: string): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_PENDIENTES, 'readwrite')
  tx.objectStore(STORE_PENDIENTES).delete(id)
  await transactionDone(tx)
}

export async function deletePendientes(ids: string[]): Promise<void> {
  if (!ids.length) return
  const db = await openDatabase()
  const tx = db.transaction(STORE_PENDIENTES, 'readwrite')
  const store = tx.objectStore(STORE_PENDIENTES)
  for (const id of ids) store.delete(id)
  await transactionDone(tx)
}
