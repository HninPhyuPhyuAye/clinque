export type ClinicFilter = 'Nearby' | 'Open now' | 'GP' | 'Dental';

export type Clinic = {
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

export type BookingStage = 'details' | 'schedule' | 'review' | 'success';

export type BookingDraft = {
  date: string;
  time: string;
  reason: string;
};

export const clinicFilters: ClinicFilter[] = ['Nearby', 'Open now', 'GP', 'Dental'];

export const appointmentDates = [
  { day: 'WED', date: '12', value: 'Wed, 12 Aug 2026' },
  { day: 'THU', date: '13', value: 'Thu, 13 Aug 2026' },
  { day: 'FRI', date: '14', value: 'Fri, 14 Aug 2026' },
  { day: 'SAT', date: '15', value: 'Sat, 15 Aug 2026' },
  { day: 'MON', date: '17', value: 'Mon, 17 Aug 2026' },
] as const;

export const appointmentTimes = [
  { label: '9:00 AM', available: false },
  { label: '9:40 AM', available: true },
  { label: '10:20 AM', available: true },
  { label: '11:10 AM', available: true },
  { label: '11:40 AM', available: true },
  { label: '2:10 PM', available: true },
] as const;

export const visitReasons = ['General consultation', 'Health screening', 'Vaccination'] as const;

export const clinics: Clinic[] = [
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
