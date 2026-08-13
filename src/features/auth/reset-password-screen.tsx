import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { clinqueColors as colors } from '@/features/clinics/clinque-theme';
import { supabase } from '@/lib/supabase';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

function Icon({ name, color = colors.teal, size = 22 }: { name: SymbolName; color?: string; size?: number }) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}

export function ResetPasswordScreen() {
  const router = useRouter();
  const linkingUrl = Linking.useLinkingURL();
  const { signOut, updatePassword } = useAuth();
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid' | 'complete'>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function acceptRecoveryLink() {
      const currentUrl = linkingUrl ?? (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null);
      if (!currentUrl) {
        if (active) setStatus('invalid');
        return;
      }

      const parsedUrl = new URL(currentUrl);
      const hash = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      const code = parsedUrl.searchParams.get('code');
      let error: Error | null = null;

      if (accessToken && refreshToken) {
        const result = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        error = result.error;
      } else if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        error = result.error;
      } else {
        const { data } = await supabase.auth.getSession();
        if (!data.session) error = new Error('Recovery session is missing.');
      }

      if (!active) return;
      setStatus(error ? 'invalid' : 'ready');

      if (!error && Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/reset-password');
      }
    }

    void acceptRecoveryLink();
    return () => { active = false; };
  }, [linkingUrl]);

  function returnToSignIn() {
    void signOut().then(() => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign('/');
        return;
      }
      router.replace('/');
    });
  }

  async function savePassword() {
    setMessage(null);
    if (password.length < 8) {
      setMessage('Your new password must contain at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setMessage('The two passwords do not match.');
      return;
    }

    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setStatus('complete');
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <View style={styles.brandMark}><Text style={styles.brandLetter}>C</Text></View>
          {status === 'checking' && (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.teal} size="large" />
              <Text style={styles.caption}>Checking your secure recovery link…</Text>
            </View>
          )}

          {status === 'invalid' && (
            <View style={styles.centered}>
              <View style={styles.iconShell}><Icon name={{ ios: 'exclamationmark.triangle.fill', android: 'link_off', web: 'link_off' }} color="#9B3E38" size={28} /></View>
              <Text style={styles.title}>Recovery link unavailable</Text>
              <Text style={styles.caption}>This link is invalid, expired, or has already been used. Request a new reset email from Clinque.</Text>
              <Pressable accessibilityRole="button" onPress={returnToSignIn} style={styles.primaryButton}><Text style={styles.primaryText}>Return to sign in</Text></Pressable>
            </View>
          )}

          {status === 'ready' && (
            <>
              <Text style={styles.eyebrow}>SECURE ACCOUNT RECOVERY</Text>
              <Text style={styles.title}>Choose a new password</Text>
              <Text style={styles.caption}>Use a password you have not used for this account before.</Text>
              <PasswordField label="New password" onChangeText={setPassword} value={password} />
              <PasswordField label="Confirm new password" onChangeText={setConfirmation} value={confirmation} />
              {message && <View style={styles.errorBox}><Icon name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }} color="#9B3E38" size={17} /><Text style={styles.errorText}>{message}</Text></View>}
              <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void savePassword()} style={[styles.primaryButton, submitting && styles.disabled]}>
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Update password securely</Text>}
              </Pressable>
            </>
          )}

          {status === 'complete' && (
            <View style={styles.centered}>
              <View style={[styles.iconShell, styles.successIcon]}><Icon name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }} size={29} /></View>
              <Text style={styles.title}>Password updated</Text>
              <Text style={styles.caption}>Your new password is active. Sign in again to continue your Clinque journey.</Text>
              <Pressable accessibilityRole="button" onPress={returnToSignIn} style={styles.primaryButton}><Text style={styles.primaryText}>Continue to sign in</Text></Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function PasswordField({ label, onChangeText, value }: { label: string; onChangeText: (value: string) => void; value: string }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <Icon name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} color="#78908F" size={18} />
        <TextInput autoCapitalize="none" autoComplete="new-password" onChangeText={onChangeText} placeholder="At least 8 characters" placeholderTextColor="#9AABAA" secureTextEntry style={styles.input} value={value} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 470, padding: 32, borderWidth: 1, borderColor: colors.line, borderRadius: 30, backgroundColor: colors.card },
  brandMark: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderRadius: 17, backgroundColor: colors.tealDark },
  brandLetter: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  centered: { alignItems: 'center' },
  iconShell: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#FFF0EE' },
  successIcon: { backgroundColor: colors.tealSoft },
  eyebrow: { color: colors.teal, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 10, color: colors.ink, fontSize: 23, fontWeight: '900', textAlign: 'center' },
  caption: { marginTop: 9, color: colors.muted, fontSize: 9, lineHeight: 15, textAlign: 'center' },
  fieldGroup: { marginTop: 18 },
  fieldLabel: { marginBottom: 7, color: colors.ink, fontSize: 8, fontWeight: '800' },
  inputShell: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 15, backgroundColor: '#FAFCFB' },
  input: { flex: 1, minHeight: 48, color: colors.ink, fontSize: 10, outlineStyle: 'none' } as never,
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: 11, borderRadius: 13, backgroundColor: '#FFF0EE' },
  errorText: { flex: 1, color: '#8A342E', fontSize: 8, lineHeight: 13 },
  primaryButton: { width: '100%', minHeight: 51, alignItems: 'center', justifyContent: 'center', marginTop: 20, borderRadius: 16, backgroundColor: colors.teal },
  primaryText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.65 },
});
