import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/features/auth/auth-context";
import type { BookingDraft, Clinic } from "@/features/clinics/clinic-data";
import { supabase } from "@/lib/supabase";

const appointmentStorageKey = "@clinque/current-appointment";
const visitHistoryStorageKey = "@clinque/visit-history";

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
  status: "waiting" | "called" | "consulting" | "completed";
  position: number;
  estimatedMinutes: number;
  checkedInAt: string;
  consultationStartedAt?: string;
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
  careTasks: CareTask[];
};

export type CareTask = {
  id: "medication" | "hydration" | "symptoms";
  title: string;
  caption: string;
  completed: boolean;
};

type AppointmentContextValue = {
  appointment: Appointment | null;
  advanceQueue: () => Promise<Appointment | null>;
  cancelAppointment: () => Promise<void>;
  completeConsultation: () => Promise<CompletedVisit | null>;
  createDemoQueue: () => Promise<Appointment>;
  loading: boolean;
  syncError: string | null;
  saveAppointment: (
    clinic: Clinic,
    draft: BookingDraft,
  ) => Promise<Appointment>;
  startConsultation: () => Promise<Appointment | null>;
  startQueue: () => Promise<Appointment | null>;
  toggleCareTask: (visitId: string, taskId: CareTask["id"]) => Promise<void>;
  updateAppointment: (
    draft: Pick<BookingDraft, "date" | "time">,
  ) => Promise<Appointment | null>;
  visitHistory: CompletedVisit[];
};

const AppointmentContext = createContext<AppointmentContextValue | null>(null);

