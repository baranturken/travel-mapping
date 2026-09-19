import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { TravelColors } from '@/constants/theme';
import {
  buildTurnstileHtml,
  parseTurnstileMessage,
  TURNSTILE_BASE_URL,
  TURNSTILE_SITE_KEY,
} from '@/features/auth/turnstile-html';

// How long to wait for Cloudflare before giving up. Turnstile is usually
// instant, but a bad network should not strand the user on a spinner.
const TOKEN_TIMEOUT_MS = 20000;

type TurnstileContextValue = {
  /**
   * Resolves with a one-time captcha token, or null when Turnstile is not
   * configured. Rejects if the challenge fails or the user dismisses it.
   *
   * Tokens are single-use: request a fresh one per auth attempt.
   */
  requestToken: () => Promise<string | null>;
  isConfigured: boolean;
};

const TurnstileContext = createContext<TurnstileContextValue | null>(null);

export function useTurnstile(): TurnstileContextValue {
  const ctx = useContext(TurnstileContext);
  if (!ctx) throw new Error('useTurnstile must be used inside <TurnstileProvider>');
  return ctx;
}

type Pending = {
  resolve: (token: string | null) => void;
  reject: (error: Error) => void;
};

export function TurnstileProvider({ children }: { children: React.ReactNode }) {
  const isConfigured = TURNSTILE_SITE_KEY.length > 0;
  const [visible, setVisible] = useState(false);
  const [solving, setSolving] = useState(true);
  const pendingRef = useRef<Pending | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Remounts the WebView per request so each challenge starts clean — a reused
  // widget can hand back an already-consumed token.
  const [attempt, setAttempt] = useState(0);

  const html = useMemo(() => buildTurnstileHtml(TURNSTILE_SITE_KEY), []);

  const finish = useCallback((fn: (p: Pending) => void) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    setVisible(false);
    if (pending) fn(pending);
  }, []);

  const requestToken = useCallback((): Promise<string | null> => {
    // Not configured: let auth proceed. Supabase only enforces captcha when the
    // dashboard toggle is on, so this keeps development and any build without
    // the key working rather than locking everyone out.
    if (!isConfigured) return Promise.resolve(null);

    // A second request while one is open would strand the first promise.
    if (pendingRef.current) {
      return Promise.reject(new Error('A verification is already in progress.'));
    }

    return new Promise<string | null>((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      setSolving(true);
      setAttempt((n) => n + 1);
      setVisible(true);

      timeoutRef.current = setTimeout(() => {
        finish((p) => p.reject(new Error('Verification timed out. Check your connection.')));
      }, TOKEN_TIMEOUT_MS);
    });
  }, [isConfigured, finish]);

  const handleMessage = useCallback(
    (raw: string) => {
      const message = parseTurnstileMessage(raw);
      if (!message) return;

      switch (message.type) {
        case 'ready':
          setSolving(false);
          break;
        case 'token':
          finish((p) => p.resolve(message.token));
          break;
        case 'expired':
          finish((p) => p.reject(new Error('Verification expired. Please try again.')));
          break;
        case 'error':
          finish((p) => p.reject(new Error(`Verification failed (${message.code}).`)));
          break;
      }
    },
    [finish],
  );

  const cancel = useCallback(() => {
    finish((p) => p.reject(new Error('Verification cancelled.')));
  }, [finish]);

  const value = useMemo<TurnstileContextValue>(
    () => ({ requestToken, isConfigured }),
    [requestToken, isConfigured],
  );

  return (
    <TurnstileContext.Provider value={value}>
      {children}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Quick security check</Text>
            <Text style={styles.body}>
              Confirming you&apos;re not a robot. This usually takes a second.
            </Text>

            <View style={styles.widgetSlot}>
              {solving ? (
                <View style={styles.widgetLoading} pointerEvents="none">
                  <ActivityIndicator color={TravelColors.primary} />
                </View>
              ) : null}
              <WebView
                key={attempt}
                originWhitelist={['*']}
                source={{ html, baseUrl: TURNSTILE_BASE_URL }}
                style={styles.webview}
                containerStyle={styles.webviewContainer}
                javaScriptEnabled
                domStorageEnabled
                scrollEnabled={false}
                setSupportMultipleWindows={false}
                onMessage={(event) => handleMessage(event.nativeEvent.data)}
                onError={() => handleMessage(JSON.stringify({ type: 'error', code: 'webview' }))}
                onHttpError={() =>
                  handleMessage(JSON.stringify({ type: 'error', code: 'http' }))
                }
              />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={cancel}
              style={({ pressed }) => [styles.cancel, pressed && styles.cancelPressed]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </TurnstileContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,36,64,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: TravelColors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: TravelColors.border,
    padding: 20,
    gap: 8,
  },
  title: { color: TravelColors.text, fontSize: 18, fontWeight: '800' },
  body: { color: TravelColors.secondaryText, fontSize: 14, lineHeight: 20 },
  widgetSlot: {
    minHeight: 92,
    justifyContent: 'center',
    marginTop: 4,
  },
  widgetLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  webview: { backgroundColor: 'transparent' },
  webviewContainer: { minHeight: 92 },
  cancel: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14 },
  cancelPressed: { opacity: 0.6 },
  cancelText: { color: TravelColors.secondaryText, fontSize: 14, fontWeight: '600' },
});
