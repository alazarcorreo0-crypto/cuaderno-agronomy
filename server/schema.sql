PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre     TEXT NOT NULL UNIQUE,
  rol        TEXT NOT NULL CHECK (rol IN ('supervisor', 'trabajador')),
  pin_hash   TEXT NOT NULL,
  activo     INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_en  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tipos_muestra (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  orden  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS campos_tipo (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo_muestra_id INTEGER NOT NULL REFERENCES tipos_muestra(id) ON DELETE CASCADE,
  nombre_campo    TEXT NOT NULL,
  tipo_dato       TEXT NOT NULL CHECK (tipo_dato IN ('texto', 'numero', 'seleccion', 'rango')),
  opciones        TEXT,
  requerido       INTEGER NOT NULL DEFAULT 0 CHECK (requerido IN (0, 1)),
  orden           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS muestras (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_muestra  TEXT NOT NULL,
  tipo_muestra_id INTEGER NOT NULL REFERENCES tipos_muestra(id),
  asignado_a      INTEGER NOT NULL REFERENCES usuarios(id),
  fecha_asignacion TEXT NOT NULL,
  asignado_por    INTEGER NOT NULL REFERENCES usuarios(id),
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'hecha', 'no_hecha')),
  fecha_marcado   TEXT,
  hora_marcado    TEXT,
  enviado         INTEGER NOT NULL DEFAULT 0 CHECK (enviado IN (0, 1)),
  fecha_envio     TEXT,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS valores_muestra (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  muestra_id   INTEGER NOT NULL REFERENCES muestras(id) ON DELETE CASCADE,
  campo_tipo_id INTEGER NOT NULL REFERENCES campos_tipo(id) ON DELETE CASCADE,
  valor        TEXT,
  UNIQUE (muestra_id, campo_tipo_id)
);

CREATE TABLE IF NOT EXISTS envios (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  trabajador_id     INTEGER NOT NULL REFERENCES usuarios(id),
  fecha             TEXT NOT NULL,
  hora              TEXT NOT NULL,
  cantidad_muestras INTEGER NOT NULL,
  detalle_json      TEXT NOT NULL,
  creado_en         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_muestras_asignado_fecha
  ON muestras (asignado_a, fecha_asignacion);
CREATE INDEX IF NOT EXISTS idx_muestras_estado
  ON muestras (estado);
CREATE INDEX IF NOT EXISTS idx_muestras_tipo
  ON muestras (tipo_muestra_id);
CREATE INDEX IF NOT EXISTS idx_valores_muestra
  ON valores_muestra (muestra_id);
CREATE INDEX IF NOT EXISTS idx_campos_tipo
  ON campos_tipo (tipo_muestra_id);
CREATE INDEX IF NOT EXISTS idx_envios_trabajador
  ON envios (trabajador_id, fecha);
