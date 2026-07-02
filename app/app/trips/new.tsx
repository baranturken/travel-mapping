import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { TravelColors } from '@/constants/theme';
import { TripForm } from '@/features/trips/components/trip-form';
import { createSQLiteTripRepository } from '@/features/trips/sqlite-trip-repository';
import type { CreateTripInput } from '@/features/trips/types';

export default function CreateTripScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const repository = useMemo(() => createSQLiteTripRepository(db), [db]);
  const [isSaving, setIsSaving] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSubmit = async (input: CreateTripInput) => {
    try {
      setIsSaving(true);
      const tripId = await repository.createTrip(input);
      router.replace({
        pathname: '/trips/[tripId]',
        params: { tripId },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Could not save trip', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestScroll = useCallback((y: number) => {
    scrollViewRef.current?.scrollTo({ y, animated: true });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.select({ ios: 'padding', default: undefined })}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <TripForm isSubmitting={isSaving} onRequestScroll={handleRequestScroll} onSubmit={handleSubmit} />
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
});
