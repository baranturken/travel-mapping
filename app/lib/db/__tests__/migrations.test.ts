import { migrateDbIfNeeded } from '@/lib/db/migrations';

type MockDatabase = {
  execAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  getAllAsync: jest.Mock;
};

function createMockDatabase(
  userVersion: number,
  columnsByTable: Partial<Record<'stops' | 'trips', string[]>> = {},
): MockDatabase {
  return {
    execAsync: jest.fn().mockResolvedValue(undefined),
    getFirstAsync: jest.fn().mockResolvedValue({ user_version: userVersion }),
    getAllAsync: jest.fn().mockImplementation((query: string) => {
      if (query === 'PRAGMA table_info(stops)') {
        return Promise.resolve((columnsByTable.stops ?? []).map((name) => ({ name })));
      }

      if (query === 'PRAGMA table_info(trips)') {
        return Promise.resolve((columnsByTable.trips ?? []).map((name) => ({ name })));
      }

      return Promise.resolve([]);
    }),
  };
}

describe('migrateDbIfNeeded', () => {
  it('returns early when the database is already at the latest version', async () => {
    const db = createMockDatabase(6);

    await migrateDbIfNeeded(db as never);

    expect(db.execAsync).toHaveBeenCalledTimes(1);
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
  });

  it('creates the latest schema from scratch at version 0', async () => {
    const db = createMockDatabase(0);

    await migrateDbIfNeeded(db as never);

    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining("PRAGMA journal_mode = 'wal';"));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS trips'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS route_cache'));
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 6');
  });

  it('upgrades version 1 databases through the intermediate schema steps', async () => {
    const db = createMockDatabase(1);

    await migrateDbIfNeeded(db as never);

    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE stops ADD COLUMN accommodation_name TEXT;'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS stop_places'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS route_cache'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE stops ADD COLUMN is_home_base'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE trips ADD COLUMN start_date'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE trips ADD COLUMN end_date'));
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 6');
  });

  it('creates the route cache table when upgrading from version 2 to 3', async () => {
    const db = createMockDatabase(2);

    await migrateDbIfNeeded(db as never);

    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS route_cache'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE stops ADD COLUMN is_home_base'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE trips ADD COLUMN start_date'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE trips ADD COLUMN end_date'));
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 6');
  });

  it('adds the home-base column when upgrading from version 3 to 4', async () => {
    const db = createMockDatabase(3, {
      stops: ['id', 'trip_id', 'city_name'],
    });

    await migrateDbIfNeeded(db as never);

    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
    expect(db.getAllAsync).toHaveBeenCalledWith('PRAGMA table_info(stops)');
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE stops ADD COLUMN is_home_base'));
    expect(db.getAllAsync).toHaveBeenCalledWith('PRAGMA table_info(trips)');
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE trips ADD COLUMN start_date'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE trips ADD COLUMN end_date'));
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 6');
  });

  it('skips the home-base ALTER TABLE if the column already exists', async () => {
    const db = createMockDatabase(3, {
      stops: ['id', 'trip_id', 'is_home_base'],
    });

    await migrateDbIfNeeded(db as never);

    expect(db.getAllAsync).toHaveBeenCalledWith('PRAGMA table_info(stops)');
    expect(db.execAsync).not.toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE stops ADD COLUMN is_home_base'));
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 6');
  });

  it('adds the publish columns when upgrading from version 5 to 6', async () => {
    const db = createMockDatabase(5, {
      trips: ['id', 'title', 'start_date', 'end_date'],
    });

    await migrateDbIfNeeded(db as never);

    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE trips ADD COLUMN is_public'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE trips ADD COLUMN supabase_id'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE trips ADD COLUMN published_at'));
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 6');
  });

  it('skips the trip-date ALTER TABLE calls if the columns already exist', async () => {
    const db = createMockDatabase(4, {
      trips: ['id', 'title', 'start_date', 'end_date'],
    });

    await migrateDbIfNeeded(db as never);

    expect(db.getAllAsync).toHaveBeenCalledWith('PRAGMA table_info(trips)');
    expect(db.execAsync).not.toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE trips ADD COLUMN start_date'));
    expect(db.execAsync).not.toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE trips ADD COLUMN end_date'));
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 6');
  });
});
