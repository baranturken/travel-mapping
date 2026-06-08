import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';

import { TravelColors } from '@/constants/theme';
import { toCreateTripInput } from '@/features/trips/mappers';
import { deleteManagedMemoryUris, isManagedMemoryUri } from '@/features/trips/memory-location';
import {
  createDefaultReturnLeg,
  createEmptyLeg,
  createEmptyStop,
  createTripSchema,
  type CreateTripFormValues,
} from '@/features/trips/schemas';
import { LegListEditor } from '@/features/trips/components/leg-list-editor';
import {
  getFirstTripFormErrorSection,
  type TripFormScrollSection,
} from '@/features/trips/form-error-navigation';
import {
  buildFerryReviewStateSignature,
  buildSuspiciousFerryConfirmationMessage,
  getSuspiciousFerryReviews,
  getUnresolvedSuspiciousFerryReviews,
} from '@/features/trips/routing/ferry-review';
import { StopListEditor } from '@/features/trips/components/stop-list-editor';
import type { CreateTripInput } from '@/features/trips/types';

type TripFormProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  submitLabel?: string;
  initialValues?: CreateTripFormValues;
  isSubmitting?: boolean;
  onRequestScroll?(y: number): void;
  onSubmit(input: CreateTripInput): void | Promise<void>;
};

const defaultValues: CreateTripFormValues = {
  title: '',
  startDate: '',
  endDate: '',
  stops: [createEmptyStop(), createEmptyStop()],
  legs: [createEmptyLeg()],
  returnToStart: false,
  returnLeg: createDefaultReturnLeg(),
};

