"use client";

import { memo, useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import { unlockAudio, playGoalSound, playUndoSound } from "@/lib/audio";
import AvatarAnneau from "@/components/ios/AvatarAnneau";

// Module-level guard: suppress taps for a short window after a long-press
// fires, so the release doesn't accidentally add a goal after undoing.
let suppressTapUntil = 0;
const SUPPRESS_TAP_MS = 700;

type Props = {
  name: string;
  photo?: string | null;
  goals: number;
  tint: "pitch" | "blue";
  /// Vient de changer de camp : un éclair de contour pour que l'œil suive.
  justMoved?: boolean;
  /// « score » : la rangée compte les buts, et RIEN d'autre. « compo » : le
  /// match est en pause de correction, la rangée ne sert plus qu'à faire
  /// changer un joueur de camp. Les deux ne coexistent jamais.
  ///
  /// La séparation est délibérée. Brancher « changer d'équipe » sur la même
  /// surface que le but, c'était rendre le geste le plus fréquent du match
  /// ambigu — un appui censé compter un but ouvrant une fenêtre à la place.
  mode?: "score" | "compo";
  onGoal: () => void;
  onUndo: () => void;
  /// Appelé au tap en mode compo uniquement.
  onMove?: () => void;
};

// La rangée de joueur du live, comme sur la maquette : avatar à l'anneau de
// la chasuble, nom, buts. TOUTE la rangée est la cible — tape = but, maintiens
// = annuler son dernier but.
function PlayerTileImpl({
  name,
  photo,
  goals,
  tint,
  justMoved,
  mode = "score",
  onGoal,
  onUndo,
  onMove,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const camp = tint === "pitch" ? "A" : "B";

  const startPress = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      didLongRef.current = false;
      btnRef.current?.classList.add("long-pressing");
      try {
        btnRef.current?.setPointerCapture(e.pointerId);
      } catch {}
      timerRef.current = setTimeout(() => {
        didLongRef.current = true;
        btnRef.current?.classList.remove("long-pressing");
        if (goals > 0) {
          // Le garde n'est armé QUE si une annulation a réellement eu lieu :
          // il absorbe le relâchement du doigt, qui sinon rajouterait le but
          // qu'on vient de retirer. L'armer sur un appui sans effet rendait
          // muette la rangée suivante pendant 700 ms.
          suppressTapUntil = Date.now() + SUPPRESS_TAP_MS;
          if (navigator.vibrate) navigator.vibrate(30);
          playUndoSound();
          onUndo();
        } else {
          // Rien à annuler : on le dit au doigt plutôt que de ne rien faire.
          if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
          btnRef.current?.classList.add("rien-a-annuler");
          setTimeout(() => btnRef.current?.classList.remove("rien-a-annuler"), 320);
        }
      }, 500);
    },
    [goals, onUndo],
  );

  const endPress = useCallback(
    (e: React.PointerEvent) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      btnRef.current?.classList.remove("long-pressing");
      const suppressed = Date.now() < suppressTapUntil;
      if (!didLongRef.current && !suppressed) {
        unlockAudio();
        if (navigator.vibrate) navigator.vibrate(12);
        playGoalSound(camp);
        onGoal();
      }
      e.preventDefault();
    },
    [onGoal, camp],
  );

  const cancelPress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    btnRef.current?.classList.remove("long-pressing");
  }, []);

  if (mode === "compo") {
    return (
      <button
        type="button"
        onClick={onMove}
        className={cn("live-joueur compo", camp, justMoved && "arrive")}
        aria-label={`${name} — envoyer dans l'autre équipe`}
      >
        <AvatarAnneau nom={name} photo={photo} camp={camp} />
        <span className="nom">{name}</span>
        <span className="fleche" aria-hidden>
          {camp === "A" ? "→" : "←"}
        </span>
      </button>
    );
  }

  return (
    <button
      ref={btnRef}
      type="button"
      aria-label={`${name} — but (maintenir pour annuler)`}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
      className={cn("live-joueur", camp, justMoved && "arrive")}
    >
      <AvatarAnneau nom={name} photo={photo} camp={camp} />
      <span className="nom">{name}</span>
      <span className="buts">{goals > 0 ? goals : ""}</span>
    </button>
  );
}

export default memo(PlayerTileImpl);
