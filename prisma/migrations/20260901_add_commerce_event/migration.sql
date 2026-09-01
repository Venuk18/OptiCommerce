-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "CommerceEventType" AS ENUM (
        'SEARCH',
        'RECOMMENDATION_VIEW',
        'RECOMMENDATION_CLICK',
        'PRODUCT_VIEW',
        'ADD_TO_CART',
        'REMOVE_FROM_CART',
        'CHECKOUT_STARTED',
        'OFFER_VIEW',
        'OFFER_ACCEPTED',
        'OFFER_REJECTED',
        'PURCHASE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommerceEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT,
    "eventType" "CommerceEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommerceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommerceEvent_sessionId_idx" ON "CommerceEvent"("sessionId");
CREATE INDEX IF NOT EXISTS "CommerceEvent_storeId_idx" ON "CommerceEvent"("storeId");
CREATE INDEX IF NOT EXISTS "CommerceEvent_productId_idx" ON "CommerceEvent"("productId");
CREATE INDEX IF NOT EXISTS "CommerceEvent_eventType_idx" ON "CommerceEvent"("eventType");
CREATE INDEX IF NOT EXISTS "CommerceEvent_createdAt_idx" ON "CommerceEvent"("createdAt");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "CommerceEvent" ADD CONSTRAINT "CommerceEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "CommerceEvent" ADD CONSTRAINT "CommerceEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
