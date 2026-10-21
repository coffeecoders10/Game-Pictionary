import type { ReactNode } from "react";
import { getDeck } from "@/lib/pictionary/deck";
import type { Card } from "@/lib/pictionary/engine";

/** Loads the deck from Backbone and renders children with it, or a readable error. */
export async function WithDeck({ children }: { children: (deck: Card[]) => ReactNode }) {
  let deck: Card[] | null = null;
  let failure = "";
  try {
    deck = await getDeck();
  } catch (err) {
    failure = err instanceof Error ? err.message : "";
  }

  if (!deck) {
    return (
      <main className="shell">
        <h1 className="wordmark small">Pictionary</h1>
        <p className="form-error" role="alert">
          Couldn&apos;t load the card deck. {failure}
        </p>
      </main>
    );
  }
  return children(deck);
}
