-- Le seuil de confirmation et la capacité d'une soirée, réglés par le club.
ALTER TABLE "club" ADD COLUMN "minJoueurs" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "club" ADD COLUMN "capaciteSoiree" INTEGER NOT NULL DEFAULT 12;

-- « Je viens tous les lundis » : l'habitué est compté présent tant qu'il n'a
-- rien dit. Personne n'est abonné d'office — c'est un choix, pas un défaut
-- qu'on subit.
ALTER TABLE "player" ADD COLUMN "abonne" BOOLEAN NOT NULL DEFAULT false;
