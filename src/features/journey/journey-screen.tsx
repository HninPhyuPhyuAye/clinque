import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Appointment, useAppointment } from '@/features/appointments/appointment-context';
import { clinqueColors as colors } from '@/features/clinics/clinque-theme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type JourneyTab = 'current' | 'past';

const qrPattern = [
  '11111110101',
  '10000010111',
  '10111010001',
  '10111010111',
  '10111010010',
  '10000010101',
  '11111110111',
  '00010001001',
  '11101111101',
  '10011000111',
  '11101110101',
];

const pastVisits = [
  {
    date: '28 Jul 2026',
    title: 'Annual health screening',
    clinic: 'Orchard Family Clinic',
    doctor: 'Dr. Cheryl Tan',
    status: 'Follow-up available',
  },
  {
    date: '16 May 2026',
    title: 'Vaccination appointment',
    clinic: 'Novena Medical Clinic',
    doctor: 'Dr. Sarah Lim',
    status: 'Completed',
  },
];

function Icon({ name, color = colors.teal, size = 22 }: { name: SymbolName; color?: string; size?: number }) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}

export function JourneyScreen() {
  const router = useRouter();
  const { appointment, loading } = useAppointment();
  const [activeTab, setActiveTab] = useState<JourneyTab>('current');
  const [qrVisible, setQrVisible] = useState(false);

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>YOUR CARE, CONNECTED</Text>
              <Text style={styles.title}>Journey</Text>
            </View>
            <Pressable onPress={() => setActiveTab('past')}>
              <Text style={styles.historyLink}>All history →</Text>
            </Pressable>
          </View>

          <View style={styles.segmentedControl}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: activeTab === 'current' }}
              onPress={() => setActiveTab('current')}
              style={[styles.segment, activeTab === 'current' && styles.segmentActive]}>
              <Text style={[styles.segmentText, activeTab === 'current' && styles.segmentTextActive]}>
                Current journey
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: activeTab === 'past' }}
              onPress={() => setActiveTab('past')}
              style={[styles.segment, activeTab === 'past' && styles.segmentActive]}>
              <Text style={[styles.segmentText, activeTab === 'past' && styles.segmentTextActive]}>Past visits</Text>
            </Pressable>
          </View>

          {activeTab === 'current' && loading && <JourneyLoading />}
          {activeTab === 'current' && !loading && appointment && (
            <CurrentJourney appointment={appointment} onCheckIn={() => setQrVisible(true)} />
          )}
          {activeTab === 'current' && !loading && !appointment && (
            <EmptyJourney onBook={() => router.push('/explore')} />
          )}
          {activeTab === 'past' && <PastJourney />}
        </ScrollView>
      </SafeAreaView>

      <CheckInModal appointment={appointment} onClose={() => setQrVisible(false)} visible={qrVisible} />
    </View>
  );
}

function CurrentJourney({ appointment, onCheckIn }: { appointment: Appointment; onCheckIn: () => void }) {
  const checkInTime = getCheckInTime(appointment.time);

  return (
    <>
      <View style={styles.visitCard}>
        <View style={styles.visitGlow} />
        <View style={styles.upcomingPill}>
          <View style={styles.upcomingDot} />
          <Text style={styles.upcomingText}>UPCOMING</Text>
        </View>
        <Text style={styles.visitTitle}>{getVisitTitle(appointment.reason)}</Text>
        <Text style={styles.visitClinic}>{appointment.doctorName} · {appointment.clinicName}</Text>
        <View style={styles.visitDateRow}>
          <View style={styles.visitDateItem}>
            <Icon name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} color="#E9FFF9" size={17} />
            <Text style={styles.visitDateText}>{formatJourneyDate(appointment.date)}</Text>
          </View>
          <View style={styles.visitDateItem}>
            <Icon name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} color="#E9FFF9" size={17} />
            <Text style={styles.visitDateText}>{appointment.time}</Text>
          </View>
        </View>
        <View style={styles.queuePanel}>
          <View>
            <Text style={styles.queueLabel}>LIVE QUEUE FORECAST</Text>
            <Text style={styles.queueValue}>{appointment.waitMinutes}–{appointment.waitMinutes + 6} min wait</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onCheckIn} style={styles.checkInButton}>
            <Icon name={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }} color={colors.tealDark} size={16} />
            <Text style={styles.checkInText}>Check in</Text>
          </Pressable>
        </View>
      </View>

      <SectionHeader count="3 STEPS" title="Your visit timeline" />
      <View style={styles.timeline}>
        <TimelineItem
          caption="Your visit is confirmed and the clinic has received your information."
          footer="Completed today"
          icon={{ ios: 'checkmark', android: 'check', web: 'check' }}
          title="Appointment booked"
        />
        <TimelineItem
          action="Preview QR →"
          caption="Scan your Clinque QR code when you arrive. Available 30 minutes before the visit."
          footer={`Opens at ${checkInTime}`}
          icon={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }}
          onPress={onCheckIn}
          title="Mobile check-in"
        />
        <TimelineItem
          caption="Visit notes, documents, and follow-up actions will appear here after your appointment."
          footer="Pending visit"
          icon={{ ios: 'plus', android: 'add', web: 'add' }}
          pending
          title="Consultation & follow-up"
        />
      </View>

      <SectionHeader count="1 FILE" title="Documents" />
      <Pressable style={styles.documentCard}>
        <View style={styles.documentIcon}>
          <Icon name={{ ios: 'doc.text.fill', android: 'description', web: 'description' }} color={colors.warm} size={19} />
        </View>
        <View style={styles.documentContent}>
          <Text style={styles.documentTitle}>Appointment confirmation</Text>
          <Text style={styles.documentCaption}>{appointment.confirmationCode} · Added today</Text>
        </View>
        <Icon name={{ ios: 'arrow.down.to.line', android: 'download', web: 'download' }} color={colors.teal} size={19} />
      </Pressable>
    </>
  );
}

