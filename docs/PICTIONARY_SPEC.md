# Pictionary: Game Logic & State Spec (for Next.js port)

Audience: an engineer/agent re-implementing the game in Next.js. This spec covers **rules, data, state, scoring, and tracking only**. It deliberately says nothing about UI, layout, styling, or animation. The new UI is being designed separately; build the logic as a UI-agnostic engine that any UI can drive.

Source of truth in the legacy Django app (`cc_projects/pictionary/`): `views.py` (all game logic), `models.py` (Cards), `forms.py`, `static/js/timer2.js` (turn timer), `static/js/canvas.js` (sketchpad), `templates/pictionary/*.html` (only for flow and wording of rules). Card data: `Data/Pictionary/Pictionary_Data.csv`.

---

## 1. What the game is

A party game for **1 to 6 teams** playing on **one shared "controller" device** (the board). Teams take turns in a fixed order. On a turn:

1. The team's dice is rolled. The number (1-6) is both the points at stake and a selector for the card category.
2. The drawer (chosen by the team, offstage from the app) reveals a card showing **two** words from the category picked by the dice and score.
3. A 90-second timer runs while the drawer draws and teammates guess. Drawing happens elsewhere (see §9) and is not tracked by game state.
4. The controller operator marks the turn **Correct** (team scores the dice value), **Wrong/Skip**, or the timer runs out (treated as Wrong).
5. The turn passes to the next team. First team to reach **25 points** wins.

The app never validates guesses, never knows who is drawing, and never sees the drawing. The human operator adjudicates. Only turn flow, dice, card dealing, scores, and the win condition are managed by the app.

---

## 2. Data

### 2.1 Card deck (static data)

File: `Data/Pictionary/Pictionary_Data.csv`. 240 rows, header `title,object,action,food,allplay`, all fields quoted, lowercase text. Treat as read-only seed data.

| Column index | CSV column | Category label (shown to the drawer) |
|---|---|---|
| 0 | `title` | `Animals & Places` |
| 1 | `object` | `Objects` |
| 2 | `action` | `Actions` |
| 3 | `food` | `Food` |
| 4 | `allplay` | `Random` |

Examples: `bavaria / egg beater / ask / oven / sydney opera house`.

Notes for the port:
- A **card** is one row: 5 words, one per category. "Card" = row; the *word pair* shown on a turn comes from two different rows, same column (see §4.3).
- The file is **not UTF-8** (Windows-1252; one row has `sacré coeur` with a mangled `é`). Re-save as UTF-8 and fix that value when converting to JSON/TS.
- Two rows contain stray commas inside quoted fields (`"dove,"`, `"elk , moose"`). Use a real CSV parser, or trim them in the converted data (`dove`, `elk, moose`).
- No blanks. Values are mostly unique per column (`allplay` has 238 unique of 240, a harmless duplicate).
- Recommended: convert once to `cards.json` / typed TS array, with the 5 fields per row. No database is needed for the deck. In Django it was a `Cards` table (`card_title, card_object, card_action, card_food, card_allplay`, each `CharField(100)`), loaded outside the repo, and never registered in admin.

### 2.2 Constants

```ts
const CATEGORIES = ['Animals & Places', 'Objects', 'Actions', 'Food', 'Random'] as const; // index 0..4, same order as card columns
const TEAM_COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'pink'] as const;         // fixed color per setup slot 1..6
const MAX_TEAMS = 6;
const MIN_TEAMS = 1;               // 0 teams = invalid, back to setup
const TEAM_NAME_MAX_LEN = 20;
const WIN_SCORE = 25;
const DICE_MIN = 1, DICE_MAX = 6;
const TURN_SECONDS = 90;           // legacy: 92000 ms countdown, text says "1:30"; see §6
const WRONG_AUTOSUBMIT_DELAY_MS = 3000; // legacy delay after timer hits zero before the turn auto-fails
const SCORE_TO_PERCENT = 4;        // legacy progress display: percent = score * 4 (25 -> 100%)
```

---

## 3. State model

