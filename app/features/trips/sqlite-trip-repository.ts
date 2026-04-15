import type { SQLiteDatabase } from 'expo-sqlite';

import { deleteManagedMemoryUris, isManagedMemoryUri } from '@/features/trips/memory-location';
import type { TripRepository } from '@/features/trips/repository';
import type {
  AccommodationType,
  CreateTripInput,
  TransportType,
  TripDetail,
  TripLeg,
  TripMemory,
  TripPlace,
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
  accommodation_name: string | null;
  accommodation_type: AccommodationType | null;
  accommodation_note: string | null;
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

type PlaceRow = {
  id: string;
  stop_id: string;
  order_index: number;
  title: string;
  note: string | null;
};

type MemoryRow = {
  id: string;
  stop_id: string;
  order_index: number;
  image_uri: string;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
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

function mapPlaceRow(row: PlaceRow): TripPlace {
  return {
    id: row.id,
    stopId: row.stop_id,
    orderIndex: row.order_index,
    title: row.title,
    note: row.note,
  };
}

function mapMemoryRow(row: MemoryRow): TripMemory {
  return {
    id: row.id,
    stopId: row.stop_id,
    orderIndex: row.order_index,
    imageUri: row.image_uri,
    caption: row.caption,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

function mapStopRow(row: StopRow, places: TripPlace[], memories: TripMemory[]): TripStop {
  return {
    id: row.id,
    tripId: row.trip_id,
    orderIndex: row.order_index,
    cityName: row.city_name,
    countryName: row.country_name,
    stayLabel: row.stay_label,
    accommodationName: row.accommodation_name,
    accommodationType: row.accommodation_type,
    accommodationNote: row.accommodation_note,
    latitude: row.latitude,
    longitude: row.longitude,
    places,
    memories,
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

async function getTripMemoryUris(db: SQLiteDatabase, tripId: string) {
  const rows = await db.getAllAsync<Pick<MemoryRow, 'image_uri'>>(
    `
      SELECT stop_memories.image_uri
      FROM stop_memories
      INNER JOIN stops ON stops.id = stop_memories.stop_id
      WHERE stops.trip_id = ?
    `,
    tripId,
  );

  return rows.map((row) => row.image_uri).filter((uri) => isManagedMemoryUri(uri));
}

function getInputManagedMemoryUris(input: CreateTripInput) {
  return input.stops.flatMap((stop) =>
    stop.memories
      .map((memory) => memory.imageUri.trim())
      .filter((imageUri) => isManagedMemoryUri(imageUri)),
  );
}

async function insertStopChildren(
  db: SQLiteDatabase,
  stopId: string,
  stopInput: CreateTripInput['stops'][number],
  now: string,
) {
  for (const [index, place] of stopInput.places.entries()) {
    await db.runAsync(
      `
        INSERT INTO stop_places (
          id,
          stop_id,
          order_index,
          title,
          note,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      createId('place'),
      stopId,
      index,
      place.title.trim(),
      place.note?.trim() ? place.note.trim() : null,
      now,
      now,
    );
  }

  for (const [index, memory] of stopInput.memories.entries()) {
    await db.runAsync(
      `
        INSERT INTO stop_memories (
          id,
          stop_id,
          order_index,
          image_uri,
          caption,
          latitude,
          longitude,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      createId('memory'),
      stopId,
      index,
      memory.imageUri.trim(),
      memory.caption?.trim() ? memory.caption.trim() : null,
      memory.latitude ?? null,
      memory.longitude ?? null,
      now,
      now,
    );
  }
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

      const [stopRows, legRows, placeRows, memoryRows] = await Promise.all([
        db.getAllAsync<StopRow>(
          `
            SELECT
              id,
              trip_id,
              order_index,
              city_name,
              country_name,
              stay_label,
              accommodation_name,
              accommodation_type,
              accommodation_note,
              latitude,
              longitude
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
        db.getAllAsync<PlaceRow>(
          `
            SELECT stop_places.id, stop_places.stop_id, stop_places.order_index, stop_places.title, stop_places.note
            FROM stop_places
            INNER JOIN stops ON stops.id = stop_places.stop_id
            WHERE stops.trip_id = ?
            ORDER BY stop_places.order_index ASC
          `,
          tripId,
        ),
        db.getAllAsync<MemoryRow>(
          `
            SELECT
              stop_memories.id,
              stop_memories.stop_id,
              stop_memories.order_index,
              stop_memories.image_uri,
              stop_memories.caption,
              stop_memories.latitude,
              stop_memories.longitude
            FROM stop_memories
            INNER JOIN stops ON stops.id = stop_memories.stop_id
            WHERE stops.trip_id = ?
            ORDER BY stop_memories.order_index ASC
          `,
          tripId,
        ),
      ]);

      const placesByStopId = new Map<string, TripPlace[]>();
      const memoriesByStopId = new Map<string, TripMemory[]>();

      placeRows.map(mapPlaceRow).forEach((place) => {
        const bucket = placesByStopId.get(place.stopId) ?? [];
        bucket.push(place);
        placesByStopId.set(place.stopId, bucket);
      });

      memoryRows.map(mapMemoryRow).forEach((memory) => {
        const bucket = memoriesByStopId.get(memory.stopId) ?? [];
        bucket.push(memory);
        memoriesByStopId.set(memory.stopId, bucket);
      });

      return {
        ...mapTripRow(tripRow),
        stops: stopRows.map((row) =>
          mapStopRow(row, placesByStopId.get(row.id) ?? [], memoriesByStopId.get(row.id) ?? []),
        ),
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
          const stopId = stopIds[index];

          await db.runAsync(
            `
              INSERT INTO stops (
                id,
                trip_id,
                order_index,
                city_name,
                country_name,
                stay_label,
                accommodation_name,
                accommodation_type,
                accommodation_note,
                latitude,
                longitude,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            stopId,
            tripId,
            index,
            stop.cityName.trim(),
            stop.countryName.trim(),
            stop.stayLabel?.trim() ? stop.stayLabel.trim() : null,
            stop.accommodationName?.trim() ? stop.accommodationName.trim() : null,
            stop.accommodationType ?? null,
            stop.accommodationNote?.trim() ? stop.accommodationNote.trim() : null,
            stop.latitude,
            stop.longitude,
            now,
            now,
          );

          await insertStopChildren(db, stopId, stop, now);
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

    async updateTrip(tripId, input) {
      const now = new Date().toISOString();
      const stopIds = input.stops.map(() => createId('stop'));
      const existingManagedMemoryUris = await getTripMemoryUris(db, tripId);
      const nextManagedMemoryUris = new Set(getInputManagedMemoryUris(input));

      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');

      try {
        await db.runAsync(
          `
            UPDATE trips
            SET title = ?, updated_at = ?
            WHERE id = ?
          `,
          input.title.trim(),
          now,
          tripId,
        );

        await db.runAsync(`DELETE FROM legs WHERE trip_id = ?`, tripId);
        await db.runAsync(`DELETE FROM stops WHERE trip_id = ?`, tripId);

        for (const [index, stop] of input.stops.entries()) {
          const stopId = stopIds[index];

          await db.runAsync(
            `
              INSERT INTO stops (
                id,
                trip_id,
                order_index,
                city_name,
                country_name,
                stay_label,
                accommodation_name,
                accommodation_type,
                accommodation_note,
                latitude,
                longitude,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            stopId,
            tripId,
            index,
            stop.cityName.trim(),
            stop.countryName.trim(),
            stop.stayLabel?.trim() ? stop.stayLabel.trim() : null,
            stop.accommodationName?.trim() ? stop.accommodationName.trim() : null,
            stop.accommodationType ?? null,
            stop.accommodationNote?.trim() ? stop.accommodationNote.trim() : null,
            stop.latitude,
            stop.longitude,
            now,
            now,
          );

          await insertStopChildren(db, stopId, stop, now);
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
        deleteManagedMemoryUris(
          existingManagedMemoryUris.filter((uri) => !nextManagedMemoryUris.has(uri)),
        );
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw error;
      }
    },

    async deleteTrip(tripId) {
      const existingManagedMemoryUris = await getTripMemoryUris(db, tripId);
      await db.runAsync(`DELETE FROM trips WHERE id = ?`, tripId);
      deleteManagedMemoryUris(existingManagedMemoryUris);
    },
  };
}
