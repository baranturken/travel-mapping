import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 2;

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
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stops (
        id TEXT PRIMARY KEY NOT NULL,
        trip_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        city_name TEXT NOT NULL,
        country_name TEXT NOT NULL,
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

      CREATE INDEX IF NOT EXISTS idx_stops_trip_order ON stops (trip_id, order_index);
      CREATE INDEX IF NOT EXISTS idx_legs_trip_order ON legs (trip_id, order_index);
      CREATE INDEX IF NOT EXISTS idx_stop_places_stop_order ON stop_places (stop_id, order_index);
      CREATE INDEX IF NOT EXISTS idx_stop_memories_stop_order ON stop_memories (stop_id, order_index);
    `);

    currentVersion = 2;
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

  await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
}
