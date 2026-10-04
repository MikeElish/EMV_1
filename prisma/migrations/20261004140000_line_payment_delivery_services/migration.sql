-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "deferred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deliveryConfirmPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deliveryDate" TIMESTAMP(3),
ADD COLUMN     "deliveryMethod" "DeliveryMethod",
ADD COLUMN     "deliveryPrevMethod" "DeliveryMethod",
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "unit" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "oneCRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraCost" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT NOT NULL,
    "serviceId" TEXT,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtraCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Service_code_key" ON "Service"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Service_oneCRef_key" ON "Service"("oneCRef");

-- CreateIndex
CREATE INDEX "ExtraCost_orderId_idx" ON "ExtraCost"("orderId");

-- AddForeignKey
ALTER TABLE "ExtraCost" ADD CONSTRAINT "ExtraCost_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraCost" ADD CONSTRAINT "ExtraCost_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Lines take payment and delivery date from their order.
UPDATE "OrderItem" i SET "paid" = o."paid", "deferred" = o."deferred", "deliveryDate" = o."deliveryDate"
FROM "Order" o WHERE o."id" = i."orderId";

-- Delivery type was only written into the delivery note at checkout.
UPDATE "OrderItem" i SET "deliveryMethod" = CASE
    WHEN o."deliveryNote" LIKE '%Способ доставки: До адреса%' THEN 'ADDRESS'::"DeliveryMethod"
    WHEN o."deliveryNote" LIKE '%Способ доставки: До терминала%' THEN 'TERMINAL'::"DeliveryMethod"
    WHEN o."deliveryNote" LIKE '%Способ доставки: Самовывоз%' THEN 'PICKUP'::"DeliveryMethod"
  END
FROM "Order" o WHERE o."id" = i."orderId";
