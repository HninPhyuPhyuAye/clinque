import { SymbolView } from "expo-symbols";
import { usePathname } from "expo-router";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type AccountRole, useAuth } from "@/features/auth/auth-context";
import { clinqueColors as colors } from "@/features/clinics/clinque-theme";
import { supabase } from "@/lib/supabase";

type SymbolName = ComponentProps<typeof SymbolView>["name"];
type Mode = "sign-in" | "sign-up" | "forgot-password";
type ClinicOption = { id: string; name: string; specialty: string };

function Icon({
  name,
  color = colors.teal,
  size = 22,
}: {
  name: SymbolName;
  color?: string;
  size?: number;
}) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}

function getPasswordResetErrorMessage(error: string) {
  const normalizedError = error.toLowerCase();

  if (normalizedError.includes("rate limit")) {
    return "Supabase’s hourly email limit has been reached. Please wait up to one hour before trying again. Your account and password are unchanged.";
  }

  return error;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 760;
  const pathname = usePathname();
  const {
    continueAsDemo,
    isDemo,
    loading,
    requestPasswordReset,
    session,
    signIn,
    signUp,
  } = useAuth();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [accountRole, setAccountRole] = useState<AccountRole>("patient");
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [clinicOptions, setClinicOptions] = useState<ClinicOption[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(false);

  // The clinic list is public (clinics are readable by anon), so the picker can
  // load before anyone signs in.
  useEffect(() => {
    if (mode !== "sign-up" || accountRole !== "nurse" || clinicOptions.length)
      return;

    let active = true;
    setClinicsLoading(true);

    void supabase
      .from("clinics")
      .select("id, name, specialty")
      .eq("is_active", true)
      .order("name")
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data) setClinicOptions(data as ClinicOption[]);
        setClinicsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accountRole, clinicOptions.length, mode]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  // Both email links land before a session exists, so they bypass the gate and
  // establish their own session from the token in the URL.
  if (
    pathname === "/reset-password" ||
    pathname === "/verify-email" ||
    session ||
    isDemo
  )
    return children;

  async function submit() {
    setMessage(null);
    if (mode === "forgot-password") {
      if (!email.trim()) {
        setMessageType("error");
        setMessage("Enter the email address linked to your Clinque account.");
        return;
      }
      setSubmitting(true);
      const result = await requestPasswordReset(email);
      setSubmitting(false);
      setMessageType(result.error ? "error" : "success");
      setMessage(
        result.error
          ? getPasswordResetErrorMessage(result.error)
          : "Password reset email sent. Open the secure link in your inbox to choose a new password.",
      );
      return;
    }

    if (
      !email.trim() ||
      password.length < 8 ||
      (mode === "sign-up" && fullName.trim().length < 2)
    ) {
      setMessageType("error");
      setMessage(
        mode === "sign-up"
          ? "Enter your name, a valid email, and a password with at least 8 characters."
          : "Enter your email and password. Passwords contain at least 8 characters.",
      );
      return;
    }

    if (mode === "sign-up" && accountRole === "nurse" && !clinicId) {
      setMessageType("error");
      setMessage("Choose the clinic you work at to register as a nurse.");
      return;
    }

    setSubmitting(true);
    const result =
      mode === "sign-up"
        ? await signUp(fullName, email, password, accountRole, clinicId)
        : await signIn(email, password);
    setSubmitting(false);

    if (result.error) {
      setMessageType("error");
      setMessage(result.error);
      return;
    }

    if (result.confirmationRequired) {
      setMessageType("success");
      setMessage(
        accountRole === "nurse"
          ? "Nurse account created. Confirm your email, then sign in — your clinic assignment is applied on first sign-in."
          : "Account created. Check your email to verify your account, then return here to sign in.",
      );
      setMode("sign-in");
      setPassword("");
    }
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage(null);
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              isCompact && styles.contentCompact,
            ]}
          >
            <View
              style={[styles.brandPanel, isCompact && styles.brandPanelCompact]}
            >
              <View style={styles.glowOne} />
              <View style={styles.glowTwo} />
              <View
                style={[styles.brandMark, isCompact && styles.brandMarkCompact]}
              >
                <Text style={styles.brandLetter}>C</Text>
              </View>
              <Text
                style={[styles.brandName, isCompact && styles.brandNameCompact]}
              >
                Clinque
              </Text>
              <Text
                style={[
                  styles.brandTitle,
                  isCompact && styles.brandTitleCompact,
                ]}
              >
                {isCompact
                  ? "Care moves better."
                  : "Care moves better when everyone knows what’s next."}
              </Text>
              {!isCompact && (
                <>
                  <Text style={styles.brandCaption}>
                    Book appointments, follow live queues, and keep your clinic
                    journey in one secure place.
                  </Text>
                  <View style={styles.trustRow}>
                    <TrustItem
                      icon={{
                        ios: "lock.shield.fill",
                        android: "shield_lock",
                        web: "shield_lock",
                      }}
                      label="Secure access"
                    />
                    <TrustItem
                      icon={{ ios: "bolt.fill", android: "bolt", web: "bolt" }}
                      label="Live updates"
                    />
                  </View>
                </>
              )}
            </View>

            <View
              style={[styles.formCard, isCompact && styles.formCardCompact]}
            >
              <Text style={styles.eyebrow}>PATIENT ACCESS</Text>
              <Text
                style={[styles.formTitle, isCompact && styles.formTitleCompact]}
              >
                {mode === "sign-in"
                  ? "Welcome back"
                  : mode === "sign-up"
                    ? "Create your account"
                    : "Reset your password"}
              </Text>
              <Text
                style={[
                  styles.formCaption,
                  isCompact && styles.formCaptionCompact,
                ]}
              >
                {mode === "sign-in"
                  ? "Sign in to continue your clinic journey."
                  : mode === "sign-up"
                    ? "Your patient profile will be protected by Supabase authentication."
                    : "We’ll email a secure, single-use recovery link to your account."}
              </Text>

              {mode !== "forgot-password" && (
                <View style={styles.modeSwitch}>
                  <ModeButton
                    active={mode === "sign-in"}
                    compact={isCompact}
                    label="Sign in"
                    onPress={() => switchMode("sign-in")}
                  />
                  <ModeButton
                    active={mode === "sign-up"}
                    compact={isCompact}
                    label="Create account"
                    onPress={() => switchMode("sign-up")}
                  />
                </View>
              )}

              {mode === "sign-up" && (
                <>
                  <View style={styles.roleBlock}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        isCompact && styles.fieldLabelCompact,
                      ]}
                    >
                      I am a
                    </Text>
                    <View style={styles.roleRow}>
                      <RoleOption
                        caption="Book visits and follow your queue"
                        compact={isCompact}
                        icon={{
                          ios: "person.fill",
                          android: "person",
                          web: "person",
                        }}
                        label="Patient"
                        onPress={() => {
                          setAccountRole("patient");
                          setClinicId(null);
                          setMessage(null);
                        }}
                        selected={accountRole === "patient"}
                      />
                      <RoleOption
                        caption="Run the queue at your clinic"
                        compact={isCompact}
                        icon={{
                          ios: "cross.case.fill",
                          android: "medical_services",
                          web: "medical_services",
                        }}
                        label="Nurse"
                        onPress={() => {
                          setAccountRole("nurse");
                          setMessage(null);
                        }}
                        selected={accountRole === "nurse"}
                      />
                    </View>
                  </View>

                  <Field
                    autoComplete="name"
                    compact={isCompact}
                    icon={{
                      ios: "person.fill",
                      android: "person",
                      web: "person",
                    }}
                    label="Full name"
                    onChangeText={setFullName}
                    placeholder={
                      accountRole === "nurse" ? "Nurse Chen" : "Maya Tan"
                    }
                    value={fullName}
                  />

                  {accountRole === "nurse" && (
                    <View style={styles.roleBlock}>
                      <Text
                        style={[
                          styles.fieldLabel,
                          isCompact && styles.fieldLabelCompact,
                        ]}
                      >
                        Which clinic do you work at?
                      </Text>
                      {clinicsLoading ? (
                        <View style={styles.clinicLoading}>
                          <ActivityIndicator color={colors.teal} />
                        </View>
                      ) : clinicOptions.length ? (
                        <View style={styles.clinicList}>
                          {clinicOptions.map((clinic) => {
                            const selected = clinic.id === clinicId;
                            return (
                              <Pressable
                                accessibilityRole="button"
                                key={clinic.id}
                                onPress={() => {
                                  setClinicId(clinic.id);
                                  setMessage(null);
                                }}
                                style={[
                                  styles.clinicOption,
                                  selected && styles.clinicOptionSelected,
                                ]}
                              >
                                <View style={styles.clinicOptionCopy}>
                                  <Text
                                    style={[
                                      styles.clinicOptionName,
                                      isCompact &&
                                        styles.clinicOptionNameCompact,
                                    ]}
                                  >
                                    {clinic.name}
                                  </Text>
                                  <Text style={styles.clinicOptionMeta}>
                                    {clinic.specialty}
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.clinicRadio,
                                    selected && styles.clinicRadioSelected,
                                  ]}
                                >
                                  {selected ? (
                                    <View style={styles.clinicRadioDot} />
                                  ) : null}
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : (
                        <Text style={styles.clinicEmpty}>
                          No clinics are available right now. Try again shortly.
                        </Text>
                      )}
                    </View>
                  )}
                </>
              )}
              <Field
                autoCapitalize="none"
                autoComplete="email"
                compact={isCompact}
                icon={{ ios: "envelope.fill", android: "mail", web: "mail" }}
                keyboardType="email-address"
                label="Email"
                onChangeText={setEmail}
                placeholder="you@example.com"
                value={email}
              />
              {mode !== "forgot-password" && (
                <Field
                  autoCapitalize="none"
                  autoComplete={
                    mode === "sign-up" ? "new-password" : "current-password"
                  }
                  compact={isCompact}
                  icon={{ ios: "lock.fill", android: "lock", web: "lock" }}
                  label="Password"
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  secureTextEntry
                  value={password}
                />
              )}

              {mode === "sign-in" && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => switchMode("forgot-password")}
                  style={styles.forgotButton}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>
              )}

              {message && (
                <View
                  style={[
                    styles.messageBox,
                    messageType === "success" && styles.successBox,
                  ]}
                >
                  <Icon
                    color={messageType === "success" ? colors.teal : "#A33A32"}
                    name={
                      messageType === "success"
                        ? {
                            ios: "checkmark.circle.fill",
                            android: "check_circle",
                            web: "check_circle",
                          }
                        : {
                            ios: "exclamationmark.circle.fill",
                            android: "error",
                            web: "error",
                          }
                    }
                    size={18}
                  />
                  <Text
                    style={[
                      styles.messageText,
                      messageType === "success" && styles.successText,
                    ]}
                  >
                    {message}
                  </Text>
                </View>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => void submit()}
                style={[
                  styles.primaryButton,
                  submitting && styles.buttonDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>
                      {mode === "sign-in"
                        ? "Sign in securely"
                        : mode === "sign-up"
                          ? "Create patient account"
                          : "Send recovery email"}
                    </Text>
                    <Icon
                      name={{
                        ios: "arrow.right",
                        android: "arrow_forward",
                        web: "arrow_forward",
                      }}
                      color="#FFFFFF"
                      size={18}
                    />
                  </>
                )}
              </Pressable>

              {mode === "forgot-password" && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => switchMode("sign-in")}
                  style={styles.returnButton}
                >
                  <Icon
                    name={{
                      ios: "arrow.left",
                      android: "arrow_back",
                      web: "arrow_back",
                    }}
                    color={colors.teal}
                    size={16}
                  />
                  <Text style={styles.returnText}>Return to sign in</Text>
                </Pressable>
              )}

              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>PORTFOLIO PREVIEW</Text>
                <View style={styles.divider} />
              </View>
              {/* Two entry points so an interviewer can see both interfaces
                  without creating an account or reaching Supabase. */}
              <Text style={styles.demoLead}>
                Explore without an account, using local demonstration data only.
              </Text>
              <View style={styles.demoRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => continueAsDemo("patient")}
                  style={styles.demoButton}
                >
                  <View style={styles.demoIcon}>
                    <Icon
                      name={{
                        ios: "person.fill",
                        android: "person",
                        web: "person",
                      }}
                      size={19}
                    />
                  </View>
                  <Text style={styles.demoTitle}>Patient view</Text>
                  <Text style={styles.demoCaption}>
                    Book, check in, follow the live queue
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => continueAsDemo("nurse")}
                  style={styles.demoButton}
                >
                  <View style={styles.demoIcon}>
                    <Icon
                      name={{
                        ios: "cross.case.fill",
                        android: "medical_services",
                        web: "medical_services",
                      }}
                      size={19}
                    />
                  </View>
                  <Text style={styles.demoTitle}>Nurse view</Text>
                  <Text style={styles.demoCaption}>
                    Run the clinic queue command centre
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function RoleOption({
  caption,
  compact,
  icon,
  label,
  onPress,
  selected,
}: {
  caption: string;
  compact: boolean;
  icon: SymbolName;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.roleOption, selected && styles.roleOptionSelected]}
    >
      <View
        style={[styles.roleIcon, selected && styles.roleIconSelected]}
      >
        <Icon
          name={icon}
          color={selected ? "#FFFFFF" : colors.teal}
          size={compact ? 20 : 18}
        />
      </View>
      <Text
        style={[
          styles.roleLabel,
          compact && styles.roleLabelCompact,
          selected && styles.roleLabelSelected,
        ]}
      >
        {label}
      </Text>
      <Text style={styles.roleCaption}>{caption}</Text>
    </Pressable>
  );
}

