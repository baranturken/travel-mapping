import * as ImagePicker from 'expo-image-picker';
import type { Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TravelColors } from '@/constants/theme';
import { createMemoryFromAsset } from '@/features/trips/memory-location';
import type { CreateTripFormValues } from '@/features/trips/schemas';

type StopMemoriesEditorProps = {
  control: Control<CreateTripFormValues>;
  errors: FieldErrors<CreateTripFormValues>;
  setValue: UseFormSetValue<CreateTripFormValues>;
  stopIndex: number;
  onQueueMemoryDeletion(imageUri: string): void;
};

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

  const openPicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        exif: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        return null;
      }

      return createMemoryFromAsset(result.assets[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Could not add photo', message);
      return null;
    }
  };

  const handleAddMemory = async () => {
    const memory = await openPicker();

    if (!memory) {
      return;
    }

    memoryArray.append(memory);
  };

  const handleReplaceMemory = async (memoryIndex: number) => {
    const memory = await openPicker();

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Photo memories</Text>
          <Text style={styles.body}>
            Pick photos from your device. Travel Mapping can read embedded photo location metadata so the trip can note where a memory was captured.
          </Text>
        </View>
        <Pressable style={styles.actionButton} onPress={() => void handleAddMemory()}>
          <Text style={styles.actionButtonText}>Add photo</Text>
        </Pressable>
      </View>

      {memoryArray.fields.length === 0 ? (
        <Text style={styles.emptyText}>No photos added for this stop yet.</Text>
      ) : null}

      {memoryArray.fields.map((field, memoryIndex) => {
        const memoryErrors = errors.stops?.[stopIndex]?.memories?.[memoryIndex];
        const memory = memoryValues?.[memoryIndex] ?? field;

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
                    placeholder="Optional caption"
                    placeholderTextColor={TravelColors.mutedText}
                  />
                </View>
              )}
            />

            <View style={styles.actionRow}>
              <Pressable
                style={styles.actionButton}
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
      })}
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
  card: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: TravelColors.tintSurface,
    gap: 10,
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
