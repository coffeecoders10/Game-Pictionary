"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { MAX_TEAMS, TEAM_COLORS, TEAM_NAME_MAX_LEN, DEFAULT_TURN_SECONDS, DEFAULT_WIN_SCORE, TURN_SECONDS_MAX, TURN_SECONDS_MIN, TURN_SECONDS_STEP, WIN_SCORE_MAX, WIN_SCORE_MIN, WIN_SCORE_STEP } from "@/lib/pictionary/engine";
import { gameActions, useGame } from "@/lib/pictionary/store";
import { Logo, Stamp } from "./Logo";
import { Modal } from "./Modal";

const REQUIRED_TEAMS = 2;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

interface SliderProps {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function Slider({ id, label, value, display, min, max, step, onChange }: SliderProps) {
  return (
    <div className="goal">
      <label htmlFor={id} className="goal-label">
        {label}
      </label>
      <input
        id={id}
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--fill": `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output htmlFor={id} className="goal-value">
        {display}
      </output>
    </div>
  );
}

export function Setup({ deckSize }: { deckSize: number }) {
  const router = useRouter();
  const saved = useGame(deckSize);
  const [names, setNames] = useState<string[]>(() => Array(MAX_TEAMS).fill(""));
  const [winScore, setWinScore] = useState<number>(DEFAULT_WIN_SCORE);
  const [turnSeconds, setTurnSeconds] = useState<number>(DEFAULT_TURN_SECONDS);
  const [shown, setShown] = useState(REQUIRED_TEAMS);
  const [error, setError] = useState(false);
  const [rules, setRules] = useState(false);

  const setName = (slot: number, value: string) => {
    setError(false);
    setNames((prev) => prev.map((n, i) => (i === slot ? value : n)));
  };

  return (
    <main className="shell setup">
      <header className="masthead">
        <Logo size={72} />
        <h1 className="wordmark">Pictionary</h1>
        <p className="tagline">Draw the word, and your team guesses it. First team to the target score wins.</p>
        <div className="masthead-links">
          <button className="link" type="button" onClick={() => setRules(true)}>
            How it works
          </button>
          <Link href="/sketch" className="btn sketchpad-btn">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 17l1-4L14 3l3 3L7 16z" />
              <path d="M12 5l3 3" />
            </svg>
            Sketchpad
          </Link>
          {saved && (
            <Link href="/play" className="link">
              Resume game
            </Link>
          )}
        </div>
      </header>

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (gameActions.start(names, deckSize, winScore, turnSeconds)) router.push("/play");
          else setError(true);
        }}
      >
        <fieldset className="teams">
          <legend className="sr-only">Team names</legend>
          {TEAM_COLORS.slice(0, shown).map((color, slot) => (
            <label key={color} className="team-field" data-color={color}>
              <span className="dot" aria-hidden />
              <span className="sr-only">Team {slot + 1} name</span>
              <input
                value={names[slot]}
                maxLength={TEAM_NAME_MAX_LEN}
                placeholder={`Team ${slot + 1}`}
                autoComplete="off"
                onChange={(e) => setName(slot, e.target.value)}
              />
            </label>
          ))}
        </fieldset>

        {shown < MAX_TEAMS && (
          <button className="btn ghost add-team" type="button" onClick={() => setShown(shown + 1)}>
            + Add team
          </button>
        )}

        <Slider
          id="win-score"
          label="Points to win"
          value={winScore}
          display={String(winScore)}
          min={WIN_SCORE_MIN}
          max={WIN_SCORE_MAX}
          step={WIN_SCORE_STEP}
          onChange={setWinScore}
        />

        <Slider
          id="turn-seconds"
          label="Time per turn"
          value={turnSeconds}
          display={mmss(turnSeconds)}
          min={TURN_SECONDS_MIN}
          max={TURN_SECONDS_MAX}
          step={TURN_SECONDS_STEP}
          onChange={setTurnSeconds}
        />

        <p className="form-error" role="alert" hidden={!error}>
          Name at least one team to start.
        </p>

        <button className="btn primary" type="submit">
          Start game
        </button>
      </form>

      <Stamp />

      {rules && (
        <Modal title="How it works" onClose={() => setRules(false)}>
          <ol className="rules-list">
            <li>Teams of two or more. Everyone plays from this one screen; each team can open the sketchpad on its own device.</li>
            <li>Roll the dice. The number is the points at stake.</li>
            <li>One teammate taps Show card, then flips it and reads it privately.</li>
            <li>The timer starts when they flip it. They draw either of the two words while the team guesses.</li>
            <li>Right answer scores the dice value. Timer out or skip scores nothing. Either way, the next team is up.</li>
            <li>First team to reach the points target you chose wins. The same person can&apos;t draw twice in a row, and no talking beyond the category.</li>
          </ol>
          <button className="btn primary" type="button" onClick={() => setRules(false)}>
            Got it
          </button>
        </Modal>
      )}
    </main>
  );
}
