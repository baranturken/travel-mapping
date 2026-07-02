import React from 'react';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { TravelColors } from '@/constants/theme';
import { migrateDbIfNeeded } from '@/lib/db/migrations';
import { APP_DATABASE_NAME } from '@/lib/db/sqlite';

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
  state = {
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorScreen}>
          <View style={styles.errorCard}>
            <Text style={styles.errorEyebrow}>Storage error</Text>
            <Text style={styles.errorTitle}>Travel Mapping could not open local trip storage.</Text>
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
      <AppShellErrorBoundary>
        <SQLiteProvider databaseName={APP_DATABASE_NAME} onInit={migrateDbIfNeeded}>
          <Stack
            screenOptions={{
              contentStyle: {
                backgroundColor: '#f6fbff',
              },
              headerStyle: {
                backgroundColor: '#ffffff',
              },
              headerTintColor: '#15304b',
              headerTitleStyle: {
                fontWeight: '700',
              },
            }}>
            <Stack.Screen name="index" options={{ title: 'Trips' }} />
            <Stack.Screen
              name="trips/new"
              options={{ title: 'Create trip', presentation: 'card' }}
            />
            <Stack.Screen name="trips/[tripId]/edit" options={{ title: 'Edit trip' }} />
            <Stack.Screen name="trips/[tripId]" options={{ title: 'Trip detail' }} />
            <Stack.Screen name="trips/[tripId]/story" options={{ title: 'Trip story' }} />
          </Stack>
        </SQLiteProvider>
      </AppShellErrorBoundary>
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
