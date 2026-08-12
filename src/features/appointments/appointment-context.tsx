import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import type { BookingDraft, Clinic } from '@/features/clinics/clinic-data';

const appointmentStorageKey = '@clinque/current-appointment';
const visitHistoryStorageKey = '@clinque/visit-history';

export type Appointment = {
  id: string;
  confirmationCode: string;
  clinicId: string;
  clinicName: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  reason: string;
  waitMinutes: number;
  bookedAt: string;
  queue?: QueueState;
};

export type QueueState = {
  status: 'waiting' | 'called';
  position: number;
  estimatedMinutes: number;
  checkedInAt: string;
  lastUpdatedAt: string;
};

export type CompletedVisit = {
  id: string;
  date: string;
  title: string;
  clinic: string;
  doctor: string;
  specialty: string;
  completedAt: string;
  diagnosis: string;
  medication: string;
  followUp: string;
};

type AppointmentContextValue = {
  appointment: Appointment | null;
  advanceQueue: () => Promise<Appointment | null>;
  cancelAppointment: () => Promise<void>;
  completeConsultation: () => Promise<CompletedVisit | null>;
  loading: boolean;
  saveAppointment: (clinic: Clinic, draft: BookingDraft) => Promise<Appointment>;
  startQueue: () => Promise<Appointment | null>;
  updateAppointment: (draft: Pick<BookingDraft, 'date' | 'time'>) => Promise<Appointment | null>;
  visitHistory: CompletedVisit[];
};

const AppointmentContext = createContext<AppointmentContextValue | null>(null);

export function AppointmentProvider({ children }: { children: ReactNode }) {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [visitHistory, setVisitHistory] = useState<CompletedVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadAppointment() {
      try {
        const [savedAppointment, savedVisitHistory] = await Promise.all([
          AsyncStorage.getItem(appointmentStorageKey),
          AsyncStorage.getItem(visitHistoryStorageKey),
        ]);
        if (savedAppointment && active) {
          setAppointment(JSON.parse(savedAppointment) as Appointment);
        }
        if (savedVisitHistory && active) {
          setVisitHistory(JSON.parse(savedVisitHistory) as CompletedVisit[]);
        }
      } catch {
        // A corrupt local value should not prevent the rest of Clinque from loading.
        if (active) setAppointment(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAppointment();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AppointmentContextValue>(
    () => ({
      appointment,
      advanceQueue: async () => {
        if (!appointment?.queue) return appointment;

        const nextPosition = Math.max(appointment.queue.position - 1, 0);
        const updatedAppointment: Appointment = {
          ...appointment,
          queue: {
            ...appointment.queue,
            status: nextPosition === 0 ? 'called' : 'waiting',
            position: nextPosition,
            estimatedMinutes: nextPosition === 0 ? 0 : Math.max(nextPosition * 3, 3),
            lastUpdatedAt: new Date().toISOString(),
          },
        };

        await persistAppointment(updatedAppointment, setAppointment);
        return updatedAppointment;
      },
      cancelAppointment: async () => {
        setAppointment(null);
        try {
          await AsyncStorage.removeItem(appointmentStorageKey);
        } catch {
          // Keep the appointment cancelled for the current session if device storage is unavailable.
        }
      },
      completeConsultation: async () => {
        if (!appointment?.queue || appointment.queue.status !== 'called') return null;

        const completedVisit = createCompletedVisit(appointment);
        const nextVisitHistory = [completedVisit, ...visitHistory];

        setAppointment(null);
        setVisitHistory(nextVisitHistory);
        try {
          await Promise.all([
            AsyncStorage.removeItem(appointmentStorageKey),
            AsyncStorage.setItem(visitHistoryStorageKey, JSON.stringify(nextVisitHistory)),
          ]);
        } catch {
          // Keep the completed visit available for the current session if storage is unavailable.
        }

        return completedVisit;
      },
      loading,
      saveAppointment: async (clinic, draft) => {
        const nextAppointment = createAppointment(clinic, draft);

        setAppointment(nextAppointment);
        try {
          await AsyncStorage.setItem(appointmentStorageKey, JSON.stringify(nextAppointment));
        } catch {
          // Keep the booking available for the current session if device storage is unavailable.
        }

        return nextAppointment;
      },
      startQueue: async () => {
        if (!appointment) return null;
        if (appointment.queue) return appointment;

        const now = new Date().toISOString();
        const updatedAppointment: Appointment = {
          ...appointment,
          queue: {
            status: 'waiting',
            position: 4,
            estimatedMinutes: 12,
            checkedInAt: now,
            lastUpdatedAt: now,
          },
        };

        await persistAppointment(updatedAppointment, setAppointment);
        return updatedAppointment;
      },
      updateAppointment: async (draft) => {
        if (!appointment) return null;

        const updatedAppointment = { ...appointment, ...draft, queue: undefined };
        setAppointment(updatedAppointment);

        try {
          await AsyncStorage.setItem(appointmentStorageKey, JSON.stringify(updatedAppointment));
        } catch {
          // Keep the updated booking available for the current session if device storage is unavailable.
        }

        return updatedAppointment;
      },
      visitHistory,
    }),
    [appointment, loading, visitHistory],
  );

  return <AppointmentContext.Provider value={value}>{children}</AppointmentContext.Provider>;
}

async function persistAppointment(
  appointment: Appointment,
  setAppointment: (appointment: Appointment) => void,
) {
  setAppointment(appointment);
  try {
    await AsyncStorage.setItem(appointmentStorageKey, JSON.stringify(appointment));
  } catch {
    // Keep the latest state for the current session if device storage is unavailable.
  }
}

export function useAppointment() {
  const context = useContext(AppointmentContext);

  if (!context) {
    throw new Error('useAppointment must be used inside AppointmentProvider');
  }

  return context;
}

function createAppointment(clinic: Clinic, draft: BookingDraft): Appointment {
  const confirmationSuffix = `${draft.date.match(/\d+/)?.[0] ?? '00'}${toTwentyFourHour(draft.time).replace(':', '')}`;

  return {
    id: `${clinic.id}-${Date.now()}`,
    confirmationCode: `CQ-${confirmationSuffix}`,
    clinicId: clinic.id,
    clinicName: clinic.name,
    doctorName: 'Dr. Sarah Lim',
    specialty: clinic.specialty,
    date: draft.date,
    time: draft.time,
    reason: draft.reason,
    waitMinutes: clinic.waitMinutes,
    bookedAt: new Date().toISOString(),
  };
}

function createCompletedVisit(appointment: Appointment): CompletedVisit {
  return {
    id: `${appointment.id}-completed`,
    date: new Intl.DateTimeFormat('en-SG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()),
    title: appointment.reason === 'Health screening' ? 'Health screening' : 'Family medicine consultation',
    clinic: appointment.clinicName,
    doctor: appointment.doctorName,
    specialty: appointment.specialty,
    completedAt: new Date().toISOString(),
    diagnosis: 'Upper respiratory tract infection',
    medication: 'Paracetamol 500 mg · Take when needed',
    followUp: 'Monitor symptoms for 3 days. Return if fever persists.',
  };
}

function toTwentyFourHour(time: string) {
  const [clock, period] = time.split(' ');
  const [hourValue, minutes] = clock.split(':').map(Number);
  let hour = hourValue;

  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;

  return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
