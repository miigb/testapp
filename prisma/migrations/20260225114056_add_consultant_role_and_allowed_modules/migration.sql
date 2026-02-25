-- AlterEnum
ALTER TYPE "public"."UserRole" ADD VALUE 'CONSULTANT';

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "allowedModules" TEXT[] DEFAULT ARRAY[]::TEXT[];
