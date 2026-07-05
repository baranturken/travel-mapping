import { Redirect, Stack } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuth } from '@/features/auth/auth-context';

export default function AuthLayout() {
  const { session, loading, profile, mfaPending } = useAuth();

  if (!loading && session && mfaPending) {
    return <Redirect href={'/mfa-challenge' as Href} />;
  }

  if (!loading && session && profile) {
    return <Redirect href={'/(tabs)/feed' as Href} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#f6fbff' },
      }}
    />
  );
}
