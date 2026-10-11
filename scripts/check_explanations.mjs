// Validates data/explanations/{round}.json for every round in data/exams/index.json.
// Usage: node scripts/check_explanations.mjs [--partial] [--rounds 79,78] | --file <part.json>
import fs from "node:fs";
import path from "node:path";
import { validateRound } from "./lib/explanations.mjs";

const DATA = path.join(import.meta.dirname, "..", "data");
const args = process.argv.slice(2);
const partial = args.includes("--partial");
const ri = args.indexOf("--rounds");
const only = ri >= 0 ? new Set(args[ri + 1].split(",").map(Number)) : null;

const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// --file <part.json>: validate one agent part (partial) against its round and exit.
const fi = args.indexOf("--file");
if (fi >= 0) {
  const part = read(args[fi + 1]);
  const errs = validateRound(read(path.join(DATA, "exams", `${part.round}.json`)), part, { partial: true });
  errs.forEach((e) => console.log(e));
  console.log(`${Object.keys(part.questions ?? {}).length} explanations checked, ${errs.length} error(s)`);
  process.exit(errs.length ? 1 : 0);
}

const rounds = read(path.join(DATA, "exams", "index.json")).map((e) => e.round).filter((r) => !only || only.has(r));

let errors = 0;
let count = 0;
for (const r of rounds.sort((a, b) => a - b)) {
  const file = path.join(DATA, "explanations", `${r}.json`);
  if (!fs.existsSync(file)) {
    if (!partial) {
      console.log(`${r}: file missing`);
      errors++;
    }
    continue;
  }
  const expl = read(file);
  count += Object.keys(expl.questions ?? {}).length;
  const errs = validateRound(read(path.join(DATA, "exams", `${r}.json`)), expl, { partial });
  errs.forEach((e) => console.log(e));
  errors += errs.length;
}
console.log(`${count} explanations checked, ${errors} error(s)`);
process.exit(errors ? 1 : 0);