The legacy app stored everything in the Django **per-browser session** (server-side session keyed by cookie, SQLite-backed). That means state belonged to one browser and was lost when the session expired or the player started a new game. The port should hold the same state in a single game-state object (client store/reducer, optionally persisted to `localStorage` so a refresh does not wipe the game; see §8).

```ts
type TeamColor = 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'pink';

interface Team {
  name: string;          // user-entered, max 20 chars
  color: TeamColor;      // determined by setup slot, not by order among active teams
  score: number;         // integer, starts 0 (legacy: player_data[i][0])
  // legacy also stored percent = score * 4 at index 3; derive it, do not store
}

type Phase =
  | 'setup'              // no game yet
  | 'awaiting_card'      // legacy valid=0: turn shown, dice rolled, card not yet shown
  | 'card_shown'         // legacy valid=2: card revealed, timer running
  | 'finished';          // a team reached WIN_SCORE (legacy: transient flag only, see §5.3)

interface Card { words: [string, string, string, string, string]; } // [title, object, action, food, allplay]

interface GameState {
  phase: Phase;
  teams: Team[];                 // active teams only, in turn order (setup slot order)
  turn: number;                  // index into teams; starts 0
  dice: number;                  // 1..6, the value rolled for the current turn
  deckRemaining: number[];       // legacy card_index: indices of cards not yet dealt
  currentWords: [string, string] | null;  // the two options for the active turn (legacy "Word")
  currentCategory: string | null;         // label of the category in play
  winner: Team | null;
}
```

Legacy session keys for reference: `nop` (team count = `teams.length`), `turn`, `dice`, `valid` (phase: 0 or 2; `1` was never used), `player_data` (`[score, name, color, percent]` per team), `genre` (the category list), `card_index`, plus an unused `score` array.

---

## 4. Game flow and rules

### 4.1 Setup (legacy `login` view)

Input: up to six optional team-name fields, tied to fixed slots 1-6 → colors red, blue, green, yellow, orange, pink.

- Include a team only if its name is non-empty. Color follows the **slot**, not the position among active teams. Example: slots 1, 3, 4 filled → teams = [red, green, yellow].
- Turn order is slot order (red → blue → green → yellow → orange → pink), skipping empty slots.
- Max name length 20. The legacy code did no trimming and no duplicate check. Recommended: trim whitespace, treat whitespace-only as empty, and allow duplicate names (colors disambiguate).
- If **zero** teams are provided, do not start a game; return to setup.
- On valid setup, initialize:
  - `teams` with `score = 0`
  - `turn = 0`
  - `phase = 'awaiting_card'`
  - `dice = rollDice()` (legacy set `dice = 0` at login, then rolled when the board first loaded; the effect is the same: the first turn has a rolled dice before any card)
  - `deckRemaining = [0 .. deckSize-1]`
  - `currentWords = null`, `winner = null`
- Starting a new game fully overwrites any previous game state ("Play Again" = go back to setup, then re-run this).

### 4.2 Dice

- `rollDice()` → uniform integer 1-6.
- The dice is **rolled for the upcoming turn immediately after the previous turn resolves** (and at game start), i.e. the value exists before the player "rolls". The legacy front end showed a cosmetic spinning animation (cycles random faces about every 150 ms for 2 s) and then revealed the pre-decided value. The result is never re-rolled.
- Port decision (either is acceptable): keep the legacy model (value decided in state at turn start; any roll UX just reveals it), or roll when the player triggers it. Either way the value must be fixed before the card is dealt, and must not change between "roll" and "show card".
- The dice is used twice: (a) as points awarded on Correct, and (b) in the category selector (§4.3).

### 4.3 Show card (legacy `showcard` POST)

Allowed only in phase `awaiting_card`. Steps:

