ALTER TABLE "SupplierOrderLine" ADD COLUMN IF NOT EXISTS "noOffer" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "SupplierProfile" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" TEXT UNIQUE NOT NULL,
    "brands" TEXT NOT NULL DEFAULT '',
    "categories" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'SupplierProfile_companyId_fkey'
          AND conrelid = '"SupplierProfile"'::regclass
    ) THEN
        ALTER TABLE "SupplierProfile" ADD CONSTRAINT "SupplierProfile_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SupplierProfile_companyId_idx" ON "SupplierProfile"("companyId");
