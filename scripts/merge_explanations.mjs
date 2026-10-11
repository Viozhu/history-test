// Merges agent output data/explanations/.parts/*.json into data/explanations/{round}.json.
// Entries from parts replace existing ones; questions are written in numeric order.
// The merged files have since been fact-checked and hand-corrected: only merge NEW parts.
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(import.meta.dirname, "..", "data", "explanations");
const PARTS = path.join(DIR, ".parts");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

if (!fs.existsSync(PARTS) || !fs.readdirSync(PARTS).some((n) => n.endsWith(".json"))) {
  console.log(`Nothing to merge: no part files in ${PARTS}`);
  process.exit(0);
}

const byRound = new Map();
for (const name of fs.readdirSync(PARTS).filter((n) => n.endsWith(".json")).sort()) {
  const part = read(path.join(PARTS, name));
  const into = byRound.get(part.round) ?? {};
  Object.assign(into, part.questions);
  byRound.set(part.round, into);
}
for (const [round, questions] of byRound) {
  const file = path.join(DIR, `${round}.json`);
  const merged = { ...(fs.existsSync(file) ? read(file).questions : {}), ...questions };
  const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => Number(a) - Number(b)));
  fs.writeFileSync(file, JSON.stringify({ round, questions: sorted }, null, 1) + "\n");
  console.log(`${round}: ${Object.keys(sorted).length} questions`);
}
