import Principal "mo:core/Principal";
import Time "mo:core/Time";

module {
  // ── Shared primitive aliases ────────────────────────────────────────────────
  public type UserId     = Principal;
  public type Timestamp  = Time.Time;   // Int (nanoseconds)
  public type TokenAmt   = Nat64;       // ICFC / ICP amounts (e8s)
  public type ProposalId = Nat32;
  public type ObjectId   = Nat32;
  public type AttrId     = Nat32;
  public type MethodId   = Nat32;
  public type EventId    = Nat32;
  public type TemplateId = Nat32;
  public type DashId     = Nat32;
  public type DocId      = Nat32;
  public type ConsumerId = Nat32;
  public type ThreadId   = Nat32;
  public type PostId     = Nat32;
  public type Pct        = Nat8;        // 0-100 percent

  // ── Access control ──────────────────────────────────────────────────────────
  public type UserRole = { #admin; #user; #guest };

  // ── User profile ────────────────────────────────────────────────────────────
  public type UserProfile = {
    name             : Text;
    icfcBalance      : TokenAmt;
    lastBalanceCheck : Timestamp;
  };

  // ── Governance proposals ────────────────────────────────────────────────────
  public type ProposalType = {
    #NewObjectType;
    #EditObjectType;
    #DeleteObjectType;
    #NewAttribute;
    #EditAttribute;
    #DeleteAttribute;
    #NewMethod;
    #EditMethod;
    #DeleteMethod;
    #UpdateFrontend;
    #UpdateCSS;
    #UpdateHTML;
    #UpdateMotoko;
    #UpdateCanister;
    #ChangeGovernance;
    #TreasuryAction;
    #BatchOp;
    #NewTemplate;
    #EditTemplate;
    #DeleteTemplate;
    #NewDashboard;
    #EditDashboard;
    #DeleteDashboard;
    #NewDynamicDoc;
    #EditDynamicDoc;
    #DeleteDynamicDoc;
    #ConfigureRealTimeFeeds;
    #SetInitialData;
    #ImportSeasonData;
    #SimulateProposal;
    #BackupSchema;
    #RestoreSchema;
    #AdjustRateLimit;
    #NewAPIPrice;
    #EditAPIPrice;
    #DeleteAPIPrice;
    #NewDataCanister;
    #NewForumCanister;
    #BanUser;
    #UnbanUser;
    #DisputeProposal;
    #DeletePost;
    #DeleteThread;
    #PinPost;
  };

  public type ProposalStatus = {
    #Submitted;
    #Simulated;
    #Voting;
    #Approved;
    #Rejected;
    #Executed;
    #Disputed;
    #Finalized;
  };

  public type Vote = {
    voter       : UserId;
    votingPower : Nat64;
    inFavor     : Bool;
    timestamp   : Timestamp;
  };

  public type Proposal = {
    id               : ProposalId;
    proposer         : UserId;
    proposalType     : ProposalType;
    status           : ProposalStatus;
    stake            : TokenAmt;
    createdAt        : Timestamp;
    updatedAt        : Timestamp;
    votesFor         : Nat64;
    votesAgainst     : Nat64;
    voters           : [Vote];
    content          : Text;
    simulationResult : ?Text;
    executionResult  : ?Text;
    disputeWindowEnd : ?Timestamp;
    votingEndsAt     : Timestamp;
  };

  // ── Governance settings ─────────────────────────────────────────────────────
  public type GovernanceSettings = {
    quorum                  : Pct;      // 0-100 %
    minStake                : TokenAmt; // minimum ICFC stake (e8s)
    votingPeriod            : Nat64;    // nanoseconds
    disputeWindow           : Nat64;    // nanoseconds
    disputeReward           : Pct;      // 0-20 % from treasury
    vpAgeWeighting          : Pct;      // 0-5 %
    autoShardingThresholdGb : Nat32;    // GiB before sharding
    backupSubnetHint        : Text;
    defaultRateLimitPerMin  : Nat32;    // default API calls/min per consumer
    defaultAPITokenId       : APITokenId; // default payment token index
    // Heartbeat automation (all DAO-configurable via #ChangeGovernance)
    heartbeatEnabled        : Bool;     // toggle heartbeat on/off
    heartbeatIntervalSecs   : Nat64;    // seconds between ticks (default 3600)
    backupIntervalSecs      : Nat64;    // seconds between backups (default 604800 = 7 days)
    autoShardingEnabled     : Bool;     // auto-propose sharding when heap exceeds threshold
  };

  // ── Backups ─────────────────────────────────────────────────────────────────
  public type BackupId = Nat32;

  public type BackupEntry = {
    id          : BackupId;
    timestamp   : Timestamp;
    schemaBlob  : Blob;        // serialized ObjectTypes + GovernanceSettings snapshot
    triggeredBy : Text;        // "heartbeat" | "manual" | "proposal"
    objectCount : Nat32;       // number of ObjectTypes snapshotted
  };

  // ── Schema types ────────────────────────────────────────────────────────────
  public type Attribute = {
    id           : AttrId;
    name         : Text;
    dataType     : Text;
    isRequired   : Bool;
    defaultValue : ?Text;
  };

  public type MethodDefinition = {
    id          : MethodId;
    name        : Text;
    description : Text;
    code        : Blob;
  };

  public type ObjectType = {
    id          : ObjectId;
    name        : Text;
    description : Text;
    createdAt   : Timestamp;
    updatedAt   : Timestamp;
    attributes  : [Attribute];
    methods     : [MethodDefinition];
  };

  // ── Event log ───────────────────────────────────────────────────────────────
  public type EventLogEntry = {
    id           : EventId;
    timestamp    : Timestamp;
    eventType    : Text;
    details      : Text;
    previousHash : ?Blob;
    hash         : Blob;
  };

  // ── Templates ───────────────────────────────────────────────────────────────
  public type Template = {
    id          : TemplateId;
    name        : Text;
    description : Text;
    content     : Text;
  };

  // ── Dashboards ──────────────────────────────────────────────────────────────
  public type DashboardConfig = {
    id      : DashId;
    user    : UserId;
    layout  : Text;
    widgets : [Text];
  };

  // ── Dynamic docs ────────────────────────────────────────────────────────────
  public type DynamicDoc = {
    id          : DocId;
    title       : Text;
    content     : Text;
    generatedAt : Timestamp;
  };

  // ── API monetization ────────────────────────────────────────────────────────
  public type APITokenId   = Nat8;
  public type APIPkgId     = Nat8;

  /// A DAO-approved payment token (ICRC-1 ledger)
  public type APIToken = {
    id         : APITokenId;
    ledgerId   : Principal;   // ICRC-1 ledger canister
    symbol     : Text;        // "ICFC", "ICP", "USDC"
    decimals   : Nat8;        // 8 for ICP/ICFC
    minDeposit : TokenAmt;    // minimum top-up (e8s)
    isActive   : Bool;
  };

  /// Per-call price package, optionally scoped to an ObjectType
  public type APIPricePackage = {
    id                 : APIPkgId;
    name               : Text;
    tokenId            : APITokenId;   // which APIToken to charge
    objectTypeId       : ?ObjectId;    // null = default for all types
    pricePerCall       : TokenAmt;     // e8s per single call
    priceBatchCall     : TokenAmt;     // e8s per batch call (cheaper)
    batchSizeThreshold : Nat8;         // min items to qualify for batch price
    isActive           : Bool;
  };

  /// Rate-limit window entry: tracks per-minute call timestamps
  public type RateLimitEntry = {
    windowStart : Timestamp;
    callCount   : Nat32;
  };

  /// Pay-as-you-go API consumer account
  public type APIConsumerV2 = {
    id             : ConsumerId;
    owner          : UserId;
    apiKey         : Blob;        // 32-byte random key
    tokenId        : APITokenId;  // which token they pay with
    balance        : TokenAmt;    // prepaid balance (e8s)
    totalDeposited : TokenAmt;
    totalSpent     : TokenAmt;
    callCount      : Nat32;
    batchCallCount : Nat32;
    createdAt      : Timestamp;
    lastCallAt     : Timestamp;
    isActive       : Bool;
    rateLimit      : Nat32;       // calls per minute; 0 = use governance default
  };

  // ── Legacy API consumers (kept for backward compat) ─────────────────────────
  public type APIConsumer = {
    id           : ConsumerId;
    principal    : UserId;
    apiKey       : Text;
    usageLimit   : Nat32;
    requestsMade : Nat32;
    createdAt    : Timestamp;
  };

  // ── Blob pipeline ───────────────────────────────────────────────────────────
  public type BlobId = Nat32;

  /// Metadata for an uploaded blob (no binary data here — stored in blobChunks).
  public type BlobEntry = {
    id          : BlobId;
    name        : Text;        // path / module name, e.g. "index.js", "Player"
    mimeType    : Text;        // "text/javascript" | "text/css" | "text/html" | "application/wasm" | "text/x-motoko"
    totalSize   : Nat32;       // total bytes across all chunks
    chunkCount  : Nat32;       // expected number of chunks
    uploadedAt  : Timestamp;
    uploadedBy  : Principal;
    isActive    : Bool;        // true once finalizeBlob succeeds
    sha256      : ?Blob;       // optional caller-supplied content hash
  };

  // ── Forum ───────────────────────────────────────────────────────────────────
  public type Post = {
    id        : PostId;
    author    : UserId;
    content   : Text;
    createdAt : Timestamp;
    isPinned  : Bool;
    isDeleted : Bool;
  };

  public type Thread = {
    id        : ThreadId;
    title     : Text;
    author    : UserId;
    createdAt : Timestamp;
    isDeleted : Bool;
    posts     : [Post];
  };

  // ── HTTP Feed types ─────────────────────────────────────────────────────────
  public type FeedId = Nat32;

  /// DAO-configured real-time data feed source
  public type FeedConfig = {
    id               : FeedId;
    name             : Text;         // "API-Football", "Opta", "ESPN", custom
    url              : Text;         // full endpoint URL (DAO-configurable)
    apiKeyHeader     : ?Text;        // header name for API key e.g. "X-RapidAPI-Key"
    apiKeyValue      : ?Text;        // the key value (DAO sets via proposal)
    pollIntervalSecs : Nat64;        // how often to fetch (min 300 = 5 min)
    enabled          : Bool;
    maxResponseBytes : Nat32;        // safety limit; default 500_000
    lastFetchAt      : Nat64;        // Unix seconds (0 = never fetched)
    lastFetchStatus  : Text;         // "ok" | "error: <msg>" | "never"
    createdBy        : Principal;
  };

  /// Result of a single HTTP fetch of a feed
  public type FeedResult = {
    feedId         : FeedId;
    fetchedAt      : Nat64;          // Unix seconds
    responseCode   : Nat16;
    bodySnippet    : Text;           // first 500 chars of response body
    fullBodyBlobId : ?BlobId;        // optional: blobId of full body if stored
  };

  // ── Season import history ─────────────────────────────────────────────────
  public type ImportRecord = {
    proposalId : ProposalId;
    blobId     : BlobId;
    importedAt : Nat64;              // Unix seconds
    importedBy : Principal;
    status     : Text;               // "pending" | "ok" | "error: <msg>"
  };
};
