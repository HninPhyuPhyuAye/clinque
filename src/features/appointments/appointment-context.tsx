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
};

type AppointmentContextValue = {
  appointment: Appointment | null;
  cancelAppointment: () => Promise<void>;
  loading: boolean;
  saveAppointment: (clinic: Clinic, draft: BookingDraft) => Promise<Appointment>;
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
      updateAppointment: async (draft) => {
        if (!appointment) return null;

        const updatedAppointment = { ...appointment, ...draft };
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
