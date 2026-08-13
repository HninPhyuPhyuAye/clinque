import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const savedClinicsStorageKey = "@clinque/saved-clinics";

// Saved clinics are a personal preference, not clinical data, so they live on
// the device. That keeps the behaviour identical for a demo visitor and a
// signed-in patient, and needs no extra table or RLS policy.
let cachedIds: string[] | null = null;
const listeners = new Set<(ids: string[]) => void>();

function broadcast(ids: string[]) {
  cachedIds = ids;
  listeners.forEach((listener) => listener(ids));
}

async function readSaved(): Promise<string[]> {
  if (cachedIds) return cachedIds;

  try {
    const stored = await AsyncStorage.getItem(savedClinicsStorageKey);
    const parsed = stored ? (JSON.parse(stored) as unknown) : [];
    cachedIds = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    cachedIds = [];
  }

  return cachedIds;
}

/**
 * Shared saved-clinic list.
 *
 * Every screen subscribes to the same in-memory copy, so tapping the heart on
 * the directory updates the count on Profile without a reload.
 */
export function useSavedClinics() {
  const [savedIds, setSavedIds] = useState<string[]>(cachedIds ?? []);
  const [loading, setLoading] = useState(cachedIds === null);

  useEffect(() => {
    let active = true;

    void readSaved().then((ids) => {
      if (!active) return;
      setSavedIds(ids);
      setLoading(false);
    });

    const listener = (ids: string[]) => setSavedIds(ids);
    listeners.add(listener);

    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);

  const toggleSaved = useCallback(async (clinicId: string) => {
    const current = await readSaved();
    const next = current.includes(clinicId)
      ? current.filter((id) => id !== clinicId)
      : [...current, clinicId];

    broadcast(next);

    try {
      await AsyncStorage.setItem(savedClinicsStorageKey, JSON.stringify(next));
    } catch {
      // The toggle still holds for this session if storage is unavailable.
    }
  }, []);

  return {
    isSaved: (clinicId: string) => savedIds.includes(clinicId),
    loading,
    savedIds,
    toggleSaved,
  };
}
