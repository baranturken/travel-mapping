import type { Control, FieldArrayWithId, FieldErrors } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { TravelColors } from '@/constants/theme';
import type { CreateTripFormValues } from '@/features/trips/schemas';
import type { SuspiciousFerryReview } from '@/features/trips/routing/ferry-review';
import { TRANSPORT_TYPES, getTransportDisplay } from '@/features/trips/types';

type LegListEditorProps = {
  control: Control<CreateTripFormValues>;
  errors: FieldErrors<CreateTripFormValues>;
  legFields: FieldArrayWithId<CreateTripFormValues, 'legs', 'id'>[];
  stopValues: CreateTripFormValues['stops'];
  returnToStart: boolean;
  suspiciousFerryReviewsByIndex: Partial<Record<number, SuspiciousFerryReview>>;
  suspiciousReturnFerryReview: SuspiciousFerryReview | null;
  confirmedSuspiciousFerryKeySet: ReadonlySet<string>;
  onConfirmSuspiciousFerryReview(reviewKey: string): void;
};

export function LegListEditor({
  control,
  errors,
  legFields,
  stopValues,
  returnToStart,
  suspiciousFerryReviewsByIndex,
  suspiciousReturnFerryReview,
  confirmedSuspiciousFerryKeySet,
  onConfirmSuspiciousFerryReview,
}: LegListEditorProps) {
  const firstStop = stopValues[0];
  const lastStop = stopValues[stopValues.length - 1];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Transport between stops</Text>
      <Text style={styles.sectionBody}>
        Each gap in the itinerary gets one transport choice. Straight lines stay deterministic in
        this MVP.
      </Text>

      <View style={styles.returnCard}>
        <Controller
          control={control}
          name="returnToStart"
          render={({ field: { value, onChange } }) => (
            <View style={styles.returnHeader}>
              <View style={styles.returnCopy}>
                <Text style={styles.cardTitle}>
                  Did you return to {firstStop?.cityName?.trim() || 'your starting city'}?
                </Text>
                <Text style={styles.sectionBody}>
                  Turn this on if the trip ended by going back to where the journey started.
                </Text>
              </View>
              <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{ false: '#cfe2f4', true: TravelColors.primary }}
                thumbColor="#ffffff"
              />
            </View>
          )}
        />
      </View>

      {legFields.map((legField, index) => {
        const fromStop = stopValues[index];
        const toStop = stopValues[index + 1];
        const labelError = errors.legs?.[index]?.transportLabel?.message;
        const suspiciousFerryReview = suspiciousFerryReviewsByIndex[index];
        const isSuspiciousFerryConfirmed = suspiciousFerryReview
          ? confirmedSuspiciousFerryKeySet.has(suspiciousFerryReview.key)
          : false;

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
            {suspiciousFerryReview ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>{suspiciousFerryReview.question}</Text>
                <Text style={styles.warningText}>{suspiciousFerryReview.explanation}</Text>
                <Text style={styles.warningText}>
                  {isSuspiciousFerryConfirmed
                    ? 'Confirmed for this route. If you change the stops or transport details, we will ask again.'
                    : 'If this ferry is intentional, confirm it here so save does not stop you later.'}
                </Text>
                <Pressable
                  style={[
                    styles.confirmButton,
                    isSuspiciousFerryConfirmed && styles.confirmButtonConfirmed,
                  ]}
                  onPress={() => onConfirmSuspiciousFerryReview(suspiciousFerryReview.key)}>
                  <Text
                    style={[
                      styles.confirmButtonText,
                      isSuspiciousFerryConfirmed && styles.confirmButtonTextConfirmed,
                    ]}>
                    {isSuspiciousFerryConfirmed ? 'Ferry confirmed' : 'Keep ferry anyway'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}

      {returnToStart && firstStop && lastStop ? (
        <View style={styles.returnDetailCard}>
          <Text style={styles.cardTitle}>
            How did you go from {lastStop.cityName?.trim() || `Stop ${stopValues.length}`} to{' '}
            {firstStop.cityName?.trim() || 'your starting city'}?
          </Text>

          <Controller
            control={control}
            name="returnLeg.transportType"
            render={({ field: { value, onChange } }) => (
              <View style={styles.selectorWrap}>
                {TRANSPORT_TYPES.map((transportType) => {
                  const selected = value === transportType;
                  const transport = getTransportDisplay(transportType);

                  return (
                    <Pressable
                      key={`return-${transportType}`}
                      style={[styles.selectorChip, selected && styles.selectorChipSelected]}
                      onPress={() => onChange(transportType)}>
                      <Text
                        style={[styles.selectorChipText, selected && styles.selectorChipTextSelected]}>
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
            name="returnLeg.transportLabel"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={`Optional label, e.g. Flight back to ${firstStop.cityName}`}
                placeholderTextColor={TravelColors.mutedText}
              />
            )}
          />
          {(() => {
            const isSuspiciousReturnFerryConfirmed = suspiciousReturnFerryReview
              ? confirmedSuspiciousFerryKeySet.has(suspiciousReturnFerryReview.key)
              : false;

            return suspiciousReturnFerryReview ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>{suspiciousReturnFerryReview.question}</Text>
                <Text style={styles.warningText}>{suspiciousReturnFerryReview.explanation}</Text>
                <Text style={styles.warningText}>
                  {isSuspiciousReturnFerryConfirmed
                    ? 'Confirmed for this return route. If you change the route, we will ask again.'
                    : 'If this return ferry is intentional, confirm it here so save does not stop you later.'}
                </Text>
                <Pressable
                  style={[
                    styles.confirmButton,
                    isSuspiciousReturnFerryConfirmed && styles.confirmButtonConfirmed,
                  ]}
                  onPress={() => onConfirmSuspiciousFerryReview(suspiciousReturnFerryReview.key)}>
                  <Text
                    style={[
                      styles.confirmButtonText,
                      isSuspiciousReturnFerryConfirmed && styles.confirmButtonTextConfirmed,
                    ]}>
                    {isSuspiciousReturnFerryConfirmed ? 'Return ferry confirmed' : 'Keep return ferry anyway'}
                  </Text>
                </Pressable>
              </View>
            ) : null;
          })()}
        </View>
      ) : null}
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
  returnCard: {
    backgroundColor: '#eff7ff',
    borderRadius: 22,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#cfe2f4',
  },
  returnDetailCard: {
    backgroundColor: '#eff7ff',
    borderRadius: 22,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#cfe2f4',
  },
  cardTitle: {
    color: TravelColors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  returnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  returnCopy: {
    flex: 1,
    gap: 4,
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
  warningCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0cf94',
    backgroundColor: '#fff8ea',
    padding: 12,
    gap: 4,
  },
  warningTitle: {
    color: '#8a5300',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  warningText: {
    color: '#8a5300',
    fontSize: 13,
    lineHeight: 18,
  },
  confirmButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d29a2f',
    backgroundColor: '#fff4d3',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  confirmButtonConfirmed: {
    borderColor: TravelColors.primary,
    backgroundColor: '#e8f3ff',
  },
  confirmButtonText: {
    color: '#8a5300',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmButtonTextConfirmed: {
    color: TravelColors.primary,
  },
});
