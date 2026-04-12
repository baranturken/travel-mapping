import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TravelColors } from '@/constants/theme';
import { toCreateTripInput } from '@/features/trips/mappers';
import {
  createEmptyLeg,
  createEmptyStop,
  createTripSchema,
  type CreateTripFormValues,
} from '@/features/trips/schemas';
import { LegListEditor } from '@/features/trips/components/leg-list-editor';
import { StopListEditor } from '@/features/trips/components/stop-list-editor';
import type { CreateTripInput } from '@/features/trips/types';

type TripFormProps = {
  isSubmitting?: boolean;
  onSubmit(input: CreateTripInput): void | Promise<void>;
};

const defaultValues: CreateTripFormValues = {
  title: '',
  stops: [createEmptyStop(), createEmptyStop()],
  legs: [createEmptyLeg()],
};

export function TripForm({ isSubmitting = false, onSubmit }: TripFormProps) {
  const {
    control,
    getValues,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTripFormValues>({
    defaultValues,
    resolver: zodResolver(createTripSchema),
  });

  const stopArray = useFieldArray({
    control,
    name: 'stops',
  });

  const legArray = useFieldArray({
    control,
    name: 'legs',
  });

  const stopValues = useWatch({
    control,
    name: 'stops',
  });

  const handleAddStopAfter = (index: number) => {
    const existingLeg = index < legArray.fields.length ? getValues(`legs.${index}`) : null;

    stopArray.insert(index + 1, createEmptyStop());

    if (index >= legArray.fields.length) {
      legArray.append(createEmptyLeg());
      return;
    }

    legArray.insert(index + 1, existingLeg ?? createEmptyLeg());
  };

  const handleRemoveStop = (index: number) => {
    if (index <= 0 || index >= stopArray.fields.length - 1) {
      return;
    }

    const previousLeg = getValues(`legs.${index - 1}`);
    const nextLeg = getValues(`legs.${index}`);

    stopArray.remove(index);
    legArray.remove(index);

    if (!previousLeg || !nextLeg) {
      return;
    }

    const sameTransportType = previousLeg.transportType === nextLeg.transportType;
    const mergedLeg =
      sameTransportType
        ? {
            transportType: previousLeg.transportType,
            transportLabel: previousLeg.transportLabel || nextLeg.transportLabel || '',
          }
        : createEmptyLeg('custom');

    legArray.update(index - 1, mergedLeg);
  };

  const submitForm = async (values: CreateTripFormValues) => {
    await onSubmit(toCreateTripInput(values));
  };

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Create trip</Text>
        <Text style={styles.title}>Build the itinerary first, then open it on the map.</Text>
        <Text style={styles.description}>
          Start simple: title, stops, transport, and map coordinates. You can add auth and sync
          later without changing this local trip structure.
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Trip title</Text>
        <Text style={styles.sectionBody}>
          Use a short name that will still make sense in your saved trips list.
        </Text>

        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="Cyclades and mainland loop"
              placeholderTextColor={TravelColors.mutedText}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        {errors.title?.message ? <Text style={styles.errorText}>{errors.title.message}</Text> : null}
      </View>

      <StopListEditor
        control={control}
        errors={errors}
        stopFields={stopArray.fields}
        onAddStopAfter={handleAddStopAfter}
        onRemoveStop={handleRemoveStop}
      />

      <View style={styles.sectionCard}>
        <LegListEditor
          control={control}
          errors={errors}
          legFields={legArray.fields}
          stopValues={stopValues ?? defaultValues.stops}
        />
        {errors.legs?.message ? <Text style={styles.errorText}>{errors.legs.message}</Text> : null}
      </View>

      <Pressable
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        disabled={isSubmitting}
        onPress={handleSubmit(submitForm)}>
        <Text style={styles.submitButtonText}>{isSubmitting ? 'Saving trip…' : 'Save trip'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  heroCard: {
    backgroundColor: TravelColors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: TravelColors.border,
    gap: 10,
  },
  eyebrow: {
    color: TravelColors.primary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: TravelColors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
  },
  description: {
    color: TravelColors.secondaryText,
    fontSize: 15,
    lineHeight: 23,
  },
  sectionCard: {
    backgroundColor: TravelColors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: TravelColors.border,
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
  submitButton: {
    backgroundColor: TravelColors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
