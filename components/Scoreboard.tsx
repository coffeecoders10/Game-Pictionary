import { getScoreboard, type GameState } from "@/lib/pictionary/engine";

export function Scoreboard({ state }: { state: GameState }) {
  const rows = getScoreboard(state);
  const active = state.phase === "finished" ? -1 : state.turn;
  return (
    <ol className="scoreboard" aria-label="Scores">
      {rows.map((team, i) => (
        <li key={team.color} className="score-row" data-color={team.color} data-active={i === active}>
          <span className="dot" aria-hidden />
          <span className="score-name">{team.name}</span>
          <span className="score-value">
            {team.score}
            <span className="score-of"> / {state.winScore}</span>
          </span>
          <span
            className="meter"
            role="progressbar"
            aria-label={`${team.name} progress`}
            aria-valuemin={0}
            aria-valuemax={state.winScore}
            aria-valuenow={Math.min(team.score, state.winScore)}
          >
            <span style={{ width: `${team.percent}%` }} />
          </span>
        </li>
      ))}
    </ol>
  );
}
