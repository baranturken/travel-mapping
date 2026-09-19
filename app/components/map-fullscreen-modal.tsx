import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { TravelColors } from '@/constants/theme';

type MapExpandButtonProps = {
  onPress: () => void;
};

/**
 * Small floating control that sits in a map's corner and opens the fullscreen
 * view. Rendered as an overlay sibling of the WebView, so it never interferes
 * with the map's own touch handling.
 */
export function MapExpandButton({ onPress }: MapExpandButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Expand map to fullscreen"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.expandButton, pressed && styles.expandButtonPressed]}>
      <Ionicons name="expand" size={18} color={TravelColors.text} />
    </Pressable>
  );
}

type MapFullscreenModalProps = {
  visible: boolean;
  onClose: () => void;
  /** The same self-contained Leaflet document the inline map renders. */
  html: string;
  title?: string;
};

export function MapFullscreenModal({ visible, onClose, html, title }: MapFullscreenModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.modalRoot}>
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={styles.modalWebview}
          javaScriptEnabled
          scrollEnabled={false}
          setSupportMultipleWindows={false}
        />

        <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
          {title ? (
            <View style={styles.titlePill}>
              <Text numberOfLines={1} style={styles.titleText}>
                {title}
              </Text>
            </View>
          ) : (
            <View style={styles.titleSpacer} />
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close fullscreen map"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.expandButtonPressed]}>
            <Ionicons name="close" size={22} color={TravelColors.text} />
          </Pressable>
        </View>

        <Text style={[styles.modalAttribution, { bottom: insets.bottom + 10 }]}>
          © OpenStreetMap contributors
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  expandButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: TravelColors.border,
    shadowColor: '#0b2440',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  expandButtonPressed: {
    backgroundColor: 'rgba(233,241,250,0.98)',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: TravelColors.surface,
  },
  modalWebview: {
    flex: 1,
    backgroundColor: TravelColors.surface,
  },
  modalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
  },
  titleSpacer: {
    flex: 1,
  },
  titlePill: {
    flex: 1,
    alignSelf: 'flex-start',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: TravelColors.border,
  },
  titleText: {
    color: TravelColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: TravelColors.border,
    shadowColor: '#0b2440',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  modalAttribution: {
    position: 'absolute',
    right: 12,
    color: TravelColors.mutedText,
    fontSize: 11,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
