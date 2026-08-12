import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import type { Appointment } from '@/features/appointments/appointment-context';

const notificationStorageKey = '@clinque/notifications';
const profileStorageKey = '@clinque/profile-preferences';

export type ClinqueNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  type: 'queue-soon' | 'doctor-ready';
};

type NotificationContextValue = {
  addQueueAlert: (appointment: Appointment) => Promise<ClinqueNotification | null>;
  loading: boolean;
  markAllRead: () => Promise<void>;
  notifications: ClinqueNotification[];
  unreadCount: number;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<ClinqueNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      try {
        const saved = await AsyncStorage.getItem(notificationStorageKey);
        if (saved && active) setNotifications(JSON.parse(saved) as ClinqueNotification[]);
      } catch {
        if (active) setNotifications([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadNotifications();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      addQueueAlert: async (appointment) => {
        if (!appointment.queue || !(await queueAlertsEnabled())) return null;

        const alert = createQueueAlert(appointment);
        if (!alert) return null;

        const existingAlert = notifications.find((notification) => notification.id === alert.id);
        if (existingAlert) return existingAlert;

        const nextNotifications = [alert, ...notifications].slice(0, 20);
        await persistNotifications(nextNotifications, setNotifications);
        return alert;
      },
      loading,
      markAllRead: async () => {
        const nextNotifications = notifications.map((notification) => ({ ...notification, read: true }));
        await persistNotifications(nextNotifications, setNotifications);
      },
      notifications,
      unreadCount: notifications.filter((notification) => !notification.read).length,
    }),
    [loading, notifications],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider');
  return context;
}

function createQueueAlert(appointment: Appointment): ClinqueNotification | null {
  if (!appointment.queue) return null;

  if (appointment.queue.status === 'called') {
    return {
      id: `${appointment.id}-doctor-ready`,
      title: 'The doctor is ready',
      message: `Please proceed to Consultation Room 3 at ${appointment.clinicName}.`,
      createdAt: new Date().toISOString(),
      read: false,
      type: 'doctor-ready',
    };
  }

  if (appointment.queue.position === 2) {
    return {
      id: `${appointment.id}-queue-soon`,
      title: 'Your turn is coming soon',
      message: `Two patients remain ahead of you at ${appointment.clinicName}.`,
      createdAt: new Date().toISOString(),
      read: false,
      type: 'queue-soon',
    };
  }

  return null;
}

async function queueAlertsEnabled() {
  try {
    const savedPreferences = await AsyncStorage.getItem(profileStorageKey);
    if (!savedPreferences) return true;
    const preferences = JSON.parse(savedPreferences) as { queueAlerts?: boolean };
    return preferences.queueAlerts ?? true;
  } catch {
    return true;
  }
}

async function persistNotifications(
  notifications: ClinqueNotification[],
  setNotifications: (notifications: ClinqueNotification[]) => void,
) {
  setNotifications(notifications);
  try {
    await AsyncStorage.setItem(notificationStorageKey, JSON.stringify(notifications));
  } catch {
    // Keep alerts available for the current session if device storage is unavailable.
  }
}
