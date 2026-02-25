import { describe, expect, it } from "vitest";

import { inferTeamRole, normalizeTeamRole, roleLabel } from "./agentRole";

describe("agent role normalization", () => {
  it("normalizes known role strings", () => {
    expect(normalizeTeamRole("backend")).toBe("backend");
    expect(normalizeTeamRole("  QA  ")).toBe("qa");
  });

  it("returns undefined for unknown role strings", () => {
    expect(normalizeTeamRole("observer")).toBeUndefined();
    expect(normalizeTeamRole("")).toBeUndefined();
  });
});

describe("agent role inference", () => {
  it("prefers explicit role", () => {
    expect(
      inferTeamRole({
        id: "vc-agent-01",
        name: "bot",
        org_id: "team",
        role: "devops",
      }),
    ).toBe("devops");
  });

  it("infers role from id/name/org hints", () => {
    expect(
      inferTeamRole({
        id: "vc-backend-01",
        name: "backend worker",
        org_id: "team-a",
        role: undefined,
      }),
    ).toBe("backend");

    expect(
      inferTeamRole({
        id: "vc-pm-01",
        name: "pm bot",
        org_id: "delivery",
        role: undefined,
      }),
    ).toBe("pmo");
  });

  it("falls back to unknown for unmatched corpus", () => {
    expect(
      inferTeamRole({
        id: "A01",
        name: "bot1",
        org_id: "",
        role: undefined,
      }),
    ).toBe("unknown");
  });
});

describe("role labels", () => {
  it("maps role to Chinese labels", () => {
    expect(roleLabel("pmo")).toBe("PMO");
    expect(roleLabel("frontend")).toBe("前端");
    expect(roleLabel("unknown")).toBe("未知");
  });
});

