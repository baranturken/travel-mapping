import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { TravelColors } from '@/constants/theme';

// 3:1 is the banner aspect used everywhere it renders (profile, public profile).
const BANNER_ASPECT = 3;

type CropState = { normX: number; normY: number; scale: number };

/**
 * Wide-aspect (3:1) crop sheet for profile banners. iOS `allowsEditing` forces a
 * square crop that doesn't match the banner, so the user picks the full photo and
 * frames it here: pan to reposition, pinch or +/- to zoom. On confirm the visible
 * window is cropped out with expo-image-manipulator and the cropped URI returned.
 */
export function BannerCropModal({
  uri,
  onCancel,
  onConfirm,
}: {
  uri: string;
  onCancel(): void;
  onConfirm(croppedUri: string): void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const frameW = Math.min(windowWidth - 48, 360);
  const frameH = Math.round(frameW / BANNER_ASPECT);

  const [cropState, setCropState] = useState<CropState>({ normX: 0, normY: 0, scale: 1 });
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  const cropRef = useRef(cropState);
  cropRef.current = cropState;
  const overflowRef = useRef({ x: 0, y: 0 });
  const panBase = useRef({ normX: 0, normY: 0, gDx: 0, gDy: 0 });
  const pinchRef = useRef<{ baseDist: number; baseScale: number } | null>(null);

  useEffect(() => {
    setCropState({ normX: 0, normY: 0, scale: 1 });
    setImgSize(null);
    Image.getSize(uri, (w, h) => setImgSize({ w, h }), () => {});
  }, [uri]);

  // Cover-fit scale: the smallest scale that fills the 3:1 frame in both axes.
  const coverBase = useMemo(() => {
    if (!imgSize) return 1;
    return Math.max(frameW / imgSize.w, frameH / imgSize.h);
  }, [imgSize, frameW, frameH]);

  useEffect(() => {
    if (!imgSize) return;
    const s = coverBase * cropState.scale;
    overflowRef.current = {
      x: Math.max(0, imgSize.w * s - frameW),
      y: Math.max(0, imgSize.h * s - frameH),
    };
  }, [imgSize, coverBase, cropState.scale, frameW, frameH]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        pinchRef.current = null;
        panBase.current = { normX: cropRef.current.normX, normY: cropRef.current.normY, gDx: 0, gDy: 0 };
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          const dist = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY,
          );
          pinchRef.current = { baseDist: dist, baseScale: cropRef.current.scale };
        }
      },
      onPanResponderMove: (evt, g) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          const dist = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY,
          );
          if (!pinchRef.current) {
            pinchRef.current = { baseDist: dist, baseScale: cropRef.current.scale };
            panBase.current = { normX: cropRef.current.normX, normY: cropRef.current.normY, gDx: g.dx, gDy: g.dy };
          } else {
            const next = Math.max(1, Math.min(4, pinchRef.current.baseScale * (dist / pinchRef.current.baseDist)));
            setCropState((prev) => ({ ...prev, scale: next, normX: 0, normY: 0 }));
          }
          return;
        }
        if (pinchRef.current) {
          // Finger lifted out of a pinch — rebase the pan so there's no jump.
          pinchRef.current = null;
          panBase.current = { normX: cropRef.current.normX, normY: cropRef.current.normY, gDx: g.dx, gDy: g.dy };
          return;
        }
        const ox = overflowRef.current.x;
        const oy = overflowRef.current.y;
        const rdx = g.dx - panBase.current.gDx;
        const rdy = g.dy - panBase.current.gDy;
        setCropState((prev) => ({
          ...prev,
          normX: ox > 0 ? Math.max(-0.5, Math.min(0.5, panBase.current.normX + rdx / ox)) : 0,
          normY: oy > 0 ? Math.max(-0.5, Math.min(0.5, panBase.current.normY + rdy / oy)) : 0,
        }));
      },
      onPanResponderRelease: () => { pinchRef.current = null; },
      onPanResponderTerminate: () => { pinchRef.current = null; },
    }),
  ).current;

  const displayMetrics = useMemo(() => {
    if (!imgSize) return null;
    const s = coverBase * cropState.scale;
    const dw = imgSize.w * s;
    const dh = imgSize.h * s;
    const ox = Math.max(0, dw - frameW);
    const oy = Math.max(0, dh - frameH);
    return {
      left: (frameW - dw) / 2 + cropState.normX * ox,
      top: (frameH - dh) / 2 + cropState.normY * oy,
      width: dw,
      height: dh,
    };
  }, [imgSize, coverBase, cropState, frameW, frameH]);

  const adjustScale = (delta: number) => {
    setCropState((prev) => ({ normX: 0, normY: 0, scale: Math.max(1, Math.min(4, prev.scale + delta)) }));
  };

  const handleConfirm = async () => {
    if (!imgSize || processing) return;
    setProcessing(true);
    try {
      const s = coverBase * cropState.scale;
      const dw = imgSize.w * s;
      const dh = imgSize.h * s;
      const ox = Math.max(0, dw - frameW);
      const oy = Math.max(0, dh - frameH);
      const left = (frameW - dw) / 2 + cropState.normX * ox;
      const top = (frameH - dh) / 2 + cropState.normY * oy;

      // Map the visible frame window back into source-pixel space.
      const cropW = frameW / s;
      const cropH = frameH / s;
      const originX = Math.max(0, Math.min(imgSize.w - cropW, -left / s));
      const originY = Math.max(0, Math.min(imgSize.h - cropH, -top / s));

      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            crop: {
              originX: Math.round(originX),
              originY: Math.round(originY),
              width: Math.round(cropW),
              height: Math.round(cropH),
            },
          },
          { resize: { width: 1280 } },
        ],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      onConfirm(result.uri);
    } catch (err) {
      Alert.alert('Could not crop banner', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable style={styles.iconButton} onPress={onCancel} hitSlop={8} accessibilityLabel="Cancel">
              <Ionicons name="close" size={20} color={TravelColors.text} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Position banner</Text>
              <Text style={styles.subtitle}>Drag to reposition · Pinch or +/− to zoom</Text>
            </View>
          </View>

          <View style={styles.frameArea}>
            <View
              style={[styles.frame, { width: frameW, height: frameH }]}
              {...panResponder.panHandlers}>
              {displayMetrics ? (
                <Image
                  source={{ uri }}
                  style={{
                    position: 'absolute',
                    width: displayMetrics.width,
                    height: displayMetrics.height,
                    left: displayMetrics.left,
                    top: displayMetrics.top,
                  }}
                  resizeMode="stretch"
                />
              ) : (
                <ActivityIndicator color={TravelColors.primary} />
              )}
            </View>
          </View>

          <View style={styles.zoomRow}>
            <Pressable style={styles.zoomButton} onPress={() => adjustScale(-0.2)}>
              <Ionicons name="remove" size={22} color={TravelColors.primary} />
            </Pressable>
            <Text style={styles.zoomLabel}>{Math.round(cropState.scale * 100)}%</Text>
            <Pressable style={styles.zoomButton} onPress={() => adjustScale(0.2)}>
              <Ionicons name="add" size={22} color={TravelColors.primary} />
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={onCancel} disabled={processing}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmButton, (processing || !imgSize) && styles.confirmDisabled]}
              onPress={handleConfirm}
              disabled={processing || !imgSize}>
              {processing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.confirmText}>Use banner</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,16,30,0.82)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: TravelColors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: TravelColors.border,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TravelColors.tintSurface,
  },
  headerCopy: { flex: 1, gap: 2 },
  title: { color: TravelColors.text, fontSize: 17, fontWeight: '700' },
  subtitle: { color: TravelColors.secondaryText, fontSize: 13 },
  frameArea: { alignItems: 'center', paddingVertical: 28 },
  frame: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingBottom: 8,
  },
  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TravelColors.tintSurface,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
  },
  zoomLabel: { color: TravelColors.text, fontSize: 15, fontWeight: '700', minWidth: 50, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: TravelColors.border,
  },
  cancelButton: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: TravelColors.borderStrong,
    backgroundColor: TravelColors.tintSurface,
  },
  cancelText: { color: TravelColors.primary, fontSize: 14, fontWeight: '700' },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 14,
    backgroundColor: TravelColors.primary,
    minHeight: 50,
  },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
