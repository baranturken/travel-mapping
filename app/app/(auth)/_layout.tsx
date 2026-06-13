import { Redirect, Stack } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuth } from '@/features/auth/auth-context';

export default function AuthLayout() {
  const { session, loading, profile } = useAuth();

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
