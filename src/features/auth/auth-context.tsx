import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

type AuthResult = { error: string | null; confirmationRequired?: boolean };

export type AccountRole = "patient" | "nurse";

// The clinic a signed-in nurse works at. Null for patients and for demo
// mode. Authorization still lives in RLS and the queue functions; this only
// decides which interface the account is shown.
export type NurseClinic = {
  id: string;
  name: string;
  specialty: string;
  address: string;
};

type AuthContextValue = {
  continueAsDemo: (role?: AccountRole) => void;
  fullName: string | null;
  isDemo: boolean;
  isNurse: boolean;
  loading: boolean;
  nurseClinic: NurseClinic | null;
  nurseError: string | null;
  nurseLoading: boolean;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  signUp: (
    fullName: string,
    email: string,
    password: string,
    role?: AccountRole,
    clinicId?: string | null,
  ) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function createAuthRedirect(path = "") {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return new URL(path, `${window.location.origin}/`).toString();
  }

  return Linking.createURL(path);
}

// Portfolio demo mode can present either interface, so an interviewer can see
// the patient journey and the nurse queue board without any account.
// Demo mode must survive a reload. Without this, any refresh — including the
// full-page navigations the web build used to do — drops a demo visitor back
// onto the sign-in screen mid-journey.
const demoRoleStorageKey = "@clinque/demo-role";

const demoNurseClinic: NurseClinic = {
  id: "demo-clinic",
  name: "Novena Medical Clinic",
  specialty: "Family Medicine",
  address: "10 Sinaran Drive, Singapore",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoRole, setDemoRole] = useState<AccountRole | null>(null);
  const isDemo = demoRole !== null;
  const [nurseClinic, setNurseClinic] = useState<NurseClinic | null>(null);
  const [nurseLoading, setNurseLoading] = useState(false);
  const [nurseError, setNurseError] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const [{ data }, storedRole] = await Promise.all([
        supabase.auth.getSession(),
        AsyncStorage.getItem(demoRoleStorageKey).catch(() => null),
      ]);

      if (!active) return;

      setSession(data.session);
      if (!data.session && (storedRole === "patient" || storedRole === "nurse"))
        setDemoRole(storedRole);
      setLoading(false);
    }

    void bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        if (nextSession) setDemoRole(null);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // clinic_nurses is readable only for the caller's own memberships, so this
  // resolves to null for every patient without needing a role column check.
  const userId = session?.user?.id ?? null;

  // Read out of the session here rather than inside the effect, so the effect
  // does not close over a stale session object.
  const metadata = session?.user?.user_metadata ?? {};
  const intendedRole =
    typeof metadata.intended_role === "string" ? metadata.intended_role : null;
  const intendedClinicId =
    typeof metadata.intended_clinic_id === "string"
      ? metadata.intended_clinic_id
      : null;

  useEffect(() => {
    if (!userId) {
      setNurseClinic(null);
      setFullName(null);
      setNurseError(null);
      setNurseLoading(false);
      return;
    }

    let active = true;
    setNurseLoading(true);

    // Returns the assignment and, separately, why the lookup failed. Falling
    // back to null silently would render a nurse as a patient with no
    // explanation, which is indistinguishable from a role mix-up.
    async function readAssignment(id: string) {
      const { data, error } = await supabase
        .from("clinic_nurses")
        .select("clinic_id, clinics ( id, name, specialty, address )")
        .eq("user_id", id)
        .limit(1)
        .maybeSingle();

      const clinic = (data as { clinics?: NurseClinic | NurseClinic[] } | null)
        ?.clinics;
      const resolved = Array.isArray(clinic) ? clinic[0] : clinic;

      return {
        assignment: error ? null : (resolved ?? null),
        failure: error?.message ?? null,
      };
    }

    async function loadIdentity(id: string) {
      const [lookup, profile] = await Promise.all([
        readAssignment(id),
        supabase.from("profiles").select("full_name").eq("id", id).maybeSingle(),
      ]);

      if (!active) return;

      const name = profile.data?.full_name?.trim() || null;
      let assignment = lookup.assignment;
      let failure = lookup.failure;

      // A nurse chosen at sign-up is redeemed on the first signed-in load,
      // because register_as_nurse needs a session to identify the caller.
      if (!assignment && intendedRole === "nurse" && intendedClinicId) {
        const { error } = await supabase.rpc("register_as_nurse", {
          p_clinic_id: intendedClinicId,
        });

        if (!active) return;

        if (error) {
          failure = error.message;
        } else {
          const retry = await readAssignment(id);
          if (!active) return;
          assignment = retry.assignment;
          failure = retry.assignment ? null : retry.failure;
        }
      }

      setNurseClinic(assignment);
      setFullName(name);
      setNurseError(
        !assignment && intendedRole === "nurse"
          ? (failure ??
            "This account was created as a nurse, but no clinic assignment exists yet.")
          : null,
      );
      setNurseLoading(false);
    }

    void loadIdentity(userId);

    return () => {
      active = false;
    };
  }, [intendedClinicId, intendedRole, userId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      continueAsDemo: (role = "patient") => {
        setDemoRole(role);
        void AsyncStorage.setItem(demoRoleStorageKey, role).catch(() => {
          // A demo session that cannot persist still works for this page view.
        });
      },
      fullName,
      isDemo,
      isNurse: demoRole === "nurse" || Boolean(nurseClinic),
      loading,
      nurseClinic: demoRole === "nurse" ? demoNurseClinic : nurseClinic,
      nurseError: isDemo ? null : nurseError,
      nurseLoading,
      requestPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          { redirectTo: createAuthRedirect("reset-password") },
        );
        return { error: error?.message ?? null };
      },
      session,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        if (session) await supabase.auth.signOut();
        setSession(null);
        setDemoRole(null);
        void AsyncStorage.removeItem(demoRoleStorageKey).catch(() => {});
        setNurseClinic(null);
        setFullName(null);
        setNurseError(null);
      },
      signUp: async (fullName, email, password, role = "patient", clinicId) => {
        // Email confirmation means there is no session yet, so a nurse cannot be
        // registered here. The choice rides along in user metadata and is
        // redeemed on first sign-in.
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              intended_role: role,
              intended_clinic_id: role === "nurse" ? (clinicId ?? null) : null,
            },
            emailRedirectTo: createAuthRedirect("verify-email"),
          },
        });
        return {
          error: error?.message ?? null,
          confirmationRequired: !error && !data.session,
        };
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        return { error: error?.message ?? null };
      },
      user: session?.user ?? null,
    }),
    [demoRole, fullName, isDemo, loading, session, nurseClinic, nurseError, nurseLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
