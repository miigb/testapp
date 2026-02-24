-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."RecordType" AS ENUM ('exequente', 'executado');

-- CreateEnum
CREATE TYPE "public"."TaxTargetField" AS ENUM ('iva', 'retencao', 'meu5', 'outrasTaxas');

-- CreateEnum
CREATE TYPE "public"."TaxBaseField" AS ENUM ('valorIndicado', 'valorSemIva', 'valorEmissao');

-- CreateEnum
CREATE TYPE "public"."DsIvaKind" AS ENUM ('sem_iva', 'total_levantado', 'valor', 'outro');

-- CreateTable
CREATE TABLE "public"."Status" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Record" (
    "id" TEXT NOT NULL,
    "tipo" "public"."RecordType" NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "processo" TEXT,
    "pe" TEXT,
    "reciboNumero" TEXT,
    "dataLevantamento" TIMESTAMP(3),
    "dataRecibo" TIMESTAMP(3),
    "valorIndicado" DECIMAL(14,2),
    "valorSemIva" DECIMAL(14,2),
    "iva" DECIMAL(14,2),
    "retencao" DECIMAL(14,2),
    "valorEmissao" DECIMAL(14,2),
    "meu5" DECIMAL(14,2),
    "outrasTaxas" DECIMAL(14,2),
    "gestor" TEXT,
    "exequente" TEXT,
    "descricaoValor" TEXT,
    "indicacoes" TEXT,
    "sourceColor" TEXT,
    "sourceSheet" TEXT,
    "statusId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecordHistory" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CalculationSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "autoApplyRules" BOOLEAN NOT NULL DEFAULT true,
    "autoComputeValorSemIva" BOOLEAN NOT NULL DEFAULT true,
    "autoComputeValorEmissao" BOOLEAN NOT NULL DEFAULT false,
    "roundTo" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalculationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaxRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rate" DECIMAL(8,5) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "targetField" "public"."TaxTargetField" NOT NULL,
    "baseField" "public"."TaxBaseField" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SavedView" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DsStatus" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DsStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DsRecord" (
    "id" TEXT NOT NULL,
    "gestora" TEXT,
    "proponentes" TEXT,
    "referencia" TEXT,
    "produto" TEXT,
    "entidadeBancaria" TEXT,
    "liderCalculo" TEXT,
    "recibo" TEXT,
    "faltaReciboGestora" TEXT,
    "valorRaw" TEXT,
    "valor" DECIMAL(14,2),
    "dataEscritura" TIMESTAMP(3),
    "dataFechoCrm" TIMESTAMP(3),
    "comissaoLojaRaw" TEXT,
    "comissaoLoja" DECIMAL(14,2),
    "ivaCgdRaw" TEXT,
    "ivaCgdValor" DECIMAL(14,2),
    "ivaCgdKind" "public"."DsIvaKind",
    "totalComissaoLojaCmIvaRaw" TEXT,
    "totalComissaoLojaCmIva" DECIMAL(14,2),
    "comissaoGestorRaw" TEXT,
    "comissaoGestor" DECIMAL(14,2),
    "percentagemRaw" TEXT,
    "percentagem" DECIMAL(8,5),
    "pagComissaoGestor" TIMESTAMP(3),
    "sourceFile" TEXT,
    "sourceSheet" TEXT,
    "sourceRowNumber" INTEGER,
    "importBatchId" TEXT,
    "rawPayload" JSONB,
    "statusId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PenhorasStatus" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PenhorasStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PenhorasRecord" (
    "id" TEXT NOT NULL,
    "pe" TEXT,
    "acto" TEXT,
    "dataPedido" TIMESTAMP(3),
    "identificacao" TEXT,
    "pedido" TEXT,
    "gestor" TEXT,
    "sourceFile" TEXT,
    "sourceSheet" TEXT,
    "sourceRowNumber" INTEGER,
    "importBatchId" TEXT,
    "rawPayload" JSONB,
    "statusId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PenhorasRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Status_key_key" ON "public"."Status"("key");

-- CreateIndex
CREATE INDEX "Record_ano_mes_idx" ON "public"."Record"("ano", "mes");

-- CreateIndex
CREATE INDEX "Record_tipo_idx" ON "public"."Record"("tipo");

-- CreateIndex
CREATE INDEX "Record_statusId_idx" ON "public"."Record"("statusId");

-- CreateIndex
CREATE INDEX "Record_gestor_idx" ON "public"."Record"("gestor");

-- CreateIndex
CREATE INDEX "Record_exequente_idx" ON "public"."Record"("exequente");

-- CreateIndex
CREATE UNIQUE INDEX "record_unique_key" ON "public"."Record"("tipo", "ano", "mes", "processo", "pe", "reciboNumero");

-- CreateIndex
CREATE INDEX "RecordHistory_recordId_createdAt_idx" ON "public"."RecordHistory"("recordId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_code_key" ON "public"."TaxRule"("code");

-- CreateIndex
CREATE INDEX "SavedView_scope_idx" ON "public"."SavedView"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "DsStatus_key_key" ON "public"."DsStatus"("key");

-- CreateIndex
CREATE INDEX "DsRecord_statusId_idx" ON "public"."DsRecord"("statusId");

-- CreateIndex
CREATE INDEX "DsRecord_gestora_idx" ON "public"."DsRecord"("gestora");

-- CreateIndex
CREATE INDEX "DsRecord_referencia_idx" ON "public"."DsRecord"("referencia");

-- CreateIndex
CREATE INDEX "DsRecord_entidadeBancaria_idx" ON "public"."DsRecord"("entidadeBancaria");

-- CreateIndex
CREATE INDEX "DsRecord_dataEscritura_idx" ON "public"."DsRecord"("dataEscritura");

-- CreateIndex
CREATE UNIQUE INDEX "PenhorasStatus_key_key" ON "public"."PenhorasStatus"("key");

-- CreateIndex
CREATE INDEX "PenhorasRecord_statusId_idx" ON "public"."PenhorasRecord"("statusId");

-- CreateIndex
CREATE INDEX "PenhorasRecord_pe_idx" ON "public"."PenhorasRecord"("pe");

-- CreateIndex
CREATE INDEX "PenhorasRecord_gestor_idx" ON "public"."PenhorasRecord"("gestor");

-- CreateIndex
CREATE INDEX "PenhorasRecord_acto_idx" ON "public"."PenhorasRecord"("acto");

-- CreateIndex
CREATE INDEX "PenhorasRecord_dataPedido_idx" ON "public"."PenhorasRecord"("dataPedido");

-- AddForeignKey
ALTER TABLE "public"."Record" ADD CONSTRAINT "Record_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."Status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecordHistory" ADD CONSTRAINT "RecordHistory_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "public"."Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DsRecord" ADD CONSTRAINT "DsRecord_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."DsStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PenhorasRecord" ADD CONSTRAINT "PenhorasRecord_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."PenhorasStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

