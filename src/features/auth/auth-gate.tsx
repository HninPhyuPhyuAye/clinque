import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { clinqueColors as colors } from '@/features/clinics/clinque-theme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type Mode = 'sign-in' | 'sign-up';

function Icon({ name, color = colors.teal, size = 22 }: { name: SymbolName; color?: string; size?: number }) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { continueAsDemo, isDemo, loading, session, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');

  if (loading) {
    return <View style={styles.loadingScreen}><ActivityIndicator color={colors.teal} size="large" /></View>;
  }

  if (session || isDemo) return children;

  async function submit() {
    setMessage(null);
    if (!email.trim() || password.length < 8 || (mode === 'sign-up' && fullName.trim().length < 2)) {
      setMessageType('error');
      setMessage(mode === 'sign-up'
        ? 'Enter your name, a valid email, and a password with at least 8 characters.'
        : 'Enter your email and password. Passwords contain at least 8 characters.');
      return;
    }

    setSubmitting(true);
    const result = mode === 'sign-up'
      ? await signUp(fullName, email, password)
      : await signIn(email, password);
    setSubmitting(false);

    if (result.error) {
      setMessageType('error');
      setMessage(result.error);
      return;
    }

    if (result.confirmationRequired) {
      setMessageType('success');
      setMessage('Account created. Check your email to verify your account, then return here to sign in.');
      setMode('sign-in');
      setPassword('');
    }
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage(null);
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.brandPanel}>
              <View style={styles.glowOne} />
              <View style={styles.glowTwo} />
              <View style={styles.brandMark}><Text style={styles.brandLetter}>C</Text></View>
              <Text style={styles.brandName}>Clinque</Text>
              <Text style={styles.brandTitle}>Care moves better{`\n`}when everyone knows what’s next.</Text>
              <Text style={styles.brandCaption}>Book appointments, follow live queues, and keep your clinic journey in one secure place.</Text>
              <View style={styles.trustRow}>
                <TrustItem icon={{ ios: 'lock.shield.fill', android: 'shield_lock', web: 'shield_lock' }} label="Secure access" />
                <TrustItem icon={{ ios: 'bolt.fill', android: 'bolt', web: 'bolt' }} label="Live updates" />
              </View>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.eyebrow}>PATIENT ACCESS</Text>
              <Text style={styles.formTitle}>{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</Text>
              <Text style={styles.formCaption}>{mode === 'sign-in' ? 'Sign in to continue your clinic journey.' : 'Your patient profile will be protected by Supabase authentication.'}</Text>

              <View style={styles.modeSwitch}>
                <ModeButton active={mode === 'sign-in'} label="Sign in" onPress={() => switchMode('sign-in')} />
                <ModeButton active={mode === 'sign-up'} label="Create account" onPress={() => switchMode('sign-up')} />
              </View>

              {mode === 'sign-up' && (
                <Field
                  autoComplete="name"
                  icon={{ ios: 'person.fill', android: 'person', web: 'person' }}
                  label="Full name"
                  onChangeText={setFullName}
                  placeholder="Maya Tan"
                  value={fullName}
                />
              )}
              <Field
                autoCapitalize="none"
                autoComplete="email"
                icon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
                keyboardType="email-address"
                label="Email"
                onChangeText={setEmail}
                placeholder="you@example.com"
                value={email}
              />
              <Field
                autoCapitalize="none"
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                label="Password"
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                secureTextEntry
                value={password}
              />

              {message && (
                <View style={[styles.messageBox, messageType === 'success' && styles.successBox]}>
                  <Icon
                    color={messageType === 'success' ? colors.teal : '#A33A32'}
                    name={messageType === 'success'
                      ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }
                      : { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }}
                    size={18}
                  />
                  <Text style={[styles.messageText, messageType === 'success' && styles.successText]}>{message}</Text>
                </View>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => void submit()}
                style={[styles.primaryButton, submitting && styles.buttonDisabled]}>
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : (
                  <><Text style={styles.primaryButtonText}>{mode === 'sign-in' ? 'Sign in securely' : 'Create patient account'}</Text><Icon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} color="#FFFFFF" size={18} /></>
                )}
              </Pressable>

              <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.dividerText}>PORTFOLIO PREVIEW</Text><View style={styles.divider} /></View>
              <Pressable accessibilityRole="button" onPress={continueAsDemo} style={styles.demoButton}>
                <Icon name={{ ios: 'play.rectangle.fill', android: 'preview', web: 'preview' }} size={19} />
                <View style={styles.demoCopy}><Text style={styles.demoTitle}>Explore without an account</Text><Text style={styles.demoCaption}>Use local demonstration data only</Text></View>
                <Icon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} color={colors.muted} size={17} />
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function TrustItem({ icon, label }: { icon: SymbolName; label: string }) {
  return <View style={styles.trustItem}><Icon name={icon} color="#A5DFD4" size={16} /><Text style={styles.trustText}>{label}</Text></View>;
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}><Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text></Pressable>;
}

