import type { Control, FieldArrayWithId, FieldErrors } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TravelColors } from '@/constants/theme';
import type { CreateTripFormValues } from '@/features/trips/schemas';

type StopListEditorProps = {
  control: Control<CreateTripFormValues>;
  errors: FieldErrors<CreateTripFormValues>;
  stopFields: FieldArrayWithId<CreateTripFormValues, 'stops', 'id'>[];
  onAddStopAfter(index: number): void;
  onRemoveStop(index: number): void;
};

export function StopListEditor({
  control,
  errors,
  stopFields,
  onAddStopAfter,
  onRemoveStop,
}: StopListEditorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Stops</Text>
      <Text style={styles.sectionBody}>
        Enter the places in travel order. Coordinates pin the stop on the saved map for this local
        MVP.
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

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>City</Text>
              <Controller
                control={control}
                name={`stops.${index}.cityName`}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Athens"
                    placeholderTextColor={TravelColors.mutedText}
                  />
                )}
              />
              {stopErrors?.cityName?.message ? (
                <Text style={styles.errorText}>{stopErrors.cityName.message}</Text>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Country</Text>
              <Controller
                control={control}
                name={`stops.${index}.countryName`}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Greece"
                    placeholderTextColor={TravelColors.mutedText}
                  />
                )}
              />
              {stopErrors?.countryName?.message ? (
                <Text style={styles.errorText}>{stopErrors.countryName.message}</Text>
              ) : null}
            </View>

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

            <View style={styles.coordinateRow}>
              <View style={[styles.fieldGroup, styles.coordinateField]}>
                <Text style={styles.label}>Latitude</Text>
                <Controller
                  control={control}
                  name={`stops.${index}.latitude`}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={styles.input}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="numbers-and-punctuation"
                      autoCapitalize="none"
                      placeholder="37.9838"
                      placeholderTextColor={TravelColors.mutedText}
                    />
                  )}
                />
                {stopErrors?.latitude?.message ? (
                  <Text style={styles.errorText}>{stopErrors.latitude.message}</Text>
                ) : null}
              </View>

              <View style={[styles.fieldGroup, styles.coordinateField]}>
                <Text style={styles.label}>Longitude</Text>
                <Controller
                  control={control}
                  name={`stops.${index}.longitude`}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={styles.input}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="numbers-and-punctuation"
                      autoCapitalize="none"
                      placeholder="23.7275"
                      placeholderTextColor={TravelColors.mutedText}
                    />
                  )}
                />
                {stopErrors?.longitude?.message ? (
                  <Text style={styles.errorText}>{stopErrors.longitude.message}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable style={styles.inlineButton} onPress={() => onAddStopAfter(index)}>
                <Text style={styles.inlineButtonText}>Add stop after</Text>
              </Pressable>

              {canRemove ? (
                <Pressable
                  style={[styles.inlineButton, styles.inlineButtonDanger]}
                  onPress={() => onRemoveStop(index)}>
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
  errorText: {
    color: TravelColors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  coordinateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  coordinateField: {
    flex: 1,
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
