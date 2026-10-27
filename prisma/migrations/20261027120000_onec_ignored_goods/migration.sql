-- CreateTable
CREATE TABLE "OneCIgnoredGood" (
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OneCIgnoredGood_pkey" PRIMARY KEY ("ref")
);
