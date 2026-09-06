-- CreateEnum
CREATE TYPE "SportFormat" AS ENUM ('FIVE', 'FUTSAL', 'SEVEN', 'ELEVEN', 'OTHER');

-- CreateEnum
CREATE TYPE "MotmMode" AS ENUM ('VOTE', 'ADMIN', 'OFF');

-- CreateEnum
CREATE TYPE "MatchKind" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "MatchEventType" AS ENUM ('GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'RED_CARD');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('IN', 'OUT', 'MAYBE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MatchStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "MatchStatus" ADD VALUE 'CANCELED';

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "metadata" TEXT,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviterId" TEXT NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club" (
    "id" TEXT NOT NULL,
    "format" "SportFormat" NOT NULL DEFAULT 'FIVE',
    "matchDurationMin" INTEGER NOT NULL DEFAULT 10,
    "pointsWin" INTEGER NOT NULL DEFAULT 3,
    "pointsDraw" INTEGER NOT NULL DEFAULT 1,
    "trackAssists" BOOLEAN NOT NULL DEFAULT true,
    "trackCards" BOOLEAN NOT NULL DEFAULT false,
    "motmMode" "MotmMode" NOT NULL DEFAULT 'VOTE',
    "membersCanScore" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "userId" TEXT,
    "skill" INTEGER NOT NULL DEFAULT 3,
    "isGk" BOOLEAN NOT NULL DEFAULT false,
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_day" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "seasonId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opponent" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "seasonId" TEXT,
    "matchDayId" TEXT,
    "kind" "MatchKind" NOT NULL DEFAULT 'INTERNAL',
    "opponentId" TEXT,
    "isHome" BOOLEAN NOT NULL DEFAULT true,
    "status" "MatchStatus" NOT NULL DEFAULT 'LIVE',
    "scheduledAt" TIMESTAMP(3),
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "venue" TEXT,
    "teamAName" TEXT NOT NULL DEFAULT 'Équipe A',
    "teamBName" TEXT NOT NULL DEFAULT 'Équipe B',
    "scoreA" INTEGER NOT NULL DEFAULT 0,
    "scoreB" INTEGER NOT NULL DEFAULT 0,
    "durationMin" INTEGER,
    "mvpId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_participant" (
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "team" "Team" NOT NULL,
    "isGk" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "match_participant_pkey" PRIMARY KEY ("matchId","playerId")
);

-- CreateTable
CREATE TABLE "match_event" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "type" "MatchEventType" NOT NULL,
    "team" "Team" NOT NULL,
    "playerId" TEXT,
    "assistPlayerId" TEXT,
    "minute" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rsvp" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT,
    "matchId" TEXT,
    "playerId" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL,
    "respondedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motm_vote" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "motm_vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "member_organizationId_idx" ON "member"("organizationId");

-- CreateIndex
CREATE INDEX "member_userId_idx" ON "member"("userId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");

-- CreateIndex
CREATE INDEX "invitation_email_idx" ON "invitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "club_inviteCode_key" ON "club"("inviteCode");

-- CreateIndex
CREATE INDEX "player_clubId_isArchived_idx" ON "player"("clubId", "isArchived");

-- CreateIndex
CREATE INDEX "player_clubId_name_idx" ON "player"("clubId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "player_clubId_userId_key" ON "player"("clubId", "userId");

-- CreateIndex
CREATE INDEX "season_clubId_isActive_idx" ON "season"("clubId", "isActive");

-- CreateIndex
CREATE INDEX "match_day_clubId_date_idx" ON "match_day"("clubId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "opponent_clubId_name_key" ON "opponent"("clubId", "name");

-- CreateIndex
CREATE INDEX "match_clubId_playedAt_idx" ON "match"("clubId", "playedAt");

-- CreateIndex
CREATE INDEX "match_clubId_status_idx" ON "match"("clubId", "status");

-- CreateIndex
CREATE INDEX "match_seasonId_idx" ON "match"("seasonId");

-- CreateIndex
CREATE INDEX "match_matchDayId_idx" ON "match"("matchDayId");

-- CreateIndex
CREATE INDEX "match_participant_playerId_idx" ON "match_participant"("playerId");

-- CreateIndex
CREATE INDEX "match_event_matchId_createdAt_idx" ON "match_event"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "match_event_playerId_idx" ON "match_event"("playerId");

-- CreateIndex
CREATE INDEX "match_event_assistPlayerId_idx" ON "match_event"("assistPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "rsvp_matchDayId_playerId_key" ON "rsvp"("matchDayId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "rsvp_matchId_playerId_key" ON "rsvp"("matchId", "playerId");

-- CreateIndex
CREATE INDEX "motm_vote_matchId_idx" ON "motm_vote"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "motm_vote_matchId_voterId_key" ON "motm_vote"("matchId", "voterId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club" ADD CONSTRAINT "club_id_fkey" FOREIGN KEY ("id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season" ADD CONSTRAINT "season_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_day" ADD CONSTRAINT "match_day_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_day" ADD CONSTRAINT "match_day_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opponent" ADD CONSTRAINT "opponent_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "match_day"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "opponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_mvpId_fkey" FOREIGN KEY ("mvpId") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participant" ADD CONSTRAINT "match_participant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participant" ADD CONSTRAINT "match_participant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_event" ADD CONSTRAINT "match_event_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_event" ADD CONSTRAINT "match_event_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_event" ADD CONSTRAINT "match_event_assistPlayerId_fkey" FOREIGN KEY ("assistPlayerId") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvp" ADD CONSTRAINT "rsvp_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "match_day"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvp" ADD CONSTRAINT "rsvp_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvp" ADD CONSTRAINT "rsvp_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motm_vote" ADD CONSTRAINT "motm_vote_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motm_vote" ADD CONSTRAINT "motm_vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motm_vote" ADD CONSTRAINT "motm_vote_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration des données v1 → v2.
-- L'historique existant (joueurs, matchs, buts) est rattaché à un club
-- "legacy" sans membre. Le premier compte qui saisit l'ancien PIN admin
-- le revendique et en devient owner (flow /onboarding, cf. lib/legacy.ts).
-- ═══════════════════════════════════════════════════════════════════════════

-- Club legacy, uniquement s'il y a des données v1.
INSERT INTO "organization" ("id", "name", "slug", "createdAt")
SELECT 'club_legacy', 'Five du jeudi', 'five-du-jeudi', now()
WHERE EXISTS (SELECT 1 FROM "Player");

INSERT INTO "club" ("id", "inviteCode", "trackAssists", "updatedAt")
SELECT 'club_legacy', substr(md5(random()::text), 1, 12), false, now()
WHERE EXISTS (SELECT 1 FROM "Player");

-- Joueurs (ids conservés).
INSERT INTO "player" ("id", "clubId", "name", "nickname", "isGuest", "createdAt")
SELECT "id", 'club_legacy', "name", "nickname", "isGuest", "createdAt"
FROM "Player";

-- Matchs (ids conservés, tous INTERNAL).
INSERT INTO "match" (
  "id", "clubId", "kind", "status", "playedAt",
  "teamAName", "teamBName", "scoreA", "scoreB", "mvpId",
  "createdAt", "updatedAt"
)
SELECT
  "id", 'club_legacy', 'INTERNAL', "status", "playedAt",
  "teamAName", "teamBName", "scoreA", "scoreB", "mvpId",
  "createdAt", "updatedAt"
FROM "Match";

-- Compositions.
INSERT INTO "match_participant" ("matchId", "playerId", "team")
SELECT "matchId", "playerId", "team"
FROM "MatchPlayer";

-- Buts → événements typés (ids conservés).
INSERT INTO "match_event" ("id", "matchId", "type", "team", "playerId", "minute", "createdAt")
SELECT "id", "matchId", 'GOAL', "team", "scorerId", "minute", "createdAt"
FROM "Goal";

-- Suppression des tables v1.
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_matchId_fkey";
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_scorerId_fkey";
ALTER TABLE "Match" DROP CONSTRAINT "Match_mvpId_fkey";
ALTER TABLE "MatchPlayer" DROP CONSTRAINT "MatchPlayer_matchId_fkey";
ALTER TABLE "MatchPlayer" DROP CONSTRAINT "MatchPlayer_playerId_fkey";
DROP TABLE "Goal";
DROP TABLE "Match";
DROP TABLE "MatchPlayer";
DROP TABLE "Player";
