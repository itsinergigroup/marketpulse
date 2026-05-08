-- CreateTable
CREATE TABLE "ImportHistory" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "imported" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedBy" TEXT NOT NULL,

    CONSTRAINT "ImportHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ImportHistory" ADD CONSTRAINT "ImportHistory_importedBy_fkey" FOREIGN KEY ("importedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
