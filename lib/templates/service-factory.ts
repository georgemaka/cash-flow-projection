import { prisma } from "../db";
import { AuditService } from "../audit";
import { TemplateService } from "./template-service";

const auditService = new AuditService(prisma);

export const templateService = new TemplateService(prisma, auditService);
