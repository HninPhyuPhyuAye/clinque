import { SymbolView } from 'expo-symbols';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Appointment, useAppointment } from '@/features/appointments/appointment-context';
import { supabase } from '@/lib/supabase';

import {
  appointmentDates,
  appointmentTimes,
  type BookingDraft,
  type BookingStage,
  type Clinic,
  type ClinicFilter,
  clinicFilters,
  clinics,
  visitReasons,
} from './clinic-data';
import { clinqueColors as colors } from './clinque-theme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

function Icon({ name, color = colors.teal, size = 22 }: { name: SymbolName; color?: string; size?: number }) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}

export function ClinicsFlow() {
  const router = useRouter();
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const { saveAppointment } = useAppointment();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ClinicFilter>('Nearby');
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [bookingStage, setBookingStage] = useState<BookingStage>('details');
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);
  const [availableClinics, setAvailableClinics] = useState<Clinic[]>(clinics);
  const [directoryState, setDirectoryState] = useState<'loading' | 'live' | 'fallback'>('loading');

  const requestedFilter = clinicFilters.find((clinicFilter) => clinicFilter === filter);

  useEffect(() => {
    if (requestedFilter) setActiveFilter(requestedFilter);
  }, [requestedFilter]);

  useEffect(() => {
    let active = true;

    async function loadClinics() {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, slug, name, specialty, address')
        .eq('is_active', true)
        .order('name');

      if (!active) return;

      if (error || !data) {
        setDirectoryState('fallback');
        return;
      }

      const databaseClinics = data.map((clinic, index) => {
        const presentation = clinics.find((item) => item.slug === clinic.slug) ?? clinics[index % clinics.length] ?? clinics[0];

        if (!presentation) throw new Error('Clinque requires at least one local clinic presentation template.');

        return {
          ...presentation,
          id: clinic.id,
          slug: clinic.slug,
          name: clinic.name,
          specialty: clinic.specialty,
          address: clinic.address,
        } satisfies Clinic;
      });

      setAvailableClinics(databaseClinics);
      setDirectoryState('live');
    }

    void loadClinics();

    return () => {
      active = false;
    };
  }, []);

  const visibleClinics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return availableClinics.filter((clinic) => {
      const matchesFilter = clinic.categories.includes(activeFilter);
      const matchesQuery =
        normalizedQuery.length === 0 ||
        clinic.name.toLowerCase().includes(normalizedQuery) ||
        clinic.specialty.toLowerCase().includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, availableClinics, query]);

  if (selectedClinic && bookingStage === 'schedule') {
    return (
      <BookingSchedule
        clinic={selectedClinic}
        initialDraft={bookingDraft}
        onBack={() => setBookingStage('details')}
        onContinue={(draft) => {
          setBookingDraft(draft);
          setBookingStage('review');
        }}
      />
    );
  }

  if (selectedClinic && bookingStage === 'review' && bookingDraft) {
    return (
      <BookingReview
        clinic={selectedClinic}
        draft={bookingDraft}
        onBack={() => setBookingStage('schedule')}
        onConfirm={async () => {
          const appointment = await saveAppointment(selectedClinic, bookingDraft);
          setConfirmedAppointment(appointment);
          setBookingStage('success');
        }}
      />
    );
  }

  if (selectedClinic && bookingStage === 'success' && bookingDraft && confirmedAppointment) {
    return (
      <BookingSuccess
        appointment={confirmedAppointment}
        clinic={selectedClinic}
        draft={bookingDraft}
        onDone={() => {
          setSelectedClinic(null);
          setBookingDraft(null);
          setConfirmedAppointment(null);
          setBookingStage('details');
          router.push('/journey');
        }}
      />
    );
  }

  if (selectedClinic) {
    return (
      <ClinicDetail
        clinic={selectedClinic}
        onBack={() => setSelectedClinic(null)}
        onChooseTime={() => setBookingStage('schedule')}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>CARE NEAR YOU</Text>
              <Text style={styles.title}>Find a clinic</Text>
            </View>
            <Pressable accessibilityLabel="Change location" style={styles.locationButton}>
              <Icon
                name={{ ios: 'location.fill', android: 'location_on', web: 'location_on' }}
                size={15}
              />
              <Text style={styles.locationText}>Singapore</Text>
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Icon name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} color="#829698" size={20} />
            <TextInput
              accessibilityLabel="Search clinics"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Search clinic, doctor, or specialty"
              placeholderTextColor="#829698"
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
            {query.length > 0 && (
              <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')}>
                <Icon
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  color="#A0B1B2"
                  size={18}
                />
              </Pressable>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
            style={styles.filterScroll}>
            {clinicFilters.map((filter) => {
              const selected = activeFilter === filter;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                  style={[styles.filterChip, selected && styles.filterChipActive]}>
                  <Text style={[styles.filterText, selected && styles.filterTextActive]}>{filter}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable style={styles.insightCard}>
            <View style={styles.insightIcon}>
              <Icon
                name={{ ios: 'chart.line.uptrend.xyaxis', android: 'moving', web: 'moving' }}
                size={19}
              />
            </View>
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>Shortest queue near you</Text>
              <Text style={styles.insightCaption}>Estimated wait from 8 minutes</Text>
            </View>
            <Icon
              name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
              color={colors.teal}
              size={18}
            />
          </Pressable>

          <View style={styles.resultHeader}>
            <Text style={styles.sectionTitle}>Recommended clinics</Text>
            <View style={styles.directoryStatus}>
              {directoryState === 'loading' && <ActivityIndicator color={colors.teal} size="small" />}
              <View style={[styles.directoryDot, directoryState === 'fallback' && styles.directoryDotFallback]} />
              <Text style={styles.directoryStatusText}>
                {directoryState === 'loading' ? 'SYNCING' : directoryState === 'live' ? 'LIVE DIRECTORY' : 'CACHED DEMO'}
              </Text>
              <Text style={styles.resultCount}>{visibleClinics.length} RESULTS</Text>
            </View>
          </View>

          {directoryState === 'fallback' && (
            <View style={styles.fallbackNotice}>
              <Icon name={{ ios: 'wifi.slash', android: 'wifi_off', web: 'wifi_off' }} color="#8A5B1F" size={16} />
              <Text style={styles.fallbackNoticeText}>The live directory is unavailable, so Clinque is showing cached demonstration clinics.</Text>
            </View>
          )}

          <View style={styles.clinicList}>
            {visibleClinics.map((clinic) => (
              <ClinicCard
                clinic={clinic}
                key={clinic.id}
                onSelect={() => {
                  setSelectedClinic(clinic);
                  setBookingStage('details');
                }}
              />
            ))}

            {visibleClinics.length === 0 && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Icon
                    name={{ ios: 'magnifyingglass', android: 'search_off', web: 'search_off' }}
                    color={colors.muted}
                    size={25}
                  />
                </View>
                <Text style={styles.emptyTitle}>No clinics found</Text>
                <Text style={styles.emptyCaption}>Try another search or specialty filter.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ClinicCard({ clinic, onSelect }: { clinic: Clinic; onSelect: () => void }) {
  const accent = getAccent(clinic.accent);

  return (
    <View style={styles.clinicCard}>
      <View style={styles.clinicTopRow}>
        <Pressable
          accessibilityLabel={`View ${clinic.name}`}
          onPress={onSelect}
          style={({ pressed }) => [styles.clinicSelection, pressed && styles.pressed]}>
          <View style={[styles.clinicLogo, { backgroundColor: accent.background }]}>
            <Icon
              name={{ ios: 'cross.case.fill', android: 'medical_services', web: 'medical_services' }}
              color={accent.foreground}
              size={22}
            />
          </View>

          <View style={styles.clinicContent}>
            <Text numberOfLines={1} style={styles.clinicName}>
              {clinic.name}
            </Text>
            <Text style={styles.clinicMeta}>
              {clinic.specialty} · {clinic.distance.toFixed(1)} km
            </Text>
            <Text style={styles.clinicMeta}>Open until {clinic.closesAt}</Text>
            <View style={styles.ratingRow}>
              <Icon name={{ ios: 'star.fill', android: 'star', web: 'star' }} color={colors.warm} size={14} />
              <Text style={styles.ratingText}>{clinic.rating.toFixed(1)}</Text>
              <Text style={styles.reviewText}>({clinic.reviews})</Text>
            </View>
          </View>
        </Pressable>

        <Pressable accessibilityLabel={`Save ${clinic.name}`} style={styles.favouriteButton}>
          <Icon name={{ ios: 'heart', android: 'favorite_border', web: 'favorite_border' }} color="#91A4A6" size={21} />
        </Pressable>
      </View>

      <View style={styles.availabilityRow}>
        <View style={styles.availabilityContent}>
          <Text style={styles.availabilityLabel}>EARLIEST AVAILABLE</Text>
          <View style={styles.timeRow}>
            <View style={styles.availableDot} />
            <Text style={styles.availableTime}>{clinic.earliest}</Text>
          </View>
          <Text style={styles.waitText}>Typical wait: {clinic.waitMinutes} min</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onSelect} style={styles.bookButton}>
          <Text style={styles.bookText}>Book now</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ClinicDetail({
  clinic,
  onBack,
  onChooseTime,
}: {
  clinic: Clinic;
  onBack: () => void;
  onChooseTime: () => void;
}) {
  const accent = getAccent(clinic.accent);

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScrollContent}>
          <View style={styles.detailNavigation}>
            <Pressable accessibilityLabel="Back to clinics" onPress={onBack} style={styles.backButton}>
              <Icon name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} color={colors.ink} size={21} />
            </Pressable>
            <Text style={styles.detailNavigationTitle}>Clinic details</Text>
            <Pressable accessibilityLabel={`Save ${clinic.name}`} style={styles.backButton}>
              <Icon name={{ ios: 'heart', android: 'favorite_border', web: 'favorite_border' }} color={colors.ink} size={20} />
            </Pressable>
          </View>

          <View style={styles.detailHero}>
            <View style={[styles.detailLogo, { backgroundColor: accent.background }]}>
              <Icon
                name={{ ios: 'cross.case.fill', android: 'medical_services', web: 'medical_services' }}
                color={accent.foreground}
                size={32}
              />
            </View>
            <Text style={styles.detailClinicName}>{clinic.name}</Text>
            <Text style={styles.detailSpecialty}>{clinic.specialty}</Text>
            <View style={styles.detailMetaRow}>
              <View style={styles.detailMetaItem}>
                <Icon name={{ ios: 'star.fill', android: 'star', web: 'star' }} color={colors.warm} size={15} />
                <Text style={styles.detailMetaStrong}>{clinic.rating.toFixed(1)}</Text>
                <Text style={styles.detailMetaMuted}>({clinic.reviews})</Text>
              </View>
              <View style={styles.detailMetaDivider} />
              <View style={styles.detailMetaItem}>
                <Icon name={{ ios: 'location.fill', android: 'location_on', web: 'location_on' }} color={colors.teal} size={15} />
                <Text style={styles.detailMetaStrong}>{clinic.distance.toFixed(1)} km</Text>
              </View>
              <View style={styles.detailMetaDivider} />
              <Text style={styles.openText}>Open now</Text>
            </View>
          </View>

          <View style={styles.queueDetailCard}>
            <View style={styles.queueDetailIcon}>
              <Icon name={{ ios: 'person.2.fill', android: 'groups', web: 'groups' }} color="#FFFFFF" size={20} />
            </View>
            <View style={styles.queueDetailContent}>
              <Text style={styles.queueDetailLabel}>LIVE QUEUE ESTIMATE</Text>
              <Text style={styles.queueDetailValue}>{clinic.waitMinutes}–{clinic.waitMinutes + 6} minutes</Text>
              <Text style={styles.queueDetailCaption}>Usually quieter before noon</Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          <Text style={styles.detailSectionTitle}>Clinic information</Text>
          <View style={styles.informationCard}>
            <InformationRow
              icon={{ ios: 'location', android: 'location_on', web: 'location_on' }}
              title={clinic.address}
              caption={`${clinic.distance.toFixed(1)} km from your location`}
            />
            <View style={styles.informationDivider} />
            <InformationRow
              icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
              title={`Open today until ${clinic.closesAt}`}
              caption="Walk-ins and appointments accepted"
            />
            <View style={styles.informationDivider} />
            <InformationRow
              icon={{ ios: 'phone', android: 'call', web: 'call' }}
              title="+65 6123 4567"
              caption="Call the clinic"
            />
          </View>

          <Text style={styles.detailSectionTitle}>Services</Text>
          <View style={styles.serviceRow}>
            {['General consultation', 'Health screening', 'Vaccination'].map((service) => (
              <View key={service} style={styles.serviceChip}>
                <Icon name={{ ios: 'checkmark', android: 'check', web: 'check' }} color={colors.teal} size={14} />
                <Text style={styles.serviceText}>{service}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.detailSectionTitle}>Available doctor</Text>
          <View style={styles.doctorCard}>
            <View style={styles.doctorAvatar}>
              <Text style={styles.doctorInitials}>SL</Text>
            </View>
            <View style={styles.doctorContent}>
              <Text style={styles.doctorName}>Dr. Sarah Lim</Text>
              <Text style={styles.doctorSpecialty}>Family Medicine · 12 years</Text>
              <Text style={styles.doctorLanguages}>English · Mandarin</Text>
            </View>
            <Icon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} color="#9CB0B1" size={20} />
          </View>

          <View style={styles.detailActionArea}>
            <View>
              <Text style={styles.nextAvailableLabel}>NEXT AVAILABLE</Text>
              <Text style={styles.nextAvailableTime}>{clinic.earliest}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onChooseTime} style={styles.chooseTimeButton}>
              <Text style={styles.chooseTimeText}>Choose time</Text>
              <Icon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} color="#FFFFFF" size={17} />
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function BookingSchedule({
  clinic,
  initialDraft,
  onBack,
  onContinue,
}: {
  clinic: Clinic;
  initialDraft: BookingDraft | null;
  onBack: () => void;
  onContinue: (draft: BookingDraft) => void;
}) {
  const [date, setDate] = useState(initialDraft?.date ?? appointmentDates[1].value);
  const [time, setTime] = useState(initialDraft?.time ?? '11:10 AM');
  const [reason, setReason] = useState(initialDraft?.reason ?? 'General consultation');

  return (
    <BookingPage
      actionLabel="Review appointment"
      onAction={() => onContinue({ date, time, reason })}
      onBack={onBack}
      progress={1}
      title="Choose a time">
      <View style={styles.bookingDoctorCard}>
        <View style={styles.bookingDoctorAvatar}>
          <Text style={styles.doctorInitials}>SL</Text>
        </View>
        <View style={styles.bookingDoctorContent}>
          <Text style={styles.bookingDoctorName}>Dr. Sarah Lim</Text>
          <Text style={styles.bookingDoctorClinic}>{clinic.name}</Text>
        </View>
        <View style={styles.verifiedPill}>
          <Icon name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} color={colors.teal} size={13} />
          <Text style={styles.verifiedText}>Verified</Text>
        </View>
      </View>

      <View style={styles.bookingSectionHeader}>
        <Text style={styles.bookingSectionTitle}>Select date</Text>
        <Text style={styles.bookingSectionMeta}>August 2026</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
        {appointmentDates.map((item) => {
          const selected = date === item.value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={item.value}
              onPress={() => setDate(item.value)}
              style={[styles.dateButton, selected && styles.dateButtonActive]}>
              <Text style={[styles.dateDay, selected && styles.dateTextActive]}>{item.day}</Text>
              <Text style={[styles.dateNumber, selected && styles.dateTextActive]}>{item.date}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.bookingSectionHeader}>
        <Text style={styles.bookingSectionTitle}>Available times</Text>
        <Text style={styles.bookingSectionMeta}>GMT+8</Text>
      </View>
      <View style={styles.timeGrid}>
        {appointmentTimes.map((item) => {
          const selected = time === item.label;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !item.available, selected }}
              disabled={!item.available}
              key={item.label}
              onPress={() => setTime(item.label)}
              style={[
                styles.timeButton,
                selected && styles.timeButtonActive,
                !item.available && styles.timeButtonUnavailable,
              ]}>
              <Text
                style={[
                  styles.timeText,
                  selected && styles.timeTextActive,
                  !item.available && styles.timeTextUnavailable,
                ]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.bookingSectionHeader}>
        <Text style={styles.bookingSectionTitle}>Visit reason</Text>
        <Text style={styles.requiredText}>REQUIRED</Text>
      </View>
      <View style={styles.reasonList}>
        {visitReasons.map((item) => {
          const selected = reason === item;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={item}
              onPress={() => setReason(item)}
              style={[styles.reasonButton, selected && styles.reasonButtonActive]}>
              <View style={[styles.reasonRadio, selected && styles.reasonRadioActive]}>
                {selected && <View style={styles.reasonRadioDot} />}
              </View>
              <View style={styles.reasonCopy}>
                <Text style={styles.reasonTitle}>{item}</Text>
                <Text style={styles.reasonCaption}>{getReasonCaption(item)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.bookingSummaryStrip}>
        <View style={styles.summaryStripIcon}>
          <Icon name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} color={colors.warm} size={18} />
        </View>
        <View>
          <Text style={styles.summaryStripTitle}>{formatBookingDate(date)} · {time}</Text>
          <Text style={styles.summaryStripCaption}>Estimated visit duration: 20 minutes</Text>
        </View>
      </View>
    </BookingPage>
  );
}

function BookingReview({
  clinic,
  draft,
  onBack,
  onConfirm,
}: {
  clinic: Clinic;
  draft: BookingDraft;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <BookingPage actionLabel="Confirm appointment" onAction={onConfirm} onBack={onBack} progress={2} title="Review booking">
      <View style={styles.reviewHero}>
        <View style={styles.reviewCalendarIcon}>
          <Icon name={{ ios: 'calendar.badge.checkmark', android: 'event_available', web: 'event_available' }} color={colors.teal} size={30} />
        </View>
        <Text style={styles.reviewDate}>{draft.date}</Text>
        <Text style={styles.reviewTime}>{draft.time}</Text>
        <Text style={styles.reviewTimezone}>Singapore time · GMT+8</Text>
      </View>

      <View style={styles.reviewCard}>
        <ReviewRow
          icon={{ ios: 'cross.case.fill', android: 'medical_services', web: 'medical_services' }}
          label="CLINIC"
          value={clinic.name}
          caption="10 Sinaran Drive, Singapore 307506"
        />
        <View style={styles.reviewDivider} />
        <ReviewRow
          icon={{ ios: 'person.fill', android: 'person', web: 'person' }}
          label="DOCTOR"
          value="Dr. Sarah Lim"
          caption="Family Medicine"
        />
        <View style={styles.reviewDivider} />
        <ReviewRow
          icon={{ ios: 'text.bubble.fill', android: 'chat', web: 'chat' }}
          label="VISIT REASON"
          value={draft.reason}
          caption="You can add more details at check-in"
        />
      </View>

      <View style={styles.arrivalCard}>
        <Icon name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} color={colors.blue} size={19} />
        <View style={styles.arrivalContent}>
          <Text style={styles.arrivalTitle}>Arrive 10 minutes early</Text>
          <Text style={styles.arrivalCaption}>You’ll receive a check-in reminder before the appointment.</Text>
        </View>
      </View>

      <View style={styles.policyCard}>
        <View style={styles.policyRow}>
          <Text style={styles.policyLabel}>Consultation estimate</Text>
          <Text style={styles.policyValue}>S$35–55</Text>
        </View>
        <View style={styles.policyDivider} />
        <View style={styles.policyRow}>
          <Text style={styles.policyLabel}>Cancellation</Text>
          <Text style={styles.policyValue}>Free up to 2 hours before</Text>
        </View>
      </View>

      <Text style={styles.consentText}>
        By confirming, you agree to share these appointment details with {clinic.name}.
      </Text>
    </BookingPage>
  );
}

function BookingSuccess({
  appointment,
  clinic,
  draft,
  onDone,
}: {
  appointment: Appointment;
  clinic: Clinic;
  draft: BookingDraft;
  onDone: () => void;
}) {
  return (
    <View style={styles.successScreen}>
      <SafeAreaView style={styles.successSafeArea}>
        <View style={styles.successContent}>
          <View style={styles.successMarkOuter}>
            <View style={styles.successMark}>
              <Icon name={{ ios: 'checkmark', android: 'check', web: 'check' }} color="#FFFFFF" size={34} />
            </View>
          </View>
          <Text style={styles.successTitle}>Appointment confirmed</Text>
          <Text style={styles.successCaption}>Your visit is booked. We’ll remind you when it’s time to check in.</Text>

          <View style={styles.successTicket}>
            <Text style={styles.ticketLabel}>APPOINTMENT</Text>
            <Text style={styles.ticketClinic}>{clinic.name}</Text>
            <View style={styles.ticketDivider} />
            <View style={styles.ticketDetails}>
              <View>
                <Text style={styles.ticketDetailLabel}>DATE</Text>
                <Text style={styles.ticketDetailValue}>{formatBookingDate(draft.date)}</Text>
              </View>
              <View>
                <Text style={styles.ticketDetailLabel}>TIME</Text>
                <Text style={styles.ticketDetailValue}>{draft.time}</Text>
              </View>
              <View>
                <Text style={styles.ticketDetailLabel}>DOCTOR</Text>
                <Text style={styles.ticketDetailValue}>Dr. Lim</Text>
              </View>
            </View>
            <View style={styles.confirmationPill}>
              <Icon name={{ ios: 'number', android: 'tag', web: 'tag' }} color={colors.teal} size={14} />
              <Text style={styles.confirmationText}>Confirmation {appointment.confirmationCode}</Text>
            </View>
          </View>

          <View style={styles.queueReadyCard}>
            <Icon name={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }} color={colors.teal} size={22} />
            <View style={styles.queueReadyContent}>
              <Text style={styles.queueReadyTitle}>Mobile check-in ready</Text>
              <Text style={styles.queueReadyCaption}>Your QR code will activate 30 minutes before the visit.</Text>
            </View>
          </View>

          <Pressable accessibilityRole="button" onPress={onDone} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>View journey</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function BookingPage({
  actionLabel,
  children,
  onAction,
  onBack,
  progress,
  title,
}: {
  actionLabel: string;
  children: ReactNode;
  onAction: () => void;
  onBack: () => void;
  progress: 1 | 2;
  title: string;
}) {
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.bookingScrollContent}>
          <View style={styles.detailNavigation}>
            <Pressable accessibilityLabel="Go back" onPress={onBack} style={styles.backButton}>
              <Icon name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} color={colors.ink} size={21} />
            </Pressable>
            <Text style={styles.detailNavigationTitle}>Book appointment</Text>
            <View style={styles.navigationSpacer} />
          </View>
          <View style={styles.progressRow}>
            {[1, 2, 3].map((step) => (
              <View key={step} style={[styles.progressBar, step <= progress && styles.progressBarActive]} />
            ))}
          </View>
          <Text style={styles.bookingKicker}>STEP {progress} OF 3</Text>
          <Text style={styles.bookingTitle}>{title}</Text>
          {children}
          <Pressable accessibilityRole="button" onPress={onAction} style={styles.bookingActionButton}>
            <Text style={styles.bookingActionText}>{actionLabel}</Text>
            <Icon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} color="#FFFFFF" size={18} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ReviewRow({
  caption,
  icon,
  label,
  value,
}: {
  caption: string;
  icon: SymbolName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewIcon}>
        <Icon name={icon} color={colors.teal} size={19} />
      </View>
      <View style={styles.reviewRowContent}>
        <Text style={styles.reviewRowLabel}>{label}</Text>
        <Text style={styles.reviewRowValue}>{value}</Text>
        <Text style={styles.reviewRowCaption}>{caption}</Text>
      </View>
    </View>
  );
}

function getReasonCaption(reason: string) {
  if (reason === 'Health screening') return 'Routine wellness tests and review';
  if (reason === 'Vaccination') return 'Discuss or receive a vaccination';
  return 'Discuss symptoms with your doctor';
}

function formatBookingDate(date: string) {
  return date.replace(' 2026', '');
}

function InformationRow({ icon, title, caption }: { icon: SymbolName; title: string; caption: string }) {
  return (
    <View style={styles.informationRow}>
      <View style={styles.informationIcon}>
        <Icon name={icon} color={colors.teal} size={18} />
      </View>
      <View style={styles.informationContent}>
        <Text style={styles.informationTitle}>{title}</Text>
        <Text style={styles.informationCaption}>{caption}</Text>
      </View>
    </View>
  );
}

function getAccent(accent: Clinic['accent']) {
  if (accent === 'blue') {
    return { background: colors.blueSoft, foreground: colors.blue };
  }
  if (accent === 'warm') {
    return { background: colors.warmSoft, foreground: colors.warm };
  }
  return { background: colors.tealSoft, foreground: colors.teal };
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
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  locationText: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
    paddingHorizontal: 15,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.card,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    color: colors.ink,
    fontSize: 13,
  },
  filterScroll: {
    marginHorizontal: -20,
    marginTop: 12,
  },
  filterContent: {
    gap: 8,
    paddingHorizontal: 20,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  filterChipActive: {
    borderColor: colors.teal,
    backgroundColor: colors.teal,
  },
  filterText: {
    color: '#61777B',
    fontSize: 11,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 20,
    padding: 15,
    borderRadius: 20,
    backgroundColor: '#DFF3EE',
  },
  insightIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.card,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    color: '#174A49',
    fontSize: 12,
    fontWeight: '800',
  },
  insightCaption: {
    marginTop: 3,
    color: '#5C7877',
    fontSize: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 27,
    marginBottom: 13,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  resultCount: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  directoryStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  directoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  directoryDotFallback: {
    backgroundColor: '#B97924',
  },
  directoryStatusText: {
    color: colors.teal,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  fallbackNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
    padding: 11,
    borderRadius: 14,
    backgroundColor: '#FFF2D8',
  },
  fallbackNoticeText: {
    flex: 1,
    color: '#76521B',
    fontSize: 9,
    lineHeight: 14,
  },
  clinicList: {
    gap: 12,
  },
  clinicCard: {
    padding: 17,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 23,
    backgroundColor: colors.card,
  },
  clinicTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  clinicSelection: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  clinicLogo: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  clinicContent: {
    flex: 1,
    minWidth: 0,
  },
  clinicName: {
    marginTop: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  clinicMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  ratingText: {
    color: colors.warm,
    fontSize: 10,
    fontWeight: '800',
  },
  reviewText: {
    color: '#829698',
    fontSize: 9,
    fontWeight: '600',
  },
  favouriteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 15,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E7F0EE',
  },
  availabilityContent: {
    flex: 1,
  },
  availabilityLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  availableTime: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '800',
  },
  waitText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 9,
  },
  bookButton: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: colors.teal,
  },
  bookText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  detailScrollContent: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 132,
  },
  detailNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    backgroundColor: colors.card,
  },
  detailNavigationTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  detailHero: {
    alignItems: 'center',
    paddingTop: 26,
    paddingBottom: 22,
  },
  detailLogo: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  detailClinicName: {
    marginTop: 15,
    color: colors.ink,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.55,
    textAlign: 'center',
  },
  detailSpecialty: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 15,
  },
  detailMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailMetaStrong: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '800',
  },
  detailMetaMuted: {
    color: colors.muted,
    fontSize: 9,
  },
  detailMetaDivider: {
    width: 1,
    height: 14,
    backgroundColor: colors.line,
  },
  openText: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: '800',
  },
  queueDetailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 17,
    borderRadius: 22,
    backgroundColor: colors.tealDark,
  },
  queueDetailIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  queueDetailContent: {
    flex: 1,
  },
  queueDetailLabel: {
    color: '#AED8D3',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  queueDetailValue: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  queueDetailCaption: {
    marginTop: 3,
    color: '#C8E5E1',
    fontSize: 9,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#76E0C5',
  },
  liveText: {
    color: '#DDF9F2',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  detailSectionTitle: {
    marginTop: 26,
    marginBottom: 12,
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  informationCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    backgroundColor: colors.card,
  },
  informationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  informationIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.tealSoft,
  },
  informationContent: {
    flex: 1,
  },
  informationTitle: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  informationCaption: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 9,
  },
  informationDivider: {
    height: 1,
    marginVertical: 13,
    backgroundColor: '#E7F0EE',
  },
  serviceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    backgroundColor: colors.card,
  },
  serviceText: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: '700',
  },
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    backgroundColor: colors.card,
  },
  doctorAvatar: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.blueSoft,
  },
  doctorInitials: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: '900',
  },
  doctorContent: {
    flex: 1,
  },
  doctorName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  doctorSpecialty: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 9,
  },
  doctorLanguages: {
    marginTop: 5,
    color: colors.teal,
    fontSize: 9,
    fontWeight: '700',
  },
  detailActionArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    backgroundColor: colors.card,
  },
  nextAvailableLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  nextAvailableTime: {
    marginTop: 5,
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  chooseTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.teal,
  },
  chooseTimeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  bookingScrollContent: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120,
  },
  navigationSpacer: {
    width: 44,
    height: 44,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 22,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.line,
  },
  progressBarActive: {
    backgroundColor: colors.teal,
  },
  bookingKicker: {
    marginTop: 23,
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bookingTitle: {
    marginTop: 5,
    color: colors.ink,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.65,
  },
  bookingDoctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  bookingDoctorAvatar: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.blueSoft,
  },
  bookingDoctorContent: {
    flex: 1,
  },
  bookingDoctorName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  bookingDoctorClinic: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 9,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 11,
    backgroundColor: colors.tealSoft,
  },
  verifiedText: {
    color: colors.teal,
    fontSize: 8,
    fontWeight: '800',
  },
  bookingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 25,
    marginBottom: 12,
  },
  bookingSectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  bookingSectionMeta: {
    color: colors.teal,
    fontSize: 9,
    fontWeight: '800',
  },
  requiredText: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  dateRow: {
    gap: 8,
  },
  dateButton: {
    width: 63,
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.card,
  },
  dateButtonActive: {
    borderColor: colors.teal,
    backgroundColor: colors.teal,
  },
  dateDay: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '800',
  },
  dateNumber: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  dateTextActive: {
    color: '#FFFFFF',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeButton: {
    width: '31%',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  timeButtonActive: {
    borderWidth: 2,
    borderColor: colors.teal,
    backgroundColor: colors.tealSoft,
  },
  timeButtonUnavailable: {
    backgroundColor: '#EDF3F1',
  },
  timeText: {
    color: '#496266',
    fontSize: 10,
    fontWeight: '700',
  },
  timeTextActive: {
    color: colors.teal,
    fontWeight: '800',
  },
  timeTextUnavailable: {
    color: '#B5C1C2',
    textDecorationLine: 'line-through',
  },
  reasonList: {
    gap: 8,
  },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 17,
    backgroundColor: colors.card,
  },
  reasonButtonActive: {
    borderColor: colors.teal,
    backgroundColor: '#F7FCFA',
  },
  reasonRadio: {
    width: 19,
    height: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#A7B8B8',
    borderRadius: 10,
  },
  reasonRadioActive: {
    borderColor: colors.teal,
  },
  reasonRadioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.teal,
  },
  reasonCopy: {
    flex: 1,
  },
  reasonTitle: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  reasonCaption: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 9,
  },
  bookingSummaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 22,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.warmSoft,
  },
  summaryStripIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  summaryStripTitle: {
    color: '#61430F',
    fontSize: 10,
    fontWeight: '800',
  },
  summaryStripCaption: {
    marginTop: 4,
    color: '#876727',
    fontSize: 8,
  },
  bookingActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    minHeight: 54,
    marginTop: 24,
    borderRadius: 18,
    backgroundColor: colors.teal,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 6,
  },
  bookingActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  reviewHero: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 22,
  },
  reviewCalendarIcon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: colors.tealSoft,
  },
  reviewDate: {
    marginTop: 14,
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  reviewTime: {
    marginTop: 4,
    color: colors.teal,
    fontSize: 25,
    fontWeight: '800',
  },
  reviewTimezone: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 9,
  },
  reviewCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    backgroundColor: colors.card,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.tealSoft,
  },
  reviewRowContent: {
    flex: 1,
  },
  reviewRowLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  reviewRowValue: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  reviewRowCaption: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 9,
  },
  reviewDivider: {
    height: 1,
    marginVertical: 14,
    backgroundColor: '#E7F0EE',
  },
  arrivalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.blueSoft,
  },
  arrivalContent: {
    flex: 1,
  },
  arrivalTitle: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: '800',
  },
  arrivalCaption: {
    marginTop: 3,
    color: '#647492',
    fontSize: 9,
    lineHeight: 13,
  },
  policyCard: {
    marginTop: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.card,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  policyLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  policyValue: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'right',
  },
  policyDivider: {
    height: 1,
    marginVertical: 12,
    backgroundColor: '#E7F0EE',
  },
  consentText: {
    marginTop: 16,
    paddingHorizontal: 12,
    color: colors.muted,
    fontSize: 8,
    lineHeight: 13,
    textAlign: 'center',
  },
  successScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  successSafeArea: {
    flex: 1,
  },
  successContent: {
    width: '100%',
    maxWidth: 540,
    flex: 1,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  successMarkOuter: {
    width: 88,
    height: 88,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 44,
    backgroundColor: colors.tealSoft,
  },
  successMark: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
    backgroundColor: colors.teal,
  },
  successTitle: {
    marginTop: 20,
    color: colors.ink,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  successCaption: {
    alignSelf: 'center',
    maxWidth: 360,
    marginTop: 8,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  successTicket: {
    marginTop: 24,
    padding: 19,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    backgroundColor: colors.card,
  },
  ticketLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  ticketClinic: {
    marginTop: 5,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  ticketDivider: {
    height: 1,
    marginVertical: 15,
    backgroundColor: '#E7F0EE',
  },
  ticketDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  ticketDetailLabel: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  ticketDetailValue: {
    marginTop: 5,
    color: colors.ink,
    fontSize: 10,
    fontWeight: '800',
  },
  confirmationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 17,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: colors.tealSoft,
  },
  confirmationText: {
    color: colors.teal,
    fontSize: 9,
    fontWeight: '800',
  },
  queueReadyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 13,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.warmSoft,
  },
  queueReadyContent: {
    flex: 1,
  },
  queueReadyTitle: {
    color: '#61430F',
    fontSize: 10,
    fontWeight: '800',
  },
  queueReadyCaption: {
    marginTop: 3,
    color: '#876727',
    fontSize: 8,
  },
  doneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 17,
    borderRadius: 17,
    backgroundColor: colors.teal,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 23,
    backgroundColor: colors.card,
  },
  emptyIcon: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#EDF4F2',
  },
  emptyTitle: {
    marginTop: 13,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyCaption: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
  },
});
