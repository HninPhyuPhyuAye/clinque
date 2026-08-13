import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/auth-context";
import { clinqueColors as colors } from "@/features/clinics/clinque-theme";
import { useNurseQueue } from "@/features/operations/nurse-queue-context";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

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

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "GOOD MORNING";
  if (hour < 18) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

export function NurseHomeScreen() {
  const router = useRouter();
  const { fullName, isDemo, nurseClinic } = useAuth();
  const { completedThisWeek, completedToday, entries, error, loading } =
    useNurseQueue();

  // Demo mode carries a persona so the dashboard never greets an empty name.
  const firstName = isDemo
    ? "Chen"
    : (fullName?.trim().split(/\s+/)[0] ?? "there");
  const waiting = entries.filter((entry) => entry.status === "waiting").length;
  const called = entries.filter((entry) => entry.status === "called").length;
  const inConsultation = entries.filter(
    (entry) => entry.status === "consulting",
  ).length;
  const nextPatient = entries[0] ?? null;
  const dailyAverage = Math.round((completedThisWeek / 7) * 10) / 10;
  const todayShareOfWeek = completedThisWeek
    ? Math.min(Math.round((completedToday / completedThisWeek) * 100), 100)
    : 0;

  function openOperations() {
    router.push("/operations");
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>{greetingFor(new Date())}</Text>
              <Text style={styles.greeting}>{firstName}</Text>
            </View>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>NURSE</Text>
            </View>
          </View>

          <View style={styles.clinicCard}>
            <View style={styles.clinicGlow} />
            <Text style={styles.clinicEyebrow}>YOUR CLINIC TODAY</Text>
            <Text style={styles.clinicName}>
              {nurseClinic?.name ?? "Unassigned"}
            </Text>
            <Text style={styles.clinicDepartment}>
              {nurseClinic?.specialty ?? "No department"}
            </Text>
            <Text style={styles.clinicAddress}>
              {nurseClinic?.address ?? "No address on file"}
            </Text>

            <View style={styles.shiftRow}>
              <View style={styles.shiftItem}>
                <Text style={styles.shiftLabel}>SHIFT</Text>
                <Text style={styles.shiftValue}>Morning</Text>
              </View>
              <View style={styles.shiftDivider} />
              <View style={styles.shiftItem}>
                <Text style={styles.shiftLabel}>ROOM</Text>
                <Text style={styles.shiftValue}>03</Text>
              </View>
              <View style={styles.shiftDivider} />
              <View style={styles.shiftItem}>
                <Text style={styles.shiftLabel}>ACCESS</Text>
                <Text style={styles.shiftValue}>Queue control</Text>
              </View>
            </View>
          </View>

          <View style={styles.metricGrid}>
            <StatCard
              accent="teal"
              caption="waiting"
              icon={{ ios: "person.2.fill", android: "groups", web: "groups" }}
              label="IN QUEUE"
              value={loading ? "—" : `${waiting}`}
            />
            <StatCard
              accent="blue"
              caption={called ? "ready now" : "in room"}
              icon={{
                ios: "stethoscope",
                android: "medical_information",
                web: "medical_information",
              }}
              label={called ? "CALLED" : "IN CARE"}
              value={loading ? "—" : `${called || inConsultation}`}
            />
            <StatCard
              accent="warm"
              caption="today"
              icon={{
                ios: "checkmark.seal.fill",
                android: "task_alt",
                web: "task_alt",
              }}
              label="COMPLETED"
              value={loading ? "—" : `${completedToday}`}
            />
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={openOperations}
            style={({ pressed }) => [
              styles.queueCard,
              pressed && styles.queueCardPressed,
            ]}
          >
            <View style={styles.queueGlow} />
            <Text style={styles.queueEyebrow}>
              {nextPatient ? "NEXT PATIENT" : "QUEUE COMMAND CENTRE"}
            </Text>
            {nextPatient ? (
              <>
                <Text style={styles.queueTitle}>{nextPatient.patientName}</Text>
                <Text style={styles.queueMeta}>
                  {nextPatient.confirmationCode} · {nextPatient.reason}
                </Text>
                <Text style={styles.queueStatus}>
                  {nextPatient.status === "consulting"
                    ? "In consultation now"
                    : nextPatient.status === "called"
                      ? "Called · proceed to Room 3"
                      : `Waiting · position #${nextPatient.position}`}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.queueTitle}>No one waiting</Text>
                <Text style={styles.queueMeta}>
                  Patients appear the moment they check in.
                </Text>
              </>
            )}

            <View style={styles.queueButton}>
              <Icon
                name={{
                  ios: "arrow.right",
                  android: "arrow_forward",
                  web: "arrow_forward",
                }}
                color={colors.tealDark}
                size={17}
              />
              <Text style={styles.queueButtonText}>Open queue</Text>
            </View>
          </Pressable>

          <Text style={styles.sectionTitle}>Your throughput</Text>
          <View style={styles.card}>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {loading ? "—" : completedToday}
                </Text>
                <Text style={styles.statLabel}>completed today</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {loading ? "—" : completedThisWeek}
                </Text>
                <Text style={styles.statLabel}>last 7 days</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {loading ? "—" : dailyAverage}
                </Text>
                <Text style={styles.statLabel}>daily average</Text>
              </View>
            </View>

            {/* A plain seven-column bar keeps the comparison honest: today
                against the rolling average, with no invented history. */}
            <View style={styles.barRow}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${todayShareOfWeek}%` as const },
                  ]}
                />
              </View>
              <Text style={styles.barCaption}>
                {completedThisWeek
                  ? `Today is ${todayShareOfWeek}% of this week's completed visits.`
                  : "No completed visits recorded yet this week."}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Today at a glance</Text>
          <View style={styles.card}>
            <GlanceRow
              icon={{
                ios: "building.2.fill",
                android: "apartment",
                web: "apartment",
              }}
              label="Clinic"
              value={nurseClinic?.name ?? "Unassigned"}
            />
            <View style={styles.divider} />
            <GlanceRow
              icon={{ ios: "cross.case.fill", android: "medical_services", web: "medical_services" }}
              label="Department"
              value={nurseClinic?.specialty ?? "—"}
            />
            <View style={styles.divider} />
            <GlanceRow
              icon={{ ios: "mappin.circle.fill", android: "place", web: "place" }}
              label="Location"
              value={nurseClinic?.address ?? "—"}
            />
            <View style={styles.divider} />
            <GlanceRow
              icon={{ ios: "person.badge.key.fill", android: "admin_panel_settings", web: "admin_panel_settings" }}
              label="Permissions"
              value="Advance queue · Start and complete consultations"
            />
          </View>

          <View style={styles.noteCard}>
            <View style={styles.noteIcon}>
              <Icon
                name={{ ios: "lock.shield.fill", android: "security", web: "security" }}
                color={colors.blue}
                size={20}
              />
            </View>
            <View style={styles.noteCopy}>
              <Text style={styles.noteTitle}>Row Level Security enforced</Text>
              <Text style={styles.noteCaption}>
                You can only see and move patients at{" "}
                {nurseClinic?.name ?? "your clinic"}. Every transition is checked
                in the database, not just in this interface.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function StatCard({
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
      <View style={[styles.metricIcon, { backgroundColor: palette.background }]}>
        <Icon name={icon} color={palette.color} size={18} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricCaption}>{caption}</Text>
    </View>
  );
}

