/**
 * Shared atoms for settings modal state management
 */

import { atom } from 'jotai';

export type SettingsTab = 'overview' | 'database' | 'domains' | 'convex-data' | 'convex-files' | 'convex-functions' | 'convex-logs' | 'convex-health' | 'convex-env' | 'convex-auth' | 'shipper-cloud-billing';

// Atom to control if settings modal is open
export const isSettingsOpenAtom = atom(false);

// Atom to control which tab is active in settings
export const activeSettingsTabAtom = atom<SettingsTab>('overview');

// Derived atom to open settings with a specific tab
export const openSettingsWithTabAtom = atom(
  null,
  (get, set, tab: SettingsTab) => {
    set(activeSettingsTabAtom, tab);
    set(isSettingsOpenAtom, true);
  }
);