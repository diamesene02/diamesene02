// Les cas de `resoudreAdresse` — la traduction de « localhost » vers
// l'adresse du Mac. Elle échoue en silence dans une requête réseau, jamais à
// l'écran : c'est exactement le genre de fonction qui mérite un test.
//
//   node scripts/verif-adresse.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import ts from "typescript";

const ici = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(ici, "..", "lib", "api.ts"), "utf8");

// On n'extrait que la fonction : le reste du module touche à
// expo-constants et à __DEV__, qui n'existent pas ici.
const debut = source.indexOf("export function resoudreAdresse");
const fin = source.indexOf("\n}\n", debut) + 3;
if (debut < 0) throw new Error("resoudreAdresse introuvable dans lib/api.ts");
const { outputText } = ts.transpileModule(source.slice(debut, fin), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { resoudreAdresse } = await import(
  "data:text/javascript," + encodeURIComponent(outputText)
);

const PROD = "https://five-scorer.vercel.app";
const cas = [
  ["l'IP du Mac remplace localhost",
    ["http://localhost:3000", "192.168.1.192:8090"], "http://192.168.1.192:3000", false],
  ["…et 127.0.0.1 aussi",
    ["http://127.0.0.1:3000", "192.168.1.192:8090"], "http://192.168.1.192:3000", false],
  ["le port demandé est gardé, pas celui de Metro",
    ["http://localhost:4321", "192.168.1.192:8090"], "http://192.168.1.192:4321", false],
  ["sans port, l'hôte change quand même",
    ["http://localhost", "192.168.1.192:8090"], "http://192.168.1.192", false],
  ["le chemin survit",
    ["http://localhost:3000/api", "192.168.1.192:8090"], "http://192.168.1.192:3000/api", false],
  ["une adresse distante n'est jamais touchée",
    [PROD, "192.168.1.192:8090"], PROD, false],
  ["un hôte qui contient « localhost » ne compte pas",
    ["https://localhost.exemple.fr", "192.168.1.192:8090"], "https://localhost.exemple.fr", false],
  ["sans hôte connu (cible web), on ne touche à rien",
    ["http://localhost:3000", undefined], "http://localhost:3000", false],
  ["un hôte déjà « localhost » ne sert à rien",
    ["http://localhost:3000", "localhost:8090"], "http://localhost:3000", false],
  ["un tunnel exp.direct ne devient pas une adresse inventée",
    ["http://localhost:3000", "xy-anonymous-8090.exp.direct:80"], "http://localhost:3000", true],
  ["…et un tunnel avec une adresse distante ne gêne pas",
    [PROD, "xy-anonymous-8090.exp.direct:80"], PROD, false],
  ["l'IP sans port de Metro marche aussi",
    ["http://localhost:3000", "192.168.1.192"], "http://192.168.1.192:3000", false],
];

let rates = 0;
for (const [quoi, [url, hote], attendu, obstacleAttendu] of cas) {
  const r = resoudreAdresse(url, hote);
  const bon = r.url === attendu && Boolean(r.obstacle) === obstacleAttendu;
  if (!bon) rates++;
  console.log(
    `${bon ? "  ok " : "ÉCHEC"}  ${quoi}` +
      (bon ? "" : `\n         attendu ${attendu} (obstacle=${obstacleAttendu}) — obtenu ${r.url} (obstacle=${Boolean(r.obstacle)})`),
  );
}
console.log(rates === 0 ? `\n${cas.length} cas, tous bons.` : `\n${rates} échec(s).`);
process.exitCode = rates === 0 ? 0 : 1;
