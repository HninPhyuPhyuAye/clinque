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
              <ClinicCard clinic={clinic} key={clinic.id} />
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

function ClinicCard({ clinic }: { clinic: Clinic }) {
  const accent = getAccent(clinic.accent);

  return (
    <View style={styles.clinicCard}>
      <View style={styles.clinicTopRow}>
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
        <Pressable accessibilityRole="button" style={styles.bookButton}>
          <Text style={styles.bookText}>Book now</Text>
        </Pressable>
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
