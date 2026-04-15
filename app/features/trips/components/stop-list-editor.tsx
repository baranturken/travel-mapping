import type {
  Control,
  FieldArrayWithId,
  FieldErrors,
  UseFormSetValue,
} from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TravelColors } from '@/constants/theme';
import type { CityOption } from '@/features/locations/world-cities';
import { CitySearchField } from '@/features/trips/components/city-search-field';
import { StopMemoriesEditor } from '@/features/trips/components/stop-memories-editor';
import { StopPlacesEditor } from '@/features/trips/components/stop-places-editor';
import type { CreateTripFormValues } from '@/features/trips/schemas';
import {
  ACCOMMODATION_TYPES,
  getAccommodationDisplay,
  type AccommodationType,
} from '@/features/trips/types';

type StopListEditorProps = {
  control: Control<CreateTripFormValues>;
  errors: FieldErrors<CreateTripFormValues>;
  stopFields: FieldArrayWithId<CreateTripFormValues, 'stops', 'id'>[];
  stopValues: CreateTripFormValues['stops'];
  setValue: UseFormSetValue<CreateTripFormValues>;
  onQueueMemoryDeletion(imageUri: string): void;
  onAddStopAfter(index: number): void;
  onMoveStop(index: number, direction: 'up' | 'down'): void;
  onRemoveStop(index: number): void;
};

