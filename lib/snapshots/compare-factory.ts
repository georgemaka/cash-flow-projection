import { prisma } from "../db";
import { CompareService } from "./compare-service";

export const compareService = new CompareService(prisma);