function TrustItem({ icon, label }: { icon: SymbolName; label: string }) {
  return (
    <View style={styles.trustItem}>
      <Icon name={icon} color="#A5DFD4" size={16} />
      <Text style={styles.trustText}>{label}</Text>
    </View>
  );
}

function ModeButton({
  active,
  compact,
  label,
  onPress,
}: {
  active: boolean;
  compact: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.modeButton, active && styles.modeButtonActive]}
    >
      <Text
        style={[
          styles.modeText,
          compact && styles.modeTextCompact,
          active && styles.modeTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Field({
  compact,
  icon,
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  compact: boolean;
  icon: SymbolName;
  label: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, compact && styles.fieldLabelCompact]}>
        {label}
      </Text>
      <View style={styles.inputShell}>
        <Icon name={icon} color="#78908F" size={18} />
        <TextInput
          {...props}
          placeholderTextColor="#9AABAA"
          style={[styles.input, compact && styles.inputCompact]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  content: {
    flexGrow: 1,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    width: "100%",
    maxWidth: 1050,
    alignSelf: "center",
    gap: 18,
    padding: 20,
    justifyContent: "center",
  },
  contentCompact: {
    flexDirection: "column",
    maxWidth: 560,
    gap: 12,
    padding: 12,
    justifyContent: "flex-start",
  },
  brandPanel: {
    position: "relative",
    overflow: "hidden",
    flex: 1,
    minHeight: 400,
    justifyContent: "center",
    padding: 36,
    borderRadius: 32,
    backgroundColor: colors.tealDark,
  },
  brandPanelCompact: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    minHeight: 0,
    height: 185,
    justifyContent: "flex-start",
    padding: 22,
    borderRadius: 26,
  },
  glowOne: {
    position: "absolute",
    top: -100,
    right: -70,
    width: 260,
    height: 260,
    borderRadius: 140,
    backgroundColor: colors.teal,
    opacity: 0.75,
  },
  glowTwo: {
    position: "absolute",
    bottom: -130,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 160,
    backgroundColor: "#174A54",
    opacity: 0.8,
  },
  brandMark: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#E9FAF6",
  },
  brandMarkCompact: { width: 42, height: 42, borderRadius: 15 },
  brandLetter: { color: colors.tealDark, fontSize: 25, fontWeight: "900" },
  brandName: {
    marginTop: 16,
    color: "#A5DFD4",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  brandNameCompact: { marginTop: 8, fontSize: 12 },
  brandTitle: {
    marginTop: 18,
    maxWidth: 470,
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  brandTitleCompact: {
    marginTop: 10,
    maxWidth: 360,
    fontSize: 25,
    lineHeight: 30,
  },
  brandCaption: {
    maxWidth: 430,
    marginTop: 16,
    color: "#C5E3DE",
    fontSize: 11,
    lineHeight: 18,
  },
  trustRow: { flexDirection: "row", gap: 16, marginTop: 30 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  trustText: { color: "#E2F5F1", fontSize: 8, fontWeight: "800" },
  formCard: {
    flex: 1,
    justifyContent: "center",
    padding: 32,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 32,
    backgroundColor: colors.card,
  },
  formCardCompact: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    width: "100%",
    justifyContent: "flex-start",
    padding: 22,
    borderRadius: 26,
  },
  eyebrow: {
    color: colors.teal,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  formTitle: {
    marginTop: 7,
    color: colors.ink,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  formTitleCompact: { fontSize: 29, lineHeight: 35 },
  formCaption: {
    marginTop: 7,
    color: colors.muted,
    fontSize: 9,
    lineHeight: 14,
  },
  formCaptionCompact: { fontSize: 13, lineHeight: 19 },
  modeSwitch: {
    flexDirection: "row",
    marginTop: 22,
    padding: 4,
    borderRadius: 15,
    backgroundColor: "#EDF4F2",
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
  },
  modeButtonActive: { backgroundColor: colors.card },
  modeText: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  modeTextCompact: { fontSize: 13 },
  modeTextActive: { color: colors.teal },
  fieldGroup: { marginTop: 15 },
  fieldLabel: {
    marginBottom: 7,
    color: colors.ink,
    fontSize: 8,
    fontWeight: "800",
  },
  fieldLabelCompact: { fontSize: 12 },
  roleBlock: { gap: 9 },
  roleRow: { flexDirection: "row", gap: 10 },
  roleOption: {
    flex: 1,
    gap: 6,
    padding: 13,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  roleOptionSelected: {
    borderColor: colors.teal,
    backgroundColor: colors.tealSoft,
  },
  roleIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.tealSoft,
  },
  roleIconSelected: { backgroundColor: colors.teal },
  roleLabel: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  roleLabelCompact: { fontSize: 15 },
  roleLabelSelected: { color: colors.tealDark },
  roleCaption: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  clinicList: { gap: 8 },
  clinicLoading: { paddingVertical: 16, alignItems: "center" },
  clinicOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    backgroundColor: colors.card,
  },
  clinicOptionSelected: {
    borderColor: colors.teal,
    backgroundColor: colors.tealSoft,
  },
  clinicOptionCopy: { flex: 1 },
  clinicOptionName: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  clinicOptionNameCompact: { fontSize: 15 },
  clinicOptionMeta: { marginTop: 2, color: colors.muted, fontSize: 11 },
  clinicRadio: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 10,
  },
  clinicRadioSelected: { borderColor: colors.teal },
  clinicRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.teal,
  },
  clinicEmpty: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 49,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    backgroundColor: "#FAFCFB",
  },
  input: {
    flex: 1,
    minHeight: 47,
    color: colors.ink,
    fontSize: 10,
    outlineStyle: "none",
  } as never,
  inputCompact: { fontSize: 14 } as never,
  forgotButton: { alignSelf: "flex-end", marginTop: 10, paddingVertical: 3 },
  forgotText: { color: colors.teal, fontSize: 8, fontWeight: "800" },
  messageBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 14,
    padding: 11,
    borderRadius: 13,
    backgroundColor: "#FCEAE8",
  },
  successBox: { backgroundColor: colors.tealSoft },
  messageText: { flex: 1, color: "#8A342E", fontSize: 8, lineHeight: 13 },
  successText: { color: "#25665F" },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    minHeight: 52,
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: colors.teal,
  },
  buttonDisabled: { opacity: 0.65 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  returnButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 13,
    paddingVertical: 5,
  },
  returnText: { color: colors.teal, fontSize: 8, fontWeight: "800" },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginVertical: 17,
  },
  divider: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: {
    color: "#8A9E9D",
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  demoLead: {
    marginBottom: 9,
    color: "#68817F",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  demoRow: { flexDirection: "row", gap: 10 },
  demoButton: {
    flex: 1,
    gap: 7,
    padding: 13,
    borderWidth: 1,
    borderColor: "#CFE9E2",
    borderRadius: 16,
    backgroundColor: colors.tealSoft,
  },
  demoIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  demoCopy: { flex: 1 },
  demoTitle: { color: "#174A49", fontSize: 12, fontWeight: "800" },
  demoCaption: { marginTop: 1, color: "#68817F", fontSize: 10, lineHeight: 14 },
});