function GlanceRow({
  icon,
  label,
  value,
}: {
  icon: SymbolName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.glanceRow}>
      <View style={styles.glanceIcon}>
        <Icon name={icon} size={18} />
      </View>
      <View style={styles.glanceCopy}>
        <Text style={styles.glanceLabel}>{label}</Text>
        <Text style={styles.glanceValue}>{value}</Text>
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
    paddingBottom: 120,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  greeting: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 30,
    fontWeight: "800",
  },
  rolePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: colors.tealSoft,
  },
  rolePillText: {
    color: colors.teal,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  clinicCard: {
    marginTop: 20,
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.tealDark,
    overflow: "hidden",
  },
  clinicGlow: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  clinicEyebrow: {
    color: "rgba(233,250,246,0.75)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  clinicName: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
  },
  clinicDepartment: {
    marginTop: 4,
    color: "#9DE1D1",
    fontSize: 13,
    fontWeight: "700",
  },
  clinicAddress: {
    marginTop: 3,
    color: "rgba(233,250,246,0.7)",
    fontSize: 11,
  },
  shiftRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  shiftItem: { flex: 1 },
  shiftDivider: {
    width: 1,
    height: 26,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  shiftLabel: {
    color: "rgba(233,250,246,0.65)",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  shiftValue: {
    marginTop: 4,
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  metricGrid: { marginTop: 16, flexDirection: "row", gap: 11 },
  metricCard: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 19,
    backgroundColor: colors.card,
  },
  metricIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  metricLabel: {
    marginTop: 11,
    color: colors.muted,
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  metricValue: {
    marginTop: 5,
    color: colors.ink,
    fontSize: 25,
    fontWeight: "800",
  },
  metricCaption: { marginTop: 1, color: colors.muted, fontSize: 9 },
  errorCard: {
    marginTop: 14,
    padding: 13,
    borderRadius: 15,
    backgroundColor: "#FDECEC",
  },
  errorText: { color: "#8C2F2F", fontSize: 11, lineHeight: 16 },
  queueCard: {
    marginTop: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#174C51",
    overflow: "hidden",
  },
  queueCardPressed: { opacity: 0.92 },
  queueGlow: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  queueEyebrow: {
    color: "rgba(233,250,246,0.75)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  queueTitle: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
  },
  queueMeta: { marginTop: 4, color: "rgba(233,250,246,0.72)", fontSize: 11 },
  queueStatus: {
    marginTop: 8,
    color: "#9DE1D1",
    fontSize: 12,
    fontWeight: "700",
  },
  queueButton: {
    marginTop: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 15,
    backgroundColor: "#E9FAF6",
  },
  queueButtonText: {
    color: colors.tealDark,
    fontSize: 10,
    fontWeight: "900",
  },
  statRow: { flexDirection: "row", alignItems: "center", paddingVertical: 16 },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 32, backgroundColor: colors.line },
  statValue: { color: colors.ink, fontSize: 23, fontWeight: "800" },
  statLabel: { marginTop: 3, color: colors.muted, fontSize: 10 },
  barRow: { paddingBottom: 16, gap: 8 },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.tealSoft,
    overflow: "hidden",
  },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.teal },
  barCaption: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  sectionTitle: {
    marginTop: 26,
    marginBottom: 11,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    backgroundColor: colors.card,
    paddingHorizontal: 15,
  },
  divider: { height: 1, backgroundColor: colors.line },
  glanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 14,
  },
  glanceIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: colors.tealSoft,
  },
  glanceCopy: { flex: 1 },
  glanceLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  glanceValue: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  noteCard: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 15,
    borderRadius: 20,
    backgroundColor: colors.blueSoft,
  },
  noteIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  noteCopy: { flex: 1 },
  noteTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  noteCaption: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
});
