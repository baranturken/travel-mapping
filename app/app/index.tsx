import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { TravelColors } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';

export default function IndexRedirect() {
  const { session, loading, profile } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TravelColors.background }}>
        <ActivityIndicator color={TravelColors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href={'/(auth)/sign-in' as Href} />;
  }

  if (!profile) {
    return <Redirect href={'/(auth)/profile-setup' as Href} />;
  }

  return <Redirect href={'/(tabs)/feed' as Href} />;
}
