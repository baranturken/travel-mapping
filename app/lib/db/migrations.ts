import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 5;

async function hasColumn(db: SQLiteDatabase, tableName: string, columnName: string) {
  if (!/^[a-z_]+$/i.test(tableName)) {
    throw new Error(`Unsupported table identifier: ${tableName}`);
  }

  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  return columns.some((column) => column.name === columnName);
}

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';

      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stops (
        id TEXT PRIMARY KEY NOT NULL,
        trip_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        city_name TEXT NOT NULL,
        country_name TEXT NOT NULL,
        is_home_base INTEGER NOT NULL DEFAULT 0,
        stay_label TEXT,
        accommodation_name TEXT,
        accommodation_type TEXT,
        accommodation_note TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS legs (
        id TEXT PRIMARY KEY NOT NULL,
        trip_id TEXT NOT NULL,
        from_stop_id TEXT NOT NULL,
        to_stop_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        transport_type TEXT NOT NULL,
        transport_label TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
        FOREIGN KEY (from_stop_id) REFERENCES stops (id) ON DELETE CASCADE,
        FOREIGN KEY (to_stop_id) REFERENCES stops (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS stop_places (
        id TEXT PRIMARY KEY NOT NULL,
        stop_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        title TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (stop_id) REFERENCES stops (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS stop_memories (
        id TEXT PRIMARY KEY NOT NULL,
        stop_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        image_uri TEXT NOT NULL,
        caption TEXT,
        latitude REAL,
        longitude REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (stop_id) REFERENCES stops (id) ON DELETE CASCADE
      );

        CREATE TABLE IF NOT EXISTS route_cache (
          cache_key TEXT PRIMARY KEY NOT NULL,
          profile TEXT NOT NULL,
          source TEXT NOT NULL,
          geometry_json TEXT NOT NULL,
          distance_meters REAL,
          duration_seconds REAL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_stops_trip_order ON stops (trip_id, order_index);
        CREATE INDEX IF NOT EXISTS idx_legs_trip_order ON legs (trip_id, order_index);
        CREATE INDEX IF NOT EXISTS idx_stop_places_stop_order ON stop_places (stop_id, order_index);
        CREATE INDEX IF NOT EXISTS idx_stop_memories_stop_order ON stop_memories (stop_id, order_index);
      `);

    currentVersion = 4;
  }

  if (currentVersion === 1) {
    await db.execAsync(`
      ALTER TABLE stops ADD COLUMN accommodation_name TEXT;
      ALTER TABLE stops ADD COLUMN accommodation_type TEXT;
      ALTER TABLE stops ADD COLUMN accommodation_note TEXT;

      CREATE TABLE IF NOT EXISTS stop_places (
        id TEXT PRIMARY KEY NOT NULL,
        stop_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        title TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (stop_id) REFERENCES stops (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS stop_memories (
        id TEXT PRIMARY KEY NOT NULL,
        stop_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        image_uri TEXT NOT NULL,
        caption TEXT,
        latitude REAL,
        longitude REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (stop_id) REFERENCES stops (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_stop_places_stop_order ON stop_places (stop_id, order_index);
      CREATE INDEX IF NOT EXISTS idx_stop_memories_stop_order ON stop_memories (stop_id, order_index);
    `);

    currentVersion = 2;
  }

  if (currentVersion === 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS route_cache (
        cache_key TEXT PRIMARY KEY NOT NULL,
        profile TEXT NOT NULL,
        source TEXT NOT NULL,
        geometry_json TEXT NOT NULL,
        distance_meters REAL,
        duration_seconds REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    currentVersion = 3;
  }

  if (currentVersion === 3) {
    if (!(await hasColumn(db, 'stops', 'is_home_base'))) {
      await db.execAsync(`
        ALTER TABLE stops ADD COLUMN is_home_base INTEGER NOT NULL DEFAULT 0;
      `);
    }

    currentVersion = 4;
  }

  if (currentVersion === 4) {
    if (!(await hasColumn(db, 'trips', 'start_date'))) {
      await db.execAsync(`
        ALTER TABLE trips ADD COLUMN start_date TEXT;
      `);
    }

    if (!(await hasColumn(db, 'trips', 'end_date'))) {
      await db.execAsync(`
        ALTER TABLE trips ADD COLUMN end_date TEXT;
      `);
    }

    currentVersion = 5;
  }

  await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
}
