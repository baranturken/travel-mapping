import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TravelColors } from '@/constants/theme';
import { extractAuthParams } from '@/features/auth/auth-deep-link';
import { supabase } from '@/lib/supabase';

// Landing screen for the auth deep links Supabase sends: the signup
// confirmation email, and the OAuth return URL.
//
// The happy path for OAuth is that `WebBrowser.openAuthSessionAsync` resolves
// in-app and the calling screen exchanges the code itself, so this screen is
// never seen. But the OS can deliver the link directly instead — if the user
// switches apps mid-flow, or opens the confirmation email on the device — and
// without a route here that lands on a "screen not found" error with a valid
// session token stranded in the URL.
type CallbackState = 'working' | 'failed';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const url = Linking.useURL();
  const [state, setState] = useState<CallbackState>('working');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function completeSignIn() {
      // The auth listener may have consumed the link before this screen
      // mounted, in which case we are already signed in and just need to move
      // the user along.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        if (!cancelled) router.replace('/' as Href);
        return;
      }

      if (!url) return; // wait for the deep link to arrive

      const { accessToken, refreshToken, code, errorDescription } = extractAuthParams(url);

      try {
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          throw new Error(
            errorDescription ?? 'This link is missing its security token, or has already been used.',
          );
        }

        // Send the user to the root redirect, which decides between MFA,
        // profile setup, and the feed based on the new session.
        if (!cancelled) router.replace('/' as Href);
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'Could not complete sign-in.');
          setState('failed');
        }
      }
    }

    void completeSignIn();
    return () => {
      cancelled = true;
    };
  }, [url, router]);

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {state === 'working' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={TravelColors.primary} />
          <Text style={styles.workingText}>Signing you in…</Text>
        </View>
      ) : (
        <View style={styles.centered}>
          <View style={styles.card}>
            <Ionicons name="alert-circle-outline" size={28} color={TravelColors.primary} />
            <Text style={styles.title}>That link didn&apos;t work</Text>
            <Text style={styles.body}>{errorMessage}</Text>
            <Text style={styles.hint}>
              Confirmation links expire and can only be used once. Signing in again will send a
              fresh one.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/(auth)/sign-in' as Href)}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonText}>Back to sign in</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TravelColors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  workingText: { color: TravelColors.secondaryText, fontSize: 15 },
  card: {
    width: '100%',
    backgroundColor: TravelColors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: TravelColors.border,
    padding: 22,
    gap: 10,
  },
  title: { color: TravelColors.text, fontSize: 21, fontWeight: '800' },
  body: { color: TravelColors.secondaryText, fontSize: 15, lineHeight: 22 },
  hint: { color: TravelColors.mutedText, fontSize: 13, lineHeight: 19 },
  button: {
    marginTop: 6,
    backgroundColor: TravelColors.primary,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
