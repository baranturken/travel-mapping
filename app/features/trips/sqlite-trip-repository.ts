import type { SQLiteDatabase } from 'expo-sqlite';

import type { TripRepository } from '@/features/trips/repository';
import type {
  CreateTripInput,
  TransportType,
  TripDetail,
  TripLeg,
  TripStop,
  TripSummary,
} from '@/features/trips/types';

type TripRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type StopRow = {
  id: string;
  trip_id: string;
  order_index: number;
  city_name: string;
  country_name: string;
  stay_label: string | null;
  latitude: number;
  longitude: number;
};

type LegRow = {
  id: string;
  trip_id: string;
  from_stop_id: string;
  to_stop_id: string;
  order_index: number;
  transport_type: TransportType;
  transport_label: string | null;
};

type TripListRow = TripRow & {
  stop_count: number;
  first_stop_label: string | null;
  last_stop_label: string | null;
};

function mapTripRow(row: TripRow): TripSummary {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStopRow(row: StopRow): TripStop {
  return {
    id: row.id,
    tripId: row.trip_id,
    orderIndex: row.order_index,
    cityName: row.city_name,
    countryName: row.country_name,
    stayLabel: row.stay_label,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

function mapLegRow(row: LegRow): TripLeg {
  return {
    id: row.id,
    tripId: row.trip_id,
    fromStopId: row.from_stop_id,
    toStopId: row.to_stop_id,
    orderIndex: row.order_index,
    transportType: row.transport_type,
    transportLabel: row.transport_label,
  };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSQLiteTripRepository(db: SQLiteDatabase): TripRepository {
  return {
    async listTrips() {
      const rows = await db.getAllAsync<TripListRow>(`
        SELECT
          trips.id,
          trips.title,
          trips.created_at,
          trips.updated_at,
          (SELECT COUNT(*) FROM stops WHERE stops.trip_id = trips.id) AS stop_count,
          (
            SELECT city_name || ', ' || country_name
            FROM stops
            WHERE stops.trip_id = trips.id
            ORDER BY order_index ASC
            LIMIT 1
          ) AS first_stop_label,
          (
            SELECT city_name || ', ' || country_name
            FROM stops
            WHERE stops.trip_id = trips.id
            ORDER BY order_index DESC
            LIMIT 1
          ) AS last_stop_label
        FROM trips
        ORDER BY datetime(updated_at) DESC, title ASC
      `);

      return rows.map((row) => ({
        ...mapTripRow(row),
        stopCount: row.stop_count,
        firstStopLabel: row.first_stop_label ?? 'Unknown start',
        lastStopLabel: row.last_stop_label ?? 'Unknown finish',
      }));
    },

    async getTripDetail(tripId) {
      const tripRow = await db.getFirstAsync<TripRow>(
        `
          SELECT id, title, created_at, updated_at
          FROM trips
          WHERE id = ?
        `,
        tripId,
      );

      if (!tripRow) {
        return null;
      }

      const [stopRows, legRows] = await Promise.all([
        db.getAllAsync<StopRow>(
          `
            SELECT id, trip_id, order_index, city_name, country_name, stay_label, latitude, longitude
            FROM stops
            WHERE trip_id = ?
            ORDER BY order_index ASC
          `,
          tripId,
        ),
        db.getAllAsync<LegRow>(
          `
            SELECT id, trip_id, from_stop_id, to_stop_id, order_index, transport_type, transport_label
            FROM legs
            WHERE trip_id = ?
            ORDER BY order_index ASC
          `,
          tripId,
        ),
      ]);

      return {
        ...mapTripRow(tripRow),
        stops: stopRows.map(mapStopRow),
        legs: legRows.map(mapLegRow),
      } satisfies TripDetail;
    },

    async createTrip(input: CreateTripInput) {
      const now = new Date().toISOString();
      const tripId = createId('trip');
      const stopIds = input.stops.map(() => createId('stop'));

      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');

      try {
        await db.runAsync(
          `
            INSERT INTO trips (id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?)
          `,
          tripId,
          input.title.trim(),
          now,
          now,
        );

        for (const [index, stop] of input.stops.entries()) {
          await db.runAsync(
            `
              INSERT INTO stops (
                id,
                trip_id,
                order_index,
                city_name,
                country_name,
                stay_label,
                latitude,
                longitude,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            stopIds[index],
            tripId,
            index,
            stop.cityName.trim(),
            stop.countryName.trim(),
            stop.stayLabel?.trim() ? stop.stayLabel.trim() : null,
            stop.latitude,
            stop.longitude,
            now,
            now,
          );
        }

        for (const [index, leg] of input.legs.entries()) {
          await db.runAsync(
            `
              INSERT INTO legs (
                id,
                trip_id,
                from_stop_id,
                to_stop_id,
                order_index,
                transport_type,
                transport_label,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            createId('leg'),
            tripId,
            stopIds[index],
            stopIds[index + 1],
            index,
            leg.transportType,
            leg.transportLabel?.trim() ? leg.transportLabel.trim() : null,
            now,
            now,
          );
        }

        await db.execAsync('COMMIT');
        return tripId;
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw error;
      }
    },
  };
}
