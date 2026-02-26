import { prisma } from "../db";
import { AuditService } from "../audit";
import { GroupService } from "./group-service";

const auditService = new AuditService(prisma);

export const groupService = new GroupService(prisma, auditService);
