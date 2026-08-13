import { supabase } from "@/lib/supabase";

export type NurseQueueStatus =
  | "waiting"
  | "called"
  | "consulting"
  | "completed"
  | "cancelled";

export type NurseQueueEntry = {
  appointmentId: string;
  patientId: string;
  patientName: string;
  confirmationCode: string;
  reason: string;
  doctorName: string;
  position: number;
  estimatedMinutes: number;
  status: NurseQueueStatus;
  checkedInAt: string;
  consultationStartedAt: string | null;
  updatedAt: string;
};

// Rows nurses still act on. Completed and cancelled visits leave the board.
const activeStatuses: NurseQueueStatus[] = ["waiting", "called", "consulting"];

type EmbeddedAppointment = {
  confirmation_code: string;
  reason: string;
  doctor_name: string;
};

type EmbeddedProfile = { full_name: string };

type NurseQueueRow = {
  appointment_id: string;
  patient_id: string;
  position: number;
  estimated_minutes: number;
  status: NurseQueueStatus;
  checked_in_at: string;
  consultation_started_at: string | null;
  updated_at: string;
  appointments: EmbeddedAppointment | EmbeddedAppointment[] | null;
  profiles: EmbeddedProfile | EmbeddedProfile[] | null;
};

function firstOf<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapRow(row: NurseQueueRow): NurseQueueEntry {
  const appointment = firstOf(row.appointments);
  const profile = firstOf(row.profiles);

  return {
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    // The profile embed is a left join: if the nurse read policy ever stops
    // matching, the entry still lists rather than vanishing from the board.
    patientName: profile?.full_name?.trim() || "Patient",
    confirmationCode: appointment?.confirmation_code ?? "—",
    reason: appointment?.reason ?? "Consultation",
    doctorName: appointment?.doctor_name ?? "the clinician",
    position: row.position,
    estimatedMinutes: row.estimated_minutes,
    status: row.status,
    checkedInAt: row.checked_in_at,
    consultationStartedAt: row.consultation_started_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchClinicQueue(
  clinicId: string,
): Promise<NurseQueueEntry[]> {
  const { data, error } = await supabase
    .from("queue_entries")
    .select(
      `appointment_id, patient_id, position, estimated_minutes, status,
       checked_in_at, consultation_started_at, updated_at,
       appointments ( confirmation_code, reason, doctor_name ),
       profiles ( full_name )`,
    )
    .eq("clinic_id", clinicId)
    .in("status", activeStatuses)
    .order("position", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as NurseQueueRow[]).map(mapRow);
}

async function countCompletedSince(clinicId: string, since: Date) {

  const { count, error } = await supabase
    .from("queue_entries")
    .select("appointment_id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("status", "completed")
    .gte("updated_at", since.toISOString());

  if (error) throw error;
  return count ?? 0;
}

/** Visits completed today and over the trailing seven days, for the dashboard. */
export async function fetchCompletionStats(clinicId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  const [today, week] = await Promise.all([
    countCompletedSince(clinicId, startOfDay),
    countCompletedSince(clinicId, startOfWeek),
  ]);

  return { today, week };
}

// The three lifecycle functions. Each verifies clinic_nurses membership itself,
// so an unauthorized caller gets 42501 rather than a silent no-op.
async function callTransition(fn: string, appointmentId: string) {
  const { error } = await supabase.rpc(fn, { p_appointment_id: appointmentId });
  if (error) throw error;
}

export function advanceNurseQueue(appointmentId: string) {
  return callTransition("advance_queue_entry", appointmentId);
}

export function startNurseConsultation(appointmentId: string) {
  return callTransition("start_consultation", appointmentId);
}

export function completeNurseConsultation(appointmentId: string) {
  return callTransition("complete_consultation", appointmentId);
}
