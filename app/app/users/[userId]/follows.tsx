import { useCallback, useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SearchListSkeleton } from '@/components/skeleton';
import { TravelColors } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { UserAvatar } from '@/features/social/components/user-avatar';
import {
  followUser,
  listFollowers,
  listFollowing,
  unfollowUser,
  type FollowListEntry,
} from '@/features/social/social-repository';
import { cacheKey, readCache, writeCache } from '@/features/social/social-cache';

type Tab = 'followers' | 'following';

export default function FollowsScreen() {
  const { userId, tab } = useLocalSearchParams<{ userId: string; tab?: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const activeTab: Tab = tab === 'following' ? 'following' : 'followers';
  const keyFor = useCallback(
    (t: Tab) => cacheKey(t === 'followers' ? 'followers' : 'following', userId ?? ''),
    [userId],
  );

  const [entries, setEntries] = useState<FollowListEntry[]>(
    () => readCache<FollowListEntry[]>(keyFor(activeTab)) ?? [],
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  // Which tab the current `entries` belong to. Deriving loading from this
  // avoids a synchronous setState in the effect body, and means switching tabs
  // cannot briefly show the previous tab's people as if they were the new
  // tab's.
  const [loadedTab, setLoadedTab] = useState<Tab | null>(
    () => (readCache<FollowListEntry[]>(keyFor(activeTab)) ? activeTab : null),
  );
  const loading = loadedTab !== activeTab;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      const rows =
        activeTab === 'followers'
          ? await listFollowers(userId, user?.id ?? null)
          : await listFollowing(userId, user?.id ?? null);
      if (cancelled) return;
      setEntries(rows);
      writeCache(keyFor(activeTab), rows);
      setLoadedTab(activeTab);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, user?.id, activeTab, keyFor]);

  const switchTab = (next: Tab) => {
    if (next === activeTab) return;
    const cached = readCache<FollowListEntry[]>(keyFor(next));
    if (cached) {
      setEntries(cached);
      setLoadedTab(next);
    }
    router.setParams({ tab: next });
  };

  const toggleFollow = async (entry: FollowListEntry) => {
    if (!user || busyId) return;
    const wasFollowing = entry.isFollowedByMe;

    // Optimistic — the row flips immediately and is reverted if the write fails.
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, isFollowedByMe: !wasFollowing } : e)),
    );
    setBusyId(entry.id);
    try {
      if (wasFollowing) await unfollowUser(user.id, entry.id);
      else await followUser(user.id, entry.id);
    } catch {
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, isFollowedByMe: wasFollowing } : e)),
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen options={{ title: activeTab === 'followers' ? 'Followers' : 'Following' }} />

      <View style={styles.tabs}>
        {(['followers', 'following'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            accessibilityRole="tab"
            accessibilityState={{ selected: t === activeTab }}
            onPress={() => switchTab(t)}
            style={[styles.tab, t === activeTab && styles.tabActive]}>
            <Text style={[styles.tabText, t === activeTab && styles.tabTextActive]}>
              {t === 'followers' ? 'Followers' : 'Following'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <SearchListSkeleton count={6} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={entries.length === 0 ? styles.emptyContent : styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={28} color={TravelColors.mutedText} />
              <Text style={styles.emptyText}>
                {activeTab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelf = user?.id === item.id;
            return (
              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push({
                    pathname: '/users/[userId]',
                    params: { userId: item.id },
                  } as unknown as Href)
                }>
                <UserAvatar profile={item} size={44} />
                <View style={styles.rowCopy}>
                  <Text style={styles.displayName} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text style={styles.username} numberOfLines={1}>
                    @{item.username}
                  </Text>
                </View>

                {user && !isSelf ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void toggleFollow(item)}
                    disabled={busyId === item.id}
                    style={[styles.followButton, item.isFollowedByMe && styles.followingButton]}>
                    <Text
                      style={[
                        styles.followButtonText,
                        item.isFollowedByMe && styles.followingButtonText,
                      ]}>
                      {item.isFollowedByMe ? 'Following' : 'Follow'}
                    </Text>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TravelColors.background },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: TravelColors.surface,
    borderWidth: 1,
    borderColor: TravelColors.border,
  },
  tabActive: { backgroundColor: TravelColors.primary, borderColor: TravelColors.primary },
  tabText: { color: TravelColors.secondaryText, fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: '#ffffff' },
  loadingWrap: { paddingHorizontal: 16, paddingTop: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: TravelColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: TravelColors.border,
    padding: 12,
  },
  rowCopy: { flex: 1, gap: 2 },
  displayName: { color: TravelColors.text, fontSize: 15, fontWeight: '700' },
  username: { color: TravelColors.mutedText, fontSize: 13 },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: TravelColors.primary,
  },
  followingButton: {
    backgroundColor: TravelColors.tintSurface,
    borderWidth: 1,
    borderColor: TravelColors.border,
  },
  followButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  followingButtonText: { color: TravelColors.primary },
  empty: { alignItems: 'center', gap: 10, padding: 24 },
  emptyText: { color: TravelColors.secondaryText, fontSize: 15 },
});
