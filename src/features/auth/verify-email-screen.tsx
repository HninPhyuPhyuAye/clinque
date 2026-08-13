import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { clinqueColors as colors } from '@/features/clinics/clinque-theme';
import { supabase } from '@/lib/supabase';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

function Icon({ name, color = colors.teal, size = 22 }: { name: SymbolName; color?: string; size?: number }) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}

/**
 * Landing page for the confirmation link in a sign-up email.
 *
 * Supabase sends the browser here after it verifies the token, either with
 * access_token/refresh_token in the URL hash or with a PKCE code. Both are
 * accepted so the same link works from a phone and a desktop.
 */
export function VerifyEmailScreen() {
  const router = useRouter();
  const linkingUrl = Linking.useLinkingURL();
  const { signOut } = useAuth();
  const [status, setStatus] = useState<'checking' | 'verified' | 'invalid'>('checking');
  const [detail, setDetail] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function acceptConfirmationLink() {
      const currentUrl =
        linkingUrl ?? (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null);

      if (!currentUrl) {
        if (active) setStatus('invalid');
        return;
      }

      const parsedUrl = new URL(currentUrl);
      const hash = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      const code = parsedUrl.searchParams.get('code');

      // Supabase reports a rejected link in the query string or the hash.
      const linkError = parsedUrl.searchParams.get('error_description') ?? hash.get('error_description');
      let error: Error | null = linkError ? new Error(linkError) : null;

      if (!error && accessToken && refreshToken) {
        const result = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        error = result.error;
      } else if (!error && code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        error = result.error;
      } else if (!error) {
        // Some Supabase configurations confirm server-side and redirect with no
        // token at all. Reaching this screen without an error still means the
        // address was confirmed.
        const { data } = await supabase.auth.getSession();
        if (!data.session) error = null;
      }

      if (!active) return;

      if (error) {
        setStatus('invalid');
        setDetail(error.message);
        return;
      }

      setStatus('verified');

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/verify-email');
      }
    }

    void acceptConfirmationLink();
    return () => {
      active = false;
    };
  }, [linkingUrl]);

  // The confirmation link may have signed the account in. Sign out first so the
  // person lands on a clean sign-in form, which is what the email promised.
  function returnToSignIn() {
    setLeaving(true);
    void signOut().then(() => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign('/');
        return;
      }
      router.replace('/');
    });
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.brandMark}>
            <Text style={styles.brandLetter}>C</Text>
          </View>

          {status === 'checking' && (
            <View style={styles.card}>
              <ActivityIndicator color={colors.teal} size="large" />
              <Text style={styles.title}>Confirming your email</Text>
              <Text style={styles.caption}>This only takes a moment.</Text>
            </View>
          )}

          {status === 'verified' && (
            <View style={styles.card}>
              <View style={styles.successIcon}>
                <Icon
                  name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
                  color={colors.teal}
                  size={34}
                />
              </View>
              <Text style={styles.title}>Email verified</Text>
              <Text style={styles.caption}>
                Your Clinque account is confirmed. Sign in to continue — patients go straight to their clinic
                journey, and nurses land on their clinic queue.
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={leaving}
                onPress={returnToSignIn}
                style={({ pressed }) => [styles.primaryButton, (pressed || leaving) && styles.primaryButtonPressed]}
              >
                <Text style={styles.primaryButtonText}>{leaving ? 'Returning…' : 'Return to sign in'}</Text>
                <Icon
                  name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                  color="#FFFFFF"
                  size={18}
                />
              </Pressable>
            </View>
          )}

          {status === 'invalid' && (
            <View style={styles.card}>
              <View style={styles.warningIcon}>
                <Icon
                  name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
                  color={colors.warm}
                  size={31}
                />
              </View>
              <Text style={styles.title}>Confirmation link unavailable</Text>
              <Text style={styles.caption}>
                This link has already been used or has expired. Sign in to check whether the account is already
                active, or create the account again to receive a fresh email.
              </Text>
              {detail ? <Text style={styles.detail}>{detail}</Text> : null}
              <Pressable
                accessibilityRole="button"
                disabled={leaving}
                onPress={returnToSignIn}
                style={({ pressed }) => [styles.primaryButton, (pressed || leaving) && styles.primaryButtonPressed]}
              >
                <Text style={styles.primaryButtonText}>{leaving ? 'Returning…' : 'Return to sign in'}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 22,
  },
  brandMark: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.teal,
  },
  brandLetter: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  card: {
    width: '100%',
    alignItems: 'center',
    gap: 13,
    padding: 26,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 26,
    backgroundColor: colors.card,
  },
  successIcon: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: colors.tealSoft,
  },
  warningIcon: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: colors.warmSoft,
  },
  title: { color: colors.ink, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  detail: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', fontStyle: 'italic' },
  primaryButton: {
    marginTop: 6,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 15,
    borderRadius: 17,
    backgroundColor: colors.teal,
  },
  primaryButtonPressed: { opacity: 0.85 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
