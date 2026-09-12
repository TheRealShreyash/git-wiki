-- CreateTable
CREATE TABLE "repos" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "totalChunks" INTEGER NOT NULL DEFAULT 0,
    "embeddedBatches" INTEGER NOT NULL DEFAULT 0,
    "totalBatches" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eventId" TEXT,
    "githubToken" TEXT,
    "logs" JSONB NOT NULL DEFAULT '[]',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER,

    CONSTRAINT "repos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" SERIAL NOT NULL,
    "repoId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "repoId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sha" TEXT,
    "size" INTEGER,

    CONSTRAINT "files_pkey" PRIMARY KEY ("repoId","path")
);

-- CreateIndex
CREATE INDEX "messages_repoId_idx" ON "messages"("repoId");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
