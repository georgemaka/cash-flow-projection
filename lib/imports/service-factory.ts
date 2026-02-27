import { prisma } from "@/lib/db";
import { ExcelImportService } from "./excel-import-service";

export const excelImportService = new ExcelImportService(prisma);
