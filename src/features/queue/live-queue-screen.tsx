import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppointment } from '@/features/appointments/appointment-context';
import { clinqueColors as colors } from '@/features/clinics/clinque-theme';
import { type ClinqueNotification, useNotifications } from '@/features/notifications/notification-context';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

function Icon({ name, color = colors.teal, size = 22 }: { name: SymbolName; color?: string; size?: number }) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}

export function LiveQueueScreen() {
  const router = useRouter();
  const { advanceQueue, appointment, completeConsultation, loading } = useAppointment();
  const { addQueueAlert } = useNotifications();
  const [visibleAlert, setVisibleAlert] = useState<ClinqueNotification | null>(null);

  function returnHome() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign('/');
      return;
    }

    router.replace('/');
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.loadingSafeArea}>
          <View style={styles.loadingMark}>
            <Text style={styles.loadingLetter}>C</Text>
          </View>
          <Text style={styles.loadingTitle}>Loading live queue</Text>
          <Text style={styles.loadingCaption}>Restoring your latest clinic status…</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (!appointment?.queue) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.emptySafeArea}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Icon name={{ ios: 'person.line.dotted.person.fill', android: 'groups', web: 'groups' }} size={29} />
            </View>
            <Text style={styles.emptyTitle}>No active queue</Text>
            <Text style={styles.emptyCaption}>Check in from Journey when you arrive at the clinic.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/journey')} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Return to Journey</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const { queue } = appointment;
  const called = queue.status === 'called';
  const progress = called ? 1 : Math.min((5 - queue.position) / 5, 0.9);

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {visibleAlert && (
            <View style={[styles.alertBanner, visibleAlert.type === 'doctor-ready' && styles.alertBannerReady]}>
              <View style={styles.alertBannerIcon}>
                <Icon
                  name={visibleAlert.type === 'doctor-ready'
                    ? { ios: 'door.left.hand.open', android: 'meeting_room', web: 'meeting_room' }
                    : { ios: 'bell.badge.fill', android: 'notifications_active', web: 'notifications_active' }}
                  color="#FFFFFF"
                  size={20}
                />
              </View>
              <View style={styles.alertBannerContent}>
                <Text style={styles.alertBannerTitle}>{visibleAlert.title}</Text>
                <Text style={styles.alertBannerMessage}>{visibleAlert.message}</Text>
              </View>
              <Pressable accessibilityLabel="Dismiss alert" onPress={() => setVisibleAlert(null)}>
                <Icon name={{ ios: 'xmark', android: 'close', web: 'close' }} color="#FFFFFF" size={17} />
              </Pressable>
            </View>
          )}
          <View style={styles.navigation}>
            <Pressable accessibilityLabel="Back to Home" onPress={returnHome} style={styles.backButton}>
              <Icon name={{ ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' }} color={colors.ink} size={19} />
            </Pressable>
            <View style={styles.navigationCopy}>
              <Text style={styles.eyebrow}>LIVE CLINIC STATUS</Text>
              <Text style={styles.title}>Your queue</Text>
            </View>
            <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
          </View>

          <View style={[styles.queueHero, called && styles.queueHeroCalled]}>
            <View style={styles.heroGlow} />
            <Text style={styles.heroLabel}>{called ? 'THE DOCTOR IS READY' : 'YOUR POSITION'}</Text>
            <Text style={styles.positionValue}>{called ? 'Now' : `#${queue.position}`}</Text>
            <Text style={styles.heroCaption}>
              {called ? 'Please proceed to Consultation Room 3.' : `${queue.position} patient${queue.position === 1 ? '' : 's'} ahead of you`}
            </Text>
            <View style={styles.waitPanel}>
              <View>
                <Text style={styles.waitLabel}>{called ? 'STATUS' : 'ESTIMATED WAIT'}</Text>
                <Text style={styles.waitValue}>{called ? 'Ready for consultation' : `About ${queue.estimatedMinutes} minutes`}</Text>
              </View>
              <View style={styles.waitIcon}>
                <Icon
                  name={called
                    ? { ios: 'door.left.hand.open', android: 'meeting_room', web: 'meeting_room' }
                    : { ios: 'clock.fill', android: 'schedule', web: 'schedule' }}
                  color={colors.tealDark}
                  size={22}
                />
              </View>
            </View>
          </View>

          <View style={styles.locationCard}>
            <View style={styles.locationIcon}>
              <Icon name={{ ios: 'cross.case.fill', android: 'medical_services', web: 'medical_services' }} size={20} />
            </View>
            <View style={styles.locationContent}>
              <Text style={styles.locationClinic}>{appointment.clinicName}</Text>
              <Text style={styles.locationCaption}>Waiting area · Level 2</Text>
            </View>
            <View style={styles.arrivedPill}>
              <Icon name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={12} />
              <Text style={styles.arrivedText}>ARRIVED</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Visit progress</Text>
            <Text style={styles.updatedText}>Updated just now</Text>
          </View>
          <View style={styles.progressCard}>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
            <QueueStep active complete label="Checked in" time={formatTime(queue.checkedInAt)} />
            <QueueStep active={!called} complete={called} label="Waiting for doctor" time={called ? 'Completed' : 'In progress'} />
            <QueueStep active={called} complete={false} label="Consultation" time={called ? 'Room 3' : 'Next'} />
          </View>

          <View style={styles.guidanceCard}>
            <View style={styles.guidanceIcon}>
              <Icon name={{ ios: 'bell.badge.fill', android: 'notifications_active', web: 'notifications_active' }} color={colors.blue} size={21} />
            </View>
            <View style={styles.guidanceContent}>
              <Text style={styles.guidanceTitle}>You can step away briefly</Text>
              <Text style={styles.guidanceCaption}>Clinque will alert you when two patients remain. Stay near the clinic.</Text>
            </View>
          </View>

          <View style={styles.demoCard}>
            <View style={styles.demoHeader}>
              <View>
                <Text style={styles.demoLabel}>PORTFOLIO DEMO</Text>
                <Text style={styles.demoTitle}>Simulate a clinic update</Text>
              </View>
              <Icon name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} color={colors.warm} size={19} />
            </View>
            <Text style={styles.demoCaption}>Move the queue forward to demonstrate live status changes without a clinic backend.</Text>
            <Pressable
              accessibilityRole="button"
              disabled={called}
              onPress={async () => {
                const updatedAppointment = await advanceQueue();
                if (updatedAppointment) {
                  const alert = await addQueueAlert(updatedAppointment);
                  if (alert) setVisibleAlert(alert);
                }
              }}
              style={[styles.demoButton, called && styles.demoButtonDisabled]}>
              <Text style={styles.demoButtonText}>{called ? 'Patient has been called' : 'Advance queue by one'}</Text>
              {!called && <Icon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} color="#FFFFFF" size={17} />}
            </Pressable>
            {called && (
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  const completedVisit = await completeConsultation();
                  if (!completedVisit) return;

                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.location.assign('/journey?tab=past');
                    return;
                  }

                  router.replace({ pathname: '/journey', params: { tab: 'past' } });
                }}
                style={styles.completeVisitButton}>
                <Icon name={{ ios: 'checkmark.seal.fill', android: 'task_alt', web: 'task_alt' }} color="#FFFFFF" size={18} />
                <Text style={styles.completeVisitButtonText}>Complete consultation</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function QueueStep({ active, complete, label, time }: { active: boolean; complete: boolean; label: string; time: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepIcon, active && styles.stepIconActive, complete && styles.stepIconComplete]}>
        {complete ? (
          <Icon name={{ ios: 'checkmark', android: 'check', web: 'check' }} color="#FFFFFF" size={13} />
        ) : (
          <View style={[styles.stepDot, active && styles.stepDotActive]} />
        )}
      </View>
      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
      <Text style={styles.stepTime}>{time}</Text>
    </View>
  );
}

