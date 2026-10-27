-- CreateTable
CREATE TABLE "StoragePlace" (
    "warehouseRef" TEXT NOT NULL,
    "itemRef" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoragePlace_pkey" PRIMARY KEY ("warehouseRef","itemRef")
);
