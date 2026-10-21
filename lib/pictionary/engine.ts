// Pure game engine: no React, no storage, no timers. See docs/PICTIONARY_SPEC.md.

export const CATEGORIES = ["Animals & Places", "Objects", "Actions", "Food", "Random"] as const;
export const TEAM_COLORS = ["red", "blue", "green", "yellow", "orange", "pink"] as const;
export const MAX_TEAMS = 6;
export const TEAM_NAME_MAX_LEN = 20;
export const WIN_SCORE_MIN = 10;
export const WIN_SCORE_MAX = 50;
export const WIN_SCORE_STEP = 5;
export const DEFAULT_WIN_SCORE = 25;
export const TURN_SECONDS_MIN = 30;
export const TURN_SECONDS_MAX = 180;
export const TURN_SECONDS_STEP = 15;
export const DEFAULT_TURN_SECONDS = 90;
export const WRONG_AUTOSUBMIT_DELAY_MS = 3000;

export type TeamColor = (typeof TEAM_COLORS)[number];
export type Phase = "setup" | "awaiting_card" | "card_shown" | "finished";
export type Outcome = "correct" | "wrong" | "skip" | "timeout";
export type Card = readonly [string, string, string, string, string];
export type Rng = () => number;

export interface Team {
  name: string;
  color: TeamColor;
  score: number;
}

export interface LastResult {
  team: string;
  color: TeamColor;
  outcome: Outcome;
  points: number;
}

export interface GameState {
  phase: Phase;
  teams: Team[];
  turn: number;
  /** Counts resolved turns; UI uses it to reset per-turn state such as the dice roll. */
  round: number;
  dice: number;
  /** Points a team needs to win, chosen at setup. */
  winScore: number;
  /** Seconds per turn, chosen at setup. */
  turnSeconds: number;
  deckSize: number;
  deckRemaining: number[];
  currentWords: [string, string] | null;
  currentCategory: string | null;
  /** Epoch ms at which the turn timer hits zero. Null until the drawer flips the card. */
  deadline: number | null;
  /** The turn just resolved, shown to the room until dismissed. */
  lastResult: LastResult | null;
  winner: Team | null;
}

const isValidTurnSeconds = (n: number) =>
  Number.isInteger(n) && n >= TURN_SECONDS_MIN && n <= TURN_SECONDS_MAX && (n - TURN_SECONDS_MIN) % TURN_SECONDS_STEP === 0;

const isValidWinScore = (n: number) =>
  Number.isInteger(n) && n >= WIN_SCORE_MIN && n <= WIN_SCORE_MAX && (n - WIN_SCORE_MIN) % WIN_SCORE_STEP === 0;

export const rollDice = (rng: Rng = Math.random) => 1 + Math.floor(rng() * 6);

const pick = (list: number[], rng: Rng) => list.splice(Math.floor(rng() * list.length), 1)[0];

const fullDeck = (size: number) => Array.from({ length: size }, (_, i) => i);

/** Returns null when no team name is given (0 teams is invalid). */
export function createGame(
  names: readonly (string | null | undefined)[],
  deckSize: number,
  winScore: number = DEFAULT_WIN_SCORE,
  turnSeconds: number = DEFAULT_TURN_SECONDS,
  rng: Rng = Math.random,
): GameState | null {
  const teams: Team[] = [];
  names.slice(0, MAX_TEAMS).forEach((raw, slot) => {
    const name = (raw ?? "").trim().slice(0, TEAM_NAME_MAX_LEN);
    if (name) teams.push({ name, color: TEAM_COLORS[slot], score: 0 });
  });
  if (teams.length === 0 || deckSize < 2) return null;
  return {
    phase: "awaiting_card",
    teams,
    turn: 0,
    round: 0,
    dice: rollDice(rng),
    winScore: isValidWinScore(winScore) ? winScore : DEFAULT_WIN_SCORE,
    turnSeconds: isValidTurnSeconds(turnSeconds) ? turnSeconds : DEFAULT_TURN_SECONDS,
    deckSize,
    deckRemaining: fullDeck(deckSize),
    currentWords: null,
    currentCategory: null,
    deadline: null,
    lastResult: null,
    winner: null,
  };
}

