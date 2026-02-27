import { prisma } from "../db";
import { AuditService } from "../audit";
import { ValueService } from "./value-service";

const auditService = new AuditService(prisma);

export const valueService = new ValueService(prisma, auditService);
