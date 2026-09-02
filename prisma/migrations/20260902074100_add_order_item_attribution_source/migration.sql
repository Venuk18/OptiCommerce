-- CreateEnum
CREATE TYPE "AttributionSource" AS ENUM ('DIRECT', 'AI_CHAT', 'BUNDLE', 'OFFER', 'RECOVERY');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "attributionSource" "AttributionSource" NOT NULL DEFAULT 'DIRECT';

-- CreateIndex
CREATE INDEX "OrderItem_attributionSource_idx" ON "OrderItem"("attributionSource");
