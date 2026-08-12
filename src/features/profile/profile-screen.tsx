import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'base64-arraybuffer';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { clinics } from '@/features/clinics/clinic-data';
import { clinqueColors as colors } from '@/features/clinics/clinque-theme';
import { supabase } from '@/lib/supabase';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

type ProfilePreferences = {
  preferredClinicId: string;
  appointmentReminders: boolean;
  queueAlerts: boolean;
  biometricUnlock: boolean;
};

type PatientIdentity = {
  avatarPath: string;
  fullName: string;
  phone: string;
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
  const [identity, setIdentity] = useState<PatientIdentity>({ avatarPath: '', fullName: '', phone: '' });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [identityLoading, setIdentityLoading] = useState(Boolean(user && !isDemo));
  const [identityError, setIdentityError] = useState<string | null>(null);

  const preferredClinic = clinics.find((clinic) => clinic.id === preferences.preferredClinicId) ?? clinics[0];
  const authenticatedName = identity.fullName || (typeof user?.user_metadata.full_name === 'string'
    ? user.user_metadata.full_name
    : user?.email?.split('@')[0]);
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

  useEffect(() => {
    let active = true;

    async function loadIdentity() {
      if (!user || isDemo) {
        setIdentity({ avatarPath: '', fullName: 'Maya Tan', phone: '+65 8123 4567' });
        setAvatarUrl(null);
        setIdentityLoading(false);
        return;
      }

      setIdentityLoading(true);
      setIdentityError(null);
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_path, full_name, phone')
        .eq('id', user.id)
        .single();

      if (!active) return;

      if (error) {
        setIdentityError(`Clinque could not load your secure profile: ${error.message}`);
      } else {
        const nextIdentity = {
          avatarPath: data.avatar_path ?? '',
          fullName: data.full_name,
          phone: data.phone ?? '',
        };
        setIdentity(nextIdentity);

        if (nextIdentity.avatarPath) {
          const { data: signedAvatar, error: avatarError } = await supabase.storage
            .from('avatars')
            .createSignedUrl(nextIdentity.avatarPath, 60 * 60);

          if (!active) return;
          if (avatarError) {
            setIdentityError(`Your profile loaded, but Clinque could not display its private photo: ${avatarError.message}`);
          } else {
            setAvatarUrl(signedAvatar.signedUrl);
          }
        } else {
          setAvatarUrl(null);
        }
      }
      setIdentityLoading(false);
    }

    void loadIdentity();
    return () => {
      active = false;
    };
  }, [isDemo, user]);

  async function saveIdentity(nextIdentity: Pick<PatientIdentity, 'fullName' | 'phone'>) {
    if (!user || isDemo) return 'Demo identity is read-only.';

    const fullName = nextIdentity.fullName.trim();
    const phone = nextIdentity.phone.trim();
    if (fullName.length < 2) return 'Enter a full name with at least 2 characters.';

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone: phone || null })
      .eq('id', user.id);

    if (error) return error.message;
    setIdentity((current) => ({ ...current, fullName, phone }));
    setIdentityError(null);
    return null;
  }

  async function uploadAvatar() {
    if (!user || isDemo) return 'Demo profile pictures are read-only.';

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset?.base64) return 'Clinque could not read that image. Please choose another photo.';
    if (asset.fileSize && asset.fileSize > 3 * 1024 * 1024) return 'Choose a profile picture smaller than 3 MB.';

    const contentType = asset.mimeType && ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)
      ? asset.mimeType
      : 'image/jpeg';
    const avatarPath = `${user.id}/avatar`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(avatarPath, decode(asset.base64), {
        cacheControl: '3600',
        contentType,
        upsert: true,
      });

    if (uploadError) return uploadError.message;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_path: avatarPath })
      .eq('id', user.id);
    if (profileError) return profileError.message;

    const { data: signedAvatar, error: signedUrlError } = await supabase.storage
      .from('avatars')
      .createSignedUrl(avatarPath, 60 * 60);
    if (signedUrlError) return signedUrlError.message;

    setIdentity((current) => ({ ...current, avatarPath }));
    setAvatarUrl(`${signedAvatar.signedUrl}&v=${Date.now()}`);
    return null;
  }

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
            <View style={styles.avatar}>
              {avatarUrl
                ? <Image contentFit="cover" source={{ uri: avatarUrl }} style={styles.avatarImage} />
                : <Text style={styles.avatarText}>{initials || 'C'}</Text>}
            </View>
            <View style={styles.profileIdentity}>
              <View style={styles.nameRow}>
                <Text style={styles.profileName}>{displayName}</Text>
                <Icon name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} color="#9DE1D1" size={18} />
              </View>
              <Text style={styles.profileMeta}>{isDemo ? 'Patient ID · CQ-20418' : user?.email}</Text>
              <Text style={styles.profileMeta}>
                {isDemo ? 'Singapore · English' : identityLoading ? 'Synchronizing secure profile…' : identity.phone || 'Add a contact number'}
              </Text>
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
      <PatientDetailsModal
        avatarUrl={avatarUrl}
        email={isDemo ? 'maya.tan@example.com' : user?.email ?? 'Not available'}
        error={identityError}
        identity={identity}
        isDemo={isDemo}
        onChooseAvatar={uploadAvatar}
        onClose={() => setDetailsVisible(false)}
        onSave={saveIdentity}
        visible={detailsVisible}
      />
      <InformationModal
        icon={{ ios: 'lock.shield.fill', android: 'shield_lock', web: 'shield_lock' }}
        onClose={() => setPrivacyVisible(false)}
        title="Privacy & data"
        visible={privacyVisible}>
        <Text style={styles.privacyModalText}>
          Signed-in identity, appointment, and queue records are protected in Supabase with row-level security. Display and notification preferences remain only on this device.
        </Text>
        <View style={styles.privacyBadge}>
          <Icon name={{ ios: 'lock.shield.fill', android: 'shield_lock', web: 'shield_lock' }} size={17} />
          <Text style={styles.privacyBadgeText}>Patient-owned cloud records</Text>
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

