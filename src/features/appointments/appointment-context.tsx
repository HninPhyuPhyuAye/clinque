import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import type { BookingDraft, Clinic } from '@/features/clinics/clinic-data';

const appointmentStorageKey = '@clinque/current-appointment';

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

type AppointmentContextValue = {
  appointment: Appointment | null;
  advanceQueue: () => Promise<Appointment | null>;
  cancelAppointment: () => Promise<void>;
  loading: boolean;
  saveAppointment: (clinic: Clinic, draft: BookingDraft) => Promise<Appointment>;
  startQueue: () => Promise<Appointment | null>;
  updateAppointment: (draft: Pick<BookingDraft, 'date' | 'time'>) => Promise<Appointment | null>;
};

const AppointmentContext = createContext<AppointmentContextValue | null>(null);

export function AppointmentProvider({ children }: { children: ReactNode }) {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadAppointment() {
      try {
        const savedAppointment = await AsyncStorage.getItem(appointmentStorageKey);
        if (savedAppointment && active) {
          setAppointment(JSON.parse(savedAppointment) as Appointment);
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
    }),
    [appointment, loading],
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

function toTwentyFourHour(time: string) {
  const [clock, period] = time.split(' ');
  const [hourValue, minutes] = clock.split(':').map(Number);
  let hour = hourValue;

  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;

  return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
