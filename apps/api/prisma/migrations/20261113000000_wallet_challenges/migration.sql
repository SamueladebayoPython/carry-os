CREATE TABLE "WalletChallenge" (
    "id" UUID NOT NULL,
    "nonce" VARCHAR(64) NOT NULL,
    "network" VARCHAR(24) NOT NULL,
    "address" VARCHAR(256) NOT NULL,
    "subject" VARCHAR(128),
    "message" TEXT NOT NULL,
    "purpose" VARCHAR(64) NOT NULL,
    "messageVersion" VARCHAR(8) NOT NULL,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "consumedAt" TIMESTAMPTZ(6),
    CONSTRAINT "WalletChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletChallenge_nonce_key" ON "WalletChallenge"("nonce");
CREATE INDEX "WalletChallenge_expiresAt_idx" ON "WalletChallenge"("expiresAt");
CREATE INDEX "WalletChallenge_subject_expiresAt_idx" ON "WalletChallenge"("subject", "expiresAt");
