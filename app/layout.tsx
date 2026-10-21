import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Instrument_Serif } from "next/font/google";
import "./globals.css";

const sans = Hanken_Grotesk({ variable: "--font-sans", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Pictionary",
  description: "A draw-and-guess party game for one shared screen.",
};

export const viewport: Viewport = { themeColor: "#0f0d0c", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
