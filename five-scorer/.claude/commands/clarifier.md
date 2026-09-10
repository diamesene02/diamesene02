---
description: Forcer les questions ouvertes d'une spec à être tranchées avant tout plan
argument-hint: <numéro de spec, ex. 0001>
---

Tu ouvres la garde « clarifier » sur `specs/$1-*/spec.md`.

Cette garde existe parce qu'une spec de ce dépôt a porté **sept questions
ouvertes pendant des semaines** sans que rien n'oblige à y répondre — et qu'un
plan écrit par-dessus des questions ouvertes est un plan qui invente les
réponses en silence.

## Ce que tu fais

1. **Lis** `specs/CONSTITUTION.md`, puis la spec visée en entier.
2. **Relève toutes les questions ouvertes** — celles du § « Questions
   ouvertes », mais aussi celles qui n'y sont pas : un « probablement », un
   « on verra », un attendu qui admet deux lectures, un critère d'acceptation
   qu'on ne sait pas vérifier.
3. **Pour chacune, va chercher la réponse dans le code d'abord.** Le plus
   souvent elle y est : un défaut qui dure depuis un an est déjà une réponse, il
   faut juste savoir si c'est celle qu'on voulait. Cite `fichier:ligne`.
4. **Écarte** celles que le code a déjà tranchées — en le disant dans la spec,
   avec la preuve.
5. **Pose les autres à Ibrahima en un seul bloc**, avec `AskUserQuestion` :
   quatre au maximum par appel, chacune avec **une proposition tranchée** et ce
   qu'elle coûte. Il préfère qu'on lui propose plutôt qu'on lui demande.
6. **Écris les réponses dans la spec**, à l'endroit de la question, datées.

## Ce que tu ne fais pas

- Tu n'écris pas de plan. Tu n'écris pas de code.
- Tu ne laisses **aucune** question sans réponse ni sans « écartée parce que ».

## Fini quand

Le § « Questions ouvertes » de la spec ne contient plus une seule question sans
réponse, et chaque réponse porte soit sa preuve dans le code, soit la date à
laquelle Ibrahima l'a tranchée.
