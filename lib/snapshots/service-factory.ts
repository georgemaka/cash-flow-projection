import { prisma } from "../db";
import { AuditService } from "../audit";
import { SnapshotService } from "./snapshot-service";

const auditService = new AuditService(prisma);

export const snapshotService = new SnapshotService(prisma, auditService);
