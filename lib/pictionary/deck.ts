import "server-only";
import { cacheLife } from "next/cache";
import type { Card } from "./engine";

interface DeckDoc {
  cards: unknown;
}

/** Reads the deck JSON from Backbone. Server-side only: the API key never reaches the browser. */
export async function getDeck(): Promise<Card[]> {
  "use cache";
  cacheLife("hours");

  const { BACKBONE_URL, BACKBONE_DB_QUERY_API_KEY, BACKBONE_STATIC_TABLE = "pictionary" } = process.env;
  const id = process.env.BACKBONE_PICTIONARY_DECK_ID ?? "1";
  if (!BACKBONE_URL || !BACKBONE_DB_QUERY_API_KEY) {
    throw new Error("BACKBONE_URL and BACKBONE_DB_QUERY_API_KEY must be set");
  }

  const res = await fetch(`${BACKBONE_URL.replace(/\/$/, "")}/db_query/${BACKBONE_STATIC_TABLE}/${id}`, {
    headers: { Authorization: `Bearer ${BACKBONE_DB_QUERY_API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? `No deck at ${BACKBONE_STATIC_TABLE}/${id}. Run: node --env-file=.env.local scripts/seed-deck.mjs`
        : `Backbone responded ${res.status}`,
    );
  }

  const { pjson } = (await res.json()) as { pjson: DeckDoc };
  const cards = pjson?.cards;
  const valid =
    Array.isArray(cards) &&
    cards.length >= 2 &&
    cards.every((c) => Array.isArray(c) && c.length === 5 && c.every((w) => typeof w === "string"));
  if (!valid) throw new Error("Deck document is malformed: expected { cards: string[5][] }");
  return cards as Card[];
}
