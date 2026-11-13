import Types "Types";
import ClientPanelTypes "types/api-client-panel";
import ClientPanelLib "lib/api-client-panel";
import ClientPanelMixin "mixins/api-client-panel-api";

import Ledger "Ledger";
import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Nat "mo:core/Nat";
import Nat8 "mo:core/Nat8";
import Nat16 "mo:core/Nat16";
import Nat32 "mo:core/Nat32";
import Nat64 "mo:core/Nat64";
import Blob "mo:core/Blob";
import Int "mo:core/Int";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Timer "mo:base/Timer";
import Prim "mo:⛔";




actor FootballHEIR {
  // ── ICFC Token Ledger ────────────────────────────────────────────────────────
  let ICFC_LEDGER_CANISTER : Text = "ddsp7-7iaaa-aaaaq-aacqq-cai";

  // Burn account: IC management canister (aaaaa-aa) is the burn sink.
  let BURN_ACCOUNT : Ledger.Account = {
    owner      = Principal.fromText("aaaaa-aa");
    subaccount = null;
  };

  // ── Access control state ─────────────────────────────────────────────────────
  var adminAssigned : Bool = false;
  let adminRoles    : Map.Map<Principal, Types.UserRole> = Map.empty();

  // ── Core storage ─────────────────────────────────────────────────────────────
  var userProfiles     : Map.Map<Principal, Types.UserProfile>       = Map.empty();
  var proposals        : Map.Map<Types.ProposalId, Types.Proposal>   = Map.empty();
  var objectTypes      : Map.Map<Types.ObjectId, Types.ObjectType>   = Map.empty();
  var eventLog         : Map.Map<Types.EventId, Types.EventLogEntry> = Map.empty();
  var templates        : Map.Map<Types.TemplateId, Types.Template>   = Map.empty();
  var dashboardConfigs : Map.Map<Types.DashId, Types.DashboardConfig> = Map.empty();
  var dynamicDocs      : Map.Map<Types.DocId, Types.DynamicDoc>      = Map.empty();
  var apiConsumers     : Map.Map<Types.ConsumerId, Types.APIConsumer>    = Map.empty();
  var threads          : Map.Map<Types.ThreadId, Types.Thread>           = Map.empty();
  var bannedUsers      : Map.Map<Principal, Bool>                        = Map.empty();

  // ── API monetization storage ──────────────────────────────────────────────────
  var apiTokens        : Map.Map<Types.APITokenId,  Types.APIToken>         = Map.empty();
  var apiPricePackages : Map.Map<Types.APIPkgId,    Types.APIPricePackage>  = Map.empty();
  var apiConsumersV2   : Map.Map<Types.ConsumerId,  Types.APIConsumerV2>    = Map.empty();
  var apiKeyIndex      : Map.Map<Blob, Types.ConsumerId>                    = Map.empty();
  var apiRateLimits    : Map.Map<Types.ConsumerId,  Types.RateLimitEntry>   = Map.empty();

  // ── Client panel state ────────────────────────────────────────────────────────
  // Per-key metadata: sequential metaId -> APIKeyMeta (name, createdAt, lastUsedAt, isActive)
  var apiKeyNames      : Map.Map<Nat32, ClientPanelTypes.APIKeyMeta>        = Map.empty();
  // Append-only call log: callId -> APICallRecord
  var apiCallLog       : Map.Map<Nat64, ClientPanelTypes.APICallRecord>     = Map.empty();
  // Monotonic counter for call log IDs
  var nextCallLogId    : Nat64 = 0;

  // ── Blob pipeline storage ─────────────────────────────────────────────────────
  // BlobEntry metadata: blobId -> BlobEntry
  var blobStore             : Map.Map<Types.BlobId, Types.BlobEntry>             = Map.empty();
  // Chunk data: blobId -> (chunkIndex -> chunk bytes)
  var blobChunks            : Map.Map<Types.BlobId, Map.Map<Nat32, Blob>>        = Map.empty();
  // Active frontend assets: path -> blobId
  var activeFrontendAssets  : Map.Map<Text, Types.BlobId>                        = Map.empty();
  // Active Motoko source references: module name -> blobId
  var activeMotokoSource    : Map.Map<Text, Types.BlobId>                        = Map.empty();

  // ── HTTP Feed storage ─────────────────────────────────────────────────────────
  var feedConfigs   : Map.Map<Types.FeedId, Types.FeedConfig>           = Map.empty();
  // feedResults stores a capped list (max 10) of recent fetch results per feed
  var feedResults   : Map.Map<Types.FeedId, List.List<Types.FeedResult>> = Map.empty();
  // Season import history: sequential key (Nat32) -> ImportRecord
  var importHistory : Map.Map<Nat32, Types.ImportRecord>                = Map.empty();

  var governanceSettings : Types.GovernanceSettings = {
    quorum                  = 0 : Nat8;
    minStake                = 1_000_000_000 : Nat64; // 10 ICFC in e8s
    votingPeriod            = 604_800_000_000_000 : Nat64; // 7 days ns
    disputeWindow           = 86_400_000_000_000  : Nat64; // 24 h ns
    disputeReward           = 0 : Nat8;
    vpAgeWeighting          = 0 : Nat8;
    autoShardingThresholdGb = 400 : Nat32;
    backupSubnetHint        = "";
    defaultRateLimitPerMin  = 10 : Nat32;
    defaultAPITokenId       = 0 : Nat8;
    // Heartbeat defaults
    heartbeatEnabled        = true;
    heartbeatIntervalSecs   = 3_600 : Nat64;    // 1 hour
    backupIntervalSecs      = 604_800 : Nat64;  // 7 days
    autoShardingEnabled     = true;
  };

  // ── Heartbeat state ───────────────────────────────────────────────────────────
  var heartbeatTimerId      : ?Timer.TimerId = null;
  var lastHeartbeatAt       : Nat64          = 0;
  var lastBackupAt          : Nat64          = 0;
  var lastShardCheckAt      : Nat64          = 0;
  var shardProposalPending  : Bool           = false;
  var nextBackupId          : Types.BackupId = 1;
  let backupStore           : Map.Map<Types.BackupId, Types.BackupEntry> = Map.empty();

  // ── Internal helpers ─────────────────────────────────────────────────────────

  func isAdmin(p : Principal) : Bool {
    if (not adminAssigned) return false;
    switch (adminRoles.get(p)) {
      case (?(#admin)) true;
      case _           false;
    };
  };

  func requireAdmin(caller : Principal) {
    if (not isAdmin(caller)) Runtime.trap("Unauthorized: Admin required");
  };

  func requireAuth(caller : Principal) {
    if (caller.isAnonymous()) Runtime.trap("Unauthorized: Authentication required");
  };

  func nextEventId() : Types.EventId {
    Nat32.fromNat(eventLog.size() + 1)
  };

  /// XOR-based minimal hash for event log chain ordering.
  /// Produces an 8-byte Blob: XOR of previous hash bytes (zero-padded) with
  /// the little-endian bytes of (id XOR timestamp low bits).
  func computeHash(prevHash : ?Blob, id : Types.EventId, timestamp : Int) : Blob {
    // Extract up to 8 bytes from previous hash (zero-padded)
    let prevArr : [Nat8] = switch (prevHash) {
      case null    [0,0,0,0,0,0,0,0];
      case (?blob) {
        let arr = blob.toArray();
        let n = arr.size();
        [
          if (n > 0) arr[0] else 0 : Nat8,
          if (n > 1) arr[1] else 0 : Nat8,
          if (n > 2) arr[2] else 0 : Nat8,
          if (n > 3) arr[3] else 0 : Nat8,
          if (n > 4) arr[4] else 0 : Nat8,
          if (n > 5) arr[5] else 0 : Nat8,
          if (n > 6) arr[6] else 0 : Nat8,
          if (n > 7) arr[7] else 0 : Nat8,
        ]
      };
    };
    // Combine id and low bits of timestamp into a single Nat64
    let tsNat : Nat64 = Nat64.fromNat(Int.abs(timestamp) % 0xFFFF_FFFF_FFFF_FFFF);
    let idNat : Nat64 = Nat64.fromNat(id.toNat());
    let mixed : Nat64 = tsNat ^ idNat;
    // Extract 8 bytes (little-endian) using dot notation
    let m0 : Nat8 = Nat8.fromNat((mixed            % 256).toNat());
    let m1 : Nat8 = Nat8.fromNat(((mixed / 256)    % 256).toNat());
    let m2 : Nat8 = Nat8.fromNat(((mixed / 65536)  % 256).toNat());
    let m3 : Nat8 = Nat8.fromNat(((mixed / 16777216) % 256).toNat());
    let m4 : Nat8 = Nat8.fromNat(((mixed / 4294967296) % 256).toNat());
    let m5 : Nat8 = Nat8.fromNat(((mixed / 1099511627776) % 256).toNat());
    let m6 : Nat8 = Nat8.fromNat(((mixed / 281474976710656) % 256).toNat());
    let m7 : Nat8 = Nat8.fromNat(((mixed / 72057594037927936) % 256).toNat());
    // XOR each byte with corresponding previous-hash byte
    Blob.fromArray([
      prevArr[0] ^ m0,
      prevArr[1] ^ m1,
      prevArr[2] ^ m2,
      prevArr[3] ^ m3,
      prevArr[4] ^ m4,
      prevArr[5] ^ m5,
      prevArr[6] ^ m6,
      prevArr[7] ^ m7,
    ]);
  };

  /// Append an entry to the immutable event log with a verifiable XOR hash chain.
  func appendEvent(eventType : Text, details : Text) {
    let id      = nextEventId();
    let now     = Time.now();
    let prevHash : ?Blob = switch (eventLog.get(Nat32.fromNat(eventLog.size()))) {
      case (?e) ?e.hash;
      case null  null;
    };
    let hash : Blob = computeHash(prevHash, id, now);
    eventLog.add(id, {
      id;
      timestamp    = now;
      eventType;
      details;
      previousHash = prevHash;
      hash;
    });
  };

  /// Query the ICFC ledger balance for an account. Returns 0 on any error.
  func queryICFCBalance(account : Ledger.Account) : async Nat64 {
    try {
      let bal = await Ledger.ledger().icrc1_balance_of(account);
      Nat64.fromNat(bal);
    } catch (_) {
      0;
    };
  };

  /// Require caller holds >= minTokens ICFC e8s on the live ledger.
  func requireICFCBalance(caller : Principal, minTokens : Nat64) : async () {
    requireAuth(caller);
    let account : Ledger.Account = { owner = caller; subaccount = null };
    let bal = await queryICFCBalance(account);
    if (bal < minTokens) {
      Runtime.trap("Insufficient ICFC balance. Required: " # minTokens.toText() # " e8s, have: " # bal.toText() # " e8s");
    };
  };

  /// Transfer `amount` e8s from the canister's own account to `to` via ICRC-1.
  func transferFromCanister(to : Ledger.Account, amount : Nat64) : async { #ok : Nat; #err : Text } {
    let arg : Ledger.TransferArg = {
      from_subaccount = null;
      to;
      amount          = amount.toNat();
      fee             = null;
      memo            = null;
      created_at_time = null;
    };
    try {
      let result = await Ledger.ledger().icrc1_transfer(arg);
      switch result {
        case (#Ok(blockIdx)) { #ok(blockIdx) };
        case (#Err(e)) {
          let msg = switch e {
            case (#InsufficientFunds { balance }) "InsufficientFunds: " # Nat64.fromNat(balance).toText() # " e8s";
            case (#BadFee { expected_fee })       "BadFee: expected " # Nat64.fromNat(expected_fee).toText();
            case (#TemporarilyUnavailable)        "TemporarilyUnavailable";
            case (#TooOld)                        "TooOld";
            case (#CreatedInFuture { ledger_time = _ }) "CreatedInFuture";
            case (#Duplicate { duplicate_of = _ })      "Duplicate";
            case (#BadBurn { min_burn_amount })          "BadBurn: min " # Nat64.fromNat(min_burn_amount).toText();
            case (#GenericError { message; error_code = _ }) message;
          };
          #err(msg);
        };
      };
    } catch (_) {
      #err("Ledger unreachable");
    };
  };

  func nextProposalId() : Types.ProposalId = Nat32.fromNat(proposals.size() + 1);
  func nextConsumerId() : Types.ConsumerId = Nat32.fromNat(apiConsumers.size() + 1);
  func nextConsumerV2Id() : Types.ConsumerId = Nat32.fromNat(apiConsumersV2.size() + 1);
  func nextDashId()     : Types.DashId     = Nat32.fromNat(dashboardConfigs.size() + 1);
  func nextThreadId()   : Types.ThreadId   = Nat32.fromNat(threads.size() + 1);
  func nextPkgId()      : Types.APIPkgId   = Nat8.fromNat(apiPricePackages.size() + 1);
  func nextTokenId()    : Types.APITokenId = Nat8.fromNat(apiTokens.size());
  func nextBlobId()     : Types.BlobId     = Nat32.fromNat(blobStore.size() + 1);

  /// Build a deterministic API key from principal text + consumer ID + timestamp.
  /// Encoded as UTF-8 bytes of a composite string, trimmed/padded to 32 bytes.
  func makeApiKey(owner : Principal, consumerId : Types.ConsumerId) : Blob {
    let raw = owner.toText() # ":" # consumerId.toText() # ":" # Time.now().toText();
    let encoded = raw.encodeUtf8();
    // Trim/pad to exactly 32 bytes
    let arr = encoded.toArray();
    var out = List.empty<Nat8>();
    var i = 0;
    while (i < 32) {
      if (i < arr.size()) { out.add(arr[i]) }
      else                { out.add(0 : Nat8) };
      i += 1;
    };
    Blob.fromArray(out.toArray());
  };

  /// Check and increment rate-limit counter for a consumer.
  /// Returns true if the call is within limit.
  func checkRateLimit(consumerId : Types.ConsumerId, limit : Nat32) : Bool {
    if (limit == 0) return true;
    let now       = Time.now();
    let windowNs  : Int = 60_000_000_000; // 1 minute
    switch (apiRateLimits.get(consumerId)) {
      case null {
        apiRateLimits.add(consumerId, { windowStart = now; callCount = 1 : Nat32 });
        true;
      };
      case (?entry) {
        if (now - entry.windowStart >= windowNs) {
          // reset window
          apiRateLimits.add(consumerId, { windowStart = now; callCount = 1 : Nat32 });
          true;
        } else if (entry.callCount >= limit) {
          false;
        } else {
          apiRateLimits.add(consumerId, { entry with callCount = entry.callCount + 1 });
          true;
        };
      };
    };
  };

  /// Resolve the effective price for a call.
  /// Prefers a package scoped to the objectTypeId, falls back to wildcard.
  func resolvePrice(tokenId : Types.APITokenId, objectTypeId : ?Types.ObjectId, isBatch : Bool, batchSize : Nat8) : ?Types.TokenAmt {
    var best : ?Types.APIPricePackage = null;
    for ((_, pkg) in apiPricePackages.entries()) {
      if (pkg.isActive and pkg.tokenId == tokenId) {
        let matches = switch (pkg.objectTypeId, objectTypeId) {
          case (null, _)        true;   // wildcard package
          case (?pid, ?oid)     pid == oid;
          case (?_, null)       false;
        };
        if (matches) {
          // prefer scoped over wildcard
          best := switch (best, pkg.objectTypeId) {
            case (null, _)        ?pkg;
            case (_, ?_)          ?pkg;  // scoped wins
            case _                best;
          };
        };
      };
    };
    switch (best) {
      case null null;
      case (?pkg) {
        if (isBatch and batchSize >= pkg.batchSizeThreshold) {
          ?(pkg.priceBatchCall)
        } else {
          ?(pkg.pricePerCall)
        };
      };
    };
  };

  // ── Feed helpers ──────────────────────────────────────────────────────────────

  func nextFeedId() : Types.FeedId = Nat32.fromNat(feedConfigs.size() + 1);
  func nextImportId() : Nat32       = Nat32.fromNat(importHistory.size() + 1);

  /// ICP management canister interface for HTTP outcalls.
  let IC = actor "aaaaa-aa" : actor {
    http_request : ({
      url               : Text;
      max_response_bytes : ?Nat64;
      method            : { #get; #post; #head };
      headers           : [{ name : Text; value : Text }];
      body              : ?Blob;
      transform         : ?{
        function : shared query ({
          response : {
            status  : Nat;
            headers : [{ name : Text; value : Text }];
            body    : Blob;
          };
          context : Blob;
        }) -> async {
          status  : Nat;
          headers : [{ name : Text; value : Text }];
          body    : Blob;
        };
        context : Blob;
      };
    }) -> async {
      status  : Nat;
      headers : [{ name : Text; value : Text }];
      body    : Blob;
    };
  };

  /// Fetch a feed by its ID. Stores result capped at last 10. Updates FeedConfig status.
  func fetchFeed(feedId : Types.FeedId) : async { #ok : Types.FeedResult; #err : Text } {
    let cfg = switch (feedConfigs.get(feedId)) {
      case null    return #err("Feed not found: " # feedId.toText());
      case (?c)    c;
    };
    if (not cfg.enabled) return #err("Feed disabled");

    // Build headers — include Content-Type; add API key header if configured
    let baseHeaders : [{ name : Text; value : Text }] = [{ name = "Content-Type"; value = "application/json" }];
    let headers : [{ name : Text; value : Text }] = switch (cfg.apiKeyHeader, cfg.apiKeyValue) {
      case (?hName, ?hVal) baseHeaders.concat([{ name = hName; value = hVal }]);
      case _               baseHeaders;
    };

    let maxBytes : ?Nat64 = ?(Nat64.fromNat(cfg.maxResponseBytes.toNat()));

    let nowSecs : Nat64 = Nat64.fromNat(Int.abs(Time.now()) / 1_000_000_000);
    let response = try {
      await (with cycles = 3_000_000_000) IC.http_request({
        url               = cfg.url;
        max_response_bytes = maxBytes;
        method            = #get;
        headers;
        body              = null;
        transform         = null;
      })
    } catch (_e) {
      let errMsg = "HTTP outcall failed";
      feedConfigs.add(feedId, { cfg with lastFetchAt = nowSecs; lastFetchStatus = "error: " # errMsg });
      appendEvent("FeedFetchError", "feedId=" # feedId.toText());
      return #err(errMsg);
    };

    let code : Nat16 = Nat16.fromNat(response.status % 65536);
    let bodyText : Text = switch (response.body.decodeUtf8()) {
      case (?t) t;
      case null "(binary body)";
    };
    // Collect first 500 chars as snippet using counter
    var charCount : Nat = 0;
    let snippet : Text = Text.fromIter(bodyText.toIter().takeWhile(func(_c : Char) : Bool {
      charCount += 1;
      charCount <= 500
    }));

    let result : Types.FeedResult = {
      feedId;
      fetchedAt      = nowSecs;
      responseCode   = code;
      bodySnippet    = snippet;
      fullBodyBlobId = null;
    };

    // Store result capped at last 10 per feed
    let lst : List.List<Types.FeedResult> = switch (feedResults.get(feedId)) {
      case null     List.empty();
      case (?l)     l;
    };
    lst.add(result);
    // Trim to last 10 by rebuilding from tail when over cap
    if (lst.size() > 10) {
      let startIdx = lst.size() - 10;
      let trimmed = List.tabulate<Types.FeedResult>(10, func i = lst.at(startIdx + i));
      lst.clear();
      lst.addAll(trimmed.values());
    };
    feedResults.add(feedId, lst);

    let statusStr = if (code >= 200 and code < 300) "ok" else "error: HTTP " # code.toText();
    feedConfigs.add(feedId, { cfg with lastFetchAt = nowSecs; lastFetchStatus = statusStr });
    appendEvent("FeedFetched", "feedId=" # feedId.toText() # " status=" # statusStr);
    #ok(result);
  };

  /// Heartbeat helper: fetch all enabled feeds whose poll interval has elapsed.
  func fetchAllEnabledFeeds() : async () {
    let nowSecs : Nat64 = Nat64.fromNat(Int.abs(Time.now()) / 1_000_000_000);
    for ((feedId, cfg) in feedConfigs.entries()) {
      if (cfg.enabled) {
        let minInterval : Nat64 = if (cfg.pollIntervalSecs < 300) 300 else cfg.pollIntervalSecs;
        if (cfg.lastFetchAt == 0 or (nowSecs - cfg.lastFetchAt) >= minInterval) {
          let _ = await fetchFeed(feedId);
        };
      };
    };
  };

  // ── Access control ────────────────────────────────────────────────────────────

  /// Query the live ICFC ledger balance for any principal.
  public shared func getICFCBalance(principal : Principal) : async Nat64 {
    let account : Ledger.Account = { owner = principal; subaccount = null };
    await queryICFCBalance(account);
  };

  /// Returns the caller's live ICFC ledger balance (convenience for frontend).
  public shared ({ caller }) func getCallerICFCBalance() : async Nat64 {
    requireAuth(caller);
    let account : Ledger.Account = { owner = caller; subaccount = null };
    await queryICFCBalance(account);
  };

  /// Return stake from canister to the proposer of a passed proposal.
  public shared ({ caller }) func returnStake(proposalId : Types.ProposalId) : async { #ok; #err : Text } {
    requireAdmin(caller);
    let proposal = switch (proposals.get(proposalId)) {
      case (?p) p;
      case null  Runtime.trap("Proposal not found");
    };
    if (proposal.status != #Executed) return #err("Proposal not in Executed state");
    if (proposal.stake == 0) return #ok;
    let to : Ledger.Account = { owner = proposal.proposer; subaccount = null };
    let result = await transferFromCanister(to, proposal.stake);
    switch result {
      case (#ok(_)) {
        proposals.add(proposalId, {
          proposal with
          executionResult = ?(switch (proposal.executionResult) {
            case (?prev) prev # " | StakeReturned";
            case null    "StakeReturned";
          });
        });
        appendEvent("StakeReturned", "proposalId=" # proposalId.toText() # " amount=" # proposal.stake.toText() # " to=" # proposal.proposer.toText());
        #ok;
      };
      case (#err(msg)) { #err("Stake return failed: " # msg) };
    };
  };

  /// Burn stake after dispute window closes on a rejected proposal.
  public shared ({ caller }) func burnStake(proposalId : Types.ProposalId) : async { #ok; #err : Text } {
    requireAdmin(caller);
    let proposal = switch (proposals.get(proposalId)) {
      case (?p) p;
      case null  Runtime.trap("Proposal not found");
    };
    if (proposal.status != #Rejected) return #err("Proposal not in Rejected state");
    if (proposal.stake == 0) return #ok;
    let now = Time.now();
    switch (proposal.disputeWindowEnd) {
      case (?windowEnd) {
        if (now <= windowEnd) return #err("Dispute window still open");
      };
      case null {}; // no window → burn immediately
    };
    let result = await transferFromCanister(BURN_ACCOUNT, proposal.stake);
    switch result {
      case (#ok(_)) {
        proposals.add(proposalId, {
          proposal with
          status           = #Finalized;
          updatedAt        = now;
          executionResult  = ?(switch (proposal.executionResult) {
            case (?prev) prev # " | StakeBurned";
            case null    "StakeBurned";
          });
        });
        appendEvent("StakeBurned", "proposalId=" # proposalId.toText() # " amount=" # proposal.stake.toText() # " burned");
        #ok;
      };
      case (#err(msg)) { #err("Stake burn failed: " # msg) };
    };
  };

  public shared ({ caller }) func initializeAccessControl() : async () {
    if (adminAssigned) Runtime.trap("Admin already initialized");
    adminRoles.add(caller, #admin);
    adminAssigned := true;
  };

  public query ({ caller }) func getCallerUserRole() : async Types.UserRole {
    switch (adminRoles.get(caller)) {
      case (?role) role;
      case null    #guest;
    };
  };

  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : Types.UserRole) : async () {
    requireAdmin(caller);
    adminRoles.add(user, role);
  };

  public query ({ caller }) func isCallerAdmin() : async Bool {
    isAdmin(caller);
  };

  // ── User profiles ─────────────────────────────────────────────────────────────

  public query ({ caller }) func getCallerUserProfile() : async ?Types.UserProfile {
    requireAuth(caller);
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?Types.UserProfile {
    requireAuth(caller);
    if (caller != user and not isAdmin(caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : Types.UserProfile) : async () {
    requireAuth(caller);
    await requireICFCBalance(caller, 1);
    userProfiles.add(caller, profile);
  };

  // ── Proposals ─────────────────────────────────────────────────────────────────

  /// Submit a proposal. Requires >= 1 ICFC on ledger and stake >= minStake.
  /// Frontend must pre-transfer `stake` e8s to the canister principal before calling.
  public shared ({ caller }) func submitProposal(
    proposalType : Types.ProposalType,
    stake        : Types.TokenAmt,
    content      : Text,
  ) : async Types.ProposalId {
    requireAuth(caller);
    await requireICFCBalance(caller, 1);
    if (stake < governanceSettings.minStake) {
      Runtime.trap("Insufficient stake: minimum " # governanceSettings.minStake.toText() # " e8s required");
    };
    let id  = nextProposalId();
    let now = Time.now();
    let proposal : Types.Proposal = {
      id;
      proposer         = caller;
      proposalType;
      status           = #Submitted;
      stake;
      createdAt        = now;
      updatedAt        = now;
      votesFor         = 0 : Nat64;
      votesAgainst     = 0 : Nat64;
      voters           = [];
      content;
      simulationResult = null;
      executionResult  = ?"StakePending"; // frontend must pre-transfer stake e8s
      disputeWindowEnd = null;
      votingEndsAt     = now + governanceSettings.votingPeriod.toNat();
    };
    proposals.add(id, proposal);
    appendEvent("ProposalSubmitted", "id=" # id.toText() # " proposer=" # caller.toText() # " stake=" # stake.toText());
    id;
  };

  /// Vote on a proposal. Voting power = real-time ICFC ledger balance (e8s).
  /// Caller must hold >= 1 e8 to vote.
  public shared ({ caller }) func voteOnProposal(proposalId : Types.ProposalId, inFavor : Bool) : async () {
    requireAuth(caller);
    let proposal = switch (proposals.get(proposalId)) {
      case (?p) p;
      case null  Runtime.trap("Proposal not found");
    };
    let now = Time.now();
    if (now > proposal.votingEndsAt) Runtime.trap("Voting period has ended");
    let alreadyVoted = proposal.voters.find(func(v : Types.Vote) : Bool { Principal.equal(v.voter, caller) });
    if (alreadyVoted != null) Runtime.trap("Already voted on this proposal");
    // Fetch real voting power from ICFC ledger
    let account : Ledger.Account = { owner = caller; subaccount = null };
    let vp : Nat64 = await queryICFCBalance(account);
    if (vp < 1) Runtime.trap("Insufficient ICFC balance to vote");
    let vote : Types.Vote = { voter = caller; votingPower = vp; inFavor; timestamp = now };
    let updated : Types.Proposal = {
      proposal with
      votesFor     = if (inFavor)     { proposal.votesFor + vp }     else { proposal.votesFor };
      votesAgainst = if (not inFavor) { proposal.votesAgainst + vp } else { proposal.votesAgainst };
      voters       = proposal.voters.concat([vote]);
      updatedAt    = now;
    };
    proposals.add(proposalId, updated);
    appendEvent("Vote", "proposalId=" # proposalId.toText() # " voter=" # caller.toText() # " vp=" # vp.toText() # " inFavor=" # (if inFavor "true" else "false"));
  };

  /// Execute a proposal. Auto-returns stake on pass. Sets dispute window on both outcomes.
  public shared ({ caller }) func executeProposal(proposalId : Types.ProposalId) : async () {
    requireAdmin(caller);
    let proposal = switch (proposals.get(proposalId)) {
      case (?p) p;
      case null  Runtime.trap("Proposal not found");
    };
    let now = Time.now();
    if (now <= proposal.votingEndsAt) Runtime.trap("Voting period still active");
    let approved  = proposal.votesFor > proposal.votesAgainst;
    let disputeEnd = ?(now + governanceSettings.disputeWindow.toNat());
    if (approved) {
      // ── Execute proposal side-effects ─────────────────────────────────────
      switch (proposal.proposalType) {
        case (#NewAPIPrice) {
          // CSV: name,tokenId,objectTypeId,pricePerCall,priceBatchCall,batchSizeThreshold
          // objectTypeId may be empty string for wildcard
          let parts = proposal.content.split(#char ',').toArray();
          if (parts.size() < 6) Runtime.trap("NewAPIPrice: invalid content format");
          let pkgId    = nextPkgId();
          let tid : Nat8 = switch (Nat.fromText(parts[1]))  { case (?n) n.toNat8(); case null 0 };
          let oid : ?Types.ObjectId = if (parts[2] == "") null
                                      else switch (Nat.fromText(parts[2])) { case (?n) ?n.toNat32(); case null null };
          let ppc  : Nat64 = switch (Nat.fromText(parts[3])) { case (?n) n.toNat64(); case null 0 };
          let pbpc : Nat64 = switch (Nat.fromText(parts[4])) { case (?n) n.toNat64(); case null 0 };
          let bst  : Nat8  = switch (Nat.fromText(parts[5])) { case (?n) n.toNat8();  case null 1 };
          apiPricePackages.add(pkgId, {
            id = pkgId; name = parts[0]; tokenId = tid;
            objectTypeId = oid; pricePerCall = ppc; priceBatchCall = pbpc;
            batchSizeThreshold = bst; isActive = true;
          });
          appendEvent("NewAPIPrice", "pkgId=" # pkgId.toText() # " name=" # parts[0]);
        };
        case (#EditAPIPrice) {
          // CSV: pkgId,name,tokenId,objectTypeId,pricePerCall,priceBatchCall,batchSizeThreshold
          let parts = proposal.content.split(#char ',').toArray();
          if (parts.size() < 7) Runtime.trap("EditAPIPrice: invalid content format");
          let pkgId : Nat8 = switch (Nat.fromText(parts[0])) {
            case (?n) n.toNat8(); case null Runtime.trap("EditAPIPrice: bad pkgId");
          };
          let ex = switch (apiPricePackages.get(pkgId)) {
            case (?p) p; case null Runtime.trap("EditAPIPrice: package not found");
          };
          let tid : Nat8 = switch (Nat.fromText(parts[2]))  { case (?n) n.toNat8();  case null ex.tokenId };
          let oid : ?Types.ObjectId = if (parts[3] == "") null
                                      else switch (Nat.fromText(parts[3])) { case (?n) ?n.toNat32(); case null ex.objectTypeId };
          let ppc  : Nat64 = switch (Nat.fromText(parts[4])) { case (?n) n.toNat64(); case null ex.pricePerCall };
          let pbpc : Nat64 = switch (Nat.fromText(parts[5])) { case (?n) n.toNat64(); case null ex.priceBatchCall };
          let bst  : Nat8  = switch (Nat.fromText(parts[6])) { case (?n) n.toNat8();  case null ex.batchSizeThreshold };
          apiPricePackages.add(pkgId, {
            ex with name = parts[1]; tokenId = tid; objectTypeId = oid;
            pricePerCall = ppc; priceBatchCall = pbpc; batchSizeThreshold = bst;
          });
          appendEvent("EditAPIPrice", "pkgId=" # pkgId.toText() # " name=" # parts[1]);
        };
        case (#DeleteAPIPrice) {
          // content: pkgId as decimal text
          let pkgId : Nat8 = switch (Nat.fromText(proposal.content)) {
            case (?n) n.toNat8(); case null Runtime.trap("DeleteAPIPrice: invalid pkgId");
          };
          let ex = switch (apiPricePackages.get(pkgId)) {
            case (?p) p; case null Runtime.trap("DeleteAPIPrice: package not found");
          };
          apiPricePackages.add(pkgId, { ex with isActive = false });
          appendEvent("DeleteAPIPrice", "pkgId=" # pkgId.toText());
        };
        case (#UpdateFrontend or #UpdateCSS or #UpdateHTML) {
          // content: "blobId,path" e.g. "42,index.js"
          let parts = proposal.content.split(#char ',').toArray();
          if (parts.size() < 2) Runtime.trap("UpdateFrontend: content must be 'blobId,path'");
          let blobId : Types.BlobId = switch (Nat.fromText(parts[0])) {
            case (?n) n.toNat32(); case null Runtime.trap("UpdateFrontend: invalid blobId");
          };
          let path = parts[1];
          let entry = switch (blobStore.get(blobId)) {
            case (?e) e; case null Runtime.trap("UpdateFrontend: blob not found");
          };
          if (not entry.isActive) Runtime.trap("UpdateFrontend: blob not finalized");
          activeFrontendAssets.add(path, blobId);
          appendEvent("UpdateFrontend", "blobId=" # blobId.toText() # " path=" # path);
        };
        case (#UpdateMotoko) {
          // content: "blobId,moduleName" e.g. "7,Player"
          let parts = proposal.content.split(#char ',').toArray();
          if (parts.size() < 2) Runtime.trap("UpdateMotoko: content must be 'blobId,moduleName'");
          let blobId : Types.BlobId = switch (Nat.fromText(parts[0])) {
            case (?n) n.toNat32(); case null Runtime.trap("UpdateMotoko: invalid blobId");
          };
          let moduleName = parts[1];
          let entry = switch (blobStore.get(blobId)) {
            case (?e) e; case null Runtime.trap("UpdateMotoko: blob not found");
          };
          if (not entry.isActive) Runtime.trap("UpdateMotoko: blob not finalized");
          activeMotokoSource.add(moduleName, blobId);
          appendEvent("UpdateMotoko", "blobId=" # blobId.toText() # " module=" # moduleName);
        };
        case (#ConfigureRealTimeFeeds) {
          // CSV formats:
          //   create: create,name,url,apiKeyHeader,apiKeyValue,pollIntervalSecs,enabled,maxResponseBytes
          //   update: update,feedId,name,url,apiKeyHeader,apiKeyValue,pollIntervalSecs,enabled,maxResponseBytes
          //   delete: delete,feedId
          // apiKeyHeader/apiKeyValue = "" for no key; pollIntervalSecs >= 300; maxResponseBytes default 500000
          let parts = proposal.content.split(#char ',').toArray();
          if (parts.size() < 2) Runtime.trap("ConfigureRealTimeFeeds: insufficient fields");
          let action = parts[0];
          if (action == "create") {
            if (parts.size() < 8) Runtime.trap("ConfigureRealTimeFeeds create: need 8 fields (create,name,url,apiKeyHeader,apiKeyValue,pollIntervalSecs,enabled,maxResponseBytes)");
            let fid = nextFeedId();
            let pollSecs : Nat64 = switch (Nat.fromText(parts[5])) { case (?n) n.toNat64(); case null 3600 };
            let enabled : Bool   = parts[6] == "true";
            let maxBytes : Nat32 = switch (Nat.fromText(parts[7])) { case (?n) n.toNat32(); case null 500_000 };
            let apiKeyHeader : ?Text = if (parts[3] == "") null else ?parts[3];
            let apiKeyValue  : ?Text = if (parts[4] == "") null else ?parts[4];
            let minPoll : Nat64 = 300;
            feedConfigs.add(fid, {
              id               = fid;
              name             = parts[1];
              url              = parts[2];
              apiKeyHeader;
              apiKeyValue;
              pollIntervalSecs = if (pollSecs < minPoll) minPoll else pollSecs;
              enabled;
              maxResponseBytes = maxBytes;
              lastFetchAt      = 0 : Nat64;
              lastFetchStatus  = "never";
              createdBy        = proposal.proposer;
            });
            appendEvent("FeedCreated", "feedId=" # fid.toText() # " name=" # parts[1] # " url=" # parts[2]);
          } else if (action == "update") {
            if (parts.size() < 9) Runtime.trap("ConfigureRealTimeFeeds update: need 9 fields (update,feedId,name,url,apiKeyHeader,apiKeyValue,pollIntervalSecs,enabled,maxResponseBytes)");
            let fid : Types.FeedId = switch (Nat.fromText(parts[1])) {
              case (?n) n.toNat32(); case null Runtime.trap("ConfigureRealTimeFeeds update: invalid feedId");
            };
            let ex = switch (feedConfigs.get(fid)) {
              case (?c) c; case null Runtime.trap("ConfigureRealTimeFeeds update: feed not found");
            };
            let pollSecs : Nat64 = switch (Nat.fromText(parts[6])) { case (?n) n.toNat64(); case null ex.pollIntervalSecs };
            let enabled : Bool   = parts[7] == "true";
            let maxBytes : Nat32 = switch (Nat.fromText(parts[8])) { case (?n) n.toNat32(); case null ex.maxResponseBytes };
            let apiKeyHeader : ?Text = if (parts[4] == "") null else ?parts[4];
            let apiKeyValue  : ?Text = if (parts[5] == "") null else ?parts[5];
            let minPoll : Nat64 = 300;
            feedConfigs.add(fid, {
              ex with
              name             = if (parts[2] == "") ex.name else parts[2];
              url              = if (parts[3] == "") ex.url  else parts[3];
              apiKeyHeader;
              apiKeyValue;
              pollIntervalSecs = if (pollSecs < minPoll) minPoll else pollSecs;
              enabled;
              maxResponseBytes = maxBytes;
            });
            appendEvent("FeedUpdated", "feedId=" # fid.toText());
          } else if (action == "delete") {
            let fid : Types.FeedId = switch (Nat.fromText(parts[1])) {
              case (?n) n.toNat32(); case null Runtime.trap("ConfigureRealTimeFeeds delete: invalid feedId");
            };
            feedConfigs.remove(fid);
            feedResults.remove(fid);
            appendEvent("FeedDeleted", "feedId=" # fid.toText());
          } else {
            Runtime.trap("ConfigureRealTimeFeeds: unknown action '" # action # "'. Use create|update|delete");
          };
        };
        case (#ImportSeasonData) {
          // content: "blobId" — references a previously uploaded blob containing CSV/JSON season data
          let blobId : Types.BlobId = switch (Nat.fromText(proposal.content)) {
            case (?n) n.toNat32(); case null Runtime.trap("ImportSeasonData: invalid blobId");
          };
          // Verify blob exists (need not be active — import can reference a raw upload)
          let _entry = switch (blobStore.get(blobId)) {
            case (?e) e; case null Runtime.trap("ImportSeasonData: blob not found");
          };
          let importId = nextImportId();
          let nowSecs : Nat64 = Nat64.fromNat(Int.abs(Time.now()) / 1_000_000_000);
          importHistory.add(importId, {
            proposalId = proposalId;
            blobId;
            importedAt = nowSecs;
            importedBy = proposal.proposer;
            status     = "pending";
          });
          appendEvent("ImportSeasonData", "importId=" # importId.toText() # " blobId=" # blobId.toText() # " proposalId=" # proposalId.toText());
        };
        case _ {}; // other proposal types: no automated side-effect yet
      };
      proposals.add(proposalId, {
        proposal with
        status           = #Executed;
        updatedAt        = now;
        disputeWindowEnd = disputeEnd;
        executionResult  = ?"Executed";
      });
      appendEvent("ProposalExecuted", "id=" # proposalId.toText());
      // Auto-return stake — non-fatal if ledger is temporarily down
      if (proposal.stake > 0) {
        let to : Ledger.Account = { owner = proposal.proposer; subaccount = null };
        let stakeResult = await transferFromCanister(to, proposal.stake);
        let latest = switch (proposals.get(proposalId)) { case (?p) p; case null proposal };
        switch stakeResult {
          case (#ok(_)) {
            proposals.add(proposalId, {
              latest with
              executionResult = ?"Executed | StakeReturned";
            });
        appendEvent("StakeReturned", "proposalId=" # proposalId.toText() # " amount=" # proposal.stake.toText() # " to=" # proposal.proposer.toText());
          };
          case (#err(msg)) {
            appendEvent("StakeReturnFailed", "proposalId=" # proposalId.toText() # " error=" # msg);
          };
        };
      };
    } else {
      proposals.add(proposalId, {
        proposal with
        status           = #Rejected;
        updatedAt        = now;
        disputeWindowEnd = disputeEnd;
        executionResult  = ?"Rejected";
      });
      appendEvent("ProposalRejected", "id=" # proposalId.toText());
    };
  };

  public shared ({ caller }) func simulateProposal(proposalId : Types.ProposalId) : async Text {
    requireAuth(caller);
    await requireICFCBalance(caller, 1);
    let proposal = switch (proposals.get(proposalId)) {
      case (?p) p;
      case null  Runtime.trap("Proposal not found");
    };
    let result = "Simulation successful - no errors detected";
    proposals.add(proposalId, {
      proposal with
      status           = #Simulated;
      simulationResult = ?result;
      updatedAt        = Time.now();
    });
    result;
  };

  /// Dispute an executed proposal within its dispute window.
  /// If disputeReward > 0%, pays reward % of stake from canister treasury to challenger.
  public shared ({ caller }) func disputeProposal(proposalId : Types.ProposalId, _reason : Text) : async () {
    requireAuth(caller);
    await requireICFCBalance(caller, 1);
    let proposal = switch (proposals.get(proposalId)) {
      case (?p) p;
      case null  Runtime.trap("Proposal not found");
    };
    if (proposal.status != #Executed) Runtime.trap("Can only dispute executed proposals");
    switch (proposal.disputeWindowEnd) {
      case null { Runtime.trap("No dispute window set") };
      case (?windowEnd) {
        let now = Time.now();
        if (now > windowEnd) Runtime.trap("Dispute window has closed");
        proposals.add(proposalId, { proposal with status = #Disputed; updatedAt = now });
        appendEvent("ProposalDisputed", "id=" # proposalId.toText() # " challenger=" # caller.toText());
        // Pay dispute reward if configured (0–20%, default 0%)
        let rewardPct = governanceSettings.disputeReward;
        if (rewardPct > 0 and proposal.stake > 0) {
          let rewardAmt : Nat64 = proposal.stake * Nat64.fromNat(rewardPct.toNat()) / 100;
          if (rewardAmt > 0) {
            let to : Ledger.Account = { owner = caller; subaccount = null };
            let rewardResult = await transferFromCanister(to, rewardAmt);
            switch rewardResult {
              case (#ok(_)) {
                appendEvent("DisputeRewardPaid", "proposalId=" # proposalId.toText() # " amount=" # rewardAmt.toText() # " to=" # caller.toText());
              };
              case (#err(msg)) {
                appendEvent("DisputeRewardFailed", "proposalId=" # proposalId.toText() # " error=" # msg);
              };
            };
          };
        };
      };
    };
  };

  public query func getProposal(id : Types.ProposalId) : async ?Types.Proposal {
    proposals.get(id);
  };

  public query func getAllProposals() : async [Types.Proposal] {
    proposals.values().toArray();
  };

  public query func getGovernanceSettings() : async Types.GovernanceSettings {
    governanceSettings;
  };

  // ── Object types ──────────────────────────────────────────────────────────────

  public query func getObjectType(id : Types.ObjectId) : async ?Types.ObjectType {
    objectTypes.get(id);
  };

  public query func getAllObjectTypes() : async [Types.ObjectType] {
    objectTypes.values().toArray();
  };

  // ── Event log ─────────────────────────────────────────────────────────────────

  public query func getEventLog() : async [Types.EventLogEntry] {
    eventLog.values().toArray();
  };

  // ── Templates ─────────────────────────────────────────────────────────────────

  public query func getTemplates() : async [Types.Template] {
    templates.values().toArray();
  };

  // ── Dashboards ────────────────────────────────────────────────────────────────

  public query ({ caller }) func getDashboardConfig() : async ?Types.DashboardConfig {
    requireAuth(caller);
    dashboardConfigs.values().find(func(c : Types.DashboardConfig) : Bool { Principal.equal(c.user, caller) });
  };

  public query ({ caller }) func getDashboardConfigs() : async [Types.DashboardConfig] {
    requireAdmin(caller);
    dashboardConfigs.values().toArray();
  };

  public shared ({ caller }) func saveDashboardConfig(layout : Text, widgets : [Text]) : async () {
    requireAuth(caller);
    await requireICFCBalance(caller, 1);
    let id = nextDashId();
    dashboardConfigs.add(id, { id; user = caller; layout; widgets });
  };

  // ── Dynamic docs ──────────────────────────────────────────────────────────────

  public query func getDynamicDocs() : async [Types.DynamicDoc] {
    dynamicDocs.values().toArray();
  };

  // ── API consumers ─────────────────────────────────────────────────────────────

  public query ({ caller }) func getAPIConsumer() : async ?Types.APIConsumer {
    requireAuth(caller);
    apiConsumers.values().find(func(c : Types.APIConsumer) : Bool { Principal.equal(c.principal, caller) });
  };

  public query ({ caller }) func getAPIConsumers() : async [Types.APIConsumer] {
    requireAdmin(caller);
    apiConsumers.values().toArray();
  };

  public shared ({ caller }) func registerAPIConsumer(apiKey : Text, usageLimit : Nat32) : async Types.ConsumerId {
    requireAuth(caller);
    await requireICFCBalance(caller, 1);
    let id = nextConsumerId();
    apiConsumers.add(id, {
      id;
      principal    = caller;
      apiKey;
      usageLimit;
      requestsMade = 0 : Nat32;
      createdAt    = Time.now();
    });
    id;
  };

  // ── API Monetization (Pay-as-you-go) ─────────────────────────────────────────

  /// Register a new API key with the chosen payment token.
  public shared ({ caller }) func registerAPIKey(tokenId : Types.APITokenId) : async { #ok : Blob; #err : Text } {
    requireAuth(caller);
    // One key per principal
    let existing = apiConsumersV2.values().find(func(c : Types.APIConsumerV2) : Bool { Principal.equal(c.owner, caller) and c.isActive });
    switch (existing) {
      case (?_) { return #err("API key already registered for this principal") };
      case null {};
    };
    if (not apiTokens.containsKey(tokenId)) return #err("Unknown tokenId");
    let id  = nextConsumerV2Id();
    let key = makeApiKey(caller, id);
    let now = Time.now();
    let consumer : Types.APIConsumerV2 = {
      id;
      owner          = caller;
      apiKey         = key;
      tokenId;
      balance        = 0 : Nat64;
      totalDeposited = 0 : Nat64;
      totalSpent     = 0 : Nat64;
      callCount      = 0 : Nat32;
      batchCallCount = 0 : Nat32;
      createdAt      = now;
      lastCallAt     = now;
      isActive       = true;
      rateLimit      = 0 : Nat32;  // 0 = use governance default
    };
    apiConsumersV2.add(id, consumer);
    apiKeyIndex.add(key, id);
    #ok(key);
  };

  /// Deposit balance from caller's ICRC-1 account to their API consumer balance.
  /// Caller must have previously approved the canister on the ledger, or this does
  /// a pull via icrc1_transfer from caller subaccount.
  public shared ({ caller }) func depositAPIBalance(apiKey : Blob, amount : Nat64) : async { #ok; #err : Text } {
    if (apiKey.size() != 32) return #err("Invalid API key: must be 32 bytes");
    let consumerId = switch (apiKeyIndex.get(apiKey)) {
      case null    return #err("API key not found");
      case (?cid)  cid;
    };
    let consumer = switch (apiConsumersV2.get(consumerId)) {
      case null    return #err("Consumer record not found");
      case (?c)    c;
    };
    if (consumer.owner != caller) return #err("Unauthorized: key not owned by caller");
    if (not consumer.isActive)    return #err("Consumer account is inactive");
    let token = switch (apiTokens.get(consumer.tokenId)) {
      case null   return #err("Token configuration not found");
      case (?t)   t;
    };
    if (amount < token.minDeposit) return #err("Amount below minimum deposit");
    // Perform ICRC-1 transfer: pull funds from caller to canister
    let ledger = actor (token.ledgerId.toText()) : actor {
      icrc1_transfer : (Ledger.TransferArg) -> async Ledger.TransferResult;
    };
    let selfPrincipal = Principal.fromActor(FootballHEIR);
    let transferArg : Ledger.TransferArg = {
      from_subaccount = null;
      to              = { owner = selfPrincipal; subaccount = null };
      amount          = amount.toNat();
      fee             = null;
      memo            = null;
      created_at_time = null;
    };
    let result = await ledger.icrc1_transfer(transferArg);
    switch (result) {
      case (#Ok(_)) {
        apiConsumersV2.add(consumerId, {
          consumer with
          balance        = consumer.balance + amount;
          totalDeposited = consumer.totalDeposited + amount;
        });
        #ok;
      };
      case (#Err(e)) {
        let msg = switch (e) {
          case (#InsufficientFunds { balance }) "Insufficient funds: " # balance.toText();
          case (#BadFee { expected_fee })        "Bad fee: " # expected_fee.toText();
          case (#TemporarilyUnavailable)         "Ledger temporarily unavailable";
          case (#TooOld)                         "Transaction too old";
          case (#GenericError { message })       "Error: " # message;
          case _                                 "Transfer failed";
        };
        #err(msg);
      };
    };
  };

  /// Deduct the cost of an API call from consumer balance.
  /// Called internally before serving paid data queries.
  public shared ({ caller }) func deductAPICall(
    apiKey       : Blob,
    objectTypeId : ?Types.ObjectId,
    isBatch      : Bool,
    batchSize    : Nat8,
  ) : async { #ok; #err : Text } {
    if (apiKey.size() != 32) return #err("Invalid API key");
    let consumerId = switch (apiKeyIndex.get(apiKey)) {
      case null    return #err("API key not found");
      case (?cid)  cid;
    };
    let consumer = switch (apiConsumersV2.get(consumerId)) {
      case null    return #err("Consumer not found");
      case (?c)    c;
    };
    if (not consumer.isActive) return #err("Consumer account inactive");
    // Rate limit
    let limit = if (consumer.rateLimit == 0) { governanceSettings.defaultRateLimitPerMin }
                else                          { consumer.rateLimit };
    if (not checkRateLimit(consumerId, limit)) return #err("Rate limit exceeded");
    // Resolve price
    let price = switch (resolvePrice(consumer.tokenId, objectTypeId, isBatch, batchSize)) {
      case null   return #err("No price package configured for this token/object type");
      case (?p)   p;
    };
    if (consumer.balance < price) return #err("Insufficient API balance");
    let now = Time.now();
    apiConsumersV2.add(consumerId, {
      consumer with
      balance        = consumer.balance - price;
      totalSpent     = consumer.totalSpent + price;
      callCount      = consumer.callCount + (if (not isBatch) 1 else 0);
      batchCallCount = consumer.batchCallCount + (if (isBatch) 1 else 0);
      lastCallAt     = now;
    });
    // Append call record to the immutable log
    nextCallLogId := ClientPanelLib.appendCallRecord(
      consumerId,
      apiKey,
      objectTypeId,
      isBatch,
      batchSize,
      price,
      "ok",
      apiCallLog,
      apiKeyNames,
      nextCallLogId,
      now,
    );
    #ok;
  };

  /// Look up a consumer by their API key (32-byte Blob).
  public query func getAPIConsumerByKey(apiKey : Blob) : async ?Types.APIConsumerV2 {
    if (apiKey.size() != 32) return null;
    switch (apiKeyIndex.get(apiKey)) {
      case null    null;
      case (?cid)  apiConsumersV2.get(cid);
    };
  };

  /// Look up the caller's own consumer record.
  public query ({ caller }) func getAPIConsumerByPrincipal() : async ?Types.APIConsumerV2 {
    requireAuth(caller);
    apiConsumersV2.values().find(func(c : Types.APIConsumerV2) : Bool { Principal.equal(c.owner, caller) });
  };

  /// List all active price packages.
  public query func getAPIPricePackages() : async [Types.APIPricePackage] {
    apiPricePackages.values().filter(func(p : Types.APIPricePackage) : Bool { p.isActive }).toArray();
  };

  /// List all configured payment tokens.
  public query func getAPITokens() : async [Types.APIToken] {
    apiTokens.values().toArray();
  };

  /// Admin: register a new supported payment token.
  public shared ({ caller }) func addAPIToken(
    ledgerId   : Principal,
    symbol     : Text,
    decimals   : Nat8,
    minDeposit : Types.TokenAmt,
  ) : async Types.APITokenId {
    requireAdmin(caller);
    let id = nextTokenId();
    apiTokens.add(id, { id; ledgerId; symbol; decimals; minDeposit; isActive = true });
    id;
  };

  // ── Blob pipeline ─────────────────────────────────────────────────────────────

  /// Max chunk size: 1.9 MB (ICP message limit is 2 MB, leave headroom).
  let MAX_CHUNK_SIZE : Nat = 1_990_656;

  /// Initiate a chunked blob upload. Returns a BlobId.
  /// Requires >= 1 ICFC. Creates an inactive BlobEntry.
  public shared ({ caller }) func initBlobUpload(
    name       : Text,
    mimeType   : Text,
    totalSize  : Nat32,
    chunkCount : Nat32,
  ) : async { #ok : Types.BlobId; #err : Text } {
    requireAuth(caller);
    await requireICFCBalance(caller, 1);
    if (chunkCount == 0) return #err("chunkCount must be >= 1");
    if (totalSize  == 0) return #err("totalSize must be >= 1");
    let id  = nextBlobId();
    let now = Time.now();
    let entry : Types.BlobEntry = {
      id;
      name;
      mimeType;
      totalSize;
      chunkCount;
      uploadedAt = now;
      uploadedBy = caller;
      isActive   = false;
      sha256     = null;
    };
    blobStore.add(id, entry);
    blobChunks.add(id, Map.empty<Nat32, Blob>());
    appendEvent("BlobInitiated", "blobId=" # id.toText() # " name=" # name # " chunks=" # chunkCount.toText());
    #ok(id);
  };

  /// Upload a single chunk. chunkIndex is 0-based.
  public shared ({ caller }) func uploadBlobChunk(
    blobId     : Types.BlobId,
    chunkIndex : Nat32,
    data       : Blob,
  ) : async { #ok; #err : Text } {
    requireAuth(caller);
    let entry = switch (blobStore.get(blobId)) {
      case (?e) e;
      case null return #err("Blob not found");
    };
    if (entry.isActive)                  return #err("Blob already finalized");
    if (entry.uploadedBy != caller)      return #err("Unauthorized: not the uploader");
    if (chunkIndex >= entry.chunkCount)  return #err("chunkIndex out of range");
    if (data.size() > MAX_CHUNK_SIZE)    return #err("Chunk exceeds 1.9 MB limit");
    let chunkMap = switch (blobChunks.get(blobId)) {
      case (?m) m;
      case null {
        let m : Map.Map<Nat32, Blob> = Map.empty();
        blobChunks.add(blobId, m);
        m;
      };
    };
    chunkMap.add(chunkIndex, data);
    #ok;
  };

  /// Finalize a blob upload. Marks isActive = true after verifying all chunks uploaded.
  public shared ({ caller }) func finalizeBlob(
    blobId : Types.BlobId,
    sha256 : ?Blob,
  ) : async { #ok; #err : Text } {
    requireAuth(caller);
    let entry = switch (blobStore.get(blobId)) {
      case (?e) e;
      case null return #err("Blob not found");
    };
    if (entry.isActive)             return #err("Blob already finalized");
    if (entry.uploadedBy != caller) return #err("Unauthorized: not the uploader");
    let chunkMap = switch (blobChunks.get(blobId)) {
      case (?m) m;
      case null return #err("No chunks uploaded");
    };
    if (chunkMap.size() < entry.chunkCount.toNat()) {
      return #err("Missing chunks: expected " # entry.chunkCount.toText() # ", have " # chunkMap.size().toText());
    };
    blobStore.add(blobId, { entry with isActive = true; sha256 });
    appendEvent("BlobFinalized", "blobId=" # blobId.toText() # " name=" # entry.name # " by=" # caller.toText());
    #ok;
  };

  /// Get blob metadata by id.
  public query func getBlobEntry(id : Types.BlobId) : async ?Types.BlobEntry {
    blobStore.get(id);
  };

  /// List all blob entries (active and inactive).
  public query func getAllBlobEntries() : async [Types.BlobEntry] {
    blobStore.values().toArray();
  };

  /// Retrieve a specific chunk by blobId + chunkIndex (0-based).
  public query func getBlobChunk(blobId : Types.BlobId, chunkIndex : Nat32) : async ?Blob {
    switch (blobChunks.get(blobId)) {
      case null     null;
      case (?cmap)  cmap.get(chunkIndex);
    };
  };

  /// List all active frontend asset mappings as [(path, blobId)].
  public query func getActiveFrontendAssets() : async [(Text, Types.BlobId)] {
    activeFrontendAssets.entries().toArray();
  };

  /// Look up the BlobEntry for a given active frontend path.
  public query func getActiveFrontendBlob(path : Text) : async ?Types.BlobEntry {
    switch (activeFrontendAssets.get(path)) {
      case null       null;
      case (?blobId)  blobStore.get(blobId);
    };
  };

  /// Reassemble all chunks in order and return body + mimeType for HTTP serving.
  /// Returns null if path not active, blob missing, or not finalized.
  public query func getHTTPAsset(path : Text) : async ?{ body : Blob; mimeType : Text } {
    let blobId = switch (activeFrontendAssets.get(path)) {
      case null     return null;
      case (?bid)   bid;
    };
    let entry = switch (blobStore.get(blobId)) {
      case null   return null;
      case (?e)   e;
    };
    if (not entry.isActive) return null;
    let chunkMap = switch (blobChunks.get(blobId)) {
      case null   return null;
      case (?m)   m;
    };
    var assembled : [Nat8] = [];
    var i : Nat32 = 0;
    while (i < entry.chunkCount) {
      let chunk = switch (chunkMap.get(i)) {
        case (?c) c;
        case null Blob.fromArray([]);
      };
      assembled := assembled.concat(chunk.toArray());
      i += 1;
    };
    ?{ body = Blob.fromArray(assembled); mimeType = entry.mimeType };
  };

  // ── Forum ─────────────────────────────────────────────────────────────────────

  public shared ({ caller }) func createThread(title : Text, content : Text) : async Types.ThreadId {
    requireAuth(caller);
    await requireICFCBalance(caller, 1);
    if (bannedUsers.get(caller) == ?true) Runtime.trap("Unauthorized: User is banned");
    let id  = nextThreadId();
    let now = Time.now();
    let firstPost : Types.Post = {
      id        = 1 : Types.PostId;
      author    = caller;
      content;
      createdAt = now;
      isPinned  = false;
      isDeleted = false;
    };
    threads.add(id, { id; title; author = caller; createdAt = now; isDeleted = false; posts = [firstPost] });
    id;
  };

  public shared ({ caller }) func addPost(threadId : Types.ThreadId, content : Text) : async Types.PostId {
    requireAuth(caller);
    await requireICFCBalance(caller, 1);
    if (bannedUsers.get(caller) == ?true) Runtime.trap("Unauthorized: User is banned");
    let thread = switch (threads.get(threadId)) {
      case (?t) t;
      case null  Runtime.trap("Thread not found");
    };
    if (thread.isDeleted) Runtime.trap("Cannot post to deleted thread");
    let postId : Types.PostId = Nat32.fromNat(thread.posts.size() + 1);
    let newPost : Types.Post  = {
      id        = postId;
      author    = caller;
      content;
      createdAt = Time.now();
      isPinned  = false;
      isDeleted = false;
    };
    threads.add(threadId, { thread with posts = thread.posts.concat([newPost]) });
    postId;
  };

  public query func getThread(id : Types.ThreadId) : async ?Types.Thread {
    threads.get(id);
  };

  public query func getAllThreads() : async [Types.Thread] {
    threads.values().toArray();
  };

  // ── Moderation ────────────────────────────────────────────────────────────────

  public shared ({ caller }) func deletePost(threadId : Types.ThreadId, postId : Types.PostId) : async () {
    requireAdmin(caller);
    let thread = switch (threads.get(threadId)) {
      case (?t) t;
      case null  Runtime.trap("Thread not found");
    };
    let updated = thread.posts.map(
      func(p : Types.Post) : Types.Post {
        if (p.id == postId) { { p with isDeleted = true } } else p
      },
    );
    threads.add(threadId, { thread with posts = updated });
  };

  public shared ({ caller }) func deleteThread(threadId : Types.ThreadId) : async () {
    requireAdmin(caller);
    let thread = switch (threads.get(threadId)) {
      case (?t) t;
      case null  Runtime.trap("Thread not found");
    };
    threads.add(threadId, { thread with isDeleted = true });
  };

  public shared ({ caller }) func pinPost(threadId : Types.ThreadId, postId : Types.PostId) : async () {
    requireAdmin(caller);
    let thread = switch (threads.get(threadId)) {
      case (?t) t;
      case null  Runtime.trap("Thread not found");
    };
    let updated = thread.posts.map(
      func(p : Types.Post) : Types.Post {
        if (p.id == postId) { { p with isPinned = true } } else p
      },
    );
    threads.add(threadId, { thread with posts = updated });
  };

  public shared ({ caller }) func banUser(user : Principal) : async () {
    requireAdmin(caller);
    bannedUsers.add(user, true);
    appendEvent("UserBanned", "user=" # user.toText() # " by=" # caller.toText());
  };

  public shared ({ caller }) func unbanUser(user : Principal) : async () {
    requireAdmin(caller);
    bannedUsers.remove(user);
    appendEvent("UserUnbanned", "user=" # user.toText() # " by=" # caller.toText());
  };

  public query func isUserBanned(user : Principal) : async Bool {
    bannedUsers.get(user) == ?true;
  };

  // ── HTTP Feed queries & management ────────────────────────────────────────────

  /// List all configured feed sources.
  public query func getFeedConfigs() : async [Types.FeedConfig] {
    feedConfigs.values().toArray();
  };

  /// Get a single feed configuration.
  public query func getFeedConfig(id : Types.FeedId) : async ?Types.FeedConfig {
    feedConfigs.get(id);
  };

  /// Get all stored fetch results for a feed (up to last 10).
  public query func getFeedResults(feedId : Types.FeedId) : async [Types.FeedResult] {
    switch (feedResults.get(feedId)) {
      case null  [];
      case (?lst) lst.toArray();
    };
  };

  /// Get the most recent fetch result for a feed.
  public query func getLatestFeedResult(feedId : Types.FeedId) : async ?Types.FeedResult {
    switch (feedResults.get(feedId)) {
      case null  null;
      case (?lst) lst.last();
    };
  };

  /// Admin-only: manually trigger a feed fetch for testing.
  public shared ({ caller }) func manualFetchFeed(feedId : Types.FeedId) : async { #ok : Types.FeedResult; #err : Text } {
    requireAdmin(caller);
    await fetchFeed(feedId);
  };

  /// Public heartbeat trigger (admin only — normally called by heartbeat timer).
  public shared ({ caller }) func triggerFeedPoll() : async () {
    requireAdmin(caller);
    await fetchAllEnabledFeeds();
  };

  // ── Season import history ─────────────────────────────────────────────────────

  /// List all season import records.
  public query func getImportHistory() : async [Types.ImportRecord] {
    importHistory.values().toArray();
  };

  /// Admin: mark an import record's status (e.g. "ok" or "error: <msg>").
  public shared ({ caller }) func updateImportStatus(importId : Nat32, status : Text) : async () {
    requireAdmin(caller);
    let rec = switch (importHistory.get(importId)) {
      case (?r) r; case null Runtime.trap("Import record not found");
    };
    importHistory.add(importId, { rec with status });
    appendEvent("ImportStatusUpdated", "importId=" # importId.toText() # " status=" # status);
  };

  // ── Heartbeat automation ──────────────────────────────────────────────────────

  /// Serialize current schema to a compact Blob for backup.
  func serializeSchema() : Blob {
    var parts = List.empty<Text>();
    for ((oid, ot) in objectTypes.entries()) {
      parts.add(oid.toText() # ":" # ot.name # ":" # ot.attributes.size().toText() # ";");
    };
    parts.add("gov:" # governanceSettings.quorum.toText() # ":" # governanceSettings.minStake.toText());
    parts.values().join("").encodeUtf8();
  };

  /// Create a backup snapshot and store it in backupStore.
  func performBackup(triggeredBy : Text) {
    let nowSecs = Nat64.fromNat(Int.abs(Time.now()) / 1_000_000_000);
    let id      = nextBackupId;
    let entry : Types.BackupEntry = {
      id;
      timestamp   = Time.now();
      schemaBlob  = serializeSchema();
      triggeredBy;
      objectCount = Nat32.fromNat(objectTypes.size());
    };
    backupStore.add(id, entry);
    nextBackupId += 1;
    lastBackupAt := nowSecs;
    appendEvent("AutoBackup", "id=" # id.toText() # " trigger=" # triggeredBy # " objects=" # objectTypes.size().toText());
  };

  /// Auto-finalize proposals whose voting period or dispute window has expired.
  func finalizeExpiredProposals() {
    let now = Time.now();
    for ((pid, proposal) in proposals.entries()) {
      if (proposal.status == #Submitted or proposal.status == #Voting) {
        if (now > proposal.votingEndsAt) {
          let approved   = proposal.votesFor > proposal.votesAgainst;
          let disputeEnd = ?(now + governanceSettings.disputeWindow.toNat());
          let newStatus  : Types.ProposalStatus = if (approved) #Approved else #Rejected;
          proposals.add(pid, {
            proposal with
            status           = newStatus;
            updatedAt        = now;
            disputeWindowEnd = disputeEnd;
            executionResult  = ?(if (approved) "AutoApproved" else "AutoRejected");
          });
          appendEvent(
            "ProposalAutoFinalized",
            "id=" # pid.toText() # " status=" # (if (approved) "Approved" else "Rejected"),
          );
        };
      } else if (proposal.status == #Rejected) {
        switch (proposal.disputeWindowEnd) {
          case (?windowEnd) {
            if (now > windowEnd) {
              proposals.add(pid, {
                proposal with
                status    = #Finalized;
                updatedAt = now;
              });
              appendEvent("ProposalFinalized", "id=" # pid.toText() # " stakeReadyToBurn=" # proposal.stake.toText());
            };
          };
          case null {};
        };
      };
    };
  };

  /// Check heap size and auto-propose sharding when threshold exceeded.
  func checkShardingTrigger() {
    if (not governanceSettings.autoShardingEnabled) return;
    if (shardProposalPending) return;
    let heapBytes      = Prim.rts_heap_size();
    let thresholdBytes = governanceSettings.autoShardingThresholdGb.toNat() * 1_073_741_824;
    if (heapBytes >= thresholdBytes) {
      let id     = nextProposalId();
      let now    = Time.now();
      let heapGb = heapBytes / 1_073_741_824;
      let proposal : Types.Proposal = {
        id;
        proposer         = Principal.fromText("aaaaa-aa");
        proposalType     = #NewDataCanister;
        status           = #Submitted;
        stake            = 0 : Nat64;
        createdAt        = now;
        updatedAt        = now;
        votesFor         = 0 : Nat64;
        votesAgainst     = 0 : Nat64;
        voters           = [];
        content          = "Auto-triggered: heap=" # heapGb.toText() # "GiB >= threshold=" # governanceSettings.autoShardingThresholdGb.toNat().toText() # "GiB";
        simulationResult = null;
        executionResult  = ?"PendingDAOVote";
        disputeWindowEnd = null;
        votingEndsAt     = now + governanceSettings.votingPeriod.toNat();
      };
      proposals.add(id, proposal);
      shardProposalPending := true;
      lastShardCheckAt := Nat64.fromNat(Int.abs(now) / 1_000_000_000);
      appendEvent("ShardingProposalCreated", "proposalId=" # id.toText() # " heapGb=" # heapGb.toText());
    };
  };

  /// Core heartbeat tick — called by the recurring timer.
  func heartbeatTick() : async () {
    if (not governanceSettings.heartbeatEnabled) return;
    let nowSecs = Nat64.fromNat(Int.abs(Time.now()) / 1_000_000_000);
    lastHeartbeatAt := nowSecs;
    finalizeExpiredProposals();
    if (nowSecs >= lastBackupAt + governanceSettings.backupIntervalSecs) {
      performBackup("heartbeat");
    };
    checkShardingTrigger();
  };

  /// Start (or restart) the recurring heartbeat timer.
  func startHeartbeat<system>() {
    switch (heartbeatTimerId) {
      case (?tid) { Timer.cancelTimer(tid) };
      case null   {};
    };
    if (not governanceSettings.heartbeatEnabled) {
      heartbeatTimerId := null;
      return;
    };
    let intervalNs = governanceSettings.heartbeatIntervalSecs.toNat() * 1_000_000_000;
    heartbeatTimerId := ?Timer.recurringTimer<system>(#nanoseconds intervalNs, heartbeatTick);
  };

  // Initialize heartbeat timer when the actor starts
  startHeartbeat<system>();

  // ── Client panel mixin ────────────────────────────────────────────────────────
  include ClientPanelMixin(
    apiConsumersV2,
    apiKeyIndex,
    apiKeyNames,
    apiCallLog,
    apiRateLimits,
    governanceSettings.defaultRateLimitPerMin,
    makeApiKey,
  );

  // ── Heartbeat public API ──────────────────────────────────────────────────────

  /// Query current heartbeat and system health status.
  public query func getHeartbeatStatus() : async {
    enabled      : Bool;
    lastRun      : Nat64;
    nextRun      : Nat64;
    lastBackupAt : Nat64;
    heapSizeMb   : Nat32;
  } {
    let nowSecs  = Nat64.fromNat(Int.abs(Time.now()) / 1_000_000_000);
    let interval = governanceSettings.heartbeatIntervalSecs;
    let nextRun  = if (lastHeartbeatAt == 0) nowSecs + interval
                   else lastHeartbeatAt + interval;
    {
      enabled      = governanceSettings.heartbeatEnabled;
      lastRun      = lastHeartbeatAt;
      nextRun;
      lastBackupAt;
      heapSizeMb   = Nat32.fromNat(Prim.rts_heap_size() / 1_048_576);
    };
  };

  /// List all backup entries (metadata only, no blob data).
  public query func getBackups() : async [{ id : Types.BackupId; timestamp : Int; triggeredBy : Text; objectCount : Nat32 }] {
    backupStore.values().map<Types.BackupEntry, { id : Types.BackupId; timestamp : Int; triggeredBy : Text; objectCount : Nat32 }>(
      func(e) { { id = e.id; timestamp = e.timestamp; triggeredBy = e.triggeredBy; objectCount = e.objectCount } }
    ).toArray();
  };

  /// Get a specific backup entry including the schema blob.
  public query func getBackup(id : Types.BackupId) : async ?Types.BackupEntry {
    backupStore.get(id);
  };

  /// Admin: trigger a manual backup immediately.
  public shared ({ caller }) func triggerManualBackup() : async Types.BackupId {
    requireAdmin(caller);
    let id = nextBackupId;
    performBackup("manual");
    id;
  };

  /// Admin: log a rollback intent from a backup. Full schema re-application
  /// requires a #RestoreSchema DAO proposal for auditability.
  public shared ({ caller }) func restoreFromBackup(backupId : Types.BackupId) : async { #ok; #err : Text } {
    requireAdmin(caller);
    let entry = switch (backupStore.get(backupId)) {
      case null    return #err("Backup not found: " # backupId.toText());
      case (?e)    e;
    };
    appendEvent(
      "SchemaRollback",
      "backupId=" # backupId.toText() #
      " timestamp=" # entry.timestamp.toText() #
      " trigger=" # entry.triggeredBy #
      " objectCount=" # entry.objectCount.toText() #
      " initiator=" # caller.toText(),
    );
    #ok;
  };

  /// Admin: toggle heartbeat on/off and restart the timer immediately.
  public shared ({ caller }) func setHeartbeatEnabled<system>(enabled : Bool) : async () {
    requireAdmin(caller);
    governanceSettings := { governanceSettings with heartbeatEnabled = enabled };
    startHeartbeat<system>();
    appendEvent("HeartbeatToggled", "enabled=" # (if enabled "true" else "false") # " by=" # caller.toText());
  };

  /// Admin: reset shard-proposal-pending flag after a sharding proposal resolves.
  public shared ({ caller }) func resetShardProposalPending() : async () {
    requireAdmin(caller);
    shardProposalPending := false;
    appendEvent("ShardPendingReset", "by=" # caller.toText());
  };
};
