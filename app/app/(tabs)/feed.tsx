import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TravelColors } from '@/constants/theme';
import { FeedListSkeleton } from '@/components/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { getFeed, getRecommendations } from '@/features/social/social-repository';
import { FeedTripCard } from '@/features/social/components/feed-trip-card';
import type { FeedTrip } from '@/features/social/types';

const PAGE_SIZE = 20;

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [trips, setTrips] = useState<FeedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecommended, setIsRecommended] = useState(false);
  // Skeletons mean "nothing here yet". On a re-focus refresh there IS content,
  // so blanking it out to re-draw placeholders makes the feed flicker away and
  // back. Track whether we have ever loaded, and fall back to the pull-to-
  // refresh spinner once we have.
  const hasLoadedRef = useRef(false);

  const loadFeed = useCallback(async (offset = 0, append = false) => {
    if (!user) return;
    try {
      let data: FeedTrip[];
      let recommended = false;
      const result = await getFeed(user.id, offset);
      if (result.length === 0 && offset === 0) {
        data = await getRecommendations(user.id, 0);
        recommended = true;
      } else {
        data = result;
      }

      if (append) {
        setTrips((prev) => [...prev, ...data]);
      } else {
        setTrips(data);
        setIsRecommended(recommended);
      }
      setHasMore(data.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load feed.');
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedRef.current) {
        setRefreshing(true);
        void loadFeed(0, false).finally(() => setRefreshing(false));
        return;
      }
      setLoading(true);
      void loadFeed(0, false).finally(() => {
        hasLoadedRef.current = true;
        setLoading(false);
      });
    }, [loadFeed]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFeed(0, false);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadFeed(trips.length, true);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <FeedListSkeleton />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centeredState}>
          <Ionicons name="wifi-outline" size={36} color={TravelColors.mutedText} />
          <Text style={styles.emptyTitle}>Could not load feed</Text>
          <Text style={styles.emptyBody}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={TravelColors.primary}
          />
        }
        onEndReached={() => void handleLoadMore()}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          isRecommended && trips.length > 0 ? (
            <View style={styles.recommendedBanner}>
              <Ionicons name="compass-outline" size={16} color={TravelColors.primary} />
              <Text style={styles.recommendedText}>
                Discover trips from the community — follow travelers to build your personal feed.
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="home-outline" size={28} color={TravelColors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Your feed is empty</Text>
            <Text style={styles.emptyBody}>
              Follow other travelers in the Search tab to see their trips here.
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={TravelColors.primary} size="small" />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <FeedTripCard
            trip={item}
            onPress={() =>
              router.push({
                pathname: '/trips/shared/[publishedId]',
                params: { publishedId: item.id },
              } as any)
            }
            onProfile={() =>
              router.push({ pathname: '/users/[userId]', params: { userId: item.userId } } as any)
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TravelColors.background },
  list: { padding: 16, gap: 14, flexGrow: 1 },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: TravelColors.tintSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: TravelColors.text, fontSize: 20, fontWeight: '700' },
  emptyBody: {
    color: TravelColors.secondaryText,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  recommendedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: TravelColors.tintSurface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: TravelColors.border,
  },
  recommendedText: {
    flex: 1,
    color: TravelColors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
  },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
});
