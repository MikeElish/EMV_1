-- Add noOffer flag to Product so the "No offer" checkbox in the admin card persists.
ALTER TABLE "Product" ADD COLUMN "noOffer" BOOLEAN NOT NULL DEFAULT false;
