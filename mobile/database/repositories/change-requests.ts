import { defineRepository } from "./helpers";
import { ChangeRequest } from "@/types";

export const changeRequestRepo = defineRepository<ChangeRequest & Record<string, unknown>>(
  "change_request",
  {
    requestedBy: "number",
    requesterName: "string",
    requesterEmail: "string",
    type: "string",
    data: "json",
    status: "string",
  },
);

export function listChangeRequests(workspaceId: number) {
  return changeRequestRepo.listForWorkspace<ChangeRequest>(workspaceId);
}
