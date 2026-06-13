import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TravelColors } from '@/constants/theme';

export type PublishablePhoto = {
  id: string;
  imageUri: string;
  caption: string | null;
  cityName: string | null;
  stopLabel: string;
};

export type PublishSelection = {
  selectedIds: string[];
  highlightId: string | null;
  isPublic: boolean;
};

export function PublishTripModal({
  visible,
  memories,
  alreadyPublished,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  memories: PublishablePhoto[];
  alreadyPublished: boolean;
  busy: boolean;
  onConfirm(selection: PublishSelection): void;
  onCancel(): void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);

  // Reset to "all selected, first is highlight" each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    const ids = memories.map((m) => m.id);
    setSelectedIds(ids);
    setHighlightId(ids[0] ?? null);
    setIsPublic(true);
  }, [visible, memories]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // Keep the highlight valid: if we just removed it, hand it to the first remaining.
      setHighlightId((h) => {
        if (next.length === 0) return null;
        if (h && next.includes(h)) return h;
        return next[0];
      });
      return next;
    });
  };

  const setHighlight = (id: string) => {
    // Highlighting a photo implies including it on the post.
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setHighlightId(id);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{alreadyPublished ? 'Update post' : 'Publish trip'}</Text>
              <Text style={styles.subtitle}>
                {memories.length === 0
                  ? 'Choose who can see this trip'
                  : 'Pick the photos for your post and a highlight'}
              </Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onCancel} hitSlop={8}>
              <Ionicons name="close" size={20} color={TravelColors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.label}>Who can see it</Text>
            <View style={styles.segment}>
              <Pressable
                style={[styles.segmentItem, isPublic && styles.segmentItemActive]}
                onPress={() => setIsPublic(true)}>
                <Ionicons name="earth" size={15} color={isPublic ? '#fff' : TravelColors.primary} />
                <Text style={[styles.segmentText, isPublic && styles.segmentTextActive]}>Public</Text>
              </Pressable>
              <Pressable
                style={[styles.segmentItem, !isPublic && styles.segmentItemActive]}
                onPress={() => setIsPublic(false)}>
                <Ionicons name="link" size={15} color={!isPublic ? '#fff' : TravelColors.primary} />
                <Text style={[styles.segmentText, !isPublic && styles.segmentTextActive]}>
                  Link only
                </Text>
              </Pressable>
            </View>

            {memories.length === 0 ? (
              <View style={styles.emptyPhotos}>
                <Ionicons name="image-outline" size={22} color={TravelColors.mutedText} />
                <Text style={styles.emptyText}>
                  This trip has no photos yet. Add photo memories to your stops to feature them on
                  the post.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.photoHeader}>
                  <Text style={styles.label}>Photos on this post</Text>
                  <Text style={styles.countText}>{selectedIds.length} selected</Text>
                </View>
                <Text style={styles.hint}>
                  Tap to include/exclude. Tap the star to choose the highlight shown on your profile.
                </Text>
                <View style={styles.grid}>
                  {memories.map((m) => {
                    const isSelected = selectedSet.has(m.id);
                    const isHighlight = highlightId === m.id;
                    return (
                      <View key={m.id} style={styles.cell}>
                        <Pressable
                          style={[styles.thumb, isSelected && styles.thumbSelected]}
                          onPress={() => toggle(m.id)}>
                          <Image source={{ uri: m.imageUri }} style={styles.thumbImage} />
                          {!isSelected ? <View style={styles.thumbDim} /> : null}
                          <View style={[styles.check, isSelected && styles.checkOn]}>
                            {isSelected ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                          </View>
                          <Pressable
                            style={styles.starButton}
                            hitSlop={6}
                            onPress={() => setHighlight(m.id)}>
                            <Ionicons
                              name={isHighlight ? 'star' : 'star-outline'}
                              size={16}
                              color={isHighlight ? '#ffd43b' : '#ffffff'}
                            />
                          </Pressable>
                        </Pressable>
                        {isHighlight ? <Text style={styles.highlightTag}>Highlight</Text> : null}
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={[styles.publishButton, busy && styles.buttonDisabled]}
              disabled={busy}
              onPress={() => onConfirm({ selectedIds, highlightId, isPublic })}>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <Text style={styles.publishText}>
                {busy ? 'Publishing…' : alreadyPublished ? 'Update post' : 'Publish'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(12,23,34,0.55)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: TravelColors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: TravelColors.border,
  },
  headerCopy: { flex: 1, gap: 2 },
  title: { color: TravelColors.text, fontSize: 19, fontWeight: '800' },
  subtitle: { color: TravelColors.secondaryText, fontSize: 13 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TravelColors.tintSurface,
  },
  body: { padding: 20, gap: 12 },
  label: { color: TravelColors.text, fontSize: 14, fontWeight: '700' },
  segment: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: TravelColors.tintSurface,
    borderRadius: 14,
    padding: 5,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentItemActive: { backgroundColor: TravelColors.primary },
  segmentText: { color: TravelColors.primary, fontSize: 14, fontWeight: '700' },
  segmentTextActive: { color: '#ffffff' },
  emptyPhotos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: TravelColors.tintSurface,
    borderRadius: 14,
    padding: 14,
  },
  emptyText: { flex: 1, color: TravelColors.secondaryText, fontSize: 13, lineHeight: 19 },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  countText: { color: TravelColors.mutedText, fontSize: 13, fontWeight: '600' },
  hint: { color: TravelColors.mutedText, fontSize: 12, lineHeight: 16, marginTop: -4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '30.5%', gap: 4 },
  thumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: 'transparent',
    backgroundColor: TravelColors.tintSurface,
  },
  thumbSelected: { borderColor: TravelColors.primary },
  thumbImage: { width: '100%', height: '100%' },
  thumbDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.55)' },
  check: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: TravelColors.primary, borderColor: '#ffffff' },
  starButton: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightTag: {
    color: TravelColors.primary,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: TravelColors.border,
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 15,
    backgroundColor: TravelColors.primary,
  },
  buttonDisabled: { opacity: 0.6 },
  publishText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
