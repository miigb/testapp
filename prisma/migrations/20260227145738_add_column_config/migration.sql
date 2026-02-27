-- AlterTable
ALTER TABLE "public"."DsRecord" ADD COLUMN     "customFields" JSONB DEFAULT '{}';

-- AlterTable
ALTER TABLE "public"."PenhorasRecord" ADD COLUMN     "customFields" JSONB DEFAULT '{}';

-- AlterTable
ALTER TABLE "public"."Record" ADD COLUMN     "customFields" JSONB DEFAULT '{}';

-- CreateTable
CREATE TABLE "public"."ColumnConfig" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "view" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "isReference" BOOLEAN NOT NULL DEFAULT false,
    "referenceConfig" JSONB,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColumnConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ColumnConfig_module_view_idx" ON "public"."ColumnConfig"("module", "view");

-- CreateIndex
CREATE UNIQUE INDEX "ColumnConfig_module_view_key_key" ON "public"."ColumnConfig"("module", "view", "key");

-- AddForeignKey
ALTER TABLE "public"."ColumnConfig" ADD CONSTRAINT "ColumnConfig_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
