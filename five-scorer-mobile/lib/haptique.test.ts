import { beforeEach, describe, expect, it, vi } from "vitest";

// Le vrai module natif ne se charge pas sous Node : on le remplace. Ce qui
// est vérifié, c'est que le bon retour part pour le bon geste, et qu'aucun
// échec du moteur ne remonte jusqu'au geste qui l'a demandé.
const moteur = vi.hoisted(() => ({
  impactAsync: vi.fn(async (_style: string) => {}),
  selectionAsync: vi.fn(async () => {}),
  notificationAsync: vi.fn(async (_type: string) => {}),
}));

vi.mock("expo-haptics", () => ({
  ...moteur,
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

import { avertissement, choix, leger, succes } from "./haptique";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("haptique", () => {
  it("envoie le retour attendu pour chaque geste", () => {
    leger();
    choix();
    succes();
    avertissement();
    expect(moteur.impactAsync).toHaveBeenCalledWith("light");
    expect(moteur.selectionAsync).toHaveBeenCalledTimes(1);
    expect(moteur.notificationAsync).toHaveBeenNthCalledWith(1, "success");
    expect(moteur.notificationAsync).toHaveBeenNthCalledWith(2, "warning");
  });

  it("se tait quand le moteur rejette sa promesse", async () => {
    moteur.notificationAsync.mockRejectedValueOnce(new Error("pas de vibreur"));
    expect(() => succes()).not.toThrow();
    // Laisse passer le rejet : un rejet non intercepté ferait échouer le test.
    await new Promise((r) => setTimeout(r, 0));
  });

  it("se tait quand le module lève avant même de rendre une promesse", () => {
    moteur.selectionAsync.mockImplementationOnce(() => {
      throw new Error("module natif absent");
    });
    expect(() => choix()).not.toThrow();
  });
});