function Field({ icon, label, ...props }: React.ComponentProps<typeof TextInput> & { icon: SymbolName; label: string }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}><Icon name={icon} color="#78908F" size={18} /><TextInput {...props} placeholderTextColor="#9AABAA" style={styles.input} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column', width: '100%', maxWidth: 1050, alignSelf: 'center', gap: 18, padding: 20, justifyContent: 'center' },
  brandPanel: { position: 'relative', overflow: 'hidden', flex: 1, minHeight: 400, justifyContent: 'center', padding: 36, borderRadius: 32, backgroundColor: colors.tealDark },
  glowOne: { position: 'absolute', top: -100, right: -70, width: 260, height: 260, borderRadius: 140, backgroundColor: colors.teal, opacity: 0.75 },
  glowTwo: { position: 'absolute', bottom: -130, left: -80, width: 300, height: 300, borderRadius: 160, backgroundColor: '#174A54', opacity: 0.8 },
  brandMark: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#E9FAF6' },
  brandLetter: { color: colors.tealDark, fontSize: 25, fontWeight: '900' },
  brandName: { marginTop: 16, color: '#A5DFD4', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  brandTitle: { marginTop: 18, maxWidth: 470, color: '#FFFFFF', fontSize: 30, lineHeight: 38, fontWeight: '900', letterSpacing: -0.8 },
  brandCaption: { maxWidth: 430, marginTop: 16, color: '#C5E3DE', fontSize: 11, lineHeight: 18 },
  trustRow: { flexDirection: 'row', gap: 16, marginTop: 30 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  trustText: { color: '#E2F5F1', fontSize: 8, fontWeight: '800' },
  formCard: { flex: 1, justifyContent: 'center', padding: 32, borderWidth: 1, borderColor: colors.line, borderRadius: 32, backgroundColor: colors.card },
  eyebrow: { color: colors.teal, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  formTitle: { marginTop: 7, color: colors.ink, fontSize: 25, fontWeight: '900', letterSpacing: -0.5 },
  formCaption: { marginTop: 7, color: colors.muted, fontSize: 9, lineHeight: 14 },
  modeSwitch: { flexDirection: 'row', marginTop: 22, padding: 4, borderRadius: 15, backgroundColor: '#EDF4F2' },
  modeButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  modeButtonActive: { backgroundColor: colors.card },
  modeText: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  modeTextActive: { color: colors.teal },
  fieldGroup: { marginTop: 15 },
  fieldLabel: { marginBottom: 7, color: colors.ink, fontSize: 8, fontWeight: '800' },
  inputShell: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 49, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 15, backgroundColor: '#FAFCFB' },
  input: { flex: 1, minHeight: 47, color: colors.ink, fontSize: 10, outlineStyle: 'none' } as never,
  messageBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: 11, borderRadius: 13, backgroundColor: '#FCEAE8' },
  successBox: { backgroundColor: colors.tealSoft },
  messageText: { flex: 1, color: '#8A342E', fontSize: 8, lineHeight: 13 },
  successText: { color: '#25665F' },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 52, marginTop: 18, borderRadius: 16, backgroundColor: colors.teal },
  buttonDisabled: { opacity: 0.65 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 17 },
  divider: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { color: '#8A9E9D', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  demoButton: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 58, padding: 12, borderRadius: 16, backgroundColor: colors.tealSoft },
  demoCopy: { flex: 1 },
  demoTitle: { color: '#174A49', fontSize: 9, fontWeight: '800' },
  demoCaption: { marginTop: 3, color: '#68817F', fontSize: 7 },
});