1. Draw **two distinct cards without replacement** from `deckRemaining`: pick a random element, remove it, pick another random element, remove it.
2. Compute the category index (column) for this turn:
   ```
   x = (currentTeam.score + dice - 1) mod 5
   ```
   (Uses the team's score **before** this turn's points, and this turn's dice. Because score changes over the game and dice varies, categories are effectively pseudo-random but deterministic given the two numbers.)
3. `currentWords = [cardA.words[x], cardB.words[x]]`; `currentCategory = CATEGORIES[x]`.
4. `phase = 'card_shown'`; start the 90 s timer (§6).

The drawer picks **either one** of the two words to draw. The teammates guess that word. The app does not record which was chosen.

The deck is a **one-way, no-reshuffle pool** for the whole game. Cards are consumed on show, regardless of whether the turn is later Correct or Wrong.

### 4.4 Resolve turn: Correct

Allowed only in phase `card_shown`.

1. `team.score += dice`
2. If `team.score >= WIN_SCORE` → game is won by this team (§5).
3. Advance turn: `turn = (turn + 1) mod teams.length`
4. `dice = rollDice()` for the next team
5. `phase = 'awaiting_card'`, clear `currentWords` / `currentCategory`, stop the timer and alarm.

### 4.5 Resolve turn: Wrong / Skip / Timeout

Allowed only in phase `card_shown`. Identical to Correct **except no points are added** (score unchanged). Three triggers, all equivalent in effect:
- The operator presses Wrong or Skip (Skip is only offered while a card is showing; the legacy UI had no skip before the card appeared).
- The timer hits zero: play the alarm, wait ~3 s, then auto-resolve as Wrong (§6).
- (Legacy "Skip Turn" simply fired the Wrong action.)

No penalty, no carry-over. The next team always gets a **fresh dice** and **fresh cards**.

### 4.6 Turn order summary

Round-robin with no skips, repeats, or reversals: `turn = (turn + 1) mod n` after every resolved turn (Correct, Wrong, Skip, or Timeout). Solo (1 team) is valid; the same team goes every turn.

### 4.7 Phase machine

```
setup --(≥1 team)--> awaiting_card --showCard--> card_shown --correct/wrong/skip/timeout--> awaiting_card
                                                          \--correct with score>=25--> finished
finished --(play again)--> setup
```

Rejected transitions (ignore or throw): showCard when not `awaiting_card`; correct/wrong when not `card_shown`; any action when `finished` or `setup`.

---

## 5. Scoring, tracking, and win condition

### 5.1 Score

- Per team integer `score`, starts 0. Only Correct changes it, by exactly `+dice` (1-6). No bonuses, steals, or negatives.
- Display value used by the legacy scoreboard: `percent = score * 4`, shown as `percent/100` with a progress bar width of `percent%`. Since 25 × 4 = 100, this is "progress to winning". **Legacy bug:** it is not capped, so a score of 30 yields 120%. Clamp bar width to 100 in the port; keep the raw `score` as the source of truth.
- Tracked per team: name, color, score. Nothing else (no history, turns played, correct/wrong counts, per-card stats). The only cross-turn trackers are `turn`, `dice`, and `deckRemaining`.

### 5.2 Win condition

- Checked **only** immediately after a Correct: `team.score >= 25`. Scores can overshoot (24 + 6 = 30) and that still wins.
- The first team to reach it wins immediately; because turns are sequential there are no ties and no "finish the round" rule.
- The win is checked for the team that just scored only (others cannot reach 25 without having their own Correct turn).

### 5.3 Win state (legacy quirk to fix)

In Django the winner was computed into a local variable `win = [1, name, color]` for that single response only; it was **not saved to the session**. The turn still advanced and a new dice was rolled behind the scenes. Reloading `/board/` after a win dropped back into the normal turn flow, and the game would continue as if no one had won.

Port requirement: persist `winner` and set `phase = 'finished'` so it survives re-renders/refresh. In `finished`, no more turn actions are accepted; only "play again" (back to setup) is available. Scores should remain readable on the finished state.

---

## 6. Timer

Legacy (`timer2.js`), client-only; the server never enforced it:

- Starts when the card is revealed.
- Countdown from `now + 92000 ms`, ticking every 1000 ms, displaying `M:S` with **no zero-padding** (e.g. `1:5`). Net effect is a "1:30" game timer with ~2 s of slack. Rules text says 1:30.
- On reaching zero (`distance < 0`): stop the interval, clear the display, play `static/js/aa.mp3` (alarm), and after 3000 ms auto-submit **Wrong**.
- Legacy bug: the "stop timer / stop audio on Correct/Wrong" function referenced an out-of-scope interval variable and called `audio.stop()` (which does not exist on `HTMLAudioElement`), so it threw; it only "worked" because the form submission reloaded the page and destroyed the timer.
- Reload during `card_shown` in legacy also restarted the timer from full (and showed blank words, see §8).

Port requirements:
- Timer is a function of `card_shown`. Cancel it on any resolution of the turn, and on unmount.
- Compute remaining time from a stored start timestamp (`Date.now()` deadline), not by counting ticks, so it survives re-renders and (if persisted) refresh.
- Recommended `TURN_SECONDS = 90`, zero-padded `M:SS` formatting is a UI concern, but the engine should expose `secondsRemaining`.
- At zero: trigger the alarm side-effect, then `resolveTurn('timeout')` after `WRONG_AUTOSUBMIT_DELAY_MS`. If the operator presses Correct during that 3 s grace window, it should be honored (legacy allowed this accidentally; reasonable to keep or disallow, but pick one and document it).
- Audio file `static/js/aa.mp3` is the alarm asset to carry over.

---

## 7. Card dealing details and edge cases

- `deckRemaining` starts as all 240 indices. Each Show Card removes 2. Max 120 turns before exhaustion.
- Legacy behavior when the deck runs out: `random.choice` on an empty list raised `IndexError` → HTTP 500. A game could in theory exceed 120 turns (e.g., 6 teams each scoring a 1 on most turns, plus any Wrong turns also burn cards). Port requirement: when fewer than 2 cards remain, **reshuffle** the full deck (optionally excluding the cards currently in play) instead of failing.
- The two words come from two different cards, same column. They cannot be the same card. They could theoretically be identical text only for the one duplicated `allplay` value; ignore.
- Randomness: legacy used Python `random` (not seeded, not security-relevant). Use `Math.random`, or a seedable PRNG if you want deterministic tests. Keep randomness inside injectable functions (`rollDice`, `drawCards`) so the engine is testable.
- Legacy loaded the deck with `Cards.objects.all()` (no explicit ordering) and indexed into it; indices were positions in an unordered queryset. Not meaningful to preserve; use stable array indices.

---

## 8. Persistence, concurrency, and legacy refresh bugs

Legacy persistence = Django session. No accounts, no database writes during play (cards table read-only), no leaderboard, no history, no game IDs, no multi-device sync. Another browser = another independent game.

Port options (pick one, keep the engine independent of it):
1. **Client-only (closest to legacy):** whole `GameState` in a reducer/store, mirrored to `localStorage` (versioned key) so refresh and navigation (e.g. visiting rules) do not lose the game. Clear it on "play again".
2. **Server-held:** route handlers/server actions that keep state in a cookie-session or store. Only worthwhile if you want multi-device play. Not required.

Legacy refresh/edge bugs. Do not replicate; handle explicitly:
- GET on the board re-rolled the dice every time. Port: dice changes only when a turn resolves (or at game start).
- Refresh during `card_shown` (a GET) rendered the card screen with **empty words** and restarted the timer. Port: persist `currentWords`/`currentCategory`/timer deadline so the card screen reconstructs correctly.
- Browser "resubmit form" on a POST would re-run Show Card (burning 2 more cards, re-computing the category) or double-apply Correct (+dice twice, advancing two turns). Port: make actions idempotent by checking `phase` (only one valid action per phase) so duplicates are ignored.
- Accessing the board with no session crashed (`KeyError`). Port: no game state → redirect to setup.
- Category `gen` (label) was computed from `x`, which was only set in the Show Card request; otherwise it defaulted to index 0. Port: carry `currentCategory` in state.

---

## 9. Sketchpad (separate, optional side-feature)

A standalone drawing surface, **not connected to game state**. Each team opens it on its own device; the controller device never receives drawing data. It is just a freehand canvas plus a clear action.

If you port it (the UI is yours to redesign), the behaviors are:
- Freehand drawing with mouse **and** touch. Black ink, thin line (~1 px). One finger only for touch; suppress page scroll while drawing on the canvas.
- A single press draws a dot (radius 1).
- "Clear" wipes the whole canvas.
- Canvas sized to the viewport (width − 20, height − 50) at load; no resize handling, no undo, no eraser, no color or brush choices, no save/export, no networking.
- Legacy bug: strokes use `lineTo`/`stroke` without `beginPath`/`moveTo` per stroke, so a new stroke visually connects to the end of the previous one and old segments get re-stroked. Port: begin a new path at pointer-down.
- Nothing in the game logic reads from or writes to the canvas.

---

## 10. Rules text to carry over (content, not layout)

From the legacy rules page (wording may be reused in any UI):
1. 1-6 teams of 2+ players each.
2. Enter team names on one device and press play.
3. Each team opens the canvas on another device.
4. On each turn a player from the team rolls the dice.
5. The team chooses one drawer for that round.
6. The drawer taps Show Card and looks at it privately.
7. A 1:30 timer starts when the card is shown.
8. The drawer draws **one of the two** options; teammates guess it.
9. Correct → points awarded, next team. Timer out → no points, next team. Skip → no points, next team.
10. Points = dice value. First team to **25** wins.

Notes (honor-system rules, **not enforced by the app**): the same player can't draw twice in a row; the drawer may announce the category but can't otherwise speak; the legacy rules page says "6 categories" but the data and logic have **5** (Animals & Places, Objects, Actions, Food, Random).

---

## 11. Suggested implementation shape

- A pure, framework-free module (e.g. `lib/pictionary/engine.ts`) exporting types from §3 and functions:
  - `createGame(teamNames: (string|null)[6], deck, rng?) → GameState | error`
  - `showCard(state, rng?) → GameState`
  - `resolveTurn(state, outcome: 'correct' | 'wrong' | 'skip' | 'timeout', rng?) → GameState`
  - `getScoreboard(state) → { name, color, score, percent }[]`
  - `reshuffleIfNeeded(deckRemaining, deckSize)` (internal)
- Wrap it in a React reducer/store; the timer and audio are UI-layer side effects driven by `phase === 'card_shown'`.
- Unit tests to write against the engine:
  - category index formula `(score + dice - 1) % 5` including wraparound (e.g. score 24, dice 6 → 29 % 5 = 4)
  - color assigned by slot (slots 1,3,4 → red, green, yellow)
  - Correct adds exactly `dice`; Wrong/Skip/Timeout add 0; all advance the turn modulo team count
  - win at exactly 25 and on overshoot (24+6); `finished` rejects further actions
  - two cards dealt are distinct and removed from the deck; deck reshuffles instead of throwing
  - duplicate/out-of-phase actions are ignored (idempotency)
  - 1-team game cycles to itself; 0 teams rejected

## 12. Quick reference: legacy behavior to preserve vs. fix

| Preserve | Fix |
|---|---|
| 1-6 teams, fixed slot → color mapping, slot-order turns | Winner not persisted → persist, lock the game |
| Dice rolled before card; same value = points and category selector | Deck exhaustion crash → reshuffle |
| Category = `(score + dice − 1) % 5`; two distinct cards, same column | Refresh/resubmit duplicating actions → phase-guarded actions |
| Cards consumed on show (even if Wrong) | Blank card/restarted timer after refresh → persist card + deadline |
| Only Correct scores (`+dice`); first to ≥25 wins (overshoot OK) | Progress >100% → clamp display |
| Wrong, Skip, Timeout all identical (no points, next team) | Timer cleanup bug; use a deadline-based timer |
| Operator adjudicates; app tracks no guesses, drawer, or history | Sketchpad stroke-joining bug |
| Names ≤ 20 chars, zero teams invalid | CSV encoding/stray commas in card data |
