"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  WRONG_AUTOSUBMIT_DELAY_MS,
  secondsRemaining,
  type Card,
  type GameState,
} from "@/lib/pictionary/engine";
import { gameActions } from "@/lib/pictionary/store";
import { playAlarm } from "./alarm";
import { Dice } from "./Dice";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Rolling and showing the card. Remounted per turn (keyed by round) so `rolled` resets. */
export function RollAndDeal({ state, deck }: { state: GameState; deck: readonly Card[] }) {
  const [rolled, setRolled] = useState(false);
  const onRolled = useCallback(() => setRolled(true), []);
  const team = state.teams[state.turn];

  return (
    <section className="turn" data-color={team.color} aria-live="polite">
      <p className="turn-label">
        <span className="dot" aria-hidden /> {team.name}&apos;s turn
      </p>
      <Dice value={state.dice} rolled={rolled} onRolled={onRolled} />
      <p className="turn-hint">
        {rolled ? `${state.dice} ${state.dice === 1 ? "point" : "points"} on the line.` : "Roll to see the points at stake."}
      </p>
      <button className="btn primary" type="button" disabled={!rolled} onClick={() => gameActions.showCard(deck)}>
        Show card
      </button>
      {rolled && <p className="fineprint">Only the drawer should look at the screen.</p>}
    </section>
  );
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function CardTurn({ state }: { state: GameState }) {
  const team = state.teams[state.turn];
  const now = useNow(250);
  // Face-up is per-device UI state: after a refresh the card starts hidden, and re-peeking never restarts the timer.
  const [faceUp, setFaceUp] = useState(false);
  const started = state.deadline !== null;
  const left = started ? secondsRemaining(state, now) : state.turnSeconds;
  const expired = started && left === 0;
  const deadline = state.deadline;
  const alarmed = useRef(false);

  // At zero: alarm once, then after the grace window resolve as a timeout.
  useEffect(() => {
    if (!expired || alarmed.current) return;
    alarmed.current = true;
    playAlarm();
  }, [expired]);

  useEffect(() => {
    if (deadline === null) return;
    const wait = Math.max(0, deadline + WRONG_AUTOSUBMIT_DELAY_MS - Date.now());
    const id = setTimeout(() => gameActions.resolve("timeout"), wait);
    return () => clearTimeout(id);
  }, [deadline]);

  // The whole card flips both ways; the first flip up starts the timer.
  const flip = () => {
    if (!faceUp) gameActions.reveal();
    setFaceUp(!faceUp);
  };

  const progress = left / state.turnSeconds;
  const R = 92;
  const C = 2 * Math.PI * R;

  return (
    <section className="turn card-turn" data-color={team.color} data-urgent={left <= 10 && started && !expired}>
      <p className="turn-label">
        <span className="dot" aria-hidden /> {team.name} · {state.dice} {state.dice === 1 ? "point" : "points"}
      </p>

      <div className="card-stage">
        <div className="clock">
          <Stain />
          <svg className="ring" viewBox="0 0 220 220" aria-hidden>
            <circle className="ring-track" cx="110" cy="110" r={R} />
            <circle
              className="ring-fill"
              cx="110"
              cy="110"
              r={R}
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              transform="rotate(-90 110 110)"
            />
          </svg>
          <div className="clock-face" role="timer" aria-label={expired ? "Time is up" : `${left} seconds left`}>
            <span className="clock-time">{expired ? "Time" : mmss(left)}</span>
          </div>
        </div>

        <div className="flipper" data-up={faceUp} onClick={flip}>
          <div className="flip-inner">
            <button
              type="button"
              className="face face-back"
              aria-hidden={faceUp}
              tabIndex={faceUp ? -1 : 0}
            >
              <Stain />
              <span className="flip-category">{state.currentCategory}</span>
              <span className="flip-title">Tap to flip</span>
              <span className="flip-note">Drawer only. The timer starts when you flip.</span>
            </button>

            <div
              className="face face-front"
              aria-hidden={!faceUp}
              inert={!faceUp}
              tabIndex={faceUp ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  flip();
                }
              }}
            >
              <p className="category">{state.currentCategory}</p>
              <p className="or-note">Draw either one</p>
              <ul className="words">
                {state.currentWords?.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <p className="flip-hint">Tap the card to hide it</p>
            </div>
          </div>
        </div>
      </div>

      <div className="verdict">
        <button className="btn primary" type="button" disabled={!started} onClick={() => gameActions.resolve("correct")}>
          Correct
        </button>
        <button className="btn" type="button" disabled={!started} onClick={() => gameActions.resolve("wrong")}>
          Wrong
        </button>
        <button className="btn ghost" type="button" onClick={() => gameActions.resolve("skip")}>
          Skip
        </button>
      </div>
    </section>
  );
}

/** A faint cup-ring stain: the one coffee hint on the card screen. */
function Stain() {
  return (
    <svg className="stain" viewBox="0 0 220 220" aria-hidden fill="none">
      <circle cx="110" cy="112" r="104" />
      <path d="M18 96a96 96 0 0 1 176-34" />
      <circle cx="112" cy="110" r="99" className="faint" />
    </svg>
  );
}
