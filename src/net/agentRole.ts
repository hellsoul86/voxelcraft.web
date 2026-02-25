import type { AgentState } from "./protocol";

export type TeamRole = "pmo" | "architect" | "frontend" | "backend" | "qa" | "devops" | "unknown";

const ROLE_SET = new Set<TeamRole>(["pmo", "architect", "frontend", "backend", "qa", "devops", "unknown"]);

function toWords(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

export function normalizeTeamRole(value: unknown): TeamRole | undefined {
  if (typeof value !== "string") return undefined;
  const role = value.trim().toLowerCase() as TeamRole;
  return ROLE_SET.has(role) ? role : undefined;
}

export function inferTeamRole(agent: Pick<AgentState, "id" | "name" | "org_id" | "role">): TeamRole {
  const explicit = normalizeTeamRole(agent.role);
  if (explicit) return explicit;

  const corpus = [agent.id, agent.name, agent.org_id]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .flatMap((x) => toWords(x));

  if (corpus.includes("pmo") || corpus.includes("pm")) return "pmo";
  if (corpus.includes("architect") || corpus.includes("arch")) return "architect";
  if (corpus.includes("frontend") || corpus.includes("front") || corpus.includes("fe")) return "frontend";
  if (corpus.includes("backend") || corpus.includes("back") || corpus.includes("be")) return "backend";
  if (corpus.includes("qa") || corpus.includes("test") || corpus.includes("tester")) return "qa";
  if (corpus.includes("devops") || corpus.includes("ops") || corpus.includes("sre")) return "devops";
  return "unknown";
}

export function roleLabel(role: TeamRole): string {
  switch (role) {
    case "pmo":
      return "PMO";
    case "architect":
      return "架构";
    case "frontend":
      return "前端";
    case "backend":
      return "后端";
    case "qa":
      return "测试";
    case "devops":
      return "运维";
    default:
      return "未知";
  }
}

