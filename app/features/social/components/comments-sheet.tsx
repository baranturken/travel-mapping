import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TravelColors } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import {
  addComment,
  deleteComment,
  getComments,
} from '@/features/social/social-repository';
import { UserAvatar } from './user-avatar';
import type { FeedTrip, TripComment } from '@/features/social/types';

type Props = {
  trip: FeedTrip;
  onClose(): void;
  onCountChange(delta: number): void;
};

export function CommentsSheet({ trip, onClose, onCountChange }: Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<TripComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setLoading(true);
    void getComments(trip.id)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [trip.id]);

  const handleSubmit = async () => {
    if (!user || !body.trim() || submitting) return;
    try {
      setSubmitting(true);
      const comment = await addComment(trip.id, user.id, body.trim());
      setComments((prev) => [...prev, comment]);
      setBody('');
      onCountChange(1);
    } catch (err) {
      Alert.alert('Could not post', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (comment: TripComment) => {
    Alert.alert('Delete comment?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(comment.id);
            setComments((prev) => prev.filter((c) => c.id !== comment.id));
            onCountChange(-1);
          } catch {
            Alert.alert('Could not delete comment.');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        style={styles.sheetWrapper}
        pointerEvents="box-none"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Comments</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color={TravelColors.text} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={TravelColors.primary} size="small" />
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
              }
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  <UserAvatar profile={item.profile} size={34} />
                  <View style={styles.commentBubble}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{item.profile.displayName}</Text>
                      <Text style={styles.commentUsername}>@{item.profile.username}</Text>
                    </View>
                    <Text style={styles.commentBody}>{item.body}</Text>
                  </View>
                  {user?.id === item.userId ? (
                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => handleDelete(item)}>
                      <Ionicons name="trash-outline" size={15} color={TravelColors.danger} />
                    </Pressable>
                  ) : null}
                </View>
              )}
            />
          )}

          {user ? (
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={body}
                onChangeText={setBody}
                placeholder="Add a comment…"
                placeholderTextColor={TravelColors.mutedText}
                multiline
                maxLength={500}
              />
              <Pressable
                style={[styles.sendButton, (!body.trim() || submitting) && styles.sendDisabled]}
                onPress={handleSubmit}
                disabled={!body.trim() || submitting}>
                {submitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Ionicons name="send" size={16} color="#ffffff" />
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 20, 40, 0.4)',
  },
  sheetWrapper: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: TravelColors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '85%',
    borderTopWidth: 1,
    borderColor: TravelColors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: TravelColors.border,
  },
  headerTitle: { color: TravelColors.text, fontSize: 17, fontWeight: '700' },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: TravelColors.tintSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: { flex: 1, paddingVertical: 32, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 14, flexGrow: 1 },
  emptyText: {
    color: TravelColors.mutedText,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  commentBubble: {
    flex: 1,
    backgroundColor: TravelColors.background,
    borderRadius: 16,
    padding: 10,
    gap: 4,
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentAuthor: { color: TravelColors.text, fontSize: 13, fontWeight: '700' },
  commentUsername: { color: TravelColors.mutedText, fontSize: 12 },
  commentBody: { color: TravelColors.secondaryText, fontSize: 14, lineHeight: 19 },
  deleteButton: {
    paddingTop: 10,
    paddingLeft: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: TravelColors.border,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: TravelColors.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: TravelColors.text,
    maxHeight: 80,
    backgroundColor: TravelColors.background,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TravelColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: TravelColors.borderStrong },
});