function PatientDetailsModal({
  avatarUrl,
  email,
  error,
  identity,
  isDemo,
  onChooseAvatar,
  onClose,
  onSave,
  visible,
}: {
  avatarUrl: string | null;
  email: string;
  error: string | null;
  identity: PatientIdentity;
  isDemo: boolean;
  onChooseAvatar: () => Promise<string | null>;
  onClose: () => void;
  onSave: (identity: Pick<PatientIdentity, 'fullName' | 'phone'>) => Promise<string | null>;
  visible: boolean;
}) {
  const [fullName, setFullName] = useState(identity.fullName);
  const [phone, setPhone] = useState(identity.phone);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setFullName(identity.fullName);
    setPhone(identity.phone);
    setMessage(error);
    setSaved(false);
  }, [error, identity, visible]);

  async function submit() {
    setSaving(true);
    setMessage(null);
    const saveError = await onSave({ fullName, phone });
    setSaving(false);
    if (saveError) {
      setSaved(false);
      setMessage(saveError);
      return;
    }

    onClose();
  }

  async function chooseAvatar() {
    setUploadingAvatar(true);
    setMessage(null);
    const uploadError = await onChooseAvatar();
    setUploadingAvatar(false);
    setSaved(!uploadError);
    setMessage(uploadError ?? 'Your private profile picture was securely updated.');
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <ModalHeader onClose={onClose} title="Patient details" />
          <View style={[styles.informationIcon, avatarUrl && styles.informationAvatar]}>
            {avatarUrl
              ? <Image contentFit="cover" source={{ uri: avatarUrl }} style={styles.informationAvatarImage} />
              : <Icon name={{ ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' }} size={27} />}
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={isDemo || uploadingAvatar}
            onPress={() => void chooseAvatar()}
            style={[styles.avatarPickerButton, isDemo && styles.identityInputDisabled]}>
            {uploadingAvatar
              ? <ActivityIndicator color={colors.teal} />
              : <Icon name={{ ios: 'photo.on.rectangle.angled', android: 'add_photo_alternate', web: 'add_photo_alternate' }} size={18} />}
            <View style={styles.avatarPickerCopy}>
              <Text style={styles.avatarPickerTitle}>{uploadingAvatar ? 'Uploading securely…' : 'Choose profile picture'}</Text>
              <Text style={styles.avatarPickerCaption}>{isDemo ? 'Available for secure accounts' : 'Private JPG, PNG, or WebP · maximum 3 MB'}</Text>
            </View>
          </Pressable>
          <View style={styles.informationContent}>
            <Text style={styles.identityLabel}>Full name</Text>
            <TextInput
              accessibilityLabel="Full name"
              editable={!isDemo && !saving}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor="#8A9E9D"
              style={[styles.identityInput, isDemo && styles.identityInputDisabled]}
              value={fullName}
            />
            <Text style={styles.identityLabel}>Phone number</Text>
            <TextInput
              accessibilityLabel="Phone number"
              editable={!isDemo && !saving}
              keyboardType="phone-pad"
              onChangeText={setPhone}
              placeholder="+65 8123 4567"
              placeholderTextColor="#8A9E9D"
              style={[styles.identityInput, isDemo && styles.identityInputDisabled]}
              value={phone}
            />
            <InfoLine label="Email" value={email} />
            <Text style={styles.identityEmailNote}>Email is controlled by your authenticated account and cannot be edited here.</Text>
            {message && (
              <View style={[styles.identityMessage, saved && styles.identitySuccessMessage]}>
                <Text style={[styles.identityMessageText, saved && styles.identitySuccessText]}>{message}</Text>
              </View>
            )}
          </View>
          {isDemo ? (
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalDone}>
              <Text style={styles.modalDoneText}>Done</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void submit()}
              style={[styles.modalDone, saving && styles.modalButtonDisabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.modalDoneText}>Save secure profile</Text>}
            </Pressable>
          )}
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
  avatarImage: { width: '100%', height: '100%', borderRadius: 20 },
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
  informationAvatar: { overflow: 'hidden', borderWidth: 2, borderColor: colors.tealSoft, backgroundColor: colors.card },
  informationAvatarImage: { width: '100%', height: '100%' },
  avatarPickerButton: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 15, backgroundColor: '#F5FAF8' },
  avatarPickerCopy: { flex: 1 },
  avatarPickerTitle: { color: colors.teal, fontSize: 9, fontWeight: '800' },
  avatarPickerCaption: { marginTop: 3, color: colors.muted, fontSize: 7, lineHeight: 11 },
  informationContent: { marginTop: 18 },
  infoLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EAF1EF' },
  infoLabel: { color: colors.muted, fontSize: 9 },
  infoValue: { color: colors.ink, fontSize: 9, fontWeight: '800', textAlign: 'right' },
  identityLabel: { marginTop: 12, marginBottom: 6, color: colors.ink, fontSize: 8, fontWeight: '800' },
  identityInput: { minHeight: 47, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: '#FAFCFB', color: colors.ink, fontSize: 10, outlineStyle: 'none' } as never,
  identityInputDisabled: { backgroundColor: '#EFF4F3', color: colors.muted },
  identityEmailNote: { marginTop: 9, color: colors.muted, fontSize: 7, lineHeight: 11 },
  identityMessage: { marginTop: 13, padding: 10, borderRadius: 12, backgroundColor: '#FCEAE8' },
  identitySuccessMessage: { backgroundColor: colors.tealSoft },
  identityMessageText: { color: '#8A342E', fontSize: 8, lineHeight: 12 },
  identitySuccessText: { color: '#25665F' },
  privacyModalText: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center' },
  privacyBadge: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 13, backgroundColor: colors.tealSoft },
  privacyBadgeText: { color: colors.teal, fontSize: 8, fontWeight: '800' },
  modalDone: { alignItems: 'center', justifyContent: 'center', minHeight: 47, marginTop: 18, borderRadius: 15, backgroundColor: colors.teal },
  modalButtonDisabled: { opacity: 0.65 },
  modalDoneText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