export const categoryIndex = (score: number, dice: number) => (score + dice - 1) % CATEGORIES.length;

/** Draws two distinct cards without replacement, reshuffling the deck if fewer than two remain. */
export function drawCards(deckRemaining: readonly number[], deckSize: number, rng: Rng = Math.random) {
  let pool = [...deckRemaining];
  if (pool.length < 2) pool = fullDeck(deckSize);
  const a = pick(pool, rng);
  const b = pick(pool, rng);
  return { a, b, remaining: pool };
}

export function showCard(state: GameState, deck: readonly Card[], rng: Rng = Math.random): GameState {
  if (state.phase !== "awaiting_card") return state;
  const { a, b, remaining } = drawCards(state.deckRemaining, state.deckSize, rng);
  const x = categoryIndex(state.teams[state.turn].score, state.dice);
  return {
    ...state,
    phase: "card_shown",
    deckRemaining: remaining,
    currentWords: [deck[a][x], deck[b][x]],
    currentCategory: CATEGORIES[x],
    deadline: null,
    lastResult: null,
  };
}

/** The drawer flipped the card: the timer starts now. Re-flipping never restarts it. */
export function revealCard(state: GameState, now: number = Date.now()): GameState {
  if (state.phase !== "card_shown" || state.deadline !== null) return state;
  return { ...state, deadline: now + state.turnSeconds * 1000 };
}

export function dismissResult(state: GameState): GameState {
  return state.lastResult ? { ...state, lastResult: null } : state;
}

export function resolveTurn(state: GameState, outcome: Outcome, rng: Rng = Math.random): GameState {
  if (state.phase !== "card_shown") return state;
  const teams = state.teams.map((t, i) =>
    i === state.turn && outcome === "correct" ? { ...t, score: t.score + state.dice } : t,
  );
  const cleared = { currentWords: null, currentCategory: null, deadline: null };
  const scorer = teams[state.turn];
  const lastResult: LastResult = {
    team: scorer.name,
    color: scorer.color,
    outcome,
    points: outcome === "correct" ? state.dice : 0,
  };
  if (outcome === "correct" && scorer.score >= state.winScore) {
    return { ...state, ...cleared, teams, lastResult: null, phase: "finished", winner: scorer, round: state.round + 1 };
  }
  return {
    ...state,
    ...cleared,
    teams,
    lastResult,
    phase: "awaiting_card",
    turn: (state.turn + 1) % teams.length,
    round: state.round + 1,
    dice: rollDice(rng),
  };
}

export const secondsRemaining = (state: GameState, now: number = Date.now()) =>
  state.deadline === null ? 0 : Math.max(0, Math.ceil((state.deadline - now) / 1000));

export const getScoreboard = (state: GameState) =>
  state.teams.map((t) => ({ ...t, percent: Math.min(100, (t.score / state.winScore) * 100) }));

/** Fills settings added after a game was saved, so older saves keep working. Same object if nothing is missing. */
export function withDefaults(state: GameState): GameState {
  if (typeof state.winScore === "number" && typeof state.turnSeconds === "number") return state;
  return {
    ...state,
    winScore: typeof state.winScore === "number" ? state.winScore : DEFAULT_WIN_SCORE,
    turnSeconds: typeof state.turnSeconds === "number" ? state.turnSeconds : DEFAULT_TURN_SECONDS,
  };
}

/** Guards persisted state: it is only valid for the deck it was dealt from. */
export function isValidState(value: unknown, deckSize: number): value is GameState {
  const s = value as GameState | null;
  return (
    !!s &&
    typeof s === "object" &&
    s.deckSize === deckSize &&
    Number.isFinite(s.winScore) &&
    Number.isFinite(s.turnSeconds) &&
    (s.deadline === null || Number.isFinite(s.deadline)) &&
    Array.isArray(s.teams) &&
    s.teams.length > 0 &&
    Array.isArray(s.deckRemaining) &&
    ["awaiting_card", "card_shown", "finished"].includes(s.phase) &&
    (s.phase !== "card_shown" || !!s.currentWords)
  );
}
