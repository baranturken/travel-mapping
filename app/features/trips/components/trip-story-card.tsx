import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { formatTripDateRange } from '@/features/trips/mappers';
import { computeTripStats, formatDistanceKm } from '@/features/trips/trip-stats';
import { getTransportDisplay, type TripDetail } from '@/features/trips/types';
import type { LegRouteData } from '@/features/trips/components/trip-map-webview';

type TripStoryCardProps = {
  trip: TripDetail;
  legRoutes?: Record<string, LegRouteData>;
  style?: ViewStyle;
};

const MAX_VISIBLE_STOPS = 6;

export function TripStoryCard({ trip, legRoutes, style }: TripStoryCardProps) {
  const stats = computeTripStats(trip, legRoutes);
  const dateRange = formatTripDateRange(trip.startDate, trip.endDate);

  const visibleStops = trip.stops.slice(0, MAX_VISIBLE_STOPS);
  const hiddenStopCount = trip.stops.length - visibleStops.length;

  const legByFromStopId = new Map(trip.legs.map((leg) => [leg.fromStopId, leg]));

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.brand}>✈ Travel Mapping</Text>

      <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
        {trip.title}
      </Text>

      {dateRange ? <Text style={styles.dateRange}>{dateRange}</Text> : null}

      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statPillText}>
            🌍 {stats.countryCount} {stats.countryCount === 1 ? 'country' : 'countries'}
          </Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statPillText}>
            📍 {stats.cityCount} {stats.cityCount === 1 ? 'city' : 'cities'}
          </Text>
        </View>
        {stats.dayCount !== null ? (
          <View style={styles.statPill}>
            <Text style={styles.statPillText}>
              🗓️ {stats.dayCount} {stats.dayCount === 1 ? 'day' : 'days'}
            </Text>
          </View>
        ) : null}
        {stats.totalDistanceKm !== null ? (
          <View style={styles.statPill}>
            <Text style={styles.statPillText}>🛣️ {formatDistanceKm(stats.totalDistanceKm)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.timeline}>
        {visibleStops.map((stop, index) => {
          const outgoingLeg = legByFromStopId.get(stop.id);
          const showConnector = index < visibleStops.length - 1 && outgoingLeg;
          const transport = outgoingLeg
            ? getTransportDisplay(outgoingLeg.transportType, outgoingLeg.transportLabel)
            : null;

          return (
            <View key={stop.id}>
              <View style={styles.stopRow}>
                <View style={styles.stopBadge}>
                  <Text style={styles.stopBadgeText}>{index + 1}</Text>
                </View>
                <View style={styles.stopCopy}>
                  <Text style={styles.stopCity} numberOfLines={1} ellipsizeMode="tail">
                    {stop.cityName}
                  </Text>
                  <Text style={styles.stopCountry} numberOfLines={1} ellipsizeMode="tail">
                    {stop.countryName}
                  </Text>
                </View>
              </View>

              {showConnector && transport ? (
                <View style={styles.connectorRow}>
                  <View style={styles.connectorLine} />
                  <Text style={styles.connectorText}>
                    {transport.emoji} {transport.label}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}

        {hiddenStopCount > 0 ? (
          <View style={styles.moreRow}>
            <View style={styles.connectorLine} />
            <Text style={styles.moreText}>+{hiddenStopCount} more</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.watermark}>Created with Travel Mapping</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 340,
    borderRadius: 28,
    padding: 24,
    backgroundColor: '#0f2540',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 14,
  },
  brand: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
  },
  dateRange: {
    color: '#7fb4f0',
    fontSize: 14,
    fontWeight: '700',
    marginTop: -6,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  statPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  statPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  timeline: {
    marginTop: 6,
    gap: 2,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stopBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2f6db8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  stopCopy: {
    flex: 1,
  },
  stopCity: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  stopCountry: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  connectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingLeft: 14,
  },
  connectorLine: {
    width: 2,
    height: 18,
    borderRadius: 1,
    backgroundColor: 'rgba(127, 180, 240, 0.5)',
  },
  connectorText: {
    color: '#7fb4f0',
    fontSize: 12,
    fontWeight: '700',
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
  },
  moreText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '700',
  },
  watermark: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 4,
  },
});
