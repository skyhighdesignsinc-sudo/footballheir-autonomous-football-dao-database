import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type Timestamp = bigint;
export type EventId = number;
export interface DashboardConfig {
    id: DashId;
    widgets: Array<string>;
    user: UserId;
    layout: string;
}
export type PostId = number;
export type TemplateId = number;
export interface ObjectType {
    id: ObjectId;
    methods: Array<MethodDefinition>;
    name: string;
    createdAt: Timestamp;
    description: string;
    updatedAt: Timestamp;
    attributes: Array<Attribute>;
}
export type DocId = number;
export interface APIConsumer {
    id: ConsumerId;
    principal: UserId;
    createdAt: Timestamp;
    requestsMade: number;
    usageLimit: number;
    apiKey: string;
}
export type Pct = number;
export type MethodId = number;
export interface APICallTypeBreakdown {
    objectTypeId?: ObjectId;
    totalCost: TokenAmt;
    typeName: string;
    callCount: number;
}
export interface Template {
    id: TemplateId;
    content: string;
    name: string;
    description: string;
}
export interface BlobEntry {
    id: BlobId;
    sha256?: Uint8Array;
    name: string;
    mimeType: string;
    totalSize: number;
    isActive: boolean;
    chunkCount: number;
    uploadedAt: Timestamp;
    uploadedBy: Principal;
}
export interface APICallRecord {
    id: bigint;
    status: string;
    objectTypeId?: ObjectId;
    cost: TokenAmt;
    isBatch: boolean;
    apiKey: Uint8Array;
    timestamp: Timestamp;
    consumerId: ConsumerId;
    batchSize: number;
}
export type BackupId = number;
export interface RateLimitStatus {
    windowStart: Timestamp;
    currentWindowCalls: number;
    rateLimit: number;
    windowEndSecs: number;
}
export interface APIPricePackage {
    id: APIPkgId;
    tokenId: APITokenId;
    objectTypeId?: ObjectId;
    name: string;
    batchSizeThreshold: number;
    pricePerCall: TokenAmt;
    isActive: boolean;
    priceBatchCall: TokenAmt;
}
export type APITokenId = number;
export interface Post {
    id: PostId;
    isDeleted: boolean;
    content: string;
    createdAt: Timestamp;
    author: UserId;
    isPinned: boolean;
}
export interface FeedResult {
    fetchedAt: bigint;
    feedId: FeedId;
    bodySnippet: string;
    fullBodyBlobId?: BlobId;
    responseCode: number;
}
export interface Vote {
    votingPower: bigint;
    voter: UserId;
    inFavor: boolean;
    timestamp: Timestamp;
}
export type ObjectId = number;
export interface DynamicDoc {
    id: DocId;
    title: string;
    content: string;
    generatedAt: Timestamp;
}
export interface MethodDefinition {
    id: MethodId;
    code: Uint8Array;
    name: string;
    description: string;
}
export interface APIToken {
    id: APITokenId;
    decimals: number;
    ledgerId: Principal;
    minDeposit: TokenAmt;
    isActive: boolean;
    symbol: string;
}
export type AttrId = number;
export type TokenAmt = bigint;
export interface Thread {
    id: ThreadId;
    title: string;
    isDeleted: boolean;
    createdAt: Timestamp;
    author: UserId;
    posts: Array<Post>;
}
export type BlobId = number;
export type ConsumerId = number;
export interface BackupEntry {
    id: BackupId;
    schemaBlob: Uint8Array;
    triggeredBy: string;
    timestamp: Timestamp;
    objectCount: number;
}
export type FeedId = number;
export type ProposalId = number;
export interface TimeSeriesBucket {
    totalCost: TokenAmt;
    bucketLabel: string;
    bucketStart: Timestamp;
    callCount: number;
}
export interface Proposal {
    id: ProposalId;
    status: ProposalStatus;
    votesAgainst: bigint;
    content: string;
    votesFor: bigint;
    createdAt: Timestamp;
    votingEndsAt: Timestamp;
    voters: Array<Vote>;
    disputeWindowEnd?: Timestamp;
    executionResult?: string;
    simulationResult?: string;
    proposalType: ProposalType;
    updatedAt: Timestamp;
    stake: TokenAmt;
    proposer: UserId;
}
export interface Attribute {
    id: AttrId;
    isRequired: boolean;
    name: string;
    dataType: string;
    defaultValue?: string;
}
export type ThreadId = number;
export type UserId = Principal;
export type DashId = number;
export interface ImportRecord {
    status: string;
    importedAt: bigint;
    importedBy: Principal;
    blobId: BlobId;
    proposalId: ProposalId;
}
export interface FeedConfig {
    id: FeedId;
    url: string;
    maxResponseBytes: number;
    name: string;
    createdBy: Principal;
    apiKeyHeader?: string;
    enabled: boolean;
    pollIntervalSecs: bigint;
    lastFetchStatus: string;
    lastFetchAt: bigint;
    apiKeyValue?: string;
}
export type APIPkgId = number;
export interface APIConsumerV2 {
    id: ConsumerId;
    tokenId: APITokenId;
    balance: TokenAmt;
    batchCallCount: number;
    owner: UserId;
    createdAt: Timestamp;
    isActive: boolean;
    lastCallAt: Timestamp;
    totalSpent: TokenAmt;
    apiKey: Uint8Array;
    callCount: number;
    totalDeposited: TokenAmt;
    rateLimit: number;
}
export interface EventLogEntry {
    id: EventId;
    hash: Uint8Array;
    timestamp: Timestamp;
    details: string;
    previousHash?: Uint8Array;
    eventType: string;
}
export interface UserProfile {
    lastBalanceCheck: Timestamp;
    name: string;
    icfcBalance: TokenAmt;
}
export interface GovernanceSettings {
    disputeReward: Pct;
    autoShardingEnabled: boolean;
    vpAgeWeighting: Pct;
    backupSubnetHint: string;
    minStake: TokenAmt;
    disputeWindow: bigint;
    votingPeriod: bigint;
    defaultRateLimitPerMin: number;
    heartbeatEnabled: boolean;
    heartbeatIntervalSecs: bigint;
    backupIntervalSecs: bigint;
    defaultAPITokenId: APITokenId;
    quorum: Pct;
    autoShardingThresholdGb: number;
}
export enum ProposalStatus {
    Disputed = "Disputed",
    Finalized = "Finalized",
    Approved = "Approved",
    Rejected = "Rejected",
    Executed = "Executed",
    Voting = "Voting",
    Simulated = "Simulated",
    Submitted = "Submitted"
}
export enum ProposalType {
    EditTemplate = "EditTemplate",
    BanUser = "BanUser",
    EditAttribute = "EditAttribute",
    NewForumCanister = "NewForumCanister",
    BackupSchema = "BackupSchema",
    RestoreSchema = "RestoreSchema",
    ImportSeasonData = "ImportSeasonData",
    UpdateCSS = "UpdateCSS",
    EditDashboard = "EditDashboard",
    UpdateFrontend = "UpdateFrontend",
    DeleteMethod = "DeleteMethod",
    DeleteAPIPrice = "DeleteAPIPrice",
    NewAPIPrice = "NewAPIPrice",
    DisputeProposal = "DisputeProposal",
    AdjustRateLimit = "AdjustRateLimit",
    DeleteDynamicDoc = "DeleteDynamicDoc",
    ConfigureRealTimeFeeds = "ConfigureRealTimeFeeds",
    NewMethod = "NewMethod",
    ChangeGovernance = "ChangeGovernance",
    NewDataCanister = "NewDataCanister",
    SetInitialData = "SetInitialData",
    UpdateCanister = "UpdateCanister",
    EditDynamicDoc = "EditDynamicDoc",
    NewDynamicDoc = "NewDynamicDoc",
    PinPost = "PinPost",
    BatchOp = "BatchOp",
    UpdateMotoko = "UpdateMotoko",
    EditAPIPrice = "EditAPIPrice",
    DeletePost = "DeletePost",
    DeleteAttribute = "DeleteAttribute",
    DeleteDashboard = "DeleteDashboard",
    DeleteTemplate = "DeleteTemplate",
    NewTemplate = "NewTemplate",
    DeleteThread = "DeleteThread",
    DeleteObjectType = "DeleteObjectType",
    EditMethod = "EditMethod",
    EditObjectType = "EditObjectType",
    NewObjectType = "NewObjectType",
    NewAttribute = "NewAttribute",
    UnbanUser = "UnbanUser",
    TreasuryAction = "TreasuryAction",
    SimulateProposal = "SimulateProposal",
    NewDashboard = "NewDashboard",
    UpdateHTML = "UpdateHTML"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    /**
     * / Admin: register a new supported payment token.
     */
    addAPIToken(ledgerId: Principal, symbol: string, decimals: number, minDeposit: TokenAmt): Promise<APITokenId>;
    addPost(threadId: ThreadId, content: string): Promise<PostId>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    banUser(user: Principal): Promise<void>;
    /**
     * / Burn stake after dispute window closes on a rejected proposal.
     */
    burnStake(proposalId: ProposalId): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createThread(title: string, content: string): Promise<ThreadId>;
    /**
     * / Deduct the cost of an API call from consumer balance.
     * / Called internally before serving paid data queries.
     */
    deductAPICall(apiKey: Uint8Array, objectTypeId: ObjectId | null, isBatch: boolean, batchSize: number): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deletePost(threadId: ThreadId, postId: PostId): Promise<void>;
    deleteThread(threadId: ThreadId): Promise<void>;
    /**
     * / Deposit balance from caller's ICRC-1 account to their API consumer balance.
     * / Caller must have previously approved the canister on the ledger, or this does
     * / a pull via icrc1_transfer from caller subaccount.
     */
    depositAPIBalance(apiKey: Uint8Array, amount: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    /**
     * / Dispute an executed proposal within its dispute window.
     * / If disputeReward > 0%, pays reward % of stake from canister treasury to challenger.
     */
    disputeProposal(proposalId: ProposalId, _reason: string): Promise<void>;
    /**
     * / Execute a proposal. Auto-returns stake on pass. Sets dispute window on both outcomes.
     */
    executeProposal(proposalId: ProposalId): Promise<void>;
    /**
     * / Finalize a blob upload. Marks isActive = true after verifying all chunks uploaded.
     */
    finalizeBlob(blobId: BlobId, sha256: Uint8Array | null): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAPICallBreakdown(fromTs: bigint, toTs: bigint): Promise<{
        __kind__: "ok";
        ok: Array<APICallTypeBreakdown>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAPICallHistory(apiKey: Uint8Array, fromTs: bigint, toTs: bigint, page: number): Promise<{
        __kind__: "ok";
        ok: Array<APICallRecord>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAPIConsumer(): Promise<APIConsumer | null>;
    /**
     * / Look up a consumer by their API key (32-byte Blob).
     */
    getAPIConsumerByKey(apiKey: Uint8Array): Promise<APIConsumerV2 | null>;
    /**
     * / Look up the caller's own consumer record.
     */
    getAPIConsumerByPrincipal(): Promise<APIConsumerV2 | null>;
    getAPIConsumers(): Promise<Array<APIConsumer>>;
    /**
     * / List all active price packages.
     */
    getAPIPricePackages(): Promise<Array<APIPricePackage>>;
    getAPIRateLimitStatus(apiKey: Uint8Array): Promise<{
        __kind__: "ok";
        ok: RateLimitStatus;
    } | {
        __kind__: "err";
        err: string;
    }>;
    /**
     * / List all configured payment tokens.
     */
    getAPITokens(): Promise<Array<APIToken>>;
    /**
     * / List all active frontend asset mappings as [(path, blobId)].
     */
    getActiveFrontendAssets(): Promise<Array<[string, BlobId]>>;
    /**
     * / Look up the BlobEntry for a given active frontend path.
     */
    getActiveFrontendBlob(path: string): Promise<BlobEntry | null>;
    /**
     * / List all blob entries (active and inactive).
     */
    getAllBlobEntries(): Promise<Array<BlobEntry>>;
    getAllConsumerKeys(): Promise<Array<APIConsumerV2>>;
    getAllObjectTypes(): Promise<Array<ObjectType>>;
    getAllProposals(): Promise<Array<Proposal>>;
    getAllThreads(): Promise<Array<Thread>>;
    /**
     * / Get a specific backup entry including the schema blob.
     */
    getBackup(id: BackupId): Promise<BackupEntry | null>;
    /**
     * / List all backup entries (metadata only, no blob data).
     */
    getBackups(): Promise<Array<{
        id: BackupId;
        triggeredBy: string;
        timestamp: bigint;
        objectCount: number;
    }>>;
    /**
     * / Retrieve a specific chunk by blobId + chunkIndex (0-based).
     */
    getBlobChunk(blobId: BlobId, chunkIndex: number): Promise<Uint8Array | null>;
    /**
     * / Get blob metadata by id.
     */
    getBlobEntry(id: BlobId): Promise<BlobEntry | null>;
    getCallTimeSeries(fromTs: bigint, toTs: bigint, granularity: string): Promise<{
        __kind__: "ok";
        ok: Array<TimeSeriesBucket>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    /**
     * / Returns the caller's live ICFC ledger balance (convenience for frontend).
     */
    getCallerICFCBalance(): Promise<bigint>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getDashboardConfig(): Promise<DashboardConfig | null>;
    getDashboardConfigs(): Promise<Array<DashboardConfig>>;
    getDynamicDocs(): Promise<Array<DynamicDoc>>;
    getEventLog(): Promise<Array<EventLogEntry>>;
    /**
     * / Get a single feed configuration.
     */
    getFeedConfig(id: FeedId): Promise<FeedConfig | null>;
    /**
     * / List all configured feed sources.
     */
    getFeedConfigs(): Promise<Array<FeedConfig>>;
    /**
     * / Get all stored fetch results for a feed (up to last 10).
     */
    getFeedResults(feedId: FeedId): Promise<Array<FeedResult>>;
    getGovernanceSettings(): Promise<GovernanceSettings>;
    /**
     * / Reassemble all chunks in order and return body + mimeType for HTTP serving.
     * / Returns null if path not active, blob missing, or not finalized.
     */
    getHTTPAsset(path: string): Promise<{
        body: Uint8Array;
        mimeType: string;
    } | null>;
    /**
     * / Query current heartbeat and system health status.
     */
    getHeartbeatStatus(): Promise<{
        heapSizeMb: number;
        enabled: boolean;
        lastBackupAt: bigint;
        nextRun: bigint;
        lastRun: bigint;
    }>;
    /**
     * / Query the live ICFC ledger balance for any principal.
     */
    getICFCBalance(principal: Principal): Promise<bigint>;
    /**
     * / List all season import records.
     */
    getImportHistory(): Promise<Array<ImportRecord>>;
    /**
     * / Get the most recent fetch result for a feed.
     */
    getLatestFeedResult(feedId: FeedId): Promise<FeedResult | null>;
    getObjectType(id: ObjectId): Promise<ObjectType | null>;
    getProposal(id: ProposalId): Promise<Proposal | null>;
    getTemplates(): Promise<Array<Template>>;
    getThread(id: ThreadId): Promise<Thread | null>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    /**
     * / Initiate a chunked blob upload. Returns a BlobId.
     * / Requires >= 1 ICFC. Creates an inactive BlobEntry.
     */
    initBlobUpload(name: string, mimeType: string, totalSize: number, chunkCount: number): Promise<{
        __kind__: "ok";
        ok: BlobId;
    } | {
        __kind__: "err";
        err: string;
    }>;
    initializeAccessControl(): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    isUserBanned(user: Principal): Promise<boolean>;
    /**
     * / Admin-only: manually trigger a feed fetch for testing.
     */
    manualFetchFeed(feedId: FeedId): Promise<{
        __kind__: "ok";
        ok: FeedResult;
    } | {
        __kind__: "err";
        err: string;
    }>;
    pinPost(threadId: ThreadId, postId: PostId): Promise<void>;
    registerAPIConsumer(apiKey: string, usageLimit: number): Promise<ConsumerId>;
    /**
     * / Register a new API key with the chosen payment token.
     */
    registerAPIKey(tokenId: APITokenId): Promise<{
        __kind__: "ok";
        ok: Uint8Array;
    } | {
        __kind__: "err";
        err: string;
    }>;
    renameAPIKey(apiKey: Uint8Array, newName: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    /**
     * / Admin: reset shard-proposal-pending flag after a sharding proposal resolves.
     */
    resetShardProposalPending(): Promise<void>;
    /**
     * / Admin: log a rollback intent from a backup. Full schema re-application
     * / requires a #RestoreSchema DAO proposal for auditability.
     */
    restoreFromBackup(backupId: BackupId): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    /**
     * / Return stake from canister to the proposer of a passed proposal.
     */
    returnStake(proposalId: ProposalId): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    revokeAPIKey(apiKey: Uint8Array): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    rotateAPIKey(apiKey: Uint8Array): Promise<{
        __kind__: "ok";
        ok: Uint8Array;
    } | {
        __kind__: "err";
        err: string;
    }>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    saveDashboardConfig(layout: string, widgets: Array<string>): Promise<void>;
    /**
     * / Admin: toggle heartbeat on/off and restart the timer immediately.
     */
    setHeartbeatEnabled(enabled: boolean): Promise<void>;
    simulateProposal(proposalId: ProposalId): Promise<string>;
    /**
     * / Submit a proposal. Requires >= 1 ICFC on ledger and stake >= minStake.
     * / Frontend must pre-transfer `stake` e8s to the canister principal before calling.
     */
    submitProposal(proposalType: ProposalType, stake: TokenAmt, content: string): Promise<ProposalId>;
    /**
     * / Public heartbeat trigger (admin only — normally called by heartbeat timer).
     */
    triggerFeedPoll(): Promise<void>;
    /**
     * / Admin: trigger a manual backup immediately.
     */
    triggerManualBackup(): Promise<BackupId>;
    unbanUser(user: Principal): Promise<void>;
    /**
     * / Admin: mark an import record's status (e.g. "ok" or "error: <msg>").
     */
    updateImportStatus(importId: number, status: string): Promise<void>;
    /**
     * / Upload a single chunk. chunkIndex is 0-based.
     */
    uploadBlobChunk(blobId: BlobId, chunkIndex: number, data: Uint8Array): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    /**
     * / Vote on a proposal. Voting power = real-time ICFC ledger balance (e8s).
     * / Caller must hold >= 1 e8 to vote.
     */
    voteOnProposal(proposalId: ProposalId, inFavor: boolean): Promise<void>;
}
