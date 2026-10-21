import { Suspense } from "react";
import { Setup } from "@/components/Setup";
import { WithDeck } from "@/components/WithDeck";

export default function Home() {
  return (
    <Suspense fallback={<main className="shell" aria-busy />}>
      <WithDeck>{(deck) => <Setup deckSize={deck.length} />}</WithDeck>
    </Suspense>
  );
}
