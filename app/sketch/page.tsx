import type { Metadata } from "next";
import { Sketchpad } from "@/components/Sketchpad";

export const metadata: Metadata = { title: "Sketchpad · Pictionary" };

export default function SketchPage() {
  return <Sketchpad />;
}
