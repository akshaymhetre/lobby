/**
 * Helpdesk domain API. Contract functions (docs/architecture.md):
 *   createTicket(ctx, { requestTypeSlug, subject, description?, fields?, priority?, source?, onBehalfOfUserId? })
 *   listMyTickets(ctx, { open?, limit? })
 *   installStarterCatalog()
 */
export { createTicket, listMyTickets } from "./tickets";
export { installStarterCatalog } from "./admin";

export {
  addComment,
  assignableAgents,
  assignTickets,
  cannedRepliesFor,
  displayFieldValues,
  getTicketDetail,
  listPickableApps,
  listQueue,
  searchPeople,
  setPriority,
  setStatus,
  STATUS_LABEL,
  ticketSlaState,
  type CreateTicketInput,
  type Priority,
  type QueueItem,
  type QueueResult,
  type QueueSort,
  type QueueView,
  type TicketDetail,
  type TicketListItem,
  type TicketStatus,
  type TimelineEvent,
} from "./tickets";
export {
  APPROVAL_LINK_TTL_DAYS,
  canDecide,
  countMyPendingApprovals,
  decideApproval,
  findApprovalByToken,
  listMyApprovals,
  type ApprovalListItem,
} from "./approvals";
export {
  deleteCalendar,
  deleteCannedReply,
  deleteConnector,
  deleteRequestType,
  deleteSlaPolicy,
  deleteTeam,
  loadHelpdeskAdmin,
  publicConfig,
  saveCalendar,
  saveCannedReply,
  saveConnector,
  saveRequestType,
  saveSlaPolicy,
  saveTeam,
  type HelpdeskAdminData,
} from "./admin";
export {
  applyExternalStatus,
  CONNECTOR_SECRET_KEYS,
  findLinkByExternalKey,
  getConnectorLink,
  mapExternalStatus,
  recordConnectorEvent,
  ticketEventById,
  ticketForPush,
  upsertConnectorLink,
} from "./connector-sync";
export { runSlaCheck } from "./sla-check";
export { HelpdeskError, canWorkTeam, pickRoundRobin } from "./internal";
export { indexRequestType, indexTicket, reindexRequestTypes, reindexTickets } from "./index-source";
export * from "./sla";
export * from "./fields";
export { STARTER_REQUEST_TYPES, STARTER_SLA_POLICIES, STARTER_TEAMS } from "./catalog-data";
