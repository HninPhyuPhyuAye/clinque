import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/lib/supabase";
import {
  advanceNurseQueue,
  completeNurseConsultation,
  fetchClinicQueue,
  fetchCompletionStats,
  startNurseConsultation,
  type NurseQueueEntry,
} from "@/features/operations/nurse-queue";

type NurseQueueContextValue = {
  advance: (appointmentId: string) => Promise<void>;
  complete: (appointmentId: string) => Promise<void>;
  completedToday: number;
  completedThisWeek: number;
  entries: NurseQueueEntry[];
  error: string | null;
  isDemoQueue: boolean;
  loading: boolean;
  reload: () => Promise<void>;
  start: (appointmentId: string) => Promise<void>;
};

// A self-contained board for the portfolio demo, so an interviewer can drive the
// nurse workflow end to end without an account or a database round trip.
function createDemoEntries(): NurseQueueEntry[] {
  const checkedInAt = new Date().toISOString();

  return [
    {
      appointmentId: "demo-appointment-1",
      patientId: "demo-patient-1",
      patientName: "Maya Tan",
      confirmationCode: "CQ-20418",
      reason: "General consultation",
      doctorName: "Dr. Sarah Lim",
      position: 1,
      estimatedMinutes: 5,
      status: "waiting",
      checkedInAt,
      consultationStartedAt: null,
      updatedAt: checkedInAt,
    },
    {
      appointmentId: "demo-appointment-2",
      patientId: "demo-patient-2",
      patientName: "Jordan Lee",
      confirmationCode: "CQ-20419",
      reason: "Follow-up",
      doctorName: "Dr. Sarah Lim",
      position: 2,
      estimatedMinutes: 9,
      status: "waiting",
      checkedInAt,
      consultationStartedAt: null,
      updatedAt: checkedInAt,
    },
    {
      appointmentId: "demo-appointment-3",
      patientId: "demo-patient-3",
      patientName: "Aisha Noor",
      confirmationCode: "CQ-20420",
      reason: "Vaccination",
      doctorName: "Dr. Sarah Lim",
      position: 3,
      estimatedMinutes: 14,
      status: "waiting",
      checkedInAt,
      consultationStartedAt: null,
      updatedAt: checkedInAt,
    },
  ];
}

const NurseQueueContext = createContext<NurseQueueContextValue | null>(null);

// supabase.channel(topic) returns the EXISTING channel when one with that topic
// is already open, and adding a listener to a subscribed channel throws. A
// per-subscription suffix guarantees a fresh channel even if a previous one is
// still being torn down.
let channelSequence = 0;

/**
 * Owns the single realtime subscription to one clinic's queue.
 *
 * Every nurse screen reads from here instead of opening its own channel, so the
 * queue board and the nurse dashboard always agree and only one subscription and
 * one fetch exist per clinic.
 */
export function NurseQueueProvider({ children }: { children: ReactNode }) {
  const { isDemo, isNurse, nurseClinic } = useAuth();
  const isDemoQueue = isDemo && isNurse;
  const clinicId = isDemoQueue ? null : (nurseClinic?.id ?? null);

  const [entries, setEntries] = useState<NurseQueueEntry[]>([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [completedThisWeek, setCompletedThisWeek] = useState(0);
  const [loading, setLoading] = useState(Boolean(clinicId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!clinicId) {
      setEntries([]);
      setCompletedToday(0);
      setCompletedThisWeek(0);
      setLoading(false);
      return;
    }

    try {
      const [queue, stats] = await Promise.all([
        fetchClinicQueue(clinicId),
        fetchCompletionStats(clinicId).catch(() => ({ today: 0, week: 0 })),
      ]);

      setEntries(queue);
      setCompletedToday(stats.today);
      setCompletedThisWeek(stats.week);
      setError(null);
    } catch (cause) {
      setError(
        cause && typeof cause === "object" && "message" in cause
          ? String((cause as { message: unknown }).message)
          : "The clinic queue could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!clinicId) return;

    channelSequence += 1;
    const channel = supabase
      .channel(`clinic-queue-${clinicId}-${channelSequence}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => void reload(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clinicId, reload]);

  // Demo mode starts with a local board and mutates it in place; a real nurse
  // calls the SECURITY DEFINER functions and lets realtime push the result back.
  useEffect(() => {
    if (!isDemoQueue) return;
    setEntries(createDemoEntries());
    setCompletedToday(0);
    // A believable week of history so the dashboard is not all zeroes.
    setCompletedThisWeek(18);
    setError(null);
    setLoading(false);
  }, [isDemoQueue]);

  const applyDemoTransition = useCallback(
    (appointmentId: string, kind: "advance" | "start" | "complete") => {
      setEntries((current) => {
        const target = current.find(
          (entry) => entry.appointmentId === appointmentId,
        );
        if (!target) return current;

        const stamped = new Date().toISOString();

        if (kind === "complete") {
          setCompletedToday((count) => count + 1);
          setCompletedThisWeek((count) => count + 1);
          return current.filter(
            (entry) => entry.appointmentId !== appointmentId,
          );
        }

        return current.map((entry) => {
          if (entry.appointmentId !== appointmentId) return entry;

          if (kind === "start")
            return {
              ...entry,
              status: "consulting",
              consultationStartedAt: stamped,
              updatedAt: stamped,
            };

          const nextPosition = Math.max(entry.position - 1, 0);
          return {
            ...entry,
            position: nextPosition,
            status: nextPosition === 0 ? "called" : "waiting",
            estimatedMinutes:
              nextPosition === 0 ? 0 : Math.max(nextPosition * 3, 3),
            updatedAt: stamped,
          };
        });
      });
    },
    [],
  );

  const runTransition = useCallback(
    async (
      appointmentId: string,
      kind: "advance" | "start" | "complete",
      remote: (id: string) => Promise<void>,
    ) => {
      if (isDemoQueue) {
        applyDemoTransition(appointmentId, kind);
        return;
      }

      await remote(appointmentId);
      await reload();
    },
    [applyDemoTransition, isDemoQueue, reload],
  );

  const value = useMemo<NurseQueueContextValue>(
    () => ({
      advance: (id) => runTransition(id, "advance", advanceNurseQueue),
      complete: (id) => runTransition(id, "complete", completeNurseConsultation),
      completedThisWeek,
      completedToday,
      entries,
      error,
      isDemoQueue,
      loading,
      reload,
      start: (id) => runTransition(id, "start", startNurseConsultation),
    }),
    [
      completedThisWeek,
      completedToday,
      entries,
      error,
      isDemoQueue,
      loading,
      reload,
      runTransition,
    ],
  );

  return (
    <NurseQueueContext.Provider value={value}>
      {children}
    </NurseQueueContext.Provider>
  );
}

export function useNurseQueue() {
  const context = useContext(NurseQueueContext);
  if (!context)
    throw new Error("useNurseQueue must be used inside NurseQueueProvider");
  return context;
}
