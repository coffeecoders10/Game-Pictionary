import { useSyncExternalStore } from "react";
import {
  createGame,
  isValidState,
  resolveTurn,
  revealCard,
  withDefaults,
  dismissResult,
  showCard,
  type Card,
  type GameState,
  type Outcome,
} from "./engine";

// Versioned so a future state shape change can't load a stale game.
const KEY = "cc-pictionary:v3";
const UNLOADED = Symbol("unloaded");

let current: GameState | null | typeof UNLOADED = UNLOADED;
const listeners = new Set<() => void>();

function read(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? withDefaults(JSON.parse(raw) as GameState) : null;
  } catch {
    return null;
  }
}

function commit(next: GameState | null) {
  current = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or full storage: the game keeps working in memory.
  }
  listeners.forEach((l) => l());
}

function snapshot(): GameState | null {
  if (current === UNLOADED) current = read();
  // Also repairs a state still held in memory from before a setting existed (e.g. across hot reloads).
  if (current !== null) current = withDefaults(current);
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      current = UNLOADED;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** `undefined` while rendering on the server / before hydration, `null` when there is no game. */
export function useGame(deckSize: number): GameState | null | undefined {
  const raw = useSyncExternalStore(subscribe, snapshot, () => undefined);
  if (raw === undefined) return undefined;
  return isValidState(raw, deckSize) ? raw : null;
}

export const gameActions = {
  start: (names: readonly string[], deckSize: number, winScore: number, turnSeconds: number) => {
    const game = createGame(names, deckSize, winScore, turnSeconds);
    if (game) commit(game);
    return game !== null;
  },
  showCard: (deck: readonly Card[]) => {
    const state = snapshot();
    if (state) commit(showCard(state, deck));
  },
  reveal: () => {
    const state = snapshot();
    if (!state) return;
    const next = revealCard(state);
    if (next !== state) commit(next);
  },
  dismissResult: () => {
    const state = snapshot();
    if (!state) return;
    const next = dismissResult(state);
    if (next !== state) commit(next);
  },
  resolve: (outcome: Outcome) => {
    const state = snapshot();
    if (!state) return;
    const next = resolveTurn(state, outcome);
    // Phase guard returns the same object: ignore duplicate or out-of-phase actions.
    if (next !== state) commit(next);
  },
  reset: () => commit(null),
};
