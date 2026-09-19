import React from 'react';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { TravelColors } from '@/constants/theme';
import { AuthProvider } from '@/features/auth/auth-context';
import { TurnstileProvider } from '@/features/auth/components/turnstile-provider';
import { migrateDbIfNeeded } from '@/lib/db/migrations';
import { APP_DATABASE_NAME } from '@/lib/db/sqlite';

// The back-button label is taken from the previous route's name, which for
// anything pushed out of the tab group is the literal string "(tabs)". These
// map a route to the label a user would recognise; the tab group resolves
// further, to whichever tab is actually focused.
const TAB_BACK_TITLES: Record<string, string> = {
  feed: 'Feed',
  trips: 'My Trips',
  search: 'Search',
  profile: 'Profile',
};

const ROUTE_BACK_TITLES: Record<string, string> = {
  'trips/[tripId]': 'Trip',
  'trips/shared/[publishedId]': 'Trip',
  'users/[userId]': 'Profile',
  'profile/edit': 'Edit profile',
};

type NavState = {
  index?: number;
  routes?: { name: string; state?: NavState }[];
};

/**
 * Label for the back button of the screen currently being rendered: the name
 * of the screen beneath it on the stack.
 *
 * Computed from navigation state rather than set with setOptions, because the
 * root layout re-declares each Stack.Screen's static options on every render
 * and would clobber a dynamically-set title.
 */
function backTitleFor(state: NavState | undefined): string {
  const index = state?.index ?? 0;
  const previous = state?.routes?.[index - 1];
  if (!previous) return 'Back';

  if (previous.name === '(tabs)') {
    const tabs = previous.state;
    const focusedTab = tabs?.routes?.[tabs?.index ?? 0]?.name;
    return (focusedTab && TAB_BACK_TITLES[focusedTab]) || 'Back';
  }

  return ROUTE_BACK_TITLES[previous.name] ?? 'Back';
}

const travelTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f6fbff',
    card: '#ffffff',
    primary: '#1f5ea8',
    text: '#15304b',
    border: '#d8e6f5',
    notification: '#1f5ea8',
  },
};

class AppShellErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorScreen}>
          <View style={styles.errorCard}>
            <Text style={styles.errorEyebrow}>Storage error</Text>
            <Text style={styles.errorTitle}>Sharevel could not open local trip storage.</Text>
            <Text style={styles.errorBody}>
              Restart the app and try again. Your device may have blocked the SQLite database from
              opening.
            </Text>
          </View>
          <StatusBar style="dark" />
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  return (
    <ThemeProvider value={travelTheme}>
      <TurnstileProvider>
        <AuthProvider>
          <AppShellErrorBoundary>
          <SQLiteProvider databaseName={APP_DATABASE_NAME} onInit={migrateDbIfNeeded}>
            <Stack
              screenOptions={({ navigation }) => ({
                contentStyle: { backgroundColor: '#f6fbff' },
                headerStyle: { backgroundColor: '#ffffff' },
                headerTintColor: '#15304b',
                headerTitleStyle: { fontWeight: '700' },
                headerBackTitle: backTitleFor(navigation.getState() as NavState),
              })}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="trips/new"
                options={{ title: 'Create trip', presentation: 'card' }}
              />
              <Stack.Screen name="trips/[tripId]/edit" options={{ title: 'Edit trip' }} />
              <Stack.Screen name="trips/[tripId]" options={{ title: 'Trip detail' }} />
              <Stack.Screen name="trips/[tripId]/story" options={{ title: 'Trip story' }} />
              <Stack.Screen name="trips/shared/[publishedId]" options={{ title: 'Trip' }} />
              <Stack.Screen name="profile/edit" options={{ title: 'Edit profile' }} />
              <Stack.Screen name="profile/security" options={{ title: 'Security' }} />
              <Stack.Screen name="users/[userId]" options={{ title: 'Profile' }} />
              <Stack.Screen name="reset-password" options={{ headerShown: false }} />
              <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
              <Stack.Screen name="mfa-challenge" options={{ headerShown: false }} />
            </Stack>
          </SQLiteProvider>
          </AppShellErrorBoundary>
        </AuthProvider>
      </TurnstileProvider>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: TravelColors.background,
  },
  errorCard: {
    backgroundColor: TravelColors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: TravelColors.border,
    gap: 10,
  },
  errorEyebrow: {
    color: TravelColors.primary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  errorTitle: {
    color: TravelColors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  errorBody: {
    color: TravelColors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
  },
});
