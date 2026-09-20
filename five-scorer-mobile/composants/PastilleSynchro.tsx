import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNoyau } from "./Noyau";
import { leger } from "../lib/haptique";
import { jeton, type Jetons } from "../lib/couleurs";
import type { EtatSynchro } from "../lib/outbox/sync";

/// La pastille de synchro, à gauche de la pilule (`SyncBadge compact` du
/// site).
///
/// Invisible quand tout est parti — c'est le cas normal, et une pastille
/// verte en permanence ne dirait rien. Elle n'apparaît que quand quelque
/// chose attend : en or s'il reste des envois qui partiront seuls, en rouge
/// hors ligne ou quand le serveur a refusé une opération. La toucher relance
/// l'envoi tout de suite, sans attendre la prochaine tentative.
///
/// Un point de 10, dans une cible de 44 : c'est au bord du terrain qu'on la
/// touche, pas au bureau.
export default function PastilleSynchro({ t }: { t: Jetons }) {
  const { drain } = useNoyau();
  const [etat, setEtat] = useState<EtatSynchro>(() => drain.etat());

  useEffect(() => drain.abonner(setEtat), [drain]);

  const refus = etat.bloquees > 0 || etat.reconnexionRequise;
  const probleme = !etat.enLigne || refus;
  if (!probleme && etat.enAttente === 0) return null;

  const couleur = probleme ? jeton(t, "bad") : jeton(t, "or");
  const n = etat.enAttente + etat.bloquees;
  const envois = `${n} envoi${n > 1 ? "s" : ""}`;
  const libelle = etat.reconnexionRequise
    ? "Session expirée : reconnecte-toi pour envoyer la saisie"
    : refus
      ? `${envois} refusé${n > 1 ? "s" : ""} par le serveur. Touche pour réessayer`
      : !etat.enLigne
        ? n > 0
          ? `Hors ligne, ${envois} en attente. Touche pour réessayer`
          : "Hors ligne"
        : `${envois} en attente. Touche pour envoyer maintenant`;

  return (
    <Pressable
      onPress={() => {
        leger();
        // Une opération refusée est mise DE CÔTÉ, pas en tête de file :
        // `relancer()` passe par `prochaineActive`, qui écarte tout ce qui
        // porte un `blocked_at`. Sur des envois refusés, il ne reparcourait
        // donc rien — « Touche pour réessayer » ne faisait strictement rien,
        // vingt taps de suite. C'est `rejouerBloquees()` qui les remet dans
        // la file, et lui seul.
        void (etat.bloquees > 0 ? drain.rejouerBloquees() : drain.relancer());
      }}
      accessibilityRole="button"
      accessibilityLabel={libelle}
      style={({ pressed }) => [s.cible, pressed && { opacity: 0.6 }]}
    >
      <View style={[s.point, { backgroundColor: couleur, boxShadow: `0 0 8px ${couleur}` }]} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  cible: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  point: { width: 10, height: 10, borderRadius: 5 },
});
