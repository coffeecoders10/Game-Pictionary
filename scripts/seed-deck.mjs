// Uploads the card deck to Backbone.
//   node --env-file=.env.local scripts/seed-deck.mjs [--csv path/to/Pictionary_Data.csv]
// Without --csv it uploads data/cards.json. With BACKBONE_PICTIONARY_DECK_ID set it
// overwrites that row; otherwise it creates one and prints the id to put in .env.local.
import { readFileSync } from "node:fs";

const { BACKBONE_URL, BACKBONE_DB_QUERY_API_KEY, BACKBONE_STATIC_TABLE = "pictionary" } = process.env;
if (!BACKBONE_URL || !BACKBONE_DB_QUERY_API_KEY) {
  console.error("Missing BACKBONE_URL or BACKBONE_DB_QUERY_API_KEY. Run with --env-file=.env.local");
  process.exit(1);
}

const CATEGORIES = ["Animals & Places", "Objects", "Actions", "Food", "Random"];

// Minimal RFC 4180 parser; the legacy CSV is Windows-1252 with a few stray commas.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function loadCards() {
  const i = process.argv.indexOf("--csv");
  if (i === -1) return JSON.parse(readFileSync(new URL("../data/cards.json", import.meta.url), "utf8")).cards;
  const text = new TextDecoder("windows-1252").decode(readFileSync(process.argv[i + 1]));
  return parseCsv(text)
    .slice(1)
    .map((r) => r.slice(0, 5).map((w) => w.trim().replace(/,$/, "").replace(/\s+,/, ",")))
    .filter((r) => r.length === 5 && r.every(Boolean));
}

const cards = loadCards();
if (cards.length < 2) throw new Error("A deck needs at least two cards");

const headers = { Authorization: `Bearer ${BACKBONE_DB_QUERY_API_KEY}`, "Content-Type": "application/json" };
const base = `${BACKBONE_URL.replace(/\/$/, "")}/db_query/${BACKBONE_STATIC_TABLE}`;

async function call(url, init) {
  const res = await fetch(url, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method} ${url} -> ${res.status} ${body.error ?? ""}`);
  return body;
}

let id = process.env.BACKBONE_PICTIONARY_DECK_ID;
if (!id) {
  const created = await call(base, {
    method: "POST",
    body: JSON.stringify({ name: "pictionary-deck", description: "Pictionary card deck" }),
  });
  id = String(created.project_id);
}

await call(`${base}/${id}`, {
  method: "PUT",
  body: JSON.stringify({ pjson: { categories: CATEGORIES, cards } }),
});

console.log(`Uploaded ${cards.length} cards to ${BACKBONE_STATIC_TABLE}/${id}`);
if (!process.env.BACKBONE_PICTIONARY_DECK_ID) console.log(`Add BACKBONE_PICTIONARY_DECK_ID=${id} to .env.local`);
