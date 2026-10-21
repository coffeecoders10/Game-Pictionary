"use client";

import { useEffect, useState } from "react";

// Pip positions on a 3x3 grid, indexed 0..8.
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Face({ value, rolling }: { value: number | null; rolling?: boolean }) {
  return (
    <div className="die" data-rolling={rolling} role="img" aria-label={value ? `Dice shows ${value}` : "Dice not rolled yet"}>
      {value === null ? (
        <span className="die-blank">?</span>
      ) : (
        Array.from({ length: 9 }, (_, i) => <span key={i} className="pip" data-on={PIPS[value].includes(i)} />)
      )}
    </div>
  );
}

/** Reveals a value that is already fixed in game state; the spin is cosmetic. */
export function Dice({ value, rolled, onRolled }: { value: number; rolled: boolean; onRolled: () => void }) {
  const [rolling, setRolling] = useState(false);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (!rolling) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const spin = reduce ? undefined : setInterval(() => setShown(1 + Math.floor(Math.random() * 6)), 120);
    const done = setTimeout(() => {
      clearInterval(spin);
      setShown(value);
      setRolling(false);
      onRolled();
    }, reduce ? 0 : 1300);
    return () => {
      clearInterval(spin);
      clearTimeout(done);
    };
  }, [rolling, value, onRolled]);

  return (
    <div className="dice-wrap">
      <Face value={rolling ? shown : rolled ? value : null} rolling={rolling} />
      {!rolled && (
        <button className="btn" type="button" disabled={rolling} onClick={() => setRolling(true)}>
          {rolling ? "Rolling" : "Roll dice"}
        </button>
      )}
    </div>
  );
}
