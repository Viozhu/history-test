// Copies the era of every generated explanation into data/era-map.json (the pipeline's input),
// keeping its _eras/_help keys. Rerun `npm run data` afterwards.
import fs from "node:fs";
import path from "node:path";

const DATA = path.join(import.meta.dirname, "..", "data");
const mapFile = path.join(DATA, "era-map.json");
const map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
const dir = path.join(DATA, "explanations");
for (const name of fs.readdirSync(dir).filter((n) => /^\d+\.json$/.test(n))) {
  const { round, questions } = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  map[String(round)] = Object.fromEntries(Object.entries(questions).map(([n, e]) => [n, e.era]));
  console.log(`${round}: ${Object.keys(questions).length} eras`);
}
fs.writeFileSync(mapFile, JSON.stringify(map, null, 2) + "\n");
