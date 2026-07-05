import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TravelColors } from '@/constants/theme';
import { SearchListSkeleton } from '@/components/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { searchProfiles, followUser, unfollowUser, getIsFollowing } from '@/features/social/social-repository';
import { UserAvatar } from '@/features/social/components/user-avatar';
import type { Profile } from '@/features/social/types';

type SearchResult = Profile & { isFollowing: boolean };

export default function SearchScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim() || !user) {
        setResults([]);
        return;
      }
      try {
        setLoading(true);
        const profiles = await searchProfiles(q.trim());
        const withFollowing = await Promise.all(
          profiles
            .filter((p) => p.id !== user.id)
            .map(async (p) => ({
              ...p,
              isFollowing: await getIsFollowing(user.id, p.id),
            })),
        );
        setResults(withFollowing);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void doSearch(text), 400);
  };

  const handleToggleFollow = async (profile: SearchResult) => {
    if (!user) return;
    const wasFollowing = profile.isFollowing;
    setResults((prev) =>
      prev.map((p) => (p.id === profile.id ? { ...p, isFollowing: !wasFollowing } : p)),
    );
    try {
      if (wasFollowing) {
        await unfollowUser(user.id, profile.id);
      } else {
        await followUser(user.id, profile.id);
      }
    } catch {
      setResults((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, isFollowing: wasFollowing } : p)),
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={TravelColors.mutedText} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={handleQueryChange}
          placeholder="Search travelers by username…"
          placeholderTextColor={TravelColors.mutedText}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => void doSearch(query)}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => { setQuery(''); setResults([]); }}>
            <Ionicons name="close-circle" size={18} color={TravelColors.mutedText} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <SearchListSkeleton />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            query.trim() ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No travelers found</Text>
                <Text style={styles.emptyBody}>Try a different username.</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={36} color={TravelColors.mutedText} />
                <Text style={styles.emptyTitle}>Find travelers</Text>
                <Text style={styles.emptyBody}>Search by username to discover and follow people.</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.resultCard}
              onPress={() =>
                router.push({ pathname: '/users/[userId]', params: { userId: item.id } } as any)
              }>
              <UserAvatar profile={item} size={48} />
              <View style={styles.resultCopy}>
                <Text style={styles.resultName}>{item.displayName}</Text>
                <Text style={styles.resultUsername}>@{item.username}</Text>
                {item.bio ? (
                  <Text style={styles.resultBio} numberOfLines={1}>
                    {item.bio}
                  </Text>
                ) : null}
              </View>
              <Pressable
                style={[styles.followButton, item.isFollowing && styles.followingButton]}
                onPress={() => void handleToggleFollow(item)}>
                <Text
                  style={[styles.followButtonText, item.isFollowing && styles.followingButtonText]}>
                  {item.isFollowing ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TravelColors.background },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: TravelColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TravelColors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TravelColors.text,
  },
  list: { paddingHorizontal: 16, gap: 10 },
  centeredState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: { color: TravelColors.text, fontSize: 18, fontWeight: '700' },
  emptyBody: {
    color: TravelColors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: TravelColors.surface,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: TravelColors.border,
  },
  resultCopy: { flex: 1, gap: 2 },
  resultName: { color: TravelColors.text, fontSize: 15, fontWeight: '700' },
  resultUsername: { color: TravelColors.mutedText, fontSize: 13 },
  resultBio: { color: TravelColors.secondaryText, fontSize: 13, lineHeight: 18 },
  followButton: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: TravelColors.primary,
  },
  followingButton: {
    backgroundColor: TravelColors.surface,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
  },
  followButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  followingButtonText: { color: TravelColors.text },
});
