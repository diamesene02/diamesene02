# 0004 — Journal

*Ce qui a divergé du plan, écrit pendant. Ce qu'un commit fait se lit dans son
diff ; ce qu'il a ÉCARTÉ ne se lit nulle part ailleurs qu'ici.*

---

## 11 septembre — `trop-vieux` est inatteignable, et il fallait s'en apercevoir

**Phase 1, à la vérification de T2.** Les quatre `curl` rendent :

```
en-tête 999      → trop-recent
en-tête 0        → ok          ← la tâche T22 attendait « trop-vieux »
en-tête absent   → ok
en-tête abc      → ok
```

`taches.md` T22 posait `["0", "trop-vieux"]` comme cas de test. **C'est la
tâche qui avait tort, pas le code.** `verdictProtocole` traite `0` par la
branche « illisible » (`!Number.isInteger(n) || n < 1`), et il a raison : une
version de protocole commence à 1, donc `0` n'est pas *une vieille app*, c'est
une valeur qui n'a pas de sens. Une app légitimement ancienne envoie soit
**rien** (l'état des quinze téléphones d'aujourd'hui), soit un entier valide
plus petit que `MINIMUM`.

**Et ça révèle mieux que ça ne corrige.** Tant que
`PROTOCOLE_MINIMUM === PROTOCOLE_COURANT === 1`, **aucune valeur ne peut rendre
`trop-vieux`** : il faudrait un entier `≥ 1` et `< 1`. La branche existe, elle
est juste, et elle est structurellement morte jusqu'au jour où `MINIMUM`
montera à 2.

Trois façons de traiter ça, et j'ai choisi la troisième :

1. *Faire rendre `trop-vieux` à `0`* — ce serait mentir sur ce qu'est une
   vieille app, pour le confort d'un test.
2. *Installer `vitest` sur le site pour tester la fonction pure* — le plan
   l'avait exclu (« ce lot ne touche au site que pour lire un en-tête »), et
   l'installer pour une branche morte serait le mauvais moment.
3. **Le dire.** T22 vérifie les trois verdicts atteignables (`trop-recent`,
   `ok` valide, `ok` illisible, `ok` absent) et porte en commentaire la ligne
   qu'il faudra ajouter le jour où `MINIMUM` monte. C'est ce jour-là que la
   quatrième vaudra quelque chose.

**Ce que ça coûte, et je l'assume :** une branche de `verdictProtocole` part en
production sans qu'aucune commande ne l'ait exercée. C'est un écart à
l'article VIII, écrit ici plutôt que découvert plus tard — et il se referme
tout seul à la première montée de `MINIMUM`, qui est précisément le moment où
cette branche cesse d'être décorative.

---

## 11 septembre — le test d'interruption passait pour de mauvaises raisons

**Phase 2, T11.** Première version du décorateur `quiEchoue` : il enveloppait la
base et remplaçait `script()` par une version qui lève au n-ième appel. Le test
échouait — `appliquerPaliers` ne rejetait pas.

**Et c'est le test qui avait tort**, pour une raison que `base.ts` documente
depuis le début : *« le rappel reçoit la base à utiliser — sur expo-sqlite c'est
un objet DISTINCT, et écrire par-dessus l'ancien sortirait silencieusement de la
transaction »*. Mon décorateur passait `fn` à la vraie `transaction()`, qui
appelait le rappel avec la **vraie** base : le `script` qui devait échouer
n'était jamais celui exécuté dans la transaction.

Corrigé en réappliquant l'enveloppe à la base que `transaction()` rend, avec un
compteur **partagé** entre les deux.

**Ce que ça vaut la peine de noter :** si je n'avais pas écrit la contre-épreuve
(T10), ce test serait parti vert en croyant couvrir quelque chose. Il n'aurait
rien coupé du tout. C'est exactement le défaut que l'article VIII vise, attrapé
par le geste que la spec exigeait.

## 11 septembre — la contre-épreuve, faite

**T10.** Migration du palier 1 vidée à la main, `db/paliers.ts` régénéré :
**trois tests tombent** sur les neuf (la convergence, la version, et l'égalité
octet pour octet des paliers). Restauré, régénéré, `git diff` vide, neuf tests
verts à nouveau.

L'échelle est donc vérifiée par des tests qui peuvent tomber — et on l'a vu.
