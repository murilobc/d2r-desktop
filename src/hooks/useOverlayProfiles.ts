import { useState, useCallback } from "react";
import { emit } from "@tauri-apps/api/event";
import type {
  OverlayProfile,
  OverlayProfileLayout,
  CreateOverlayProfileInput,
  UpdateOverlayProfileInput,
} from "../types";
import {
  getOverlayProfiles,
  createOverlayProfile,
  updateOverlayProfile,
  deleteOverlayProfile,
  setActiveOverlayProfile,
} from "../api";

const MAX_PROFILES = 20;

export interface UseOverlayProfiles {
  profiles: OverlayProfile[];
  activeProfile: OverlayProfile | null;
  loading: boolean;
  error: string | null;
  loadProfiles: () => Promise<void>;
  createProfile: (name: string, layout: OverlayProfileLayout) => Promise<OverlayProfile | null>;
  updateProfile: (id: string, input: UpdateOverlayProfileInput) => Promise<OverlayProfile | null>;
  deleteProfile: (id: string) => Promise<boolean>;
  switchProfile: (id: string) => Promise<boolean>;
}

export function useOverlayProfiles(): UseOverlayProfiles {
  const [profiles, setProfiles] = useState<OverlayProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<OverlayProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emitProfileUpdate = useCallback(async (layout: OverlayProfileLayout) => {
    await emit("overlay-profile-update", layout);
  }, []);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedProfiles = await getOverlayProfiles();
      setProfiles(fetchedProfiles);
      const active = fetchedProfiles.find((p) => p.is_active) ?? null;
      setActiveProfile(active);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createProfileFn = useCallback(
    async (name: string, layout: OverlayProfileLayout): Promise<OverlayProfile | null> => {
      setError(null);

      if (profiles.length >= MAX_PROFILES) {
        setError("Maximum number of profiles reached");
        return null;
      }

      try {
        const input: CreateOverlayProfileInput = { name, layout };
        const newProfile = await createOverlayProfile(input);
        setProfiles((prev) => [...prev, newProfile]);
        return newProfile;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return null;
      }
    },
    [profiles.length]
  );

  const updateProfileFn = useCallback(
    async (id: string, input: UpdateOverlayProfileInput): Promise<OverlayProfile | null> => {
      setError(null);
      try {
        const updated = await updateOverlayProfile(id, input);
        setProfiles((prev) =>
          prev.map((p) => (p.id === id ? updated : p))
        );

        if (activeProfile?.id === id) {
          setActiveProfile(updated);
          await emitProfileUpdate(updated.layout);
        }

        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return null;
      }
    },
    [activeProfile?.id, emitProfileUpdate]
  );

  const deleteProfileFn = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null);
      try {
        await deleteOverlayProfile(id);
        const remaining = profiles.filter((p) => p.id !== id);
        setProfiles(remaining);

        if (activeProfile?.id === id) {
          // Backend activates the first remaining profile
          const newActive = remaining[0] ?? null;
          if (newActive) {
            newActive.is_active = true;
            setActiveProfile(newActive);
            await emitProfileUpdate(newActive.layout);
          } else {
            setActiveProfile(null);
          }
        }

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return false;
      }
    },
    [profiles, activeProfile?.id, emitProfileUpdate]
  );

  const switchProfileFn = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null);
      try {
        await setActiveOverlayProfile(id);

        setProfiles((prev) =>
          prev.map((p) => ({ ...p, is_active: p.id === id }))
        );

        const target = profiles.find((p) => p.id === id) ?? null;
        if (target) {
          const updatedTarget = { ...target, is_active: true };
          setActiveProfile(updatedTarget);
          await emitProfileUpdate(updatedTarget.layout);
        }

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return false;
      }
    },
    [profiles, emitProfileUpdate]
  );

  return {
    profiles,
    activeProfile,
    loading,
    error,
    loadProfiles,
    createProfile: createProfileFn,
    updateProfile: updateProfileFn,
    deleteProfile: deleteProfileFn,
    switchProfile: switchProfileFn,
  };
}
