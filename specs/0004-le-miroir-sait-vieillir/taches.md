# 0004 — Tâches

*TOUTES FAITES le 11 septembre 2026. Les écarts sont dans
[`journal.md`](journal.md) — et il y en a eu quatre, dont deux qui ont
corrigé ces tâches plutôt que le code.*

*Écrites le 11 septembre 2026, contre le code réel — chaque fichier cité a été
lu avant d'écrire la tâche qui le touche. Ordre du plan §8. Chaque tâche porte
sa commande de vérification ; aucune ne se coche sans l'avoir vue passer.*

---

## Phase 1 — Le serveur apprend à lire l'en-tête

*Déployable seule, sans effet : personne n'envoie encore cet en-tête.*

- [x] **T1. `five-scorer/lib/protocole.ts` (neuf).** Le contrat, minimal :

  ```ts
  export const PROTOCOLE_COURANT = 1;
  export const PROTOCOLE_MINIMUM = 1;

  export type VerdictProtocole = "ok" | "trop-vieux" | "trop-recent";

  export function verdictProtocole(enteteBrut: string | null): VerdictProtocole {
    if (!enteteBrut) return "ok"; // pas d'en-tête = les quinze téléphones d'aujourd'hui
    const n = Number(enteteBrut);
    if (!Number.isInteger(n) || n < 1) return "ok"; // valeur illisible : on ne pénalise personne
    if (n < PROTOCOLE_MINIMUM) return "trop-vieux";
    if (n > PROTOCOLE_COURANT) return "trop-recent";
    return "ok";
  }
  ```

  Le cas « absent » et le cas « illisible » rendent tous deux `"ok"` : un
  serveur qui pénalise ce qu'il ne comprend pas viole Q4. *Deux entiers, pas
  un* : `MINIMUM` et `COURANT` divergeront le jour où on retire le support
  d'un vieux protocole sans encore en exiger un neuf.

  **Vérification** : fonction pure, sans I/O — testable directement.
  `five-scorer` n'a ni script de test ni script de types
  (`five-scorer/package.json:5-16`, vérifié) ; ce lot n'en installe pas pour
  une seule fonction. Elle est vérifiée par le script de la tâche T24, qui
  l'exerce à travers de vraies requêtes HTTP — la même discipline que
  `parcours-lecture.mjs`.

- [x] **T2. Brancher dans `five-scorer/middleware.ts`.** Après le bloc existant
  (`:38-41`, le 401 nu de sync), et **avant** `return NextResponse.next()`
  (`:43`) :

  ```ts
  if (pathname.startsWith("/api/clubs/")) {
    const verdict = verdictProtocole(req.headers.get("x-protocole"));
    const res = hasSession
      ? NextResponse.next()
      : NextResponse.json({ error: "unauthorized" }, { status: 401 });
    res.headers.set("x-protocole-verdict", verdict);
    return res;
  }
  ```

  L'en-tête est posé **que la session soit valide ou non** : c'est une
  métadonnée de transport, pas un droit d'accès, et poser un cas particulier
  pour l'appel anonyme rendrait la tâche T24 dépendante d'un vrai cookie pour
  rien.

  **Vérification** — sans cookie, donc sans dépendance à un compte de test :
  ```bash
  cd five-scorer && npm run build   # prisma generate && next build : tsc en passant
  npx next dev &
  sleep 3
  curl -si http://localhost:3000/api/clubs/x/effectif -H "x-protocole: 999" \
    | grep -i "^x-protocole-verdict: trop-recent"
  curl -si http://localhost:3000/api/clubs/x/effectif \
    | grep -i "^x-protocole-verdict: ok"
  kill %1
  ```
  Les deux `grep` doivent trouver leur ligne. *999 est bien « trop récent » :
  `PROTOCOLE_COURANT` vaut 1 aujourd'hui.*

---

## Phase 2 — L'échelle de migration, à vide, et ses tests

*La pièce maîtresse (plan §8). Un seul palier, qui ne change rien : on éprouve
le mécanisme avant qu'il porte un vrai risque.*

- [x] **T3. Geler `five-scorer-mobile/db/paliers/001-schema.sql` (neuf).**
  Copie **littérale** de `db/schema.sql` tel qu'il est aujourd'hui —
  `cp db/schema.sql db/paliers/001-schema.sql`. C'est l'instantané : « le
  schéma tel que TOUTES les bases installées avant ce lot le portent déjà ».
  **Jamais retouché ensuite** — un futur palier en gèlera un nouveau, celui-ci
  reste l'archive du jour 1.

