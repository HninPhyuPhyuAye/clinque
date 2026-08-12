import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { clinics } from '@/features/clinics/clinic-data';
import { clinqueColors as colors } from '@/features/clinics/clinque-theme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

type ProfilePreferences = {
  preferredClinicId: string;
  appointmentReminders: boolean;
  queueAlerts: boolean;
  biometricUnlock: boolean;
};

const profileStorageKey = '@clinque/profile-preferences';
const defaultPreferences: ProfilePreferences = {
  preferredClinicId: 'novena-medical',
  appointmentReminders: true,
  queueAlerts: true,
  biometricUnlock: false,
};

function Icon({ name, color = colors.teal, size = 22 }: { name: SymbolName; color?: string; size?: number }) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}

export function ProfileScreen() {
  const router = useRouter();
  const { isDemo, signOut, user } = useAuth();
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [clinicPickerVisible, setClinicPickerVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const preferredClinic = clinics.find((clinic) => clinic.id === preferences.preferredClinicId) ?? clinics[0];
  const authenticatedName = typeof user?.user_metadata.full_name === 'string'
    ? user.user_metadata.full_name
    : user?.email?.split('@')[0];
  const displayName = isDemo ? 'Maya Tan' : authenticatedName || 'Clinque patient';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  useEffect(() => {
    let active = true;

    async function loadPreferences() {
      try {
        const storedPreferences = await AsyncStorage.getItem(profileStorageKey);
        if (storedPreferences && active) {
          setPreferences({ ...defaultPreferences, ...(JSON.parse(storedPreferences) as Partial<ProfilePreferences>) });
        }
      } catch {
        // Default preferences keep the profile usable if local storage is unavailable.
      }
    }

    void loadPreferences();
    return () => {
      active = false;
    };
  }, []);

  function updatePreferences(update: Partial<ProfilePreferences>) {
    setPreferences((current) => {
      const nextPreferences = { ...current, ...update };
      void AsyncStorage.setItem(profileStorageKey, JSON.stringify(nextPreferences));
      return nextPreferences;
    });
  }

  function openOperations() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign('/operations');
      return;
    }
    router.push('/operations');
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>YOUR HEALTH IDENTITY</Text>
              <Text style={styles.title}>Profile</Text>
            </View>
            <View style={styles.demoPill}>
              <View style={styles.demoDot} />
              <Text style={styles.demoText}>{isDemo ? 'DEMO PROFILE' : 'SECURE ACCOUNT'}</Text>
            </View>
          </View>

          <View style={styles.profileHero}>
            <View style={styles.profileGlow} />
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials || 'C'}</Text></View>
            <View style={styles.profileIdentity}>
              <View style={styles.nameRow}>
                <Text style={styles.profileName}>{displayName}</Text>
                <Icon name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} color="#9DE1D1" size={18} />
              </View>
              <Text style={styles.profileMeta}>{isDemo ? 'Patient ID · CQ-20418' : user?.email}</Text>
              <Text style={styles.profileMeta}>{isDemo ? 'Singapore · English' : 'Supabase authenticated patient'}</Text>
            </View>
            <Pressable
              accessibilityLabel="View patient details"
              accessibilityRole="button"
              onPress={() => setDetailsVisible(true)}
              style={styles.editButton}>
              <Icon name={{ ios: 'pencil', android: 'edit', web: 'edit' }} color="#E9FAF6" size={17} />
            </Pressable>
            <View style={styles.completenessPanel}>
              <View>
                <Text style={styles.completenessLabel}>PROFILE COMPLETENESS</Text>
                <Text style={styles.completenessCaption}>Insurance details can be added later</Text>
              </View>
              <Text style={styles.completenessValue}>82%</Text>
            </View>
          </View>

          <SectionHeader title="Care preferences" />
          <View style={styles.card}>
            <SettingsRow
              caption={preferredClinic.specialty}
              icon={{ ios: 'cross.case.fill', android: 'medical_services', web: 'medical_services' }}
              iconBackground={colors.tealSoft}
              label="Preferred clinic"
              onPress={() => setClinicPickerVisible(true)}
              value={preferredClinic.name}
            />
            <Divider />
            <SettingsRow
              caption="Family Medicine"
              icon={{ ios: 'person.text.rectangle.fill', android: 'badge', web: 'badge' }}
              iconBackground={colors.blueSoft}
              label="Family doctor"
              value="Dr. Sarah Lim"
            />
          </View>

          <SectionHeader title="Coverage & records" />
          <View style={styles.card}>
            <SettingsRow
              caption="Add a policy for faster registration"
              icon={{ ios: 'shield.lefthalf.filled', android: 'health_and_safety', web: 'health_and_safety' }}
              iconBackground={colors.warmSoft}
              label="Insurance"
              value="Not connected"
            />
            <Divider />
            <SettingsRow
              caption="2 visits · 1 document"
              icon={{ ios: 'folder.fill', android: 'folder', web: 'folder' }}
              iconBackground={colors.tealSoft}
              label="Health records"
              value="Clinque history"
            />
          </View>

          <SectionHeader title="Notifications & security" />
          <View style={styles.card}>
            <ToggleRow
              caption="Appointment changes and reminders"
              label="Appointment reminders"
              onValueChange={(value) => updatePreferences({ appointmentReminders: value })}
              value={preferences.appointmentReminders}
            />
            <Divider />
            <ToggleRow
              caption="Live wait-time and check-in updates"
              label="Queue alerts"
              onValueChange={(value) => updatePreferences({ queueAlerts: value })}
              value={preferences.queueAlerts}
            />
            <Divider />
            <ToggleRow
              caption="Use Face ID or device biometrics"
              label="Biometric unlock"
              onValueChange={(value) => updatePreferences({ biometricUnlock: value })}
              value={preferences.biometricUnlock}
            />
          </View>

          <Pressable
            accessibilityLabel="Open clinic operations demo"
            accessibilityRole="button"
            onPress={openOperations}
            style={({ pressed }) => [styles.operationsCard, pressed && styles.operationsCardPressed]}>
            <View style={styles.operationsIcon}>
              <Icon name={{ ios: 'chart.bar.xaxis', android: 'monitoring', web: 'monitoring' }} color="#E9FAF6" size={23} />
            </View>
            <View style={styles.operationsContent}>
              <View style={styles.operationsTitleRow}>
                <Text style={styles.operationsTitle}>Clinic operations demo</Text>
                <View style={styles.staffPill}><Text style={styles.staffPillText}>STAFF PORTAL</Text></View>
              </View>
              <Text style={styles.operationsCaption}>Run the live clinic queue and see patient updates synchronize instantly.</Text>
            </View>
            <Icon name={{ ios: 'arrow.up.right', android: 'north_east', web: 'north_east' }} color="#9DE1D1" size={18} />
          </Pressable>

          <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.signOutButton}>
            <Icon name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} color="#9B3E38" size={18} />
            <View style={styles.signOutCopy}>
              <Text style={styles.signOutTitle}>{isDemo ? 'Exit portfolio preview' : 'Sign out'}</Text>
              <Text style={styles.signOutCaption}>{isDemo ? 'Return to the secure patient access screen' : 'End this authenticated session on this device'}</Text>
            </View>
          </Pressable>

          <Pressable accessibilityRole="button" onPress={() => setPrivacyVisible(true)} style={styles.privacyCard}>
            <View style={styles.privacyIcon}>
              <Icon name={{ ios: 'lock.shield.fill', android: 'shield_lock', web: 'shield_lock' }} size={23} />
            </View>
            <View style={styles.privacyContent}>
              <Text style={styles.privacyTitle}>Privacy & data controls</Text>
              <Text style={styles.privacyCaption}>See how this prototype handles your local data.</Text>
            </View>
            <Icon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} color="#8BA09F" size={19} />
          </Pressable>

          <Text style={styles.versionText}>Clinque prototype · Version 1.0.0</Text>
        </ScrollView>
      </SafeAreaView>

      <ClinicPickerModal
        onClose={() => setClinicPickerVisible(false)}
        onSelect={(clinicId) => {
          updatePreferences({ preferredClinicId: clinicId });
          setClinicPickerVisible(false);
        }}
        selectedClinicId={preferences.preferredClinicId}
        visible={clinicPickerVisible}
      />
      <InformationModal
        icon={{ ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' }}
        onClose={() => setDetailsVisible(false)}
        title="Patient details"
        visible={detailsVisible}>
        <InfoLine label="Full name" value={displayName} />
        <InfoLine label="Account" value={isDemo ? 'Portfolio demonstration' : 'Supabase authenticated'} />
        <InfoLine label="Email" value={isDemo ? 'maya.tan@example.com' : user?.email ?? 'Not available'} />
        <Text style={styles.modalFootnote}>Editing will be enabled after secure authentication is connected.</Text>
      </InformationModal>
      <InformationModal
        icon={{ ios: 'lock.shield.fill', android: 'shield_lock', web: 'shield_lock' }}
        onClose={() => setPrivacyVisible(false)}
        title="Privacy & data"
        visible={privacyVisible}>
        <Text style={styles.privacyModalText}>
          This portfolio prototype keeps appointment and preference data only in this browser or device. It does not send medical information to a clinic or cloud service.
        </Text>
        <View style={styles.privacyBadge}>
          <Icon name={{ ios: 'iphone', android: 'smartphone', web: 'smartphone' }} size={17} />
          <Text style={styles.privacyBadgeText}>Stored locally for demonstration</Text>
        </View>
      </InformationModal>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function SettingsRow({
  caption,
  icon,
  iconBackground,
  label,
  onPress,
  value,
}: {
  caption: string;
  icon: SymbolName;
  iconBackground: string;
  label: string;
  onPress?: () => void;
  value: string;
}) {
  const content = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: iconBackground }]}><Icon name={icon} size={19} /></View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
        <Text style={styles.rowCaption}>{caption}</Text>
      </View>
      {onPress && <Icon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} color="#8BA09F" size={18} />}
    </>
  );

  if (onPress) {
    return <Pressable accessibilityRole="button" onPress={onPress} style={styles.settingsRow}>{content}</Pressable>;
  }

  return <View style={styles.settingsRow}>{content}</View>;
}

