import { SymbolView } from "expo-symbols";
import { useRouter } from "expo-router";
import { useState, type ComponentProps } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppointment } from "@/features/appointments/appointment-context";
import { useAuth } from "@/features/auth/auth-context";
import { clinqueColors as colors } from "@/features/clinics/clinque-theme";
import { useNotifications } from "@/features/notifications/notification-context";
import { useNurseQueue } from "@/features/operations/nurse-queue-context";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

const mockPatients = [
  { initials: "JL", name: "Jordan Lee", reason: "Follow-up", wait: "4 min" },
  { initials: "AN", name: "Aisha Noor", reason: "Vaccination", wait: "7 min" },
  { initials: "RK", name: "Ryan Koh", reason: "Consultation", wait: "10 min" },
];

// supabase-js resolves { data, error } with a plain object rather than a thrown
// PostgrestError, so instanceof checks miss it and the real message is lost.
// Read the message off whatever shape actually arrives.
function readErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const { message, details, hint, code } = error as Record<string, unknown>;
    const parts = [message, details, hint]
      .filter((part): part is string => typeof part === "string" && part !== "")
      .join(" · ");

    if (parts) return typeof code === "string" ? `${parts} [${code}]` : parts;
  }

  return "Unknown error";
}

// Postgres raises 42501 from the lifecycle functions when the caller is not a
// nurse at the clinic. That is the expected outcome for a signed-in patient, so
// it gets a plain explanation rather than a raw database string.
function describeTransitionError(message: string) {
  if (/only clinic nurses/i.test(message))
    return "This account is not a nurse at this clinic, so it cannot move the queue. Register the account as a nurse for this clinic, or use the nurse demo.";

  if (/cannot be advanced|cannot start|cannot be completed/i.test(message))
    return "The queue moved since this screen loaded. Reload to see its current state.";

  if (/no queue entry/i.test(message))
    return "That appointment has no queue entry. The patient needs to check in first.";

  return `That queue update could not be applied: ${message}`;
}

function Icon({
  name,
  color = colors.teal,
  size = 22,
}: {
  name: SymbolName;
  color?: string;
  size?: number;
}) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}

// One shape for the board, whether the row came from the clinic's real queue or
// from the local portfolio demo.
type BoardPatient = {
  appointmentId: string | null;
  confirmationCode: string;
  doctorName: string;
  estimatedMinutes: number;
  initials: string;
  name: string;
  position: number;
  reason: string;
  status: "waiting" | "called" | "consulting" | "completed";
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "P";
}

