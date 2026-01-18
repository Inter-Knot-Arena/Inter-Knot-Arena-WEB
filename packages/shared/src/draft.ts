import type { DraftAction, DraftActionType, DraftState } from "./types.js";

export interface DraftTemplate {
  id: string;
  name: string;
  uniqueMode: DraftState["uniqueMode"];
  sequence: DraftActionType[];
}

export const draftTemplates: DraftTemplate[] = [
  {
    id: "bo1-standard",
    name: "BO1 Standard",
    uniqueMode: "GLOBAL",
    sequence: [
      "BAN_A",
      "BAN_B",
      "PICK_A",
      "PICK_B",
      "PICK_A",
      "PICK_B",
      "PICK_A",
      "PICK_B"
    ]
  },
  {
    id: "bo3-standard",
    name: "BO3 Standard",
    uniqueMode: "GLOBAL",
    sequence: [
      "BAN_A",
      "BAN_B",
      "PICK_A",
      "PICK_B",
      "PICK_A",
      "PICK_B",
      "PICK_A",
      "PICK_B"
    ]
  }
];

export function getDraftTemplate(id: string): DraftTemplate {
  const template = draftTemplates.find((item) => item.id === id);
  if (!template) {
    throw new Error(`Unknown draft template: ${id}`);
  }
  return template;
}

export function nextDraftAction(
  template: DraftTemplate,
  actions: DraftAction[]
): DraftActionType | null {
  return template.sequence[actions.length] ?? null;
}

export function isDraftComplete(template: DraftTemplate, actions: DraftAction[]): boolean {
  return actions.length >= template.sequence.length;
}

export function listDraftAgents(actions: DraftAction[]): string[] {
  return actions
    .filter((action) => action.type.startsWith("PICK"))
    .map((action) => action.agentId);
}