function JourneyLoading() {
  return (
    <View style={styles.journeyLoading}>
      <View style={styles.loadingPill} />
      <View style={styles.loadingLine} />
      <View style={[styles.loadingLine, styles.loadingLineShort]} />
    </View>
  );
}

function EmptyJourney({ onBook }: { onBook: () => void }) {
  return (
    <View style={styles.emptyJourney}>
      <View style={styles.emptyJourneyIcon}>
        <Icon name={{ ios: 'calendar.badge.plus', android: 'calendar_add_on', web: 'calendar_add_on' }} size={28} />
      </View>
      <Text style={styles.emptyJourneyTitle}>Your next visit starts here</Text>
      <Text style={styles.emptyJourneyCaption}>
        Book a clinic appointment and Clinque will organize your check-in, timeline, and documents here.
      </Text>
      <Pressable accessibilityRole="button" onPress={onBook} style={styles.emptyJourneyButton}>
        <Text style={styles.emptyJourneyButtonText}>Find a clinic</Text>
        <Icon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} color="#FFFFFF" size={17} />
      </Pressable>
    </View>
  );
}

function PastJourney() {
  return (
    <View style={styles.pastContent}>
      <View style={styles.historySummary}>
        <View style={styles.historySummaryIcon}>
          <Icon name={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }} size={22} />
        </View>
        <View>
          <Text style={styles.historySummaryTitle}>2 clinic visits this year</Text>
          <Text style={styles.historySummaryCaption}>Your records stay organized by visit.</Text>
        </View>
      </View>

      <Text style={styles.yearLabel}>2026</Text>
      <View style={styles.pastList}>
        {pastVisits.map((visit) => (
          <Pressable key={visit.date} style={styles.pastCard}>
            <View style={styles.pastDateColumn}>
              <Text style={styles.pastMonth}>{visit.date.split(' ')[1].toUpperCase()}</Text>
              <Text style={styles.pastDay}>{visit.date.split(' ')[0]}</Text>
            </View>
            <View style={styles.pastMain}>
              <Text style={styles.pastTitle}>{visit.title}</Text>
              <Text style={styles.pastClinic}>{visit.clinic}</Text>
              <Text style={styles.pastDoctor}>{visit.doctor}</Text>
              <View style={styles.pastStatusPill}>
                <View style={styles.pastStatusDot} />
                <Text style={styles.pastStatusText}>{visit.status}</Text>
              </View>
            </View>
            <Icon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} color="#9CB0B1" size={19} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TimelineItem({
  action,
  caption,
  footer,
  icon,
  onPress,
  pending = false,
  title,
}: {
  action?: string;
  caption: string;
  footer: string;
  icon: SymbolName;
  onPress?: () => void;
  pending?: boolean;
  title: string;
}) {
  return (
    <View style={styles.timelineItem}>
      <View style={[styles.timelineIcon, pending && styles.timelineIconPending]}>
        <Icon name={icon} color={pending ? '#8BA09F' : colors.teal} size={15} />
      </View>
      <View style={styles.timelineCard}>
        <Text style={styles.timelineTitle}>{title}</Text>
        <Text style={styles.timelineCaption}>{caption}</Text>
        <View style={styles.timelineFooter}>
          <Text style={[styles.timelineFooterText, pending && styles.timelineFooterPending]}>{footer}</Text>
          {action && (
            <Pressable onPress={onPress}>
              <Text style={styles.timelineAction}>{action}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function SectionHeader({ count, title }: { count: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

function CheckInModal({
  appointment,
  onClose,
  visible,
}: {
  appointment: Appointment | null;
  onClose: () => void;
  visible: boolean;
}) {
  if (!appointment) return null;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Pressable accessibilityLabel="Close QR check-in" onPress={onClose} style={styles.modalClose}>
            <Icon name={{ ios: 'xmark', android: 'close', web: 'close' }} color={colors.ink} size={20} />
          </Pressable>
          <View style={styles.modalIcon}>
            <Icon name={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }} color={colors.teal} size={27} />
          </View>
          <Text style={styles.modalTitle}>Mobile check-in</Text>
          <Text style={styles.modalCaption}>Show this QR code at {appointment.clinicName} when you arrive.</Text>
          <View style={styles.qrCode}>
            {qrPattern.map((row, rowIndex) =>
              row.split('').map((cell, columnIndex) => (
                <View
                  key={`${rowIndex}-${columnIndex}`}
                  style={[styles.qrCell, cell === '1' && styles.qrCellFilled]}
                />
              )),
            )}
          </View>
          <Text style={styles.qrConfirmation}>{appointment.confirmationCode}</Text>
          <View style={styles.modalStatus}>
            <View style={styles.modalStatusDot} />
            <Text style={styles.modalStatusText}>Activates at {getCheckInTime(appointment.time)}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalDone}>
            <Text style={styles.modalDoneText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function formatJourneyDate(date: string) {
  return date.replace(/,? 2026$/, '');
}

function getVisitTitle(reason: string) {
  if (reason === 'Health screening') return 'Health screening';
  if (reason === 'Vaccination') return 'Vaccination appointment';
  return 'Family medicine visit';
}

function getCheckInTime(time: string) {
  const [clock, period] = time.split(' ');
  const [hourValue, minuteValue] = clock.split(':').map(Number);
  let minutesSinceMidnight = (hourValue % 12) * 60 + minuteValue;

  if (period === 'PM') minutesSinceMidnight += 12 * 60;
  minutesSinceMidnight = (minutesSinceMidnight - 30 + 24 * 60) % (24 * 60);

  const hour = Math.floor(minutesSinceMidnight / 60);
  const minute = minutesSinceMidnight % 60;
  const formattedHour = hour % 12 || 12;
  const formattedPeriod = hour >= 12 ? 'PM' : 'AM';

  return `${formattedHour}:${minute.toString().padStart(2, '0')} ${formattedPeriod}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  scrollContent: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 132,
  },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  title: { marginTop: 4, color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  historyLink: { color: colors.teal, fontSize: 10, fontWeight: '800' },
  segmentedControl: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 20,
    padding: 4,
    borderRadius: 17,
    backgroundColor: '#E6EFED',
  },
  segment: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  segmentActive: { backgroundColor: colors.card },
  segmentText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  segmentTextActive: { color: colors.teal },
  journeyLoading: { marginTop: 18, padding: 22, borderRadius: 26, backgroundColor: '#E6EFED' },
  loadingPill: { width: 82, height: 22, borderRadius: 11, backgroundColor: '#D2E1DE' },
  loadingLine: { width: '72%', height: 18, marginTop: 20, borderRadius: 9, backgroundColor: '#D2E1DE' },
  loadingLineShort: { width: '48%', height: 11, marginTop: 10 },
  emptyJourney: { alignItems: 'center', marginTop: 18, paddingHorizontal: 24, paddingVertical: 38, borderWidth: 1, borderColor: colors.line, borderRadius: 26, backgroundColor: colors.card },
  emptyJourneyIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.tealSoft },
  emptyJourneyTitle: { marginTop: 18, color: colors.ink, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyJourneyCaption: { maxWidth: 360, marginTop: 8, color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center' },
  emptyJourneyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minWidth: 150, minHeight: 46, marginTop: 20, paddingHorizontal: 18, borderRadius: 15, backgroundColor: colors.teal },
  emptyJourneyButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  visitCard: {
    position: 'relative', overflow: 'hidden', marginTop: 18, padding: 20, borderRadius: 26,
    backgroundColor: colors.tealDark, shadowColor: colors.tealDark, shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22, shadowRadius: 25, elevation: 7,
  },
  visitGlow: { position: 'absolute', width: 170, height: 170, top: -80, right: -65, borderRadius: 90, backgroundColor: colors.teal, opacity: 0.65 },
  upcomingPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)' },
  upcomingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#7EE1C8' },
  upcomingText: { color: '#DBFAF2', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  visitTitle: { marginTop: 18, color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  visitClinic: { marginTop: 4, color: '#C5E6DF', fontSize: 10 },
  visitDateRow: { flexDirection: 'row', gap: 16, marginTop: 17 },
  visitDateItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visitDateText: { color: '#ECFFFA', fontSize: 10, fontWeight: '700' },
  queuePanel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 18, padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)' },
  queueLabel: { color: '#ABD6D0', fontSize: 7, fontWeight: '800', letterSpacing: 0.7 },
  queueValue: { marginTop: 4, color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  checkInButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: '#E9FAF5' },
  checkInText: { color: colors.tealDark, fontSize: 9, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  sectionCount: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.6 },
  timeline: { gap: 10 },
  timelineItem: { flexDirection: 'row', gap: 10 },
  timelineIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: colors.background, borderRadius: 21, backgroundColor: colors.tealSoft },
  timelineIconPending: { backgroundColor: '#EDF1F0' },
  timelineCard: { flex: 1, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.card },
  timelineTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  timelineCaption: { marginTop: 5, color: colors.muted, fontSize: 9, lineHeight: 14 },
  timelineFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#EBF2F0' },
  timelineFooterText: { color: colors.teal, fontSize: 8, fontWeight: '800' },
  timelineFooterPending: { color: '#8BA09F' },
  timelineAction: { color: colors.teal, fontSize: 8, fontWeight: '800' },
  documentCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.card },
  documentIcon: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.warmSoft },
  documentContent: { flex: 1 },
  documentTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  documentCaption: { marginTop: 4, color: colors.muted, fontSize: 8 },
  pastContent: { marginTop: 18 },
  historySummary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 20, backgroundColor: colors.tealSoft },
  historySummaryIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.card },
  historySummaryTitle: { color: '#174A49', fontSize: 11, fontWeight: '800' },
  historySummaryCaption: { marginTop: 4, color: '#5C7877', fontSize: 9 },
  yearLabel: { marginTop: 24, marginBottom: 10, color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  pastList: { gap: 11 },
  pastCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 21, backgroundColor: colors.card },
  pastDateColumn: { width: 44, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.tealSoft },
  pastMonth: { color: colors.teal, fontSize: 8, fontWeight: '800' },
  pastDay: { marginTop: 3, color: colors.ink, fontSize: 16, fontWeight: '800' },
  pastMain: { flex: 1 },
  pastTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  pastClinic: { marginTop: 4, color: colors.muted, fontSize: 9 },
  pastDoctor: { marginTop: 3, color: colors.muted, fontSize: 9 },
  pastStatusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 11, backgroundColor: colors.warmSoft },
  pastStatusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.warm },
  pastStatusText: { color: colors.warm, fontSize: 8, fontWeight: '800' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: 'rgba(6,29,35,0.62)' },
  modalCard: { position: 'relative', width: '100%', maxWidth: 390, alignItems: 'center', padding: 24, borderRadius: 28, backgroundColor: colors.card },
  modalClose: { position: 'absolute', top: 15, right: 15, width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EDF4F2' },
  modalIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.tealSoft },
  modalTitle: { marginTop: 14, color: colors.ink, fontSize: 20, fontWeight: '800' },
  modalCaption: { maxWidth: 280, marginTop: 7, color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  qrCode: { width: 198, height: 198, flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, padding: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: '#FFFFFF' },
  qrCell: { width: 16, height: 16, backgroundColor: '#FFFFFF' },
  qrCellFilled: { backgroundColor: colors.ink },
  qrConfirmation: { marginTop: 12, color: colors.ink, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  modalStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 13, backgroundColor: colors.warmSoft },
  modalStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warm },
  modalStatusText: { color: colors.warm, fontSize: 8, fontWeight: '800' },
  modalDone: { width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 18, borderRadius: 16, backgroundColor: colors.teal },
  modalDoneText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
