-- Add CONTRACT category for deferral contract documents.
ALTER TYPE "OrderDocumentCategory" ADD VALUE IF NOT EXISTS 'CONTRACT';
