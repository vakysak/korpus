-- Break from cabinet-line OrderItem + BomItem → Order with BOM line items

DROP TABLE IF EXISTS "BomItem";
DROP TABLE IF EXISTS "OrderItem";
DROP TABLE IF EXISTS "Order";

DROP TYPE IF EXISTS "OrderStatus";
DROP TYPE IF EXISTS "BomPartType";

CREATE TYPE "OrderStatus" AS ENUM (
  'DRAFT',
  'CONFIRMED',
  'ORDERED',
  'IN_PRODUCTION',
  'DONE',
  'CANCELLED'
);

CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER,
    "templateId" INTEGER,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "depthMm" INTEGER NOT NULL,
    "backType" "BackType" NOT NULL DEFAULT 'OVERLAID_HDF',
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "partName" VARCHAR(100) NOT NULL,
    "partType" VARCHAR(20) NOT NULL,
    "materialId" INTEGER,
    "hardwareId" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "thickness" DECIMAL(5,1),
    "qty" DECIMAL(10,4) NOT NULL,
    "unit" VARCHAR(10) NOT NULL,
    "unitPrice" DECIMAL(10,4) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "supplierId" INTEGER,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_supplierId_idx" ON "OrderItem"("supplierId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "CabinetTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_hardwareId_fkey"
  FOREIGN KEY ("hardwareId") REFERENCES "Hardware"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
