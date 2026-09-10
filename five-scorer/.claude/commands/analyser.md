---
description: Relire une spec contre la constitution, contre le code, et contre elle-même
argument-hint: <numéro de spec, ex. 0001>
---

Tu ouvres la garde « analyser » sur `specs/$1-*/`.

Cette garde existe parce que deux erreurs ont traversé une relecture le
10 septembre 2026 — un comptage de cas faux de 51, un arrondi lu à l'euro au
lieu du centime — **toutes deux parce qu'un chiffre avait été recopié d'un
document à l'autre sans rouvrir le fichier**. Elles ont été rattrapées par
chance, pas par processus. Cette commande est le processus.

## Ce que tu fais, dans cet ordre

### 1. Contre la constitution
Relis `specs/CONSTITUTION.md` puis la spec. Pour chacun des dix articles :
la spec le respecte, le contredit, ou ne le concerne pas ? **Une contradiction
n'est pas forcément une faute** — mais elle doit être assumée par écrit dans la
spec, avec sa raison.

### 2. Contre le code
Chaque affirmation technique de la spec porte un `fichier:ligne`. **Rouvre-les
tous.** Une citation qui pointe au-delà de la fin du fichier, un fichier qui
n'existe plus, une ligne qui dit autre chose : signale-le. Le balayage 0000 en
porte une quinzaine, et un fichier cité 26 fois qui avait été supprimé le
matin même.

### 3. Contre elle-même
Entre `spec.md`, `plan.md`, `taches.md` : un attendu sans tâche, une tâche sans
attendu, un critère d'acceptation qu'aucune commande ne vérifie, deux chiffres
qui se contredisent. **Recompte tout nombre repris d'un autre document** — ne le
crois pas.

### 4. Contre la base
La spec 0000 est la base : 549 cas. Cette spec doit dire **quels cas elle
referme**, par leur identifiant. Vérifie qu'ils existent dans
`specs/0000-le-club-et-lapp/cas.md`, que leur gravité correspond à ce que la
spec en dit, et qu'aucun cas fermé n'est oublié.

### 5. Ce qui manque
Qu'est-ce que cette spec n'a pas envisagé ? Le hors-ligne, la reprise sur un
second appareil, deux personnes en même temps, une saison clôturée, quelqu'un
qui n'a pas de compte, un téléphone prêté.

## Ce que tu rends

Un rapport, en français, dense, en quatre parties : **à corriger** (avec la
formulation juste) · **contradictions** · **ce qui manque** · **ce qui tient**
(court, pour savoir où ne pas retourner).

Tu ne modifies aucun fichier sans que la correction ait été validée. Une
affirmation exagérée dans une spec coûte plus cher qu'un cas manquant : elle
envoie travailler au mauvais endroit.