export function AppointmentProvider({ children }: { children: ReactNode }) {
  const { isDemo, user } = useAuth();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [visitHistory, setVisitHistory] = useState<CompletedVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAppointment() {
      setLoading(true);
      setSyncError(null);
      try {
        const savedVisitHistory = await AsyncStorage.getItem(
          visitHistoryStorageKey,
        );
        if (savedVisitHistory && active) {
          const savedVisits = JSON.parse(savedVisitHistory) as Array<
            CompletedVisit & { careTasks?: CareTask[] }
          >;
          setVisitHistory(
            savedVisits.map((visit) => ({
              ...visit,
              careTasks: visit.careTasks ?? createCareTasks(),
            })),
          );
        }

        if (user && !isDemo) {
          const { data, error } = await supabase
            .from("appointments")
            .select(
              "id, confirmation_code, clinic_id, doctor_name, reason, scheduled_at, status, created_at",
            )
            .eq("patient_id", user.id)
            .in("status", [
              "booked",
              "checked_in",
              "waiting",
              "called",
              "consulting",
            ])
            .order("scheduled_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (error) throw error;
          if (!data) {
            if (active) setAppointment(null);
            return;
          }

          const { data: clinic, error: clinicError } = await supabase
            .from("clinics")
            .select("name, specialty")
            .eq("id", data.clinic_id)
            .single();

          if (clinicError) throw clinicError;
          const { data: queue, error: queueError } = await supabase
            .from("queue_entries")
            .select(
              "status, position, estimated_minutes, checked_in_at, consultation_started_at, updated_at",
            )
            .eq("appointment_id", data.id)
            .in("status", ["waiting", "called", "consulting"])
            .maybeSingle();

          if (queueError) throw queueError;
          if (active)
            setAppointment(mapDatabaseAppointment(data, clinic, queue));
          return;
        }

        const savedAppointment = await AsyncStorage.getItem(
          appointmentStorageKey,
        );
        if (savedAppointment && active) {
          setAppointment(JSON.parse(savedAppointment) as Appointment);
        }
      } catch (error) {
        // A corrupt local value should not prevent the rest of Clinque from loading.
        if (active) {
          setAppointment(null);
          setSyncError(
            error instanceof Error
              ? `Clinque could not load your secure appointment: ${error.message}`
              : "Clinque could not load your secure appointment. Check your connection and try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAppointment();

    return () => {
      active = false;
    };
  }, [isDemo, user]);

  useEffect(() => {
    if (!user || isDemo || !appointment) return;

    const channel = supabase
      .channel(`patient-queue-${appointment.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
          filter: `patient_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as Partial<DatabaseQueueEntry>;
          if (
            !isDatabaseQueueEntry(row) ||
            row.appointment_id !== appointment.id
          )
            return;

          setAppointment((current) =>
            current ? { ...current, queue: mapDatabaseQueue(row) } : current,
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [appointment?.id, isDemo, user]);

  const value = useMemo<AppointmentContextValue>(
    () => ({
      appointment,
      advanceQueue: async () => {
        if (!appointment?.queue) return appointment;

        if (user && !isDemo) {
          const { data, error } = await supabase.rpc("advance_queue_entry", {
            p_appointment_id: appointment.id,
          });

          if (error) throw error;
          return syncQueueFromDatabase(data, appointment, setAppointment);
        }

        const nextPosition = Math.max(appointment.queue.position - 1, 0);
        const updatedAppointment: Appointment = {
          ...appointment,
          queue: {
            ...appointment.queue,
            status: nextPosition === 0 ? "called" : "waiting",
            position: nextPosition,
            estimatedMinutes:
              nextPosition === 0 ? 0 : Math.max(nextPosition * 3, 3),
            lastUpdatedAt: new Date().toISOString(),
          },
        };

        await persistAppointment(updatedAppointment, setAppointment);
        return updatedAppointment;
      },
      cancelAppointment: async () => {
        if (user && !isDemo && appointment) {
          const { error } = await supabase
            .from("appointments")
            .update({ status: "cancelled" })
            .eq("id", appointment.id)
            .eq("patient_id", user.id);

          if (error) throw error;
          setAppointment(null);
          return;
        }

        setAppointment(null);
        try {
          await AsyncStorage.removeItem(appointmentStorageKey);
        } catch {
          // Keep the appointment cancelled for the current session if device storage is unavailable.
        }
      },
      completeConsultation: async () => {
        if (!appointment?.queue || appointment.queue.status !== "consulting")
          return null;

        const completedVisit = createCompletedVisit(appointment);
        const nextVisitHistory = [completedVisit, ...visitHistory];
        const completedAppointment: Appointment = {
          ...appointment,
          queue: {
            ...appointment.queue,
            status: "completed",
            lastUpdatedAt: new Date().toISOString(),
          },
        };

        if (user && !isDemo) {
          const { error } = await supabase.rpc("complete_consultation", {
            p_appointment_id: appointment.id,
          });

          if (error) throw error;
        }

        setAppointment(completedAppointment);
        setVisitHistory(nextVisitHistory);
        try {
          await Promise.all([
            AsyncStorage.setItem(
              appointmentStorageKey,
              JSON.stringify(completedAppointment),
            ),
            AsyncStorage.setItem(
              visitHistoryStorageKey,
              JSON.stringify(nextVisitHistory),
            ),
          ]);
        } catch {
          // Keep the completed visit available for the current session if storage is unavailable.
        }

        return completedVisit;
      },
      createDemoQueue: async () => {
        const demoAppointment = createAppointment(
          {
            id: "novena-medical",
            slug: "novena-medical",
            name: "Novena Medical Clinic",
            specialty: "Family Medicine",
            address: "10 Sinaran Drive, Singapore 307506",
            distance: 0.8,
            closesAt: "9:00 PM",
            rating: 4.9,
            reviews: 284,
            earliest: "Today, 11:10 AM",
            waitMinutes: 8,
            categories: ["Nearby", "Open now", "GP"],
            accent: "teal",
          },
          {
            date: "Thu, 13 Aug 2026",
            time: "11:10 AM",
            reason: "General consultation",
          },
        );
        const now = new Date().toISOString();
        const queuedAppointment: Appointment = {
          ...demoAppointment,
          queue: {
            status: "waiting",
            position: 4,
            estimatedMinutes: 12,
            checkedInAt: now,
            lastUpdatedAt: now,
          },
        };

        await persistAppointment(queuedAppointment, setAppointment);
        return queuedAppointment;
      },
      loading,
      saveAppointment: async (clinic, draft) => {
        if (user && !isDemo) {
          const confirmationCode = createConfirmationCode();
          const { data, error } = await supabase
            .from("appointments")
            .insert({
              patient_id: user.id,
              clinic_id: clinic.id,
              confirmation_code: confirmationCode,
              doctor_name: "Dr. Sarah Lim",
              reason: draft.reason,
              scheduled_at: toScheduledAt(draft.date, draft.time),
              status: "booked",
            })
            .select(
              "id, confirmation_code, clinic_id, doctor_name, reason, scheduled_at, created_at",
            )
            .single();

          if (error) throw error;

          const remoteAppointment = createAppointment(clinic, draft, {
            id: data.id,
            confirmationCode: data.confirmation_code,
            bookedAt: data.created_at,
          });
          setAppointment(remoteAppointment);
          return remoteAppointment;
        }

        const nextAppointment = createAppointment(clinic, draft);

        setAppointment(nextAppointment);
        try {
          await AsyncStorage.setItem(
            appointmentStorageKey,
            JSON.stringify(nextAppointment),
          );
        } catch {
          // Keep the booking available for the current session if device storage is unavailable.
        }

        return nextAppointment;
      },
      syncError,
      startConsultation: async () => {
        if (!appointment?.queue || appointment.queue.status !== "called")
          return appointment;

        const startedAt = new Date().toISOString();
        const consultingAppointment: Appointment = {
          ...appointment,
          queue: {
            ...appointment.queue,
            status: "consulting",
            consultationStartedAt: startedAt,
            lastUpdatedAt: startedAt,
          },
        };

        if (user && !isDemo) {
          const { data, error } = await supabase.rpc("start_consultation", {
            p_appointment_id: appointment.id,
          });

          if (error) throw error;
          return syncQueueFromDatabase(data, appointment, setAppointment);
        }

        await persistAppointment(consultingAppointment, setAppointment);
        return consultingAppointment;
      },
      startQueue: async () => {
        if (!appointment) return null;
        if (appointment.queue) return appointment;

        const now = new Date().toISOString();

        if (user && !isDemo) {
          const { data, error } = await supabase
            .from("queue_entries")
            .insert({
              appointment_id: appointment.id,
              clinic_id: appointment.clinicId,
              patient_id: user.id,
              position: 4,
              estimated_minutes: 12,
              status: "waiting",
            })
            .select(
              "appointment_id, status, position, estimated_minutes, checked_in_at, consultation_started_at, updated_at",
            )
            .single();

          if (error) throw error;

          const { error: appointmentError } = await supabase
            .from("appointments")
            .update({ status: "checked_in" })
            .eq("id", appointment.id)
            .eq("patient_id", user.id);

          if (appointmentError) throw appointmentError;

          const checkedInAppointment = {
            ...appointment,
            queue: mapDatabaseQueue(data),
          };
          setAppointment(checkedInAppointment);
          return checkedInAppointment;
        }

        const updatedAppointment: Appointment = {
          ...appointment,
          queue: {
            status: "waiting",
            position: 4,
            estimatedMinutes: 12,
            checkedInAt: now,
            lastUpdatedAt: now,
          },
        };

        await persistAppointment(updatedAppointment, setAppointment);
        return updatedAppointment;
      },
      toggleCareTask: async (visitId, taskId) => {
        const nextVisitHistory = visitHistory.map((visit) =>
          visit.id === visitId
            ? {
                ...visit,
                careTasks: visit.careTasks.map((task) =>
                  task.id === taskId
                    ? { ...task, completed: !task.completed }
                    : task,
                ),
              }
            : visit,
        );

        setVisitHistory(nextVisitHistory);
        try {
          await AsyncStorage.setItem(
            visitHistoryStorageKey,
            JSON.stringify(nextVisitHistory),
          );
        } catch {
          // Keep progress available for the current session if storage is unavailable.
        }
      },
      updateAppointment: async (draft) => {
        if (!appointment) return null;

        const updatedAppointment = {
          ...appointment,
          ...draft,
          queue: undefined,
        };

        if (user && !isDemo) {
          const { error } = await supabase
            .from("appointments")
            .update({
              scheduled_at: toScheduledAt(draft.date, draft.time),
              status: "booked",
            })
            .eq("id", appointment.id)
            .eq("patient_id", user.id);

          if (error) throw error;
          setAppointment(updatedAppointment);
          return updatedAppointment;
        }

        setAppointment(updatedAppointment);

        try {
          await AsyncStorage.setItem(
            appointmentStorageKey,
            JSON.stringify(updatedAppointment),
          );
        } catch {
          // Keep the updated booking available for the current session if device storage is unavailable.
        }

        return updatedAppointment;
      },
      visitHistory,
    }),
    [appointment, isDemo, loading, syncError, user, visitHistory],
  );

  return (
    <AppointmentContext.Provider value={value}>
      {children}
    </AppointmentContext.Provider>
  );
}

async function persistAppointment(
  appointment: Appointment,
  setAppointment: (appointment: Appointment) => void,
) {
  setAppointment(appointment);
  try {
    await AsyncStorage.setItem(
      appointmentStorageKey,
      JSON.stringify(appointment),
    );
  } catch {
    // Keep the latest state for the current session if device storage is unavailable.
  }
}

export function useAppointment() {
  const context = useContext(AppointmentContext);

  if (!context) {
    throw new Error("useAppointment must be used inside AppointmentProvider");
  }

  return context;
}

function createAppointment(
  clinic: Clinic,
  draft: BookingDraft,
  remote?: Pick<Appointment, "bookedAt" | "confirmationCode" | "id">,
): Appointment {
  const confirmationSuffix = `${draft.date.match(/\d+/)?.[0] ?? "00"}${toTwentyFourHour(draft.time).replace(":", "")}`;

  return {
    id: remote?.id ?? `${clinic.id}-${Date.now()}`,
    confirmationCode: remote?.confirmationCode ?? `CQ-${confirmationSuffix}`,
    clinicId: clinic.id,
    clinicName: clinic.name,
    doctorName: "Dr. Sarah Lim",
    specialty: clinic.specialty,
    date: draft.date,
    time: draft.time,
    reason: draft.reason,
    waitMinutes: clinic.waitMinutes,
    bookedAt: remote?.bookedAt ?? new Date().toISOString(),
  };
}

function createCompletedVisit(appointment: Appointment): CompletedVisit {
  return {
    id: `${appointment.id}-completed`,
    date: new Intl.DateTimeFormat("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date()),
    title:
      appointment.reason === "Health screening"
        ? "Health screening"
        : "Family medicine consultation",
    clinic: appointment.clinicName,
    doctor: appointment.doctorName,
    specialty: appointment.specialty,
    completedAt: new Date().toISOString(),
    diagnosis: "Upper respiratory tract infection",
    medication: "Paracetamol 500 mg · Take when needed",
    followUp: "Monitor symptoms for 3 days. Return if fever persists.",
    careTasks: createCareTasks(),
  };
}

function createCareTasks(): CareTask[] {
  return [
    {
      id: "medication",
      title: "Medication check",
      caption: "Take paracetamol only when needed and follow the label.",
      completed: false,
    },
    {
      id: "hydration",
      title: "Stay hydrated",
      caption: "Aim for regular fluids throughout the day.",
      completed: false,
    },
    {
      id: "symptoms",
      title: "Review symptoms",
      caption: "Check your temperature and note whether symptoms improve.",
      completed: false,
    },
  ];
}

function toTwentyFourHour(time: string) {
  const [clock, period] = time.split(" ");
  const [hourValue, minutes] = clock.split(":").map(Number);
  let hour = hourValue;

  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  return `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function createConfirmationCode() {
  return `CQ-${Date.now().toString(36).slice(-5).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function toScheduledAt(date: string, time: string) {
  const parsedDate = new Date(date);
  const singaporeDate = [
    parsedDate.getFullYear(),
    String(parsedDate.getMonth() + 1).padStart(2, "0"),
    String(parsedDate.getDate()).padStart(2, "0"),
  ].join("-");

  return new Date(
    `${singaporeDate}T${toTwentyFourHour(time)}:00+08:00`,
  ).toISOString();
}

type DatabaseAppointment = {
  id: string;
  confirmation_code: string;
  clinic_id: string;
  doctor_name: string;
  reason: string;
  scheduled_at: string;
  created_at: string;
};

type DatabaseQueueEntry = {
  appointment_id: string;
  status: "waiting" | "called" | "consulting" | "completed" | "cancelled";
  position: number;
  estimated_minutes: number;
  checked_in_at: string;
  consultation_started_at: string | null;
  updated_at: string;
};

function mapDatabaseAppointment(
  row: DatabaseAppointment,
  clinic: { name: string; specialty: string },
  queue: Omit<DatabaseQueueEntry, "appointment_id"> | null,
): Appointment {
  const scheduledAt = new Date(row.scheduled_at);

  return {
    id: row.id,
    confirmationCode: row.confirmation_code,
    clinicId: row.clinic_id,
    clinicName: clinic?.name ?? "Clinque clinic",
    doctorName: row.doctor_name,
    specialty: clinic?.specialty ?? "Primary care",
    date: new Intl.DateTimeFormat("en-SG", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Singapore",
    }).format(scheduledAt),
    time: new Intl.DateTimeFormat("en-SG", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Singapore",
    }).format(scheduledAt),
    reason: row.reason,
    waitMinutes: 10,
    bookedAt: row.created_at,
    queue: queue
      ? mapDatabaseQueue({ ...queue, appointment_id: row.id })
      : undefined,
  };
}

// The lifecycle functions return the row they just wrote, so the server response
// replaces the optimistic copy instead of sitting alongside it and drifting.
function syncQueueFromDatabase(
  row: unknown,
  appointment: Appointment,
  setAppointment: (next: Appointment) => void,
): Appointment {
  // A composite-returning function comes back as an object, but a SETOF variant
  // would arrive wrapped in an array. Accept either rather than depend on it.
  const entry = Array.isArray(row) ? row[0] : row;

  if (!isDatabaseQueueEntry(entry as Partial<DatabaseQueueEntry>))
    return appointment;

  const syncedAppointment: Appointment = {
    ...appointment,
    queue: mapDatabaseQueue(entry as DatabaseQueueEntry),
  };

  setAppointment(syncedAppointment);
  return syncedAppointment;
}

function mapDatabaseQueue(row: DatabaseQueueEntry): QueueState {
  return {
    status:
      row.status === "called" ||
      row.status === "consulting" ||
      row.status === "completed"
        ? row.status
        : "waiting",
    position: row.position,
    estimatedMinutes: row.estimated_minutes,
    checkedInAt: row.checked_in_at,
    consultationStartedAt: row.consultation_started_at ?? undefined,
    lastUpdatedAt: row.updated_at,
  };
}

function isDatabaseQueueEntry(
  row: Partial<DatabaseQueueEntry>,
): row is DatabaseQueueEntry {
  return (
    typeof row.appointment_id === "string" &&
    (row.status === "waiting" ||
      row.status === "called" ||
      row.status === "consulting" ||
      row.status === "completed" ||
      row.status === "cancelled") &&
    typeof row.position === "number" &&
    typeof row.estimated_minutes === "number" &&
    typeof row.checked_in_at === "string" &&
    (typeof row.consultation_started_at === "string" ||
      row.consultation_started_at === null) &&
    typeof row.updated_at === "string"
  );
}
