import type { Control, FieldErrors } from 'react-hook-form';
import { Controller, useFieldArray } from 'react-hook-form';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TravelColors } from '@/constants/theme';
import { createEmptyPlace, type CreateTripFormValues } from '@/features/trips/schemas';

type StopPlacesEditorProps = {
  control: Control<CreateTripFormValues>;
  errors: FieldErrors<CreateTripFormValues>;
  stopIndex: number;
};

export function StopPlacesEditor({ control, errors, stopIndex }: StopPlacesEditorProps) {
  const placeArray = useFieldArray({
    control,
    name: `stops.${stopIndex}.places` as const,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Visited places</Text>
          <Text style={styles.body}>Add the landmarks, neighborhoods, or venues you explored here.</Text>
        </View>
        <Pressable style={styles.addButton} onPress={() => placeArray.append(createEmptyPlace())}>
          <Text style={styles.addButtonText}>Add place</Text>
        </Pressable>
      </View>

      {placeArray.fields.length === 0 ? (
        <Text style={styles.emptyText}>No places added for this stop yet.</Text>
      ) : null}

      {placeArray.fields.map((field, placeIndex) => {
        const placeErrors = errors.stops?.[stopIndex]?.places?.[placeIndex];

        return (
          <View key={field.id} style={styles.card}>
            <Controller
              control={control}
              name={`stops.${stopIndex}.places.${placeIndex}.title`}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.input}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Place name"
                  placeholderTextColor={TravelColors.mutedText}
                />
              )}
            />
            {placeErrors?.title?.message ? (
              <Text style={styles.errorText}>{placeErrors.title.message}</Text>
            ) : null}

            <Controller
              control={control}
              name={`stops.${stopIndex}.places.${placeIndex}.note`}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  multiline
                  textAlignVertical="top"
                  placeholder="Optional note, e.g. sunset walk and seafood dinner"
                  placeholderTextColor={TravelColors.mutedText}
                />
              )}
            />

            <Pressable
              style={[styles.addButton, styles.removeButton]}
              onPress={() => placeArray.remove(placeIndex)}>
              <Text style={styles.removeButtonText}>Remove place</Text>
            </Pressable>
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
  multilineInput: {
    minHeight: 88,
  },
  addButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    backgroundColor: '#ffffff',
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  addButtonText: {
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
