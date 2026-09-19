import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TravelColors } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { blockUser, reportContent } from '@/features/social/moderation';
import { getIsFollowing, unfollowUser } from '@/features/social/social-repository';
import { invalidateCache } from '@/features/social/social-cache';
import { errorMessage } from '@/lib/errors';
import {
  REPORT_REASONS,
  type ReportReason,
  type ReportTargetType,
} from '@/features/social/report-reasons';

type Props = {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId: string | null;
  /** Shown in the heading, e.g. a trip title or "@username". */
  targetLabel?: string;
  /** Used in the follow-up prompt. Falls back to "this account". */
  targetOwnerUsername?: string;
  /** Called after a successful report, so the caller can also hide the item. */
  onReported?: () => void;
  /** Called after the follow-up prompt blocks the account. */
  onBlocked?: () => void;
};

const TARGET_NOUN: Record<ReportTargetType, string> = {
  trip: 'this trip',
  comment: 'this comment',
  profile: 'this account',
};

export function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
  targetOwnerId,
  targetLabel,
  targetOwnerUsername,
  onReported,
  onBlocked,
}: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReason(null);
    setDetails('');
    setSubmitting(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!user || !reason || submitting) return;
    setSubmitting(true);
    try {
      await reportContent({
        reporterId: user.id,
        targetType,
        targetId,
        targetOwnerId,
        reason,
        details,
      });
      reset();
      onClose();
      onReported?.();
      await offerFollowUp();
    } catch (err) {
      setSubmitting(false);
      Alert.alert('Could not send report', errorMessage(err));
    }
  };

  // Reporting someone is usually the moment you also want them out of your
  // feed. Asking here saves hunting for the block control, and offering
  // "unfollow" separately matters because blocking is heavier than most people
  // want for, say, spam.
  const offerFollowUp = async () => {
    const name = targetOwnerUsername ? `@${targetOwnerUsername}` : 'this account';
    const thanks =
      'Thanks — our team reviews reports within 24 hours and will take action if this breaks our rules.';

    if (!user || !targetOwnerId || targetOwnerId === user.id) {
      Alert.alert('Report received', thanks);
      return;
    }

    // Only offer to unfollow when there is something to unfollow.
    let following = false;
    try {
      following = await getIsFollowing(user.id, targetOwnerId);
    } catch {
      // Not worth failing the prompt over; just omit the option.
    }

    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];

    if (following) {
      buttons.push({
        text: `Unfollow ${name}`,
        onPress: () => {
          void unfollowUser(user.id, targetOwnerId)
            .then(() => invalidateCache(''))
            .catch((err: unknown) => Alert.alert('Could not unfollow', errorMessage(err)));
        },
      });
    }

    buttons.push({
      text: `Block ${name}`,
      style: 'destructive',
      onPress: () => {
        void blockUser(user.id, targetOwnerId)
          .then(() => {
            invalidateCache('');
            onBlocked?.();
          })
          .catch((err: unknown) => Alert.alert('Could not block', errorMessage(err)));
      },
    });

    buttons.push({ text: 'No thanks', style: 'cancel' });

    Alert.alert('Report received', `${thanks}

Would you also like to do any of these?`, buttons);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={close} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />

            <View style={styles.header}>
              <Text style={styles.title}>Report {TARGET_NOUN[targetType]}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} hitSlop={10}>
                <Ionicons name="close" size={22} color={TravelColors.secondaryText} />
              </Pressable>
            </View>

            {targetLabel ? (
              <Text style={styles.targetLabel} numberOfLines={1}>
                {targetLabel}
              </Text>
            ) : null}

            <Text style={styles.subtitle}>
              Reports are anonymous — the person you report is not told who reported them.
            </Text>

            <ScrollView style={styles.reasonList} keyboardShouldPersistTaps="handled">
              {REPORT_REASONS.map((r) => {
                const selected = reason === r.value;
                return (
                  <Pressable
                    key={r.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setReason(r.value)}
                    style={[styles.reasonRow, selected && styles.reasonRowSelected]}>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? TravelColors.primary : TravelColors.mutedText}
                    />
                    <View style={styles.reasonCopy}>
                      <Text style={[styles.reasonLabel, selected && styles.reasonLabelSelected]}>
                        {r.label}
                      </Text>
                      <Text style={styles.reasonDescription}>{r.description}</Text>
                    </View>
                  </Pressable>
                );
              })}

              {reason ? (
                <View style={styles.detailsField}>
                  <Text style={styles.detailsLabel}>
                    {reason === 'other' ? 'What is wrong?' : 'Anything to add? (optional)'}
                  </Text>
                  <TextInput
                    style={styles.detailsInput}
                    value={details}
                    onChangeText={setDetails}
                    placeholder="Add any context that would help us review this"
                    placeholderTextColor={TravelColors.mutedText}
                    multiline
                    maxLength={1000}
                    editable={!submitting}
                  />
                </View>
              ) : null}
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              onPress={() => void submit()}
              disabled={!reason || submitting}
              style={[styles.submit, (!reason || submitting) && styles.submitDisabled]}>
              {submitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitText}>Submit report</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,36,64,0.45)', justifyContent: 'flex-end' },
  backdropFill: { flex: 1 },
  sheet: {
    backgroundColor: TravelColors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '88%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: TravelColors.border,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: TravelColors.text, fontSize: 20, fontWeight: '800' },
  targetLabel: { color: TravelColors.primary, fontSize: 14, fontWeight: '700', marginTop: 2 },
  subtitle: {
    color: TravelColors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 6,
  },
  reasonList: { marginTop: 4 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reasonRowSelected: {
    backgroundColor: TravelColors.tintSurface,
    borderColor: TravelColors.border,
  },
  reasonCopy: { flex: 1, gap: 2 },
  reasonLabel: { color: TravelColors.text, fontSize: 15, fontWeight: '600' },
  reasonLabelSelected: { fontWeight: '800' },
  reasonDescription: { color: TravelColors.mutedText, fontSize: 12, lineHeight: 17 },
  detailsField: { gap: 6, marginTop: 8, marginBottom: 4 },
  detailsLabel: { color: TravelColors.text, fontSize: 14, fontWeight: '700' },
  detailsInput: {
    borderWidth: 1,
    borderColor: TravelColors.border,
    borderRadius: 14,
    padding: 12,
    minHeight: 84,
    textAlignVertical: 'top',
    color: TravelColors.text,
    fontSize: 15,
    backgroundColor: TravelColors.background,
  },
  submit: {
    marginTop: 12,
    backgroundColor: TravelColors.primary,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
