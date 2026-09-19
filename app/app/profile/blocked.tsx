import { useCallback, useState } from 'react';
import { Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SearchListSkeleton } from '@/components/skeleton';
import { TravelColors } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { UserAvatar } from '@/features/social/components/user-avatar';
import { listBlockedProfiles, unblockUser } from '@/features/social/moderation';
import { invalidateCache } from '@/features/social/social-cache';
import type { Profile } from '@/features/social/types';

type BlockedRow = { blocked_id: string; created_at: string; profile: Profile | null };

// Apple requires blocking to be undoable, which means somewhere to see who you
// have blocked. Without this screen a block is a one-way door.
export default function BlockedAccountsScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BlockedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void listBlockedProfiles(user.id)
        .then((data) => setRows(data as unknown as BlockedRow[]))
        .finally(() => setLoading(false));
    }, [user]),
  );

  const confirmUnblock = (row: BlockedRow) => {
    const name = row.profile ? `@${row.profile.username}` : 'this account';
    Alert.alert(`Unblock ${name}?`, 'You will see their trips and comments again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: () => {
          if (!user) return;
          setBusyId(row.blocked_id);
          void unblockUser(user.id, row.blocked_id)
            .then(() => {
              setRows((prev) => prev.filter((r) => r.blocked_id !== row.blocked_id));
              // Their content becomes visible again, so cached feeds and
              // profiles are now missing rows they should contain.
              invalidateCache('');
            })
            .catch((err: unknown) =>
              Alert.alert('Error', err instanceof Error ? err.message : 'Please try again.'),
            )
            .finally(() => setBusyId(null));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Blocked accounts' }} />

      {loading ? (
        <View style={styles.loadingWrap}>
          <SearchListSkeleton count={4} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.blocked_id}
          contentContainerStyle={rows.length === 0 ? styles.emptyContent : styles.listContent}
          ListHeaderComponent={
            rows.length > 0 ? (
              <Text style={styles.intro}>
                Blocked accounts cannot see your trips or comments, and you cannot see theirs. They
                are not told that you blocked them.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="shield-checkmark-outline" size={30} color={TravelColors.mutedText} />
              <Text style={styles.emptyTitle}>No blocked accounts</Text>
              <Text style={styles.emptyBody}>
                You can block someone from their profile if they are bothering you.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <UserAvatar
                profile={item.profile ?? { displayName: '?', avatarUrl: null }}
                size={44}
              />
              <View style={styles.rowCopy}>
                <Text style={styles.displayName} numberOfLines={1}>
                  {item.profile?.displayName ?? 'Unknown account'}
                </Text>
                {item.profile ? (
                  <Text style={styles.username} numberOfLines={1}>
                    @{item.profile.username}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => confirmUnblock(item)}
                disabled={busyId === item.blocked_id}
                style={({ pressed }) => [styles.unblockButton, pressed && styles.pressed]}>
                <Text style={styles.unblockText}>Unblock</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TravelColors.background },
  loadingWrap: { paddingHorizontal: 16, paddingTop: 12 },
  listContent: { padding: 16, gap: 10 },
  emptyContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  intro: {
    color: TravelColors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
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
  unblockButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: TravelColors.tintSurface,
    borderWidth: 1,
    borderColor: TravelColors.border,
  },
  pressed: { opacity: 0.6 },
  unblockText: { color: TravelColors.primary, fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8 },
  emptyTitle: { color: TravelColors.text, fontSize: 17, fontWeight: '700' },
  emptyBody: {
    color: TravelColors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
