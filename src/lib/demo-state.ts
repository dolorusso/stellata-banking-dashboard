/**
 * Client-held demo state: the user's event log, persisted in localStorage and
 * sent in every API request body. Read fresh at request time, so query keys
 * don't need to include it; mutations invalidate queries after writing.
 */
import { useSyncExternalStore } from "react";
import { DemoStateSchema, EMPTY_DEMO_STATE, type CardStatus, type DemoState, type TransferEvent } from "./schemas";

const STORAGE_KEY = "stellata-demo-state-v1";
const CHANGE_EVENT = "stellata-demo-state-change";

let snapshot: DemoState | null = null;

export function readDemoState(): DemoState {
  if (snapshot) return snapshot;
  if (typeof window === "undefined") return EMPTY_DEMO_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? DemoStateSchema.safeParse(JSON.parse(raw)) : null;
    snapshot = parsed?.success ? parsed.data : EMPTY_DEMO_STATE;
  } catch {
    snapshot = EMPTY_DEMO_STATE; // corrupted or unavailable storage → start fresh
  }
  return snapshot;
}

function writeDemoState(next: DemoState) {
  snapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota: keep working in memory for this session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function appendTransferEvent(event: TransferEvent) {
  const state = readDemoState();
  writeDemoState({ ...state, transfers: [...state.transfers, event] });
}

export function setCardStatus(cardId: string, status: CardStatus) {
  const state = readDemoState();
  writeDemoState({ ...state, cardStatus: { ...state.cardStatus, [cardId]: status } });
}

export function resetDemoState() {
  writeDemoState(EMPTY_DEMO_STATE);
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    snapshot = null; // another tab wrote: re-read
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, readDemoState, () => EMPTY_DEMO_STATE);
}
