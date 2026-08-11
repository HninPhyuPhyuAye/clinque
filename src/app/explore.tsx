import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type ClinicFilter = 'Nearby' | 'Open now' | 'GP' | 'Dental';

type Clinic = {
  id: string;
  name: string;
  specialty: string;
  distance: number;
  closesAt: string;
  rating: number;
  reviews: number;
  earliest: string;
  waitMinutes: number;
  categories: ClinicFilter[];
  accent: 'teal' | 'blue' | 'warm';
};

const colors = {
  background: '#F4F9F8',
  card: '#FFFFFF',
  ink: '#102A35',
  muted: '#6B8085',
  teal: '#0E746A',
  tealDark: '#0B555D',
  tealSoft: '#DDF4EE',
  line: '#DFEBE9',
  blue: '#415B87',
  blueSoft: '#E8EEFA',
  warm: '#9B6515',
  warmSoft: '#FFF4DD',
} as const;

const filters: ClinicFilter[] = ['Nearby', 'Open now', 'GP', 'Dental'];

const clinics: Clinic[] = [
  {
    id: 'novena-medical',
    name: 'Novena Medical Clinic',
    specialty: 'Family Medicine',
    distance: 0.8,
    closesAt: '9:00 PM',
    rating: 4.9,
    reviews: 284,
    earliest: 'Today, 11:10 AM',
    waitMinutes: 8,
    categories: ['Nearby', 'Open now', 'GP'],
    accent: 'teal',
  },
  {
    id: 'orchard-family',
    name: 'Orchard Family Clinic',
    specialty: 'General Practice',
    distance: 1.4,
    closesAt: '7:30 PM',
    rating: 4.8,
    reviews: 191,
    earliest: 'Today, 11:40 AM',
    waitMinutes: 14,
    categories: ['Nearby', 'Open now', 'GP'],
    accent: 'blue',
  },
  {
    id: 'smile-dental',
    name: 'Smileworks Dental Studio',
    specialty: 'General Dentistry',
    distance: 2.1,
    closesAt: '8:00 PM',
    rating: 4.7,
    reviews: 156,
    earliest: 'Tomorrow, 9:20 AM',
    waitMinutes: 22,
    categories: ['Open now', 'Dental'],
    accent: 'warm',
  },
];

function Icon({ name, color = colors.teal, size = 22 }: { name: SymbolName; color?: string; size?: number }) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}

export default function ClinicsScreen() {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ClinicFilter>('Nearby');
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);

  const visibleClinics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return clinics.filter((clinic) => {
      const matchesFilter = clinic.categories.includes(activeFilter);
      const matchesQuery =
        normalizedQuery.length === 0 ||
        clinic.name.toLowerCase().includes(normalizedQuery) ||
        clinic.specialty.toLowerCase().includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, query]);

  if (selectedClinic) {
    return <ClinicDetail clinic={selectedClinic} onBack={() => setSelectedClinic(null)} />;
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
            {filters.map((filter) => {
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
            <Text style={styles.resultCount}>{visibleClinics.length} RESULTS</Text>
          </View>

          <View style={styles.clinicList}>
            {visibleClinics.map((clinic) => (
              <ClinicCard clinic={clinic} key={clinic.id} onSelect={() => setSelectedClinic(clinic)} />
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

function ClinicDetail({ clinic, onBack }: { clinic: Clinic; onBack: () => void }) {
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
              title="10 Sinaran Drive, Singapore 307506"
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
            <Pressable accessibilityRole="button" style={styles.chooseTimeButton}>
              <Text style={styles.chooseTimeText}>Choose time</Text>
              <Icon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} color="#FFFFFF" size={17} />
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
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
