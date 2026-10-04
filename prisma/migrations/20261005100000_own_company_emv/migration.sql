-- The site's own company
ALTER TABLE "Company" ADD COLUMN "isOwn" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "Company" ("id", "name", "type", "isOwn", "createdAt", "updatedAt")
SELECT 'emv-own-company', 'EMV', 'Наша компания', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Company" WHERE "isOwn");

-- Every employee (everyone but customers) belongs to it
UPDATE "User" SET "companyId" = (SELECT "id" FROM "Company" WHERE "isOwn" LIMIT 1)
WHERE "role" <> 'CUSTOMER';
