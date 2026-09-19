import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TravelColors } from '@/constants/theme';
import {
  MIN_PASSWORD_LENGTH,
  type PasswordResult,
  type PasswordStrength,
} from '@/features/auth/password-policy';

const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  weak: '#b53c3c',
  fair: '#b8860b',
  strong: '#2d7a47',
};
const STRENGTH_TEXT: Record<PasswordStrength, string> = {
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
};
const STRENGTH_WIDTH: Record<PasswordStrength, `${number}%`> = {
  weak: '33%',
  fair: '66%',
  strong: '100%',
};

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.ruleRow}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'ellipse-outline'}
        size={15}
        color={ok ? '#2d7a47' : TravelColors.mutedText}
      />
      <Text style={[styles.ruleText, ok && styles.ruleTextOk]}>{label}</Text>
    </View>
  );
}

// Live strength meter + requirements checklist shown under a new-password
// field. Render only while the password is non-empty.
export function PasswordRequirements({ result }: { result: PasswordResult }) {
  return (
    <View style={styles.policy}>
      <View style={styles.strengthRow}>
        <View style={styles.strengthTrack}>
          <View
            style={[
              styles.strengthFill,
              {
                width: STRENGTH_WIDTH[result.strength],
                backgroundColor: STRENGTH_COLOR[result.strength],
              },
            ]}
          />
        </View>
        <Text style={[styles.strengthLabel, { color: STRENGTH_COLOR[result.strength] }]}>
          {STRENGTH_TEXT[result.strength]}
        </Text>
      </View>
      <Rule ok={result.checks.minLength} label={`At least ${MIN_PASSWORD_LENGTH} characters`} />
      <Rule ok={result.checks.hasLower} label="Contains a lowercase letter" />
      <Rule ok={result.checks.hasUpper} label="Contains an uppercase letter" />
      <Rule ok={result.checks.hasNumber} label="Contains a number" />
      <Rule ok={result.checks.hasSymbol} label="Contains a symbol (! ? # …)" />
      <Rule ok={result.checks.notCommon} label="Not a common password" />
    </View>
  );
}

const styles = StyleSheet.create({
  policy: { gap: 6, marginTop: 8 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  strengthTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: TravelColors.border,
    overflow: 'hidden',
  },
  strengthFill: { height: 6, borderRadius: 999 },
  strengthLabel: { fontSize: 12, fontWeight: '700', minWidth: 44, textAlign: 'right' },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ruleText: { color: TravelColors.mutedText, fontSize: 13 },
  ruleTextOk: { color: TravelColors.secondaryText },
});