export function StopListEditor({
  control,
  errors,
  stopFields,
  stopValues,
  setValue,
  onQueueMemoryDeletion,
  onAddStopAfter,
  onMoveStop,
  onRemoveStop,
}: StopListEditorProps) {
  const handleSelectCity = (index: number, city: CityOption) => {
    setValue(`stops.${index}.cityName`, city.cityName, { shouldDirty: true, shouldValidate: true });
    setValue(`stops.${index}.countryName`, city.countryName, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue(`stops.${index}.latitude`, city.latitude.toString(), {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue(`stops.${index}.longitude`, city.longitude.toString(), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleManualCitySave = (
    index: number,
    city: { cityName: string; countryName: string; latitude: string; longitude: string },
  ) => {
    setValue(`stops.${index}.cityName`, city.cityName, { shouldDirty: true, shouldValidate: true });
    setValue(`stops.${index}.countryName`, city.countryName, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue(`stops.${index}.latitude`, city.latitude, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue(`stops.${index}.longitude`, city.longitude, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleRemoveStopPress = (index: number) => {
    const stop = stopValues[index];

    const hasStoryContent = Boolean(
      stop?.stayLabel?.trim() ||
        stop?.accommodationName?.trim() ||
        stop?.accommodationType ||
        stop?.accommodationNote?.trim() ||
        stop?.places.length ||
        stop?.memories.length,
    );

    if (!hasStoryContent) {
      onRemoveStop(index);
      return;
    }

    Alert.alert(
      'Remove this stop?',
      'This stop already has stay details, places, or photo memories. Removing it will delete that content from this trip draft.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemoveStop(index),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Stops</Text>
      <Text style={styles.sectionBody}>
        Search each stop by city. Then enrich it with stays, places you visited, and photo memories.
      </Text>

      {stopFields.map((field, index) => {
        const stopErrors = errors.stops?.[index];
        const canRemove = index > 0 && index < stopFields.length - 1;
        const isStart = index === 0;
        const isFinish = index === stopFields.length - 1;

        return (
          <View key={field.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{index + 1}</Text>
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.cardTitle}>
                  {isStart ? 'Start' : isFinish ? 'Final stop' : 'Intermediate stop'}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {canRemove
                    ? 'This stop can be removed without deleting the trip.'
                    : 'Keep at least a start and finish stop in the route.'}
                </Text>
              </View>
            </View>

            <CitySearchField
              value={stopValues[index] ?? field}
              errorMessage={stopErrors?.cityName?.message ?? stopErrors?.countryName?.message}
              onSelect={(city) => handleSelectCity(index, city)}
              onManualSave={(city) => handleManualCitySave(index, city)}
            />

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Stay label</Text>
              <Controller
                control={control}
                name={`stops.${index}.stayLabel`}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Optional, e.g. 3 nights"
                    placeholderTextColor={TravelColors.mutedText}
                  />
                )}
              />
            </View>

            <View style={styles.groupCard}>
              <Text style={styles.groupTitle}>Accommodation</Text>
              <Text style={styles.groupBody}>
                Add the place you stayed so it can appear in the itinerary and on the map.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Stay name</Text>
                <Controller
                  control={control}
                  name={`stops.${index}.accommodationName`}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={styles.input}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Optional, e.g. Blue Harbor Hotel"
                      placeholderTextColor={TravelColors.mutedText}
                    />
                  )}
                />
              </View>

              <Controller
                control={control}
                name={`stops.${index}.accommodationType`}
                render={({ field: { value, onChange } }) => (
                  <View style={styles.selectorWrap}>
                    {ACCOMMODATION_TYPES.map((accommodationType) => {
                      const accommodation = getAccommodationDisplay(accommodationType);
                      const selected = value === accommodationType;

                      return (
                        <Pressable
                          key={accommodationType}
                          style={[styles.selectorChip, selected && styles.selectorChipSelected]}
                          onPress={() =>
                            onChange(selected ? ('' as '' | AccommodationType) : accommodationType)
                          }>
                          <Text
                            style={[
                              styles.selectorChipText,
                              selected && styles.selectorChipTextSelected,
                            ]}>
                            {accommodation.emoji} {accommodation.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              />

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Accommodation note</Text>
                <Controller
                  control={control}
                  name={`stops.${index}.accommodationNote`}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[styles.input, styles.multilineInput]}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      multiline
                      textAlignVertical="top"
                      placeholder="Optional, e.g. sea view room near the port"
                      placeholderTextColor={TravelColors.mutedText}
                    />
                  )}
                />
              </View>
            </View>

            <View style={styles.groupCard}>
              <StopPlacesEditor control={control} errors={errors} stopIndex={index} />
            </View>

            <View style={styles.groupCard}>
              <StopMemoriesEditor
                control={control}
                errors={errors}
                setValue={setValue}
                stopIndex={index}
                onQueueMemoryDeletion={onQueueMemoryDeletion}
              />
            </View>

            {stopErrors?.latitude?.message || stopErrors?.longitude?.message ? (
              <Text style={styles.errorText}>
                {stopErrors?.latitude?.message ?? stopErrors?.longitude?.message}
              </Text>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable style={styles.inlineButton} onPress={() => onAddStopAfter(index)}>
                <Text style={styles.inlineButtonText}>Add stop after</Text>
              </Pressable>
              <Pressable
                style={[styles.inlineButton, index === 0 && styles.inlineButtonDisabled]}
                disabled={index === 0}
                onPress={() => onMoveStop(index, 'up')}>
                <Text
                  style={[styles.inlineButtonText, index === 0 && styles.inlineButtonTextDisabled]}>
                  Move up
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.inlineButton,
                  index === stopFields.length - 1 && styles.inlineButtonDisabled,
                ]}
                disabled={index === stopFields.length - 1}
                onPress={() => onMoveStop(index, 'down')}>
                <Text
                  style={[
                    styles.inlineButtonText,
                    index === stopFields.length - 1 && styles.inlineButtonTextDisabled,
                  ]}>
                  Move down
                </Text>
              </Pressable>

              {canRemove ? (
                <Pressable
                  style={[styles.inlineButton, styles.inlineButtonDanger]}
                  onPress={() => handleRemoveStopPress(index)}>
                  <Text style={styles.inlineButtonDangerText}>Remove stop</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  sectionTitle: {
    color: TravelColors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  sectionBody: {
    color: TravelColors.secondaryText,
    fontSize: 14,
    lineHeight: 22,
  },
  card: {
    backgroundColor: TravelColors.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: TravelColors.border,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: TravelColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: TravelColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: TravelColors.mutedText,
    fontSize: 13,
    lineHeight: 18,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: TravelColors.text,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 92,
  },
  groupCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#f9fcff',
    borderWidth: 1,
    borderColor: TravelColors.border,
    gap: 10,
  },
  groupTitle: {
    color: TravelColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  groupBody: {
    color: TravelColors.secondaryText,
    fontSize: 13,
    lineHeight: 20,
  },
  selectorWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectorChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  selectorChipSelected: {
    backgroundColor: TravelColors.primary,
    borderColor: TravelColors.primary,
  },
  selectorChipText: {
    color: TravelColors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  selectorChipTextSelected: {
    color: '#ffffff',
  },
  errorText: {
    color: TravelColors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inlineButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: TravelColors.tintSurface,
  },
  inlineButtonText: {
    color: TravelColors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  inlineButtonDisabled: {
    opacity: 0.45,
  },
  inlineButtonTextDisabled: {
    color: TravelColors.mutedText,
  },
  inlineButtonDanger: {
    backgroundColor: '#fff6f6',
    borderColor: '#efc7c7',
  },
  inlineButtonDangerText: {
    color: TravelColors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
});