function ToggleRow({
  caption,
  label,
  onValueChange,
  value,
}: {
  caption: string;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowCaption}>{caption}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        ios_backgroundColor="#D5E2DF"
        onValueChange={onValueChange}
        thumbColor="#FFFFFF"
        trackColor={{ false: '#D5E2DF', true: colors.teal }}
        value={value}
      />
    </View>
  );
}

function ClinicPickerModal({
  onClose,
  onSelect,
  selectedClinicId,
  visible,
}: {
  onClose: () => void;
  onSelect: (clinicId: string) => void;
  selectedClinicId: string;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <ModalHeader onClose={onClose} title="Preferred clinic" />
          <Text style={styles.modalIntro}>Clinque will prioritize this clinic in recommendations.</Text>
          <View style={styles.clinicOptions}>
            {clinics.map((clinic) => {
              const selected = clinic.id === selectedClinicId;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={clinic.id}
                  onPress={() => onSelect(clinic.id)}
                  style={[styles.clinicOption, selected && styles.clinicOptionSelected]}>
                  <View style={[styles.clinicOptionIcon, selected && styles.clinicOptionIconSelected]}>
                    <Icon name={{ ios: 'cross.case.fill', android: 'medical_services', web: 'medical_services' }} color={selected ? '#FFFFFF' : colors.teal} size={18} />
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={styles.clinicOptionName}>{clinic.name}</Text>
                    <Text style={styles.rowCaption}>{clinic.specialty} · {clinic.distance.toFixed(1)} km</Text>
                  </View>
                  {selected && <Icon name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={20} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InformationModal({
  children,
  icon,
  onClose,
  title,
  visible,
}: {
  children: ReactNode;
  icon: SymbolName;
  onClose: () => void;
  title: string;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <ModalHeader onClose={onClose} title={title} />
          <View style={styles.informationIcon}><Icon name={icon} size={27} /></View>
          <View style={styles.informationContent}>{children}</View>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalDone}>
            <Text style={styles.modalDoneText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ModalHeader({ onClose, title }: { onClose: () => void; title: string }) {
  return (
    <View style={styles.modalHeader}>
      <Text style={styles.modalTitle}>{title}</Text>
      <Pressable accessibilityLabel={`Close ${title}`} onPress={onClose} style={styles.modalClose}>
        <Icon name={{ ios: 'xmark', android: 'close', web: 'close' }} color={colors.ink} size={18} />
      </Pressable>
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  scrollContent: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 132 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  title: { marginTop: 4, color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  demoPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 13, backgroundColor: colors.warmSoft },
  demoDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.warm },
  demoText: { color: colors.warm, fontSize: 7, fontWeight: '800', letterSpacing: 0.6 },
  profileHero: { position: 'relative', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20, padding: 20, paddingBottom: 96, borderRadius: 27, backgroundColor: colors.tealDark },
  profileGlow: { position: 'absolute', width: 180, height: 180, top: -90, right: -60, borderRadius: 90, backgroundColor: colors.teal, opacity: 0.7 },
  avatar: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 22, backgroundColor: '#E6F8F3' },
  avatarText: { color: colors.tealDark, fontSize: 20, fontWeight: '900' },
  profileIdentity: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  profileName: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  profileMeta: { marginTop: 5, color: '#C7E6E0', fontSize: 9 },
  editButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.13)' },
  completenessPanel: { position: 'absolute', right: 20, bottom: 18, left: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 13, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)' },
  completenessLabel: { color: '#ABD6D0', fontSize: 7, fontWeight: '800', letterSpacing: 0.7 },
  completenessCaption: { marginTop: 4, color: '#E5F8F3', fontSize: 8 },
  completenessValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  sectionTitle: { marginTop: 26, marginBottom: 11, color: colors.ink, fontSize: 15, fontWeight: '800' },
  card: { overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: 22, backgroundColor: colors.card },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 82, paddingHorizontal: 15, paddingVertical: 13 },
  rowIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  rowContent: { flex: 1 },
  rowLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  rowValue: { marginTop: 4, color: colors.ink, fontSize: 11, fontWeight: '800' },
  rowCaption: { marginTop: 4, color: colors.muted, fontSize: 8, lineHeight: 12 },
  divider: { height: 1, marginLeft: 70, backgroundColor: '#EAF1EF' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingHorizontal: 15, paddingVertical: 12 },
  operationsCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, padding: 16, borderRadius: 21, backgroundColor: colors.tealDark },
  operationsCardPressed: { opacity: 0.82 },
  operationsIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)' },
  operationsContent: { flex: 1 },
  operationsTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  operationsTitle: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  operationsCaption: { marginTop: 5, color: '#C7E6E0', fontSize: 8, lineHeight: 12 },
  staffPill: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(157,225,209,0.16)' },
  staffPillText: { color: '#9DE1D1', fontSize: 6, fontWeight: '900', letterSpacing: 0.6 },
  signOutButton: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 12, padding: 15, borderWidth: 1, borderColor: '#F0D8D5', borderRadius: 19, backgroundColor: '#FFF7F6' },
  signOutCopy: { flex: 1 },
  signOutTitle: { color: '#873C37', fontSize: 10, fontWeight: '800' },
  signOutCaption: { marginTop: 3, color: '#98706D', fontSize: 7, lineHeight: 11 },
  privacyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, padding: 16, borderRadius: 21, backgroundColor: colors.tealSoft },
  privacyIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.card },
  privacyContent: { flex: 1 },
  privacyTitle: { color: '#174A49', fontSize: 11, fontWeight: '800' },
  privacyCaption: { marginTop: 4, color: '#5C7877', fontSize: 8, lineHeight: 12 },
  versionText: { marginTop: 18, color: '#91A3A4', fontSize: 8, textAlign: 'center' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: 'rgba(6,29,35,0.62)' },
  modalCard: { width: '100%', maxWidth: 400, padding: 22, borderRadius: 27, backgroundColor: colors.card },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  modalClose: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EDF4F2' },
  modalIntro: { marginTop: 8, color: colors.muted, fontSize: 9, lineHeight: 14 },
  clinicOptions: { gap: 9, marginTop: 18 },
  clinicOption: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 66, padding: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 17 },
  clinicOptionSelected: { borderColor: colors.teal, backgroundColor: '#F2FBF8' },
  clinicOptionIcon: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.tealSoft },
  clinicOptionIconSelected: { backgroundColor: colors.teal },
  clinicOptionName: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  informationIcon: { width: 58, height: 58, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 18, borderRadius: 20, backgroundColor: colors.tealSoft },
  informationContent: { marginTop: 18 },
  infoLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EAF1EF' },
  infoLabel: { color: colors.muted, fontSize: 9 },
  infoValue: { color: colors.ink, fontSize: 9, fontWeight: '800', textAlign: 'right' },
  modalFootnote: { marginTop: 14, color: colors.muted, fontSize: 8, lineHeight: 13, textAlign: 'center' },
  privacyModalText: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center' },
  privacyBadge: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 13, backgroundColor: colors.tealSoft },
  privacyBadgeText: { color: colors.teal, fontSize: 8, fontWeight: '800' },
  modalDone: { alignItems: 'center', justifyContent: 'center', minHeight: 47, marginTop: 18, borderRadius: 15, backgroundColor: colors.teal },
  modalDoneText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
