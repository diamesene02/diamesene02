-- Couleurs de chasubles : l'identité visuelle appartient au club, pas à l'app.
ALTER TABLE "club" ADD COLUMN "colorA" TEXT NOT NULL DEFAULT '#FF6B2C';
ALTER TABLE "club" ADD COLUMN "colorB" TEXT NOT NULL DEFAULT '#3D8BFF';