function formatTime(isoDate: string) {
  return new Intl.DateTimeFormat('en-SG', { hour: 'numeric', minute: '2-digit' }).format(new Date(isoDate));
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14, padding: 14, borderRadius: 19, backgroundColor: colors.blue },
  alertBannerReady: { backgroundColor: colors.tealDark },
  alertBannerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.16)' },
  alertBannerContent: { flex: 1 },
  alertBannerTitle: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  alertBannerMessage: { marginTop: 3, color: 'rgba(255,255,255,0.82)', fontSize: 8, lineHeight: 12 },
  loadingSafeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  loadingMark: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.teal },
  loadingLetter: { color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  loadingTitle: { marginTop: 17, color: colors.ink, fontSize: 17, fontWeight: '800' },
  loadingCaption: { marginTop: 6, color: colors.muted, fontSize: 9 },
  safeArea: { flex: 1 },
  scrollContent: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 50 },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 15, backgroundColor: colors.card },
  navigationCopy: { flex: 1 },
  eyebrow: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 3, color: colors.ink, fontSize: 24, fontWeight: '800' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 13, backgroundColor: colors.tealSoft },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.teal },
  liveText: { color: colors.teal, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  queueHero: { position: 'relative', overflow: 'hidden', alignItems: 'center', marginTop: 20, padding: 24, borderRadius: 29, backgroundColor: colors.tealDark },
  queueHeroCalled: { backgroundColor: '#174C51' },
  heroGlow: { position: 'absolute', width: 200, height: 200, top: -110, right: -65, borderRadius: 100, backgroundColor: colors.teal, opacity: 0.65 },
  heroLabel: { color: '#B7DFD8', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  positionValue: { marginTop: 8, color: '#FFFFFF', fontSize: 50, fontWeight: '900', letterSpacing: -2 },
  heroCaption: { marginTop: 3, color: '#D7EFEA', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  waitPanel: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, padding: 15, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.11)' },
  waitLabel: { color: '#ABD6D0', fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  waitValue: { marginTop: 5, color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  waitIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#E9FAF5' },
  locationCard: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 13, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 19, backgroundColor: colors.card },
  locationIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.tealSoft },
  locationContent: { flex: 1 },
  locationClinic: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  locationCaption: { marginTop: 4, color: colors.muted, fontSize: 8 },
  arrivedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 11, backgroundColor: colors.tealSoft },
  arrivedText: { color: colors.teal, fontSize: 7, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, marginBottom: 11 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  updatedText: { color: colors.teal, fontSize: 8, fontWeight: '700' },
  progressCard: { padding: 17, borderWidth: 1, borderColor: colors.line, borderRadius: 22, backgroundColor: colors.card },
  progressTrack: { overflow: 'hidden', height: 6, marginBottom: 17, borderRadius: 3, backgroundColor: '#E4ECEA' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.teal },
  stepRow: { flexDirection: 'row', alignItems: 'center', minHeight: 42 },
  stepIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: '#DCE7E5', borderRadius: 14, backgroundColor: '#F3F6F5' },
  stepIconActive: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  stepIconComplete: { borderColor: colors.teal, backgroundColor: colors.teal },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#AAB9B7' },
  stepDotActive: { backgroundColor: colors.teal },
  stepLabel: { flex: 1, color: colors.muted, fontSize: 9, fontWeight: '700' },
  stepLabelActive: { color: colors.ink, fontWeight: '800' },
  stepTime: { color: colors.muted, fontSize: 8 },
  guidanceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 13, padding: 15, borderRadius: 20, backgroundColor: colors.blueSoft },
  guidanceIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.card },
  guidanceContent: { flex: 1 },
  guidanceTitle: { color: '#334E76', fontSize: 10, fontWeight: '800' },
  guidanceCaption: { marginTop: 4, color: '#667797', fontSize: 8, lineHeight: 12 },
  demoCard: { marginTop: 19, padding: 17, borderWidth: 1, borderColor: '#EADFC7', borderRadius: 22, backgroundColor: '#FFFBF3' },
  demoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  demoLabel: { color: colors.warm, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  demoTitle: { marginTop: 4, color: colors.ink, fontSize: 12, fontWeight: '800' },
  demoCaption: { marginTop: 8, color: colors.muted, fontSize: 8, lineHeight: 13 },
  demoButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 45, marginTop: 14, borderRadius: 15, backgroundColor: colors.teal },
  demoButtonDisabled: { backgroundColor: '#92A7A4' },
  demoButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  completeVisitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 47, marginTop: 10, borderRadius: 15, backgroundColor: colors.tealDark },
  completeVisitButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  emptySafeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  emptyCard: { width: '100%', maxWidth: 390, alignItems: 'center', padding: 30, borderWidth: 1, borderColor: colors.line, borderRadius: 26, backgroundColor: colors.card },
  emptyIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.tealSoft },
  emptyTitle: { marginTop: 17, color: colors.ink, fontSize: 18, fontWeight: '800' },
  emptyCaption: { marginTop: 7, color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center' },
  primaryButton: { minHeight: 47, alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 20, borderRadius: 15, backgroundColor: colors.teal },
  primaryButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
