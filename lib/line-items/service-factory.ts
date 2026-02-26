import { prisma } from "../db";
import { AuditService } from "../audit";
import { LineItemService } from "./line-item-service";

const auditService = new AuditService(prisma);

export const lineItemService = new LineItemService(prisma, auditService);
