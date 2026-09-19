import { Redirect, Tabs, useNavigation } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect } from 'react';

import { TravelColors } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';

// The parent stack knows this group only as "(tabs)", so a screen pushed from
// a tab shows "(tabs)" as its back-button label. Mirroring the focused tab's
// title onto the parent gives the back button the name of the page the user
// actually came from.
const TAB_TITLES: Record<string, string> = {
  feed: 'Feed',
  trips: 'My Trips',
  search: 'Search',
  profile: 'Profile',
};

export default function TabsLayout() {
  const { session, loading, mfaPending } = useAuth();
  const navigation = useNavigation();

  const setParentTitle = useCallback(
    (routeName: string | undefined) => {
      const title = routeName ? TAB_TITLES[routeName] : undefined;
      if (title) navigation.getParent()?.setOptions({ title });
    },
    [navigation],
  );

  // The state listener only fires on a change, so the very first screen pushed
  // before any tab switch would still read "(tabs)".
  useEffect(() => {
    setParentTitle('feed');
  }, [setParentTitle]);

  if (!loading && !session) {
    return <Redirect href={'/(auth)/sign-in' as Href} />;
  }

  if (!loading && mfaPending) {
    return <Redirect href={'/mfa-challenge' as Href} />;
  }

  return (
    <Tabs
      screenListeners={{
        state: (e) => {
          const state = (e.data as { state?: { index: number; routes: { name: string }[] } })
            ?.state;
          if (!state) return;
          setParentTitle(state.routes[state.index]?.name);
        },
      }}
      screenOptions={{
        tabBarActiveTintColor: TravelColors.primary,
        tabBarInactiveTintColor: TravelColors.mutedText,
        tabBarStyle: {
          backgroundColor: TravelColors.surface,
          borderTopColor: TravelColors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: TravelColors.surface },
        headerTintColor: TravelColors.text,
        headerTitleStyle: { fontWeight: '700' },
      }}>
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'My Trips',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
