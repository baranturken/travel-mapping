import type { Control, FieldArrayWithId, FieldErrors } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TravelColors } from '@/constants/theme';
import type { CreateTripFormValues } from '@/features/trips/schemas';
import { TRANSPORT_TYPES, getTransportDisplay } from '@/features/trips/types';

type LegListEditorProps = {
  control: Control<CreateTripFormValues>;
  errors: FieldErrors<CreateTripFormValues>;
  legFields: FieldArrayWithId<CreateTripFormValues, 'legs', 'id'>[];
  stopValues: CreateTripFormValues['stops'];
};

export function LegListEditor({
  control,
  errors,
  legFields,
  stopValues,
}: LegListEditorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Transport between stops</Text>
      <Text style={styles.sectionBody}>
        Each gap in the itinerary gets one transport choice. Straight lines stay deterministic in
        this MVP.
      </Text>

      {legFields.map((legField, index) => {
        const fromStop = stopValues[index];
        const toStop = stopValues[index + 1];
        const labelError = errors.legs?.[index]?.transportLabel?.message;

        return (
          <View key={legField.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {fromStop?.cityName?.trim() || `Stop ${index + 1}`} →{' '}
              {toStop?.cityName?.trim() || `Stop ${index + 2}`}
            </Text>

            <Controller
              control={control}
              name={`legs.${index}.transportType`}
              render={({ field: { value, onChange } }) => (
                <View style={styles.selectorWrap}>
                  {TRANSPORT_TYPES.map((transportType) => {
                    const selected = value === transportType;
                    const transport = getTransportDisplay(transportType);

                    return (
                      <Pressable
                        key={transportType}
                        style={[styles.selectorChip, selected && styles.selectorChipSelected]}
                        onPress={() => onChange(transportType)}>
                        <Text
                          style={[
                            styles.selectorChipText,
                            selected && styles.selectorChipTextSelected,
                          ]}>
                          {transport.emoji} {transport.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />

            <Controller
              control={control}
              name={`legs.${index}.transportLabel`}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.input}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Optional label, e.g. Night ferry"
                  placeholderTextColor={TravelColors.mutedText}
                />
              )}
            />
            {labelError ? <Text style={styles.errorText}>{labelError}</Text> : null}
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
    backgroundColor: TravelColors.tintSurface,
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    color: TravelColors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
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
});