- [x] **T4. `five-scorer-mobile/db/paliers/001-versionner.sql` (neuf).**
  ```sql
  -- Palier 1 : adopter la version de schéma elle-même.
  --
  -- Aucune table ne change — ce palier EST le passage d'une base sans version
  -- (toutes les bases installées avant ce lot) à une base versionnée. Le
  -- schéma qu'il cible est 001-schema.sql, qui est déjà celui de toute base
  -- existante. Seul PRAGMA user_version bouge.
  PRAGMA user_version = 1;
  ```

- [x] **T5. Généraliser la chaîne de génération.** `db/schema.ts` a déjà son
  script (`scripts/schema-vers-ts.mjs`) et son test d'égalité
  (`five-scorer-mobile/db/schema.test.ts:41-48`). Même geste pour les paliers :
  - `scripts/paliers-vers-ts.mjs` (neuf, sur le modèle de
    `scripts/schema-vers-ts.mjs`) — lit chaque `db/paliers/NNN-*.sql`, écrit
    `db/paliers.ts` : `export const PALIERS: { version: number; schema: string;
    migration: string }[]`, trié par `version`.
  - `db/paliers.test.ts` (neuf) — égalité octet pour octet entre les fichiers
    `.sql` et `PALIERS`, même schéma de test que `five-scorer-mobile/db/schema.test.ts:41-48`.

  **Vérification** :
  ```bash
  node scripts/paliers-vers-ts.mjs && npm run tester -- db/paliers.test.ts
  ```

- [x] **T6. `five-scorer-mobile/lib/outbox/migrations.ts` (neuf).** Le
  moteur de l'échelle, contre l'interface `Base` — donc valable pour
  `BaseExpo` et `BaseNode` sans rien savoir de l'un ni de l'autre :

  ```ts
  export type Palier = { version: number; migration: string };

  /// Fait monter une base EXISTANTE, palier par palier — jamais en sautant à
  /// la cible : chaque palier n'a été éprouvé que contre le précédent.
  ///
  /// Chaque palier dans SA transaction (base.transaction()) : un palier coupé
  /// au milieu laisse la base sur le précédent, entière, avec sa file.
  export async function appliquerPaliers(base: Base, paliers: Palier[]): Promise<void> {
    const rangee = await base.premier<{ user_version: number }>("PRAGMA user_version");
    let actuelle = rangee?.user_version ?? 0;
    for (const p of paliers.filter((p) => p.version > actuelle).sort((a, b) => a.version - b.version)) {
      await base.transaction((b) => b.script(p.migration));
      actuelle = p.version;
    }
  }
  ```

  *Aucune migration descendante* : si `actuelle` dépasse le plus haut palier
  connu (rétrogradation), la boucle ne filtre rien à appliquer et rend la
  main sans y toucher — c'est le comportement demandé par le plan §1, obtenu
  sans code dédié.

