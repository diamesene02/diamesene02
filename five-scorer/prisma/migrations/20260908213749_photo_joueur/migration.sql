-- La photo du joueur : data-URL JPEG carrée de 256 px, redimensionnée sur
-- l'appareil avant l'envoi. Colonne nullable : rien à reprendre sur
-- l'existant.
ALTER TABLE "player" ADD COLUMN "photo" TEXT;
