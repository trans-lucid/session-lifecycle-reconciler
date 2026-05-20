import { mkdir, writeFile } from "node:fs/promises";
import { InMemoryAuditLog } from "./auditLog";

export async function writeAuditReport(auditLog: InMemoryAuditLog, out = "results/session_audit_report.json") {
  const events = await auditLog.list();
  await mkdir("results", { recursive: true });
  await writeFile(out, JSON.stringify({ schemaVersion: "session-audit/v1", events }, null, 2));
  await writeFile("results/summary.md", `# Session Audit Summary\n\nEvents: ${events.length}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const audit = new InMemoryAuditLog();
  await audit.append({ eventType: "demo", reason: "manual_run" });
  await writeAuditReport(audit);
  console.log("wrote results/session_audit_report.json");
}

