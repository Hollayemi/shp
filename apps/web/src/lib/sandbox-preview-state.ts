import { atom } from "jotai";

export type SandboxPreviewState = {
  url: string;
  authenticatedUrl?: string;
  token?: string;
  timestamp: number;
  shouldRefresh: boolean;
} | null;

export const sandboxPreviewUrlAtom = atom<SandboxPreviewState>(null);

export const setSandboxPreviewUrlAtom = atom(
  null,
  (get, set, value: SandboxPreviewState) => {
    set(sandboxPreviewUrlAtom, value);
  },
);
