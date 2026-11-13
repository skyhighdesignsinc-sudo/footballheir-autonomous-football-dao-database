/**
 * Shared frontend types — re-exported from backend bindings + UI-specific extensions.
 * All IDs map to number (Nat32), timestamps to bigint (Nat64).
 */
export type {
  Proposal,
  ProposalId,
  ObjectType,
  ObjectId,
  Attribute,
  AttrId,
  GovernanceSettings,
  UserProfile,
  UserRole,
  APIConsumer,
  APIConsumerV2,
  APIPricePackage,
  APIPkgId,
  APIToken,
  APITokenId,
  Thread,
  ThreadId,
  Post,
  PostId,
  Vote,
  EventLogEntry,
  EventId,
  Template,
  TemplateId,
  DynamicDoc,
  DocId,
  DashboardConfig,
  DashId,
  MethodDefinition,
  MethodId,
  Timestamp,
  TokenAmt,
  UserId,
  Pct,
  ConsumerId,
  APICallRecord,
  APICallTypeBreakdown,
  TimeSeriesBucket,
  RateLimitStatus,
} from "./backend";

export { ProposalStatus, ProposalType } from "./backend";

/** All 33 proposal type keys as string union for type-safe selects */
export type ProposalTypeKey = keyof typeof import("./backend").ProposalType;

/** Proposal filter options for the proposals list view */
export type ProposalFilter =
  | "All"
  | "Voting"
  | "Submitted"
  | "Approved"
  | "Executed"
  | "Rejected"
  | "Disputed"
  | "Finalized"
  | "Simulated";

/** Navigation pages */
export type Page =
  | "home"
  | "proposals"
  | "governance"
  | "forum"
  | "api"
  | "docs";

/** Supported UI locales */
export type Locale = "en" | "es" | "vi";

/** Access level derived from ICFC balance */
export type AccessLevel = "holder" | "readonly";

// ─── Advanced API Dashboard Types ─────────────────────────────────────────────

/** Metadata for a single API key owned by a consumer */
export interface APIKeyMeta {
  id: number;
  consumerId: number;
  name: string;
  apiKey: Uint8Array;
  createdAt: bigint;
  lastUsedAt: bigint;
  isActive: boolean;
}

/** Date range filter used across analytics tabs */
export interface DateRange {
  from: Date;
  to: Date;
}

/** Active tab IDs for the developer portal */
export type DevPortalTab = "overview" | "keys" | "analytics" | "billing";
