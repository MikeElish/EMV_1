-- CreateTable
CREATE TABLE "SearchLog" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "brand" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT,
    "inSystem" BOOLEAN NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchLogDaily" (
    "id" TEXT NOT NULL,
    "searchLogId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SearchLogDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkSearchRequest" (
    "id" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkSearchRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchLog_productId_idx" ON "SearchLog"("productId");

-- CreateIndex
CREATE INDEX "SearchLog_inSystem_idx" ON "SearchLog"("inSystem");

-- CreateIndex
CREATE UNIQUE INDEX "SearchLog_brand_sku_key" ON "SearchLog"("brand", "sku");

-- CreateIndex
CREATE INDEX "SearchLogDaily_searchLogId_idx" ON "SearchLogDaily"("searchLogId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchLogDaily_searchLogId_date_key" ON "SearchLogDaily"("searchLogId", "date");

-- AddForeignKey
ALTER TABLE "SearchLog" ADD CONSTRAINT "SearchLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchLogDaily" ADD CONSTRAINT "SearchLogDaily_searchLogId_fkey" FOREIGN KEY ("searchLogId") REFERENCES "SearchLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
