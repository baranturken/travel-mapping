import { Redirect, Stack, useSegments } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuth } from '@/features/auth/auth-context';

export default function AuthLayout() {
  const { session, loading, profile, mfaPending } = useAuth();
  const segments = useSegments();
  const onProfileSetup = segments[segments.length - 1] === 'profile-setup';

  if (!loading && session && mfaPending) {
    return <Redirect href={'/mfa-challenge' as Href} />;
  }

  // A session with no profile row yet — a brand-new account. Without this the
  // user is authenticated but no redirect matches, so they sit on the sign-in
  // screen tapping a button that silently succeeds every time.
  //
  // The guard matters: profile-setup lives inside this group, so redirecting to
  // it unconditionally would loop.
  if (!loading && session && !profile && !onProfileSetup) {
    return <Redirect href={'/(auth)/profile-setup' as Href} />;
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
