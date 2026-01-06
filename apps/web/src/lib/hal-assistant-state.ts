import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { UIMessage } from "@ai-sdk/react";
import type { AdvisorHatType } from "./advisor-hats";

// Atom to track if the HAL assistant full panel is open - persisted to localStorage
export const halAssistantOpenAtom = atomWithStorage<boolean>(
  "hal-assistant-open",
  false,
);

// Atom to track if the HAL assistant mini popup is open (separate from full panel)
export const halAssistantMiniPopupOpenAtom = atom<boolean>(false);

// Atom to track if there are new deliverables
export const halAssistantHasNewDeliverableAtom = atom<boolean>(false);

// Atom to track the current active tab
export const halAssistantActiveTabAtom = atom<string>("advisor");

// Atom to track if there are analysis results
export const halAssistantHasResultsAtom = atom<boolean>(false);

// Derived atom to set hasNewDeliverable
export const setHalAssistantHasNewDeliverableAtom = atom(
  null,
  (get, set, value: boolean) => {
    set(halAssistantHasNewDeliverableAtom, value);
  },
);

// Global error notification state
export interface ErrorNotificationState {
  show: boolean;
  hasCriticalOrHighErrors: boolean;
  errorCount: number;
}

export const errorNotificationAtom = atom<ErrorNotificationState>({
  show: false,
  hasCriticalOrHighErrors: false,
  errorCount: 0,
});

// Derived atom to update error notification state
export const setErrorNotificationAtom = atom(
  null,
  (get, set, value: Partial<ErrorNotificationState>) => {
    const currentState = get(errorNotificationAtom);
    set(errorNotificationAtom, { ...currentState, ...value });
  },
);

// Multi-Hat Advisor System Atoms
// NOTE: These atoms need to be project-specific to avoid sharing state across projects
// Use the factory functions below to create project-scoped atoms

// Factory function to create project-specific active tabs atom
export const createAdvisorActiveTabsAtom = (projectId: string) =>
  atomWithStorage<AdvisorHatType[]>(
    `advisor-active-tabs-${projectId}`,
    ["generalist"], // Default: only generalist tab open
  );

// Factory function to create project-specific current tab atom
export const createAdvisorCurrentTabAtom = (projectId: string) =>
  atomWithStorage<AdvisorHatType>(
    `advisor-current-tab-${projectId}`,
    "generalist",
  );

// Legacy global atoms (deprecated - kept for backward compatibility)
// These will be removed once all components use project-specific atoms
export const advisorActiveTabsAtom = atomWithStorage<AdvisorHatType[]>(
  "advisor-active-tabs",
  ["generalist"],
);

export const advisorCurrentTabAtom = atomWithStorage<AdvisorHatType>(
  "advisor-current-tab",
  "generalist",
);

// Pinned hats (shown in mini popup) - persisted to localStorage
// This can remain global as it's a user preference, not project-specific
export const advisorPinnedHatsAtom = atomWithStorage<AdvisorHatType[]>(
  "advisor-pinned-hats",
  ["generalist"], // Default: generalist is pinned
);

// In-memory cache of Advisor chat state so the mini popup and full panel can
// reuse already-fetched messages without refetching when toggling views.
type AdvisorChatCacheState = {
  messages: UIMessage[];
  hasInitialized: boolean;
  lastLoadedAt: number | null;
};

const advisorChatCacheAtoms = new Map<
  string,
  ReturnType<typeof atom<AdvisorChatCacheState>>
>();

export const createAdvisorChatCacheAtom = (
  projectId: string,
  hatType: AdvisorHatType,
) => {
  const key = `${projectId}-${hatType}-cache`;

  if (!advisorChatCacheAtoms.has(key)) {
    advisorChatCacheAtoms.set(
      key,
      atom<AdvisorChatCacheState>({
        messages: [],
        hasInitialized: false,
        lastLoadedAt: null,
      }),
    );
  }

  // The non-null assertion is safe because we create the atom when missing.
  return advisorChatCacheAtoms.get(key)!;
};
