import { prisma } from "../db";
import { BulkValueService } from "./bulk-service";

export const bulkValueService = new BulkValueService(prisma);