export function ClinicOperationsScreen() {
  const router = useRouter();
  const { isDemo, nurseClinic, nurseLoading, user } = useAuth();
  const {
    advanceQueue,
    appointment,
    completeConsultation,
    createDemoQueue,
    loading,
    startConsultation,
  } = useAppointment();
  const { addQueueAlert } = useNotifications();
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >(null);

  const {
    advance,
    complete,
    entries: nurseEntries,
    error: nurseQueueError,
    isDemoQueue,
    loading: nurseQueueLoading,
    reload: reloadNurseQueue,
    start,
  } = useNurseQueue();

  async function runTransition<T>(
    transition: () => Promise<T>,
  ): Promise<T | null> {
    setActionError(null);
    setPending(true);
    try {
      return await transition();
    } catch (error) {
      setActionError(describeTransitionError(readErrorMessage(error)));
      return null;
    } finally {
      setPending(false);
    }
  }

  function returnToPatientApp() {
    router.replace("/");
  }

  function openPatientQueue() {
    router.replace("/queue");
  }

  if (loading || nurseLoading) return <View style={styles.screen} />;

  // Three distinct experiences. A nurse drives their own clinic's live
  // queue; demo mode drives a local portfolio queue; a signed-in patient is told
  // plainly that this screen is not theirs to drive, rather than being handed a
  // demo button whose local appointment id can never reach the database.
  const mode: "nurse" | "demo" | "patient" = nurseClinic
    ? "nurse"
    : user && !isDemo
      ? "patient"
      : "demo";

  const demoQueue = appointment?.queue;
  const board: BoardPatient[] =
    mode === "nurse"
      ? nurseEntries.map((entry) => ({
          appointmentId: entry.appointmentId,
          confirmationCode: entry.confirmationCode,
          doctorName: entry.doctorName,
          estimatedMinutes: entry.estimatedMinutes,
          initials: initialsOf(entry.patientName),
          name: entry.patientName,
          position: entry.position,
          reason: entry.reason,
          status: entry.status === "cancelled" ? "waiting" : entry.status,
        }))
      : demoQueue
        ? [
            {
              appointmentId: null,
              confirmationCode: appointment?.confirmationCode ?? "CQ-20418",
              doctorName: appointment?.doctorName ?? "Dr. Sarah Lim",
              estimatedMinutes: demoQueue.estimatedMinutes,
              initials: "MT",
              name: "Maya Tan",
              position: demoQueue.position,
              reason: appointment?.reason ?? "General consultation",
              status: demoQueue.status,
            },
          ]
        : [];

  const active =
    board.find((patient) => patient.appointmentId === selectedAppointmentId) ??
    board[0] ??
    null;

  const called = active?.status === "called";
  const consulting = active?.status === "consulting";
  const completed = active?.status === "completed";

  // Nurses see the real count. Demo keeps the three mock companions so the
  // portfolio board does not look empty.
  const totalWaiting =
    mode === "nurse"
      ? board.length
      : active
        ? Math.max(active.position, 1) + 3
        : 0;

  async function onPrimaryAction() {
    if (!active || completed || pending) return;

    if (mode === "nurse") {
      const appointmentId = active.appointmentId;
      if (!appointmentId) return;

      await runTransition(async () => {
        if (consulting) await complete(appointmentId);
        else if (called) await start(appointmentId);
        else await advance(appointmentId);
        return true;
      });
      return;
    }

    if (consulting) {
      await runTransition(completeConsultation);
      return;
    }
    if (called) {
      await runTransition(startConsultation);
      return;
    }

    const updatedAppointment = await runTransition(advanceQueue);
    if (updatedAppointment) await addQueueAlert(updatedAppointment);
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Return to patient app"
              onPress={returnToPatientApp}
              style={styles.backButton}
            >
              <Icon
                name={{
                  ios: "arrow.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                color={colors.ink}
                size={19}
              />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>
                {mode === "nurse"
                  ? "CLINIC OPERATIONS · NURSE"
                  : mode === "patient"
                    ? "CLINIC OPERATIONS · RESTRICTED"
                    : "CLINIC OPERATIONS · NURSE DEMO"}
              </Text>
              <Text style={styles.title}>Queue command centre</Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          <View style={styles.clinicBar}>
            <View style={styles.clinicIcon}>
              <Icon
                name={{
                  ios: "cross.case.fill",
                  android: "medical_services",
                  web: "medical_services",
                }}
                size={21}
              />
            </View>
            <View style={styles.clinicCopy}>
              <Text style={styles.clinicName}>
                {nurseClinic?.name ?? "Novena Medical Clinic"}
              </Text>
              <Text style={styles.clinicMeta}>
                {nurseClinic
                  ? `${nurseClinic.specialty} · ${nurseClinic.address}`
                  : "Family Medicine · Level 2"}
              </Text>
            </View>
            <Text style={styles.shiftText}>Morning shift</Text>
          </View>

          {mode === "patient" ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Icon
                  name={{ ios: "lock.fill", android: "lock", web: "lock" }}
                  size={29}
                />
              </View>
              <Text style={styles.emptyTitle}>Nurse access required</Text>
              <Text style={styles.emptyCaption}>
                Queue and consultation transitions belong to authorized clinic
                nurses. This account is signed in as a patient, so the clinic
                queue is not available here. Your own visit status stays on the
                live queue screen.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={openPatientQueue}
                style={styles.primaryButton}
              >
                <Icon
                  name={{
                    ios: "list.bullet.rectangle",
                    android: "list_alt",
                    web: "list_alt",
                  }}
                  color="#FFFFFF"
                  size={18}
                />
                <Text style={styles.primaryButtonText}>View my live queue</Text>
              </Pressable>
            </View>
          ) : nurseQueueError ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Icon
                  name={{
                    ios: "exclamationmark.triangle.fill",
                    android: "warning",
                    web: "warning",
                  }}
                  size={29}
                />
              </View>
              <Text style={styles.emptyTitle}>Queue unavailable</Text>
              <Text style={styles.emptyCaption}>{nurseQueueError}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void reloadNurseQueue()}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : !active ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Icon
                  name={{
                    ios: "person.3.fill",
                    android: "groups",
                    web: "groups",
                  }}
                  size={29}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {mode === "nurse"
                  ? nurseQueueLoading
                    ? "Loading clinic queue"
                    : "No patients in the queue"
                  : "No active patient queue"}
              </Text>
              <Text style={styles.emptyCaption}>
                {mode === "nurse"
                  ? `Patients appear here the moment a signed-in account checks in at ${nurseClinic?.name ?? "this clinic"}. Portfolio demo sessions stay on their own device and never reach this board.`
                  : "Load a safe demonstration queue to explore the nurse workflow without a clinic backend."}
              </Text>
              {mode === "nurse" ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void reloadNurseQueue()}
                  style={styles.primaryButton}
                >
                  <Icon
                    name={{
                      ios: "arrow.clockwise",
                      android: "refresh",
                      web: "refresh",
                    }}
                    color="#FFFFFF"
                    size={18}
                  />
                  <Text style={styles.primaryButtonText}>Refresh queue</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void createDemoQueue()}
                  style={styles.primaryButton}
                >
                  <Icon
                    name={{
                      ios: "play.fill",
                      android: "play_arrow",
                      web: "play_arrow",
                    }}
                    color="#FFFFFF"
                    size={18}
                  />
                  <Text style={styles.primaryButtonText}>
                    Load demonstration queue
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <>
              <View style={styles.metricGrid}>
                <MetricCard
                  label="WAITING"
                  value={`${totalWaiting}`}
                  caption="patients"
                  icon={{
                    ios: "person.2.fill",
                    android: "groups",
                    web: "groups",
                  }}
                  accent="teal"
                />
                <MetricCard
                  label="AVG WAIT"
                  value={`${active.estimatedMinutes}`}
                  caption="minutes"
                  icon={{
                    ios: "clock.fill",
                    android: "schedule",
                    web: "schedule",
                  }}
                  accent="blue"
                />
                <MetricCard
                  label="ROOM"
                  value="03"
                  caption={
                    completed
                      ? "available"
                      : consulting
                        ? "in consultation"
                        : called
                          ? "ready"
                          : "in use"
                  }
                  icon={{
                    ios: "door.left.hand.open",
                    android: "meeting_room",
                    web: "meeting_room",
                  }}
                  accent="warm"
                />
              </View>

              <View style={styles.nowServingCard}>
                <View style={styles.nowServingGlow} />
                <Text style={styles.nowServingLabel}>
                  {completed
                    ? "VISIT COMPLETED"
                    : consulting
                      ? "CONSULTATION IN PROGRESS"
                      : called
                        ? "PATIENT CALLED"
                        : "NEXT PATIENT"}
                </Text>
                <View style={styles.patientRow}>
                  <View style={styles.patientAvatar}>
                    <Text style={styles.patientInitials}>
                      {active.initials}
                    </Text>
                  </View>
                  <View style={styles.patientCopy}>
                    <Text style={styles.patientName}>{active.name}</Text>
                    <Text style={styles.patientMeta}>
                      {active.confirmationCode} · {active.reason}
                    </Text>
                    <Text style={styles.patientPosition}>
                      {completed
                        ? "Summary released to Journey"
                        : consulting
                          ? `With ${active.doctorName} in Room 3`
                          : called
                            ? "Proceed to Room 3"
                            : `Patient queue position #${active.position}`}
                    </Text>
                  </View>
                  <View style={styles.arrivedPill}>
                    <View style={styles.arrivedDot} />
                    <Text style={styles.arrivedText}>ARRIVED</Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={completed || pending}
                  onPress={onPrimaryAction}
                  style={[
                    styles.callButton,
                    (completed || pending) && styles.callButtonDisabled,
                  ]}
                >
                  <Icon
                    name={
                      completed
                        ? {
                            ios: "checkmark.seal.fill",
                            android: "task_alt",
                            web: "task_alt",
                          }
                        : consulting
                          ? {
                              ios: "checkmark.circle.fill",
                              android: "done_all",
                              web: "done_all",
                            }
                          : called
                            ? {
                                ios: "stethoscope",
                                android: "medical_information",
                                web: "medical_information",
                              }
                            : {
                                ios: "speaker.wave.2.fill",
                                android: "campaign",
                                web: "campaign",
                              }
                    }
                    color={completed ? colors.teal : colors.tealDark}
                    size={19}
                  />
                  <Text style={styles.callButtonText}>
                    {pending
                      ? "Applying…"
                      : completed
                        ? "Visit completed"
                        : consulting
                          ? "Complete visit"
                          : called
                            ? "Start consultation"
                            : "Advance queue"}
                  </Text>
                </Pressable>
                {actionError ? (
                  <View style={styles.actionError}>
                    <Text style={styles.actionErrorText}>{actionError}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Waiting room</Text>
                <Text style={styles.sectionMeta}>{totalWaiting} PATIENTS</Text>
              </View>
              <View style={styles.waitingList}>
                {mode === "nurse"
                  ? board.map((patient) => (
                      <Pressable
                        accessibilityRole="button"
                        key={patient.appointmentId ?? patient.name}
                        onPress={() =>
                          setSelectedAppointmentId(patient.appointmentId)
                        }
                      >
                        <PatientListItem
                          highlighted={
                            patient.appointmentId === active.appointmentId
                          }
                          initials={patient.initials}
                          name={patient.name}
                          position={`#${patient.position}`}
                          reason={patient.reason}
                          wait={
                            patient.status === "consulting"
                              ? "In consultation"
                              : patient.status === "called"
                                ? "Called"
                                : "Checked in"
                          }
                        />
                      </Pressable>
                    ))
                  : [
                      !called && !consulting && !completed ? (
                        <PatientListItem
                          highlighted
                          initials={active.initials}
                          key="active"
                          name={active.name}
                          position={`#${active.position}`}
                          reason={active.reason}
                        />
                      ) : null,
                      ...mockPatients.map((patient, index) => (
                        <PatientListItem
                          initials={patient.initials}
                          key={patient.name}
                          name={patient.name}
                          position={`#${Math.max(active.position + index + 1, index + 2)}`}
                          reason={patient.reason}
                          wait={patient.wait}
                        />
                      )),
                    ]}
              </View>

              <View style={styles.syncCard}>
                <View style={styles.syncIcon}>
                  <Icon
                    name={{
                      ios: "arrow.triangle.2.circlepath",
                      android: "sync",
                      web: "sync",
                    }}
                    color={colors.blue}
                    size={21}
                  />
                </View>
                <View style={styles.syncCopy}>
                  <Text style={styles.syncTitle}>
                    {isDemoQueue
                      ? "Portfolio demonstration"
                      : mode === "nurse"
                        ? "Patient apps synchronized"
                        : "Patient app synchronized"}
                  </Text>
                  <Text style={styles.syncCaption}>
                    {isDemoQueue
                      ? "This board runs on local demonstration data. A signed-in nurse drives the same workflow through Supabase, where every transition is authorized in the database."
                      : mode === "nurse"
                        ? `Every transition writes queue_entries, so ${active.name.split(" ")[0]}'s live queue updates over realtime without a refresh.`
                        : "Queue position, wait estimate, and alerts use the same state as Maya’s patient view."}
                  </Text>
                </View>
                {mode === "nurse" ? null : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={openPatientQueue}
                    style={styles.previewButton}
                  >
                    <Text style={styles.previewButtonText}>Preview</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function MetricCard({
  accent,
  caption,
  icon,
  label,
  value,
}: {
  accent: "teal" | "blue" | "warm";
  caption: string;
  icon: SymbolName;
  label: string;
  value: string;
}) {
  const palette =
    accent === "teal"
      ? { background: colors.tealSoft, color: colors.teal }
      : accent === "blue"
        ? { background: colors.blueSoft, color: colors.blue }
        : { background: colors.warmSoft, color: colors.warm };
  return (
    <View style={styles.metricCard}>
      <View
        style={[styles.metricIcon, { backgroundColor: palette.background }]}
      >
        <Icon name={icon} color={palette.color} size={18} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricCaption}>{caption}</Text>
    </View>
  );
}

function PatientListItem({
  highlighted = false,
  initials,
  name,
  position,
  reason,
  wait,
}: {
  highlighted?: boolean;
  initials: string;
  name: string;
  position: string;
  reason: string;
  wait?: string;
}) {
  return (
    <View style={[styles.listItem, highlighted && styles.listItemHighlighted]}>
      <View
        style={[styles.listAvatar, highlighted && styles.listAvatarHighlighted]}
      >
        <Text
          style={[
            styles.listInitials,
            highlighted && styles.listInitialsHighlighted,
          ]}
        >
          {initials}
        </Text>
      </View>
      <View style={styles.listCopy}>
        <Text style={styles.listName}>{name}</Text>
        <Text style={styles.listReason}>{reason}</Text>
      </View>
      <View style={styles.listMeta}>
        <Text style={styles.listPosition}>{position}</Text>
        <Text style={styles.listWait}>{wait ?? "Checked in"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 45,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    backgroundColor: colors.card,
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: colors.teal,
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: { marginTop: 3, color: colors.ink, fontSize: 23, fontWeight: "800" },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 13,
    backgroundColor: colors.tealSoft,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  liveText: {
    color: colors.teal,
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  clinicBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 19,
    backgroundColor: colors.card,
  },
  clinicIcon: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.tealSoft,
  },
  clinicCopy: { flex: 1 },
  clinicName: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  clinicMeta: { marginTop: 3, color: colors.muted, fontSize: 8 },
  shiftText: { color: colors.teal, fontSize: 8, fontWeight: "800" },
  emptyCard: {
    alignItems: "center",
    marginTop: 18,
    padding: 30,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 27,
    backgroundColor: colors.card,
  },
  emptyIcon: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.tealSoft,
  },
  emptyTitle: {
    marginTop: 17,
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyCaption: {
    maxWidth: 380,
    marginTop: 7,
    color: colors.muted,
    fontSize: 9,
    lineHeight: 15,
    textAlign: "center",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 49,
    marginTop: 20,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: colors.teal,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  metricGrid: { flexDirection: "row", gap: 10, marginTop: 17 },
  metricCard: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  metricIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
  },
  metricLabel: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  metricValue: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 23,
    fontWeight: "900",
  },
  metricCaption: { color: colors.muted, fontSize: 7 },
  nowServingCard: {
    position: "relative",
    overflow: "hidden",
    marginTop: 14,
    padding: 19,
    borderRadius: 25,
    backgroundColor: colors.tealDark,
  },
  nowServingGlow: {
    position: "absolute",
    top: -80,
    right: -55,
    width: 170,
    height: 170,
    borderRadius: 90,
    backgroundColor: colors.teal,
    opacity: 0.55,
  },
  nowServingLabel: {
    color: "#AEE0D7",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1,
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
  },
  patientAvatar: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#E9FAF6",
  },
  patientInitials: { color: colors.tealDark, fontSize: 15, fontWeight: "900" },
  patientCopy: { flex: 1 },
  patientName: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  patientMeta: { marginTop: 3, color: "#B9DCD7", fontSize: 8 },
  patientPosition: {
    marginTop: 5,
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  arrivedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  arrivedDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#92E2D1",
  },
  arrivedText: { color: "#C9F2E9", fontSize: 6, fontWeight: "900" },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    marginTop: 17,
    borderRadius: 15,
    backgroundColor: "#E9FAF6",
  },
  callButtonDisabled: { backgroundColor: "#D6F1EA" },
  callButtonText: { color: colors.tealDark, fontSize: 9, fontWeight: "900" },
  actionError: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: "#FDECEC",
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  actionErrorText: { color: "#8C2F2F", fontSize: 11, lineHeight: 16 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  sectionMeta: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  waitingList: { gap: 9 },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.card,
  },
  listItemHighlighted: { borderColor: "#A8D8CE", backgroundColor: "#F4FCF9" },
  listAvatar: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.blueSoft,
  },
  listAvatarHighlighted: { backgroundColor: colors.tealSoft },
  listInitials: { color: colors.blue, fontSize: 10, fontWeight: "900" },
  listInitialsHighlighted: { color: colors.teal },
  listCopy: { flex: 1 },
  listName: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  listReason: { marginTop: 3, color: colors.muted, fontSize: 8 },
  listMeta: { alignItems: "flex-end" },
  listPosition: { color: colors.teal, fontSize: 11, fontWeight: "900" },
  listWait: { marginTop: 3, color: colors.muted, fontSize: 7 },
  syncCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 16,
    padding: 14,
    borderRadius: 19,
    backgroundColor: colors.blueSoft,
  },
  syncIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  syncCopy: { flex: 1 },
  syncTitle: { color: "#344F76", fontSize: 10, fontWeight: "800" },
  syncCaption: { marginTop: 3, color: "#657797", fontSize: 7, lineHeight: 11 },
  previewButton: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: colors.card,
  },
  previewButtonText: { color: colors.blue, fontSize: 7, fontWeight: "900" },
});
