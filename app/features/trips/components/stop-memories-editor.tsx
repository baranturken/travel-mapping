import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import type { Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TravelColors } from '@/constants/theme';
import { createMemoryFromAsset } from '@/features/trips/memory-location';
import { createMemoriesFromPickerResult } from '@/features/trips/photo-memory-picker';
import type { CreateTripFormValues } from '@/features/trips/schemas';

type StopMemoriesEditorProps = {
  control: Control<CreateTripFormValues>;
  errors: FieldErrors<CreateTripFormValues>;
  setValue: UseFormSetValue<CreateTripFormValues>;
  stopIndex: number;
  onQueueMemoryDeletion(imageUri: string): void;
};

const COMPACT_MEMORY_THRESHOLD = 3;

export function StopMemoriesEditor({
  control,
  errors,
  setValue,
  stopIndex,
  onQueueMemoryDeletion,
}: StopMemoriesEditorProps) {
  const memoryArray = useFieldArray({
    control,
    name: `stops.${stopIndex}.memories` as const,
  });
  const memoryValues = useWatch({
    control,
    name: `stops.${stopIndex}.memories`,
  });
  const [selectedMemoryIndex, setSelectedMemoryIndex] = useState(0);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const memories = useMemo(
    () => memoryArray.fields.map((field, index) => memoryValues?.[index] ?? field),
    [memoryArray.fields, memoryValues],
  );
  const isCompactMode = memoryArray.fields.length > COMPACT_MEMORY_THRESHOLD;
  const selectedField = memoryArray.fields[selectedMemoryIndex];
  const selectedMemory = memories[selectedMemoryIndex];
  const previewMemories = memories.slice(0, COMPACT_MEMORY_THRESHOLD);

  useEffect(() => {
    if (memoryArray.fields.length === 0) {
      setSelectedMemoryIndex(0);
      return;
    }

    if (selectedMemoryIndex >= memoryArray.fields.length) {
      setSelectedMemoryIndex(memoryArray.fields.length - 1);
    }
  }, [memoryArray.fields.length, selectedMemoryIndex]);

  const openPicker = async (allowsMultipleSelection: boolean) => {
    try {
      setIsPickingImage(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection,
        orderedSelection: allowsMultipleSelection,
        exif: true,
        quality: 0.8,
      });

      return createMemoriesFromPickerResult(result, createMemoryFromAsset);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Could not add photo', message);
      return [];
    } finally {
      setIsPickingImage(false);
    }
  };

  const handleAddMemory = async () => {
    const memories = await openPicker(true);

    if (memories.length === 0) {
      return;
    }

    const nextStartIndex = memoryArray.fields.length;
    memoryArray.append(memories);
    setSelectedMemoryIndex(nextStartIndex);
  };

  const handleReplaceMemory = async (memoryIndex: number) => {
    const [memory] = await openPicker(false);

    if (!memory) {
      return;
    }

    const previousImageUri = memoryValues?.[memoryIndex]?.imageUri;

    if (previousImageUri) {
      onQueueMemoryDeletion(previousImageUri);
    }

    setValue(`stops.${stopIndex}.memories.${memoryIndex}`, memory, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleRemoveMemory = (memoryIndex: number) => {
    const imageUri = memoryValues?.[memoryIndex]?.imageUri;

    if (imageUri) {
      onQueueMemoryDeletion(imageUri);
    }

    memoryArray.remove(memoryIndex);
  };

  const renderMemoryCard = (memoryIndex: number) => {
    const field = memoryArray.fields[memoryIndex];
    const memory = memories[memoryIndex];

    if (!field || !memory) {
      return null;
    }

    const memoryErrors = errors.stops?.[stopIndex]?.memories?.[memoryIndex];

    return (
      <View key={field.id} style={styles.card}>
        <Image source={{ uri: memory.imageUri }} style={styles.previewImage} />
        <Text style={styles.metaText}>
          {memory.latitude !== null && memory.longitude !== null
            ? 'This photo includes location metadata for map-linked memory notes.'
            : 'This photo has no exact GPS data, so it stays attached to the stop gallery.'}
        </Text>

        <Controller
          control={control}
          name={`stops.${stopIndex}.memories.${memoryIndex}.caption`}
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Caption</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Optional caption, e.g. Sunset by the ferry port"
                placeholderTextColor={TravelColors.mutedText}
              />
            </View>
          )}
        />

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionButton, isPickingImage && styles.actionButtonDisabled]}
            disabled={isPickingImage}
            onPress={() => void handleReplaceMemory(memoryIndex)}>
            <Text style={styles.actionButtonText}>Replace photo</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.removeButton]}
            onPress={() => handleRemoveMemory(memoryIndex)}>
            <Text style={styles.removeButtonText}>Remove photo</Text>
          </Pressable>
        </View>

        {memoryErrors?.imageUri?.message ? (
          <Text style={styles.errorText}>{memoryErrors.imageUri.message}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Photo memories</Text>
          <Text style={styles.body}>
            Pick one or many photos from your device. Sharevel can read embedded photo location metadata so the trip can note where a memory was captured.
          </Text>
        </View>
        <View style={styles.headerActions}>
          {memoryArray.fields.length > 0 ? (
            <View style={styles.memoryCountPill}>
              <Text style={styles.memoryCountPillText}>{memoryArray.fields.length} photos</Text>
            </View>
          ) : null}
          <Pressable
            style={[styles.actionButton, isPickingImage && styles.actionButtonDisabled]}
            disabled={isPickingImage}
            onPress={() => void handleAddMemory()}>
            {isPickingImage ? (
              <ActivityIndicator size="small" color={TravelColors.primary} />
            ) : (
              <Text style={styles.actionButtonText}>Add photos</Text>
            )}
          </Pressable>
        </View>
      </View>

      {memoryArray.fields.length === 0 ? (
        <Text style={styles.emptyText}>No photos added for this stop yet.</Text>
      ) : null}

      {isCompactMode ? (
        <>
          <View style={styles.stackCard}>
            <View style={styles.stackPreviewRow}>
              <View style={styles.stackCanvas}>
                {previewMemories.map((memory, index) => (
                  <Pressable
                    key={`${memory.imageUri}-${index}`}
                    style={[
                      styles.stackPreviewPhoto,
                      {
                        left: index * 22,
                        transform: [{ rotate: `${(index - 1) * 5}deg` }],
                        zIndex: previewMemories.length - index,
                      },
                    ]}
                    onPress={() => setSelectedMemoryIndex(index)}>
                    <Image source={{ uri: memory.imageUri }} style={styles.stackPreviewImage} />
                  </Pressable>
                ))}
              </View>

              <View style={styles.stackCopy}>
                <Text style={styles.stackTitle}>Grouped for easier editing</Text>
                <Text style={styles.stackBody}>
                  Your photos now stay in one compact stack. Pick a thumbnail below to edit its caption, replace it, or remove it.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.thumbRail}>
            {memoryArray.fields.map((field, memoryIndex) => {
              const memory = memories[memoryIndex];
              const isSelected = memoryIndex === selectedMemoryIndex;

              if (!memory) {
                return null;
              }

              return (
                <Pressable
                  key={field.id}
                  style={[styles.thumbButton, isSelected && styles.thumbButtonSelected]}
                  onPress={() => setSelectedMemoryIndex(memoryIndex)}>
                  <Image source={{ uri: memory.imageUri }} style={[styles.thumbImage, isSelected && styles.thumbImageSelected]} />
                  <Text style={[styles.thumbLabel, isSelected && styles.thumbLabelSelected]}>
                    {memoryIndex + 1}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {selectedField && selectedMemory ? (
            <View style={styles.selectedMemoryWrap}>
              <Text style={styles.selectedMemoryLabel}>
                Editing photo {selectedMemoryIndex + 1} of {memoryArray.fields.length}
              </Text>
              {renderMemoryCard(selectedMemoryIndex)}
            </View>
          ) : null}
        </>
      ) : (
        memoryArray.fields.map((_, memoryIndex) => renderMemoryCard(memoryIndex))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  header: {
    gap: 10,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  headerCopy: {
    gap: 4,
  },
  title: {
    color: TravelColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    color: TravelColors.secondaryText,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyText: {
    color: TravelColors.mutedText,
    fontSize: 13,
  },
  memoryCountPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: TravelColors.tintSurface,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  memoryCountPillText: {
    color: TravelColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: TravelColors.tintSurface,
    gap: 10,
  },
  stackCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#eef7ff',
    borderWidth: 1,
    borderColor: '#d4e7fa',
    gap: 10,
  },
  stackPreviewRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  stackCanvas: {
    width: 120,
    height: 86,
    position: 'relative',
  },
  stackPreviewPhoto: {
    position: 'absolute',
    top: 0,
    width: 64,
    height: 86,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#dfeaf5',
  },
  stackPreviewImage: {
    width: '100%',
    height: '100%',
  },
  stackCopy: {
    flex: 1,
    minWidth: 180,
    gap: 4,
  },
  stackTitle: {
    color: TravelColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  stackBody: {
    color: TravelColors.secondaryText,
    fontSize: 13,
    lineHeight: 20,
  },
  thumbRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  thumbButton: {
    width: 64,
    gap: 6,
    alignItems: 'center',
  },
  thumbButtonSelected: {
    transform: [{ scale: 1.04 }],
  },
  thumbImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#dfeaf5',
  },
  thumbImageSelected: {
    borderColor: TravelColors.primary,
  },
  thumbLabel: {
    color: TravelColors.secondaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  thumbLabelSelected: {
    color: TravelColors.primary,
  },
  selectedMemoryWrap: {
    gap: 8,
  },
  selectedMemoryLabel: {
    color: TravelColors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#dfeaf5',
  },
  metaText: {
    color: TravelColors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    color: TravelColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: TravelColors.text,
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    backgroundColor: '#ffffff',
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  actionButtonText: {
    color: TravelColors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  removeButton: {
    backgroundColor: '#fff6f6',
    borderColor: '#efc7c7',
  },
  removeButtonText: {
    color: TravelColors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: TravelColors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
});