- [x] **T7. Étendre `appliquerSchema`** (`five-scorer-mobile/lib/outbox/base.ts:62-64`) :

  ```ts
  export async function appliquerSchema(
    base: Base,
    schema: string,
    paliers: Palier[] = PALIERS.map(({ version, migration }) => ({ version, migration })),
  ): Promise<void> {
    const neuve = !(await base.premier("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1"));
    await base.script(schema); // idempotent — CREATE TABLE IF NOT EXISTS, PRAGMA de tête
    if (neuve) {
      const cible = Math.max(0, ...paliers.map((p) => p.version));
      if (cible > 0) await base.script(`PRAGMA user_version = ${cible};`);
      return;
    }
    await appliquerPaliers(base, paliers);
  }
  ```

  *Une base neuve ne traverse pas l'échelle* — elle nait directement à la
  cible, comme le plan le prescrit (§1, « l'ambiguïté à lever »). `cible` sort
  de `paliers`, pas d'une constante à part : une seule source, l'article III.

- [x] **T8. Le test de convergence — `lib/outbox/migrations.test.ts` (neuf),
  le plus important du lot.**
  ```ts
  it("une base MONTÉE et une base NEUVE ont le même schéma", async () => {
    const ancienne = BaseNode.ouvrir();
    await ancienne.script(readFileSync("db/paliers/001-schema.sql", "utf8"));
    // pas de PRAGMA user_version ici : c'est l'état exact d'une base
    // installée avant ce lot — à la version 0, implicite.
    await appliquerSchema(ancienne, SCHEMA);

    const neuve = BaseNode.ouvrir();
    await appliquerSchema(neuve, SCHEMA);

    const tables = (b) => b.lire("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name");
    expect(await tables(ancienne)).toEqual(await tables(neuve));
  });
  ```
  **Vérification** : `npm run tester -- lib/outbox/migrations.test.ts`

- [x] **T9. Le test de la file — même fichier.** Base à l'ancien schéma,
  une opération enfilée (le motif de `enfiler()` dans
  `five-scorer-mobile/db/schema.test.ts:30-38`, à reprendre ici pour `BaseNode`), migration,
  l'opération **encore là** ensuite : `SELECT COUNT(*) FROM outbox` inchangé
  avant/après.

- [x] **T10. La contre-épreuve — geste ponctuel, pas un test permanent.**
  Casser `001-versionner.sql` à la main (vider son contenu), relancer T8 et
  T9 : **les deux doivent échouer**. Puis restaurer le fichier
  (`git checkout -- db/paliers/001-versionner.sql`). Un test qu'on ne peut
  pas faire tomber n'est pas vérifié (article VIII) — mais un fichier laissé
  cassé exprès dans le dépôt serait pire. **Ce geste est fait une fois, à
  l'implémentation, et noté dans `journal.md`** : pas de trace permanente
  dans le code.

- [x] **T11. Le test d'interruption — même fichier.** Fournir à
  `appliquerPaliers` une `Base` qui enveloppe une `BaseNode` réelle et fait
  échouer `script()` après la première instruction d'un palier à deux
  instructions (un décorateur simple, dans le fichier de test). Vérifier
  qu'après l'échec : `PRAGMA user_version` est resté au palier précédent, et
  les tables du palier manqué n'existent pas à moitié.

  *Ce test attend un second vrai palier pour être significatif* — avec un
  seul palier qui ne pose qu'un `PRAGMA`, une coupure ne laisse rien à
  moitié fait par construction. **Ce test est donc écrit avec un palier
  FACTICE à deux instructions, local au fichier de test**, pas avec
  `PALIERS` : il prouve le mécanisme, indépendamment du contenu réel des
  paliers livrés.

---

## Phase 3 — `TRANS-65` : l'écran d'échec cesse d'être un cul-de-sac

*Avant la première vraie migration — c'est lui qu'on verra si une migration
tourne mal.*

- [x] **T12. `composants/Noyau.tsx` : un message qui dit quoi faire.**
  Le `catch` (`:82-84`) pose aujourd'hui `e.message` tel quel dans `erreur`
  (phrase anglaise brute de SQLite). Distinguer trois cas dans ce `catch`,
  posés dans un état structuré `{ titre: string; aide: string; peutReessayer:
  boolean }` plutôt qu'une chaîne :
  - une `SQLITE_CORRUPT` ou I/O — *« Le fichier de la base a un problème. »*,
    réessayable ;
  - le cas de rétrogradation (T13) — *« Cette version de l'app est plus
    ancienne que les données de ce téléphone. »*, pas réessayable, pas de
    perte annoncée ;
  - tout le reste — le message technique reste affiché en petit, sous la
    phrase française, pour ne rien cacher à qui sait lire.

  Le composant `Attente` (`:137-154`) gagne un bouton **Réessayer**, qui
  relance l'effet du fournisseur (compteur de tentatives dans une `ref`,
  incrémenté pour redéclencher l'`useEffect`).

- [x] **T13. Le cas de rétrogradation, détecté avant `appliquerSchema`.**
  Dans `ouvrirBase()` (`five-scorer-mobile/lib/outbox/baseExpo.ts:66-71`), lire
  `PRAGMA user_version` juste après l'ouverture, **avant** d'appeler
  `appliquerSchema`. Si elle dépasse le plus haut palier connu du binaire
  courant : lever une erreur typée (`class BaseTropRecente extends Error`),
  que `Noyau.tsx` distingue dans son `catch` pour le message de T12. La base
  n'est ni touchée ni ouverte en écriture dans ce cas.

  **Vérification (T12 + T13)** : `expo-sqlite` ne se charge pas dans Node
  (commentaire de `five-scorer-mobile/lib/outbox/baseExpo.ts:1-9`) — pas de test automatisé pour ce
  fichier, comme pour le reste de `baseExpo.ts`. Vérifié dans le simulateur
  (article VII) : une base dont `user_version` est posé à 99 à la main
  (`sqlite3 five-scorer.db "PRAGMA user_version = 99"` sur le fichier du
  simulateur) fait afficher le message de rétrogradation, pas un plantage.

---

## Phase 4 — `expo-updates` et `runtimeVersion`

*Indépendante des phases 1-3 : peut être faite en parallèle.*

- [x] **T14.** `npx expo install expo-updates` dans `five-scorer-mobile`.
  **Vérification** : `expo-updates` apparaît dans `package.json` **et**
  `package-lock.json` (les deux étaient à zéro occurrence avant ce lot).

- [x] **T15. `app.json`** — un bloc `updates` et un `runtimeVersion` explicite
  (pas `"policy": "appVersion"` : `five-scorer-mobile/eas.json:4` fixe
  `"appVersionSource": "local"` et `five-scorer-mobile/app.json:5` fige `"version": "1.0.0"`,
  cette politique ne bougerait jamais). Un entier posé à la main :
  ```json
  "runtimeVersion": "1",
  "updates": { "url": "https://u.expo.dev/<projectId>" }
  ```
  `extra.eas.projectId` existe déjà (`app.json`, vérifié).

- [x] **T16. `eas.json`** — un `channel` par profil de build (`:7-28`) :
  `"lundi"` → canal `production`, `"atelier"` → canal `atelier`, `"magasin"`
  → canal `production`. Deux profils sur le même canal, volontairement : un
  correctif poussé pendant que le club joue doit atteindre les deux.

- [x] **T17. La règle dans `EAS.md`.** Une section neuve : *« Toute touche à
  `plugins` (`five-scorer-mobile/app.json:36-52`), à une permission, ou à une dépendance native
  incrémente `runtimeVersion`. Un correctif JavaScript pur ne le touche
  jamais — c'est ce qui le rend éligible à `expo-updates`. »*

  **Vérification** : `npx expo config --type public | grep runtimeVersion`
  rend `1`. `npx eas channel:list` (après un premier `eas update:configure`)
  liste les deux canaux de T16.

---

## Phase 5 — L'en-tête côté app, et le bandeau

- [x] **T18. `lib/appel.ts` : poser l'en-tête.** Dans `creerAppel`
  (`:111-142`), à côté de `accept` et `cookie` (`:125,127`) :
  ```ts
  entetes["x-protocole"] = String(PROTOCOLE_COURANT);
  ```
  `PROTOCOLE_COURANT` vit côté app dans `lib/protocole.ts` (neuf, miroir de
  T1 — **pas partagé par import** : les deux dépôts ne s'importent pas l'un
  l'autre, c'est la même discipline que `lib/noyau/` qui recopie plutôt
  qu'importe). Ajouté à `lib/noyau/copie-conforme.test.ts` **non** : ce
  fichier n'a de sens que par valeur (`1` des deux côtés), pas par octet —
  une recopie y serait une fausse promesse. La convergence des DEUX entiers
  est vérifiée par T24, qui interroge le vrai serveur.

- [x] **T19. Lire le verdict de la réponse.** Toujours dans `creerAppel`,
  après le `fetch` (`:132-136`), avant de retourner :
  ```ts
  const verdict = res.headers.get("x-protocole-verdict") as VerdictProtocole | null;
  if (verdict) definirVerdict(verdict);
  ```
  `definirVerdict` : un petit module `lib/protocoleClient.ts` (neuf) —
  état module-level + `abonnerVerdict(fn)`, sur le modèle le plus simple qui
  fonctionne sans dépendance neuve (pas de bibliothèque d'état ajoutée pour
  ça).

- [x] **T20. `composants/BandeauVersion.tsx` (neuf).** S'abonne à
  `protocoleClient`, ne rend rien quand le verdict est `"ok"`. Sinon, une
  bande fine, en haut, avec le message (« Une mise à jour est disponible » /
  « Le serveur se met à jour, réessaie dans un instant ») — **jamais un
  écran, jamais un blocage** (Q4).

- [x] **T21. Brancher dans `app/_layout.tsx`.** À l'intérieur de
  `SafeAreaProvider` (`:10`), au-dessus de `FournisseurNoyau` — le bandeau ne
  dépend d'aucune donnée du noyau, il doit pouvoir s'afficher même si le
  noyau échoue à s'ouvrir (T12).

- [x] **T22. `five-scorer-mobile/scripts/verif-version.mjs` (neuf), sur le
  modèle de `parcours-lecture.mjs`.** Les trois cas de T1, contre un vrai
  `next dev` :
  ```js
  const cas = [
    ["999", "trop-recent"],
    ["1", "ok"],
    ["abc", "ok"],   // illisible : on ne pénalise pas ce qu'on ne comprend pas
    [null, "ok"],    // absent : les quinze téléphones d'aujourd'hui
  ];
  // « trop-vieux » n'y est PAS, et c'est voulu : il est inatteignable tant que
  // PROTOCOLE_MINIMUM vaut 1, puisqu'une version de protocole commence à 1.
  // Le jour où MINIMUM monte à 2, ce script gagne la ligne ["1", "trop-vieux"]
  // — et c'est ce jour-là qu'elle voudra dire quelque chose. Voir journal.md.
  for (const [entete, attendu] of cas) {
    const r = await fetch(`${BASE}/api/clubs/x/effectif`, {
      headers: entete ? { "x-protocole": entete } : {},
    });
    ok(r.headers.get("x-protocole-verdict") === attendu, `en-tête ${entete ?? "absent"}`, attendu);
  }
  ```
  **Vérification** : `node scripts/verif-version.mjs` — TOUT VERT. C'est la
  commande qui referme T1, T2, T18 et T19 ensemble : le seul des critères de
  version qui soit scriptable sans téléphone (spec.md, § À quoi on saura).

---

## Phase 6 — L'`ErrorBoundary` de la feuille

- [x] **T23. `lib/plantages.ts` (neuf).** Deux fonctions, sur `expo-file-system`
  (déjà une dépendance — `lib/photo/choisir.ts` l'utilise) :
  - `enregistrerPlantage(erreur: Error): Promise<void>` — ajoute une ligne
    JSON à `FileSystem.documentDirectory + "plantages.jsonl"`, borné aux 20
    dernières (relit, tronque, réécrit — un fichier de plantages n'a pas
    besoin d'être un journal append-only illimité).
  - `lirePlantages(): Promise<Plantage[]>` — les relit. **Non branchée à un
    écran dans ce lot** : c'est une lecture pour plus tard, au besoin,
    manuelle (ouvrir le fichier depuis le débogueur ou un futur écran de
    réglages app-level, qui n'existe pas encore — spec.md ne le prévoyait pas
    et en construire un ici serait déborder le lot). **Dit ici plutôt que
    découvert dans le diff** (article X).

  **Vérification** : la mise en forme et le troncage à 20 sont une fonction
  pure, extractible et testable sans `expo-file-system` — `lib/plantages.test.ts`
  (neuf), sur le modèle de `db/schema.test.ts`.

- [x] **T24. `app/match/[id].tsx` : exporter `ErrorBoundary`.** Expo Router
  reconnaît un export nommé `ErrorBoundary` par fichier de route, sans
  câblage dans `_layout.tsx`. Contrat minimal :
  ```tsx
  export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
    useEffect(() => { void enregistrerPlantage(error); }, [error]);
    return (
      <Ecran>
        <Text>La feuille a rencontré un problème.</Text>
        <Text>{error.message}</Text>
        <BoutonPlein libelle="Réessayer" onPress={retry} />
      </Ecran>
    );
  }
  ```
  La feuille en cours **n'est pas perdue** : elle vit dans SQLite, pas dans
  l'état React — `retry()` réaffiche le même écran, qui relit la base.

  **Vérification** : dans le simulateur, provoquer un plantage contrôlé
  (une assertion qui lève, posée temporairement dans un `onPress` de test,
  puis retirée) pendant un match en cours ; l'écran de T24 s'affiche au lieu
  d'un écran noir, **Réessayer** ramène la feuille avec ses buts déjà
  saisis, et `plantages.jsonl` porte une ligne neuve (article VII).

---

## Vérification globale, avant de livrer

```bash
cd five-scorer-mobile
npm run verifier          # tsc --noEmit
npm run tester            # vitest run — T8, T9, T11, T23, et tout ce qui existait
npx expo export --platform ios

cd ../five-scorer
npm run build              # prisma generate && next build

cd ../five-scorer-mobile
node scripts/jeu-dessai.mjs
node scripts/parcours-lecture.mjs      # TOUT VERT, sans une ligne modifiée
node scripts/verif-version.mjs         # TOUT VERT — T1, T2, T18, T19
```

Puis le tour dans le simulateur (T13, T24) — les deux seuls critères
qu'aucune commande ne referme.
