import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { TravelColors } from '@/constants/theme';
import { TripDetailSkeleton } from '@/components/skeleton';
import { TripForm } from '@/features/trips/components/trip-form';
import { toTripFormValues } from '@/features/trips/mappers';
import { createSQLiteTripRepository } from '@/features/trips/sqlite-trip-repository';
import type { CreateTripInput, TripDetail } from '@/features/trips/types';

export default function EditTripScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const db = useSQLiteContext();
  const repository = useMemo(() => createSQLiteTripRepository(db), [db]);
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    let isMounted = true;

    const loadTrip = async () => {
      if (!tripId) {
        if (isMounted) {
          setTrip(null);
          setErrorMessage('This trip could not be found.');
          setIsLoading(false);
        }
        return;
      }

      try {
        const nextTrip = await repository.getTripDetail(tripId);

        if (!isMounted) {
          return;
        }

        setTrip(nextTrip);
        setErrorMessage(nextTrip ? null : 'This trip could not be found.');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setTrip(null);
        setErrorMessage(error instanceof Error ? error.message : 'Please try again.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadTrip();

    return () => {
      isMounted = false;
    };
  }, [repository, tripId]);

  const handleSubmit = async (input: CreateTripInput) => {
    if (!tripId) {
      return;
    }

    try {
      setIsSaving(true);
      await repository.updateTrip(tripId, input);
      router.replace({
        pathname: '/trips/[tripId]',
        params: { tripId },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Could not update trip', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestScroll = useCallback((y: number) => {
    scrollViewRef.current?.scrollTo({ y, animated: true });
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <TripDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>Could not open trip</Text>
          <Text style={styles.stateBody}>{errorMessage ?? 'Please return to the trips list and try again.'}</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen options={{ title: `Edit: ${trip.title}` }} />
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.select({ ios: 'padding', default: undefined })}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <TripForm
            eyebrow="Edit trip"
            title="Update your itinerary."
            description="Change stops, reorder the journey, or update transport between legs. Your changes are saved locally."
            submitLabel="Save changes"
            initialValues={toTripFormValues(trip)}
            isSubmitting={isSaving}
            onRequestScroll={handleRequestScroll}
            onSubmit={handleSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: TravelColors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  stateTitle: {
    color: TravelColors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  stateBody: {
    color: TravelColors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 8,
    backgroundColor: TravelColors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
