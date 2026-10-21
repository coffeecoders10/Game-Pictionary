"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type Card, type LastResult } from "@/lib/pictionary/engine";
import { gameActions, useGame } from "@/lib/pictionary/store";
import { Logo, Stamp } from "./Logo";
import { Modal } from "./Modal";
import { Scoreboard } from "./Scoreboard";
import { CardTurn, RollAndDeal } from "./Turn";

const outcomeTitle = (r: LastResult) =>
  r.outcome === "correct" ? `Correct, +${r.points}` : r.outcome === "timeout" ? "Time's up" : r.outcome === "skip" ? "Skipped" : "Not this time";

export function Game({ deck }: { deck: readonly Card[] }) {
  const router = useRouter();
  const state = useGame(deck.length);
  const [dialog, setDialog] = useState<"scores" | "end" | null>(null);

  // No saved game (opened /play directly, or the game just ended): back to the landing page.
  const missing = state === null;
  useEffect(() => {
    if (missing) router.replace("/");
  }, [missing, router]);

  if (!state) return <main className="shell" aria-busy />;

  const finished = state.phase === "finished";
  const result = state.lastResult;
  const next = state.teams[state.turn];
  const close = () => setDialog(null);

  return (
    <main className="shell board">
      <aside className="rail">
        <span className="brand">
          <Logo size={36} />
          <span className="wordmark small">Pictionary</span>
        </span>
        <ol className="order" aria-label="Turn order">
          {state.teams.map((t, i) => (
            <li key={t.color} data-color={t.color} data-active={!finished && i === state.turn}>
              <span className="dot" aria-hidden />
              <span className="order-name">{t.name}</span>
            </li>
          ))}
        </ol>
        <nav className="rail-actions">
          <button className="link" type="button" onClick={() => setDialog("scores")}>
            Scores
          </button>
          <button className="link" type="button" onClick={() => (finished ? gameActions.reset() : setDialog("end"))}>
            {finished ? "New game" : "End game"}
          </button>
        </nav>
        <Stamp />
      </aside>

      <div className="stage">
        {finished && state.winner ? (
          <section className="turn winner" data-color={state.winner.color} aria-live="polite">
            <p className="turn-label">First to {state.winScore}</p>
            <h2 className="winner-name">{state.winner.name}</h2>
            <p className="turn-hint">takes the game with {state.winner.score} points.</p>
            <div className="winner-scores">
              <Scoreboard state={state} />
            </div>
            <button className="btn primary" type="button" onClick={() => gameActions.reset()}>
              Play again
            </button>
          </section>
        ) : state.phase === "card_shown" ? (
          <CardTurn state={state} />
        ) : (
          <RollAndDeal key={state.round} state={state} deck={deck} />
        )}
      </div>

      <Stamp />

      {dialog === "scores" && (
        <Modal title="Scores" onClose={close}>
          <Scoreboard state={state} />
          <button className="btn primary" type="button" onClick={close}>
            Back to game
          </button>
        </Modal>
      )}

      {dialog === "end" && (
        <Modal title="End this game?" onClose={close}>
          <p className="modal-text">Scores and cards dealt so far will be lost.</p>
          <div className="modal-actions">
            <button className="btn" type="button" onClick={close}>
              Keep playing
            </button>
            <button
              className="btn danger"
              type="button"
              onClick={() => {
                close();
                gameActions.reset();
              }}
            >
              End game
            </button>
          </div>
        </Modal>
      )}

      {result && !finished && dialog === null && (
        <Modal title={outcomeTitle(result)} onClose={gameActions.dismissResult}>
          <p className="modal-text" data-color={result.color}>
            {result.points > 0 ? `${result.team} scores ${result.points}.` : `${result.team} scores nothing this turn.`}
          </p>
          <Scoreboard state={state} />
          <button className="btn primary" type="button" onClick={gameActions.dismissResult}>
            {next.name} is up
          </button>
        </Modal>
      )}
    </main>
  );
}
