import type { Metadata } from "next";
import { Suspense } from "react";
import { Game } from "@/components/Game";
import { WithDeck } from "@/components/WithDeck";

export const metadata: Metadata = { title: "Playing · Pictionary" };

export default function PlayPage() {
  return (
    <Suspense fallback={<main className="shell" aria-busy />}>
      <WithDeck>{(deck) => <Game deck={deck} />}</WithDeck>
    </Suspense>
  );
}
