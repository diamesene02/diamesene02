import { create } from "zustand";

export type LivePlayer = {
  id: string;
  name: string;
  goals: number;
};

type State = {
  matchId: string | null;
  scoreA: number;
  scoreB: number;
  teamA: LivePlayer[];
  teamB: LivePlayer[];
  init: (payload: {
    matchId: string;
    scoreA: number;
    scoreB: number;
    teamA: LivePlayer[];
    teamB: LivePlayer[];
  }) => void;
  applyGoal: (playerId: string, team: "A" | "B", delta: 1 | -1) => void;
  setScores: (scoreA: number, scoreB: number) => void;
};

export const useLiveMatch = create<State>((set) => ({
  matchId: null,
  scoreA: 0,
  scoreB: 0,
  teamA: [],
  teamB: [],
  init: (p) => set({ ...p }),
  applyGoal: (playerId, team, delta) =>
    set((s) => {
      const updateList = (list: LivePlayer[]) =>
        list.map((p) =>
          p.id === playerId
            ? { ...p, goals: Math.max(0, p.goals + delta) }
            : p
        );
      return {
        teamA: team === "A" ? updateList(s.teamA) : s.teamA,
        teamB: team === "B" ? updateList(s.teamB) : s.teamB,
        scoreA: team === "A" ? Math.max(0, s.scoreA + delta) : s.scoreA,
        scoreB: team === "B" ? Math.max(0, s.scoreB + delta) : s.scoreB,
      };
    }),
  setScores: (scoreA, scoreB) => set({ scoreA, scoreB }),
}));
