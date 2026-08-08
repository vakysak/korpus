-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('OK', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'OK',
    "matAdded" INTEGER NOT NULL DEFAULT 0,
    "matUpdated" INTEGER NOT NULL DEFAULT 0,
    "hwAdded" INTEGER NOT NULL DEFAULT 0,
    "hwUpdated" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ImportLog" ADD CONSTRAINT "ImportLog_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