export function TripForm({
  eyebrow = 'Create trip',
  title = 'Build your itinerary.',
  description = 'Add a title, your stops in order, and the transport between each one. Everything is saved locally on your device.',
  submitLabel = 'Save trip',
  initialValues,
  isSubmitting = false,
  onRequestScroll,
  onSubmit,
}: TripFormProps) {
  const formDefaults = useMemo(() => initialValues ?? defaultValues, [initialValues]);
  const queuedMemoryDeletionUrisRef = useRef<Set<string>>(new Set());
  const sectionOffsetsRef = useRef<Partial<Record<TripFormScrollSection, number>>>({});
  const [confirmedSuspiciousFerryKeys, setConfirmedSuspiciousFerryKeys] = useState<string[]>([]);

  const {
    control,
    getValues,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateTripFormValues>({
    defaultValues: formDefaults,
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

  const returnToStart = useWatch({
    control,
    name: 'returnToStart',
  });

  const legValues = useWatch({
    control,
    name: 'legs',
  });

  const returnLegValue = useWatch({
    control,
    name: 'returnLeg',
  });

  const currentFerryReviewInput = useMemo(
    () => ({
      stops: stopValues ?? formDefaults.stops,
      legs: legValues ?? formDefaults.legs,
      returnToStart: returnToStart ?? false,
      returnLeg: returnLegValue ?? formDefaults.returnLeg,
    }),
    [formDefaults.legs, formDefaults.returnLeg, formDefaults.stops, legValues, returnLegValue, returnToStart, stopValues],
  );

  const suspiciousFerryReviews = useMemo(
    () => getSuspiciousFerryReviews(currentFerryReviewInput),
    [currentFerryReviewInput],
  );

  const suspiciousFerryReviewsByIndex = useMemo(() => {
    const nextReviews: Partial<Record<number, (typeof suspiciousFerryReviews)[number]>> = {};

    suspiciousFerryReviews.forEach((review) => {
      if (review.segmentKind === 'leg') {
        nextReviews[review.index] = review;
      }
    });

    return nextReviews;
  }, [suspiciousFerryReviews]);

  const suspiciousReturnFerryReview = useMemo(
    () => suspiciousFerryReviews.find((review) => review.segmentKind === 'return') ?? null,
    [suspiciousFerryReviews],
  );
  const confirmedSuspiciousFerryKeySet = useMemo(
    () => new Set(confirmedSuspiciousFerryKeys),
    [confirmedSuspiciousFerryKeys],
  );

  const ferryReviewStateSignature = useMemo(
    () => buildFerryReviewStateSignature(currentFerryReviewInput),
    [currentFerryReviewInput],
  );
  const previousFerryReviewStateSignatureRef = useRef(ferryReviewStateSignature);

  useEffect(() => {
    if (previousFerryReviewStateSignatureRef.current === ferryReviewStateSignature) {
      return;
    }

    previousFerryReviewStateSignatureRef.current = ferryReviewStateSignature;
    setConfirmedSuspiciousFerryKeys([]);
  }, [ferryReviewStateSignature]);

  const confirmSuspiciousFerryReview = useCallback((reviewKey: string) => {
    setConfirmedSuspiciousFerryKeys((currentKeys) =>
      currentKeys.includes(reviewKey) ? currentKeys : [...currentKeys, reviewKey],
    );
  }, []);

  const queueMemoryDeletion = useCallback((imageUri: string) => {
    if (!isManagedMemoryUri(imageUri)) {
      return;
    }

    queuedMemoryDeletionUrisRef.current.add(imageUri.trim());
  }, []);

  const registerSectionOffset = useCallback(
    (section: TripFormScrollSection) => (event: LayoutChangeEvent) => {
      sectionOffsetsRef.current[section] = event.nativeEvent.layout.y;
    },
    [],
  );

  const scrollToSection = useCallback(
    (section: TripFormScrollSection) => {
      const y = Math.max((sectionOffsetsRef.current[section] ?? 0) - 20, 0);
      onRequestScroll?.(y);
    },
    [onRequestScroll],
  );

  const handleAddStopAfter = (index: number) => {
    const nextStop = createEmptyStop();
    nextStop.isHomeBase = false;
    stopArray.insert(index + 1, nextStop);

    if (index >= legArray.fields.length) {
      legArray.append(createEmptyLeg('custom'));
      return;
    }

    legArray.insert(index + 1, createEmptyLeg('custom'));
    legArray.update(index, createEmptyLeg('custom'));
  };

  const handleRemoveStop = (index: number) => {
    if (index <= 0 || index >= stopArray.fields.length - 1) {
      return;
    }

    const removedStop = getValues(`stops.${index}`);
    const previousLeg = getValues(`legs.${index - 1}`);
    const nextLeg = getValues(`legs.${index}`);

    removedStop?.memories.forEach((memory) => queueMemoryDeletion(memory.imageUri));

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

  const handleMoveStop = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= stopArray.fields.length) {
      return;
    }

    stopArray.move(index, targetIndex);

    const affectedLegStart = Math.max(0, Math.min(index, targetIndex) - 1);
    const affectedLegEnd = Math.min(legArray.fields.length - 1, Math.max(index, targetIndex));

    for (let legIndex = affectedLegStart; legIndex <= affectedLegEnd; legIndex += 1) {
      legArray.update(legIndex, createEmptyLeg('custom'));
    }
  };

  const persistForm = async (values: CreateTripFormValues) => {
    const input = toCreateTripInput(values);
    const retainedUris = new Set(
      input.stops
        .flatMap((stop) => stop.memories.map((memory) => memory.imageUri.trim()))
        .filter((uri) => isManagedMemoryUri(uri)),
    );

    await onSubmit(input);

    const queuedUris = Array.from(queuedMemoryDeletionUrisRef.current).filter(
      (uri) => !retainedUris.has(uri),
    );

    deleteManagedMemoryUris(queuedUris);

    queuedUris.forEach((uri) => queuedMemoryDeletionUrisRef.current.delete(uri));
  };

  const submitForm = async (values: CreateTripFormValues) => {
    const unresolvedSuspiciousFerryReviews = getUnresolvedSuspiciousFerryReviews(
      values,
      confirmedSuspiciousFerryKeySet,
    );

    if (unresolvedSuspiciousFerryReviews.length > 0) {
      Alert.alert(
        'Confirm suspicious ferry legs',
        buildSuspiciousFerryConfirmationMessage(unresolvedSuspiciousFerryReviews),
        [
          {
            text: 'Go back and edit',
            style: 'cancel',
          },
          {
            text: 'Keep ferry',
            onPress: () => {
              unresolvedSuspiciousFerryReviews.forEach((review) => {
                confirmSuspiciousFerryReview(review.key);
              });

              void persistForm(values);
            },
          },
        ],
      );
      return;
    }

    await persistForm(values);
  };

  const handleInvalidSubmit = useCallback(
    (nextErrors: typeof errors) => {
      const section = getFirstTripFormErrorSection(nextErrors);

      if (section) {
        scrollToSection(section);
      }
    },
    [scrollToSection],
  );

  return (
    <View style={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
      </View>

      <View style={styles.sectionCard} onLayout={registerSectionOffset('title')}>
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

      <View style={styles.sectionCard} onLayout={registerSectionOffset('dates')}>
        <Text style={styles.sectionTitle}>Trip dates</Text>
        <Text style={styles.sectionBody}>
          Add the start and end dates if you want story-ready timing. Use the YYYY-MM-DD format.
        </Text>

        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.label}>Start date</Text>
            <Controller
              control={control}
              name="startDate"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="2026-07-03"
                  placeholderTextColor={TravelColors.mutedText}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                  maxLength={10}
                />
              )}
            />
            {errors.startDate?.message ? <Text style={styles.errorText}>{errors.startDate.message}</Text> : null}
          </View>

          <View style={styles.dateField}>
            <Text style={styles.label}>End date</Text>
            <Controller
              control={control}
              name="endDate"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="2026-07-09"
                  placeholderTextColor={TravelColors.mutedText}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                />
              )}
            />
            {errors.endDate?.message ? <Text style={styles.errorText}>{errors.endDate.message}</Text> : null}
          </View>
        </View>
      </View>

      <View onLayout={registerSectionOffset('stops')}>
        <StopListEditor
          control={control}
          errors={errors}
          stopFields={stopArray.fields}
          stopValues={stopValues ?? formDefaults.stops}
          setValue={setValue}
          onQueueMemoryDeletion={queueMemoryDeletion}
          onAddStopAfter={handleAddStopAfter}
          onMoveStop={handleMoveStop}
          onRemoveStop={handleRemoveStop}
        />
      </View>

      <View style={styles.sectionCard} onLayout={registerSectionOffset('legs')}>
        <LegListEditor
          control={control}
          errors={errors}
          legFields={legArray.fields}
          stopValues={stopValues ?? formDefaults.stops}
          returnToStart={returnToStart ?? false}
          suspiciousFerryReviewsByIndex={suspiciousFerryReviewsByIndex}
          suspiciousReturnFerryReview={suspiciousReturnFerryReview}
          confirmedSuspiciousFerryKeySet={confirmedSuspiciousFerryKeySet}
          onConfirmSuspiciousFerryReview={confirmSuspiciousFerryReview}
        />
        {errors.legs?.message ? <Text style={styles.errorText}>{errors.legs.message}</Text> : null}
        {errors.returnLeg?.transportLabel?.message ? (
          <Text style={styles.errorText}>{errors.returnLeg.transportLabel.message}</Text>
        ) : null}
      </View>

      <Pressable
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        disabled={isSubmitting}
        onPress={handleSubmit(submitForm, handleInvalidSubmit)}>
        {isSubmitting ? <ActivityIndicator size="small" color="#ffffff" /> : null}
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'Saving trip…' : submitLabel}
        </Text>
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
  label: {
    color: TravelColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dateField: {
    flex: 1,
    minWidth: 160,
    gap: 6,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
