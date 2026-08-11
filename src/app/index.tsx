import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Appointment, useAppointment } from '@/features/appointments/appointment-context';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

const colors = {
  background: '#F4F9F8',
  card: '#FFFFFF',
  ink: '#102A35',
  muted: '#6B8085',
  teal: '#0E746A',
  tealDark: '#0B555D',
  tealSoft: '#DDF4EE',
  mint: '#B8E8DC',
  line: '#E0ECE9',
  warm: '#FFF4DD',
  warmInk: '#9B6515',
} as const;

function Icon({ name, color = colors.teal, size = 22 }: { name: SymbolName; color?: string; size?: number }) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}

const quickActions: Array<{
  label: string;
  icon: SymbolName;
  color: string;
  background: string;
}> = [
  {
    label: 'Book',
    icon: { ios: 'calendar.badge.plus', android: 'calendar_add_on', web: 'calendar_add_on' },
    color: '#0E746A',
    background: '#DDF4EE',
  },
  {
    label: 'Check in',
    icon: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' },
    color: '#415B87',
    background: '#E8EEFA',
  },
  {
    label: 'Visit history',
    icon: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' },
    color: '#9B6515',
    background: '#FFF4DD',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { appointment, loading } = useAppointment();

  function openQuickAction(label: string) {
    if (label === 'Book') {
      router.push('/explore');
      return;
    }

    if (label === 'Visit history') {
      router.push({ pathname: '/journey', params: { tab: 'past' } });
      return;
    }

    router.push('/journey');
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>GOOD MORNING</Text>
              <Text style={styles.greeting}>Maya</Text>
            </View>

            <Pressable accessibilityLabel="Open notifications" style={styles.notificationButton}>
              <Icon
                name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
                color={colors.ink}
                size={21}
              />
              <View style={styles.notificationDot} />
            </Pressable>
          </View>

          {loading && <AppointmentLoadingCard />}
          {!loading && appointment && (
            <HomeAppointmentCard appointment={appointment} onCheckIn={() => router.push('/journey')} />
          )}
          {!loading && !appointment && <EmptyAppointmentCard onBook={() => router.push('/explore')} />}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>How can we help?</Text>
          </View>

          <View style={styles.quickActionRow}>
            {quickActions.map((action) => (
              <Pressable
                accessibilityRole="button"
                key={action.label}
                onPress={() => openQuickAction(action.label)}
                style={styles.quickAction}>
                <View style={[styles.quickIcon, { backgroundColor: action.background }]}>
                  <Icon name={action.icon} color={action.color} size={23} />
                </View>
                <Text style={styles.quickLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent care</Text>
            <Pressable onPress={() => router.push({ pathname: '/journey', params: { tab: 'past' } })}>
              <Text style={styles.linkText}>View all</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/journey', params: { tab: 'past' } })}
            style={styles.historyCard}>
            <View style={styles.historyIcon}>
              <Icon
                name={{ ios: 'cross.case.fill', android: 'medical_services', web: 'medical_services' }}
                color={colors.teal}
                size={22}
              />
            </View>
            <View style={styles.historyContent}>
              <Text style={styles.historyDate}>28 JUL 2026</Text>
              <Text style={styles.historyTitle}>Annual health screening</Text>
              <Text style={styles.historyClinic}>Orchard Family Clinic</Text>
              <View style={styles.followUpPill}>
                <View style={styles.followUpDot} />
                <Text style={styles.followUpText}>Follow-up available</Text>
              </View>
            </View>
            <Icon
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              color="#9CB0B1"
              size={20}
            />
          </Pressable>

          <View style={styles.privacyNote}>
            <Icon
              name={{ ios: 'lock.shield', android: 'shield_lock', web: 'shield_lock' }}
              color={colors.muted}
              size={16}
            />
            <Text style={styles.privacyText}>Your clinic journey, securely in one place.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function HomeAppointmentCard({ appointment, onCheckIn }: { appointment: Appointment; onCheckIn: () => void }) {
  return (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentGlow} />
      <View style={styles.cardTopRow}>
        <View style={styles.nextVisitPill}>
          <View style={styles.pillDot} />
          <Text style={styles.nextVisitText}>NEXT APPOINTMENT</Text>
        </View>
        <Text style={styles.appointmentDay}>{getAppointmentDay(appointment.date)}</Text>
      </View>

      <Text style={styles.doctorName}>{appointment.doctorName}</Text>
      <Text style={styles.specialty}>{appointment.specialty} · {appointment.clinicName}</Text>

      <View style={styles.appointmentDetails}>
        <View style={styles.detailItem}>
          <Icon
            name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
            color="#D8F6ED"
            size={18}
          />
          <Text style={styles.detailText}>{formatHomeDate(appointment.date)}</Text>
        </View>
        <View style={styles.detailDivider} />
        <View style={styles.detailItem}>
          <Icon
            name={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
            color="#D8F6ED"
            size={18}
          />
          <Text style={styles.detailText}>{appointment.time}</Text>
        </View>
      </View>

      <View style={styles.queuePanel}>
        <View>
          <Text style={styles.queueLabel}>ESTIMATED WAIT</Text>
          <Text style={styles.queueValue}>{appointment.waitMinutes}–{appointment.waitMinutes + 6} minutes</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onCheckIn} style={styles.checkInButton}>
          <Text style={styles.checkInText}>Check in</Text>
          <Icon
            name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
            color={colors.tealDark}
            size={17}
          />
        </Pressable>
      </View>
    </View>
  );
}

function AppointmentLoadingCard() {
  return (
    <View style={[styles.appointmentCard, styles.appointmentLoadingCard]}>
      <View style={styles.appointmentLoadingPill} />
      <View style={styles.appointmentLoadingTitle} />
      <View style={styles.appointmentLoadingLine} />
    </View>
  );
}

function EmptyAppointmentCard({ onBook }: { onBook: () => void }) {
  return (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentGlow} />
      <View style={styles.emptyAppointmentIcon}>
        <Icon name={{ ios: 'calendar.badge.plus', android: 'calendar_add_on', web: 'calendar_add_on' }} color="#E9FAF6" size={26} />
      </View>
      <Text style={styles.emptyAppointmentTitle}>No upcoming appointment</Text>
      <Text style={styles.emptyAppointmentCaption}>Find a nearby clinic and choose a time that works for you.</Text>
      <Pressable accessibilityRole="button" onPress={onBook} style={styles.emptyAppointmentButton}>
        <Text style={styles.emptyAppointmentButtonText}>Book appointment</Text>
        <Icon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} color={colors.tealDark} size={17} />
      </Pressable>
    </View>
  );
}

function getAppointmentDay(date: string) {
  return date.split(',')[0].toUpperCase();
}

function formatHomeDate(date: string) {
  return date.replace(/^[^,]+,\s*/, '').replace(/\s+2026$/, '');
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 132,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  greeting: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  notificationButton: {
    position: 'relative',
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.card,
    backgroundColor: '#F28C74',
  },
  appointmentCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: 22,
    borderRadius: 28,
    backgroundColor: colors.tealDark,
    shadowColor: '#0B555D',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 26,
    elevation: 8,
  },
  appointmentGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    top: -105,
    right: -50,
    borderRadius: 100,
    backgroundColor: colors.teal,
    opacity: 0.6,
  },
  appointmentLoadingCard: { minHeight: 260, backgroundColor: '#DDE9E7' },
  appointmentLoadingPill: { width: 120, height: 26, borderRadius: 13, backgroundColor: '#C8DAD6' },
  appointmentLoadingTitle: { width: '54%', height: 24, marginTop: 28, borderRadius: 12, backgroundColor: '#C8DAD6' },
  appointmentLoadingLine: { width: '70%', height: 14, marginTop: 12, borderRadius: 7, backgroundColor: '#C8DAD6' },
  emptyAppointmentIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.13)' },
  emptyAppointmentTitle: { marginTop: 20, color: '#FFFFFF', fontSize: 21, fontWeight: '800' },
  emptyAppointmentCaption: { maxWidth: 390, marginTop: 7, color: '#C8E5E1', fontSize: 12, lineHeight: 18 },
  emptyAppointmentButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 20, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 14, backgroundColor: '#E6F8F3' },
  emptyAppointmentButtonText: { color: colors.tealDark, fontSize: 12, fontWeight: '800' },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextVisitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#A9E8D8',
  },
  nextVisitText: {
    color: '#E9FAF6',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  appointmentDay: {
    color: '#BFE9E1',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  doctorName: {
    marginTop: 24,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  specialty: {
    marginTop: 5,
    color: '#C8E5E1',
    fontSize: 13,
    fontWeight: '500',
  },
  appointmentDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  detailText: {
    color: '#F4FFFC',
    fontSize: 13,
    fontWeight: '700',
  },
  detailDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  queuePanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  queueLabel: {
    color: '#A9D5D0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  queueValue: {
    marginTop: 3,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#E6F8F3',
  },
  checkInText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 30,
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  linkText: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '800',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickAction: {
    flex: 1,
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  quickIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  quickLabel: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 17,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  historyIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.tealSoft,
  },
  historyContent: {
    flex: 1,
  },
  historyDate: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  historyTitle: {
    marginTop: 5,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  historyClinic: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
  },
  followUpPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.warm,
  },
  followUpDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.warmInk,
  },
  followUpText: {
    color: colors.warmInk,
    fontSize: 9,
    fontWeight: '800',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 24,
  },
  privacyText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '500',
  },
});
