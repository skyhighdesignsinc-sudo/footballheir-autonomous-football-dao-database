# ICP / Motoko Coding Standards

General best practices for writing performant, safe, and upgrade-proof code on the Internet Computer using Motoko.
This file is intentionally project-agnostic — it applies to any ICP canister.

---

## 1. Data Type Optimization (C++-like cycle minimization)

Choose the **smallest type that fits the domain**. Every extra byte costs cycles in storage and in message encoding.

### Integer sizing rules

| Domain                                   | Type    | Reasoning                                       |
|------------------------------------------|---------|-------------------------------------------------|
| Percentages (0–100)                      | `Nat8`  | Max 255 — no reason for a larger type           |
| Small counts / enum-like IDs (≤ 65 535)  | `Nat16` | Rare; prefer `Nat32` unless you truly need it   |
| Primary keys / sequence IDs              | `Nat32` | Supports 4 billion rows — sufficient for most DBs |
| Token amounts (e8s), timestamps (ns)     | `Nat64` | ICP uses nanoseconds; ICRC-1 amounts are Nat     |
| General integer math with no bound       | `Nat`   | Only when bounds genuinely unknown              |
| Signed integers                          | `Int`   | `Time.now()` returns `Int` (nanoseconds)        |

### FootballHEIR data type decisions (from `Types.mo`)

Every field type is chosen for the smallest encoding that satisfies domain constraints:

| Field / Alias         | Type         | Cycle-cost justification                                          |
|-----------------------|--------------|-------------------------------------------------------------------|
| `ProposalId`          | `Nat32`      | Max 4 billion proposals; saves 4 bytes vs Nat64 per entry         |
| `ObjectId`            | `Nat32`      | Max 4 billion object types; sufficient for any schema             |
| `AttrId`              | `Nat32`      | Max 4 billion attributes; avoids Nat heap boxing                  |
| `MethodId`            | `Nat32`      | Max 4 billion methods; 4 bytes on the wire                        |
| `EventId`             | `Nat32`      | Max 4 billion log entries; 4 bytes vs 8 for Nat64                 |
| `ThreadId`            | `Nat32`      | Forum threads bounded by governance activity                      |
| `PostId`              | `Nat32`      | Per-thread post counter; Nat32 is plenty                          |
| `BlobId`              | `Nat32`      | Blob uploads bounded by canister storage capacity                 |
| `FeedId`              | `Nat32`      | HTTP feed configs are few; Nat32 is generous                      |
| `BackupId`            | `Nat32`      | Schema snapshots taken weekly; fits in Nat32 for centuries        |
| `ConsumerId`          | `Nat32`      | Max 4 billion API consumers; saves 4 bytes vs Nat64               |
| `APITokenId`          | `Nat8`       | DAO approves at most a few dozen tokens; 1 byte each              |
| `APIPkgId`            | `Nat8`       | Price packages are few (≤ 255); minimum footprint                 |
| `Pct`                 | `Nat8`       | Percentages 0–100; 1 byte vs 8 for Nat64                          |
| `TokenAmt`            | `Nat64`      | ICRC-1 e8s amounts; IC convention requires full Nat64 range       |
| `Timestamp`           | `Int`        | `Time.now()` returns `Int` nanoseconds; no conversion overhead    |
| `UserId`              | `Principal`  | Native identity type; avoid re-encoding to Text                   |
| `votesFor/Against`    | `Nat64`      | Aggregated VP in e8s can exceed Nat32 range with many voters      |
| `callCount`           | `Nat32`      | Per-consumer call counter; resets are DAO-governed                |
| `totalSize`           | `Nat32`      | Blob size bounded by ICP message cap (~2 MB); Nat32 sufficient    |
| `chunkCount`          | `Nat32`      | Chunk count per blob; Nat32 is generous                           |
| `responseCode`        | `Nat16`      | HTTP status codes 100–599; 2 bytes, exactly right                 |
| `rateLimit`           | `Nat32`      | Calls per minute; Nat32 avoids boxing overhead                    |
| `lastFetchAt`         | `Nat64`      | Unix seconds sentinel: 0 = never fetched; Nat64 for future-proof  |
| `pollIntervalSecs`    | `Nat64`      | Nanosecond-compatible denominator for timer arithmetic            |
| `maxResponseBytes`    | `Nat32`      | Capped at 500 KB by default; Nat32 covers up to ~4 GB             |
| `apiKey`              | `Blob`       | 32-byte random key; Blob stores raw bytes, Text wastes 2x storage |
| `schemaBlob`          | `Blob`       | Serialized snapshot; binary, not human-readable                   |
| `sha256`              | `?Blob`      | Optional 32-byte hash; ?Blob = absent when not supplied           |

```motoko
// ✅ Good — tight types matching Types.mo
public type ProposalId = Nat32;   // up to ~4B proposals
public type Pct        = Nat8;    // 0–100 percent
public type TokenAmt   = Nat64;   // ICRC-1 e8s amounts
public type Timestamp  = Int;     // Time.now() is Int (nanoseconds)

// ❌ Bad — oversized
public type ProposalId = Nat;     // wastes encoding bytes on the wire
public type Pct        = Nat;     // 8x larger than needed
```

### Float — avoid unless necessary

Float is 64-bit IEEE 754. For financial values or percentages, use integer arithmetic with a known exponent instead:

```motoko
// ❌ Avoid
let rate : Float = 0.035;

// ✅ Use integer with exponent (e.g., basis points)
let rateBps : Nat32 = 350;  // 3.50% stored as 350 basis points
let result : Nat64 = amount * Nat64.fromNat(rateBps.toNat()) / 10_000;
```

### Blob vs Text

```motoko
// ✅ Blob: binary data, hashes, API keys, crypto material
public type APIKey = Blob;    // 32-byte key stored as raw bytes
let hash : Blob = computeHash(...);

// ✅ Text: human-readable strings, URLs, names, descriptions
let url  : Text = "https://api.example.com/v1/players";
let name : Text = "Premier League";

// ❌ Bad: storing a binary hash as hex Text — wastes 2x storage
let hexHash : Text = "a3f4b2...";
```

### Principal vs Text for identities

Always use `Principal` for user identities and canister references. Never store them as `Text` in data structures.

```motoko
// ✅ Good
let owner : Principal = msg.caller;
Map.add(users, owner, profile);

// ❌ Bad — loses type safety and costs more cycles to re-parse
let ownerText : Text = Principal.toText(msg.caller);
```

### Option types — `?T` vs sentinel values

Use `?T` when absence is meaningful. Use sentinel values (e.g., `0`) only when a "missing" value has a clear numerical meaning and the type already encodes the domain.

```motoko
// ✅ Option: absence is semantically meaningful
objectTypeId : ?Nat32;  // null = applies to all object types (wildcard)
sha256       : ?Blob;   // null = no hash provided by uploader

// ✅ Sentinel: 0 means "never fetched" — self-documenting in the domain
lastFetchAt : Nat64;    // 0 = never fetched

// ❌ Avoid mixing — don't use ?Nat64 where 0 is a valid alternative
```

---

## 2. Stable Memory & Upgrade Safety

### `stable var` vs heap variables

**Everything that must survive a canister upgrade MUST be `stable var`** or stored in stable memory structures.

```motoko
// ✅ Stable — survives upgrades
var proposals : Map.Map<ProposalId, Proposal> = Map.empty();  // mo:core Map is stable
var governanceSettings : GovernanceSettings = { quorum = 0 : Nat8; ... };

// ❌ Will be reset on upgrade — heap-only
var cache : [Text] = [];   // fine if it's truly ephemeral
```

In this project, every `var` at the actor top-level is implicitly stable (Motoko's orthogonal persistence). All `Map.Map`, `List.List`, and scalar values at the actor level survive upgrades automatically.

**Key rule:** Timer IDs (`?Timer.TimerId`) are NOT stable — timers must be restarted in the actor body or a `postupgrade` hook.

```motoko
// In actor body — runs on every canister start/upgrade
startHeartbeat<system>();
```

### Stable Maps in main.mo — 18 stable vars

The actor declares all state at top-level. These survive upgrades without migration unless the record type changes:

| Map variable           | Key type          | Value type           | Purpose                                          |
|------------------------|-------------------|----------------------|--------------------------------------------------|
| `adminRoles`           | `Principal`       | `UserRole`           | Access control: who is admin                     |
| `userProfiles`         | `Principal`       | `UserProfile`        | Cached user name + ICFC balance                  |
| `proposals`            | `ProposalId`      | `Proposal`           | All governance proposals                         |
| `objectTypes`          | `ObjectId`        | `ObjectType`         | DAO-created schema entities (Player, Club, etc.) |
| `eventLog`             | `EventId`         | `EventLogEntry`      | Append-only, hash-chained audit log              |
| `templates`            | `TemplateId`      | `Template`           | Reusable proposal content templates              |
| `dashboardConfigs`     | `DashId`          | `DashboardConfig`    | Per-user analytics dashboard layouts             |
| `dynamicDocs`          | `DocId`           | `DynamicDoc`         | DAO-managed markdown/OpenAPI documentation       |
| `apiConsumers`         | `ConsumerId`      | `APIConsumer`        | Legacy V1 consumer records (backward compat)     |
| `threads`              | `ThreadId`        | `Thread`             | Forum threads + embedded posts                   |
| `bannedUsers`          | `Principal`       | `Bool`               | Moderation: banned principal set                 |
| `apiTokens`            | `APITokenId`      | `APIToken`           | DAO-approved ICRC-1 payment tokens               |
| `apiPricePackages`     | `APIPkgId`        | `APIPricePackage`    | Per-call pricing, optionally scoped to ObjectType|
| `apiConsumersV2`       | `ConsumerId`      | `APIConsumerV2`      | Pay-as-you-go consumer accounts                  |
| `apiKeyIndex`          | `Blob`            | `ConsumerId`         | Reverse index: API key bytes → consumerId         |
| `apiRateLimits`        | `ConsumerId`      | `RateLimitEntry`     | Per-consumer rate-limit window tracking          |
| `blobStore`            | `BlobId`          | `BlobEntry`          | Blob upload metadata (name, MIME, size, sha256)  |
| `blobChunks`           | `BlobId`          | `Map<Nat32, Blob>`   | Chunked binary content (nested Map)              |
| `activeFrontendAssets` | `Text`            | `BlobId`             | Path → active blobId for HTTP asset serving      |
| `activeMotokoSource`   | `Text`            | `BlobId`             | Module name → active Motoko source blobId        |
| `feedConfigs`          | `FeedId`          | `FeedConfig`         | HTTP feed sources (URL, API key, interval)       |
| `feedResults`          | `FeedId`          | `List<FeedResult>`   | Recent fetch results (capped at 10 per feed)     |
| `importHistory`        | `Nat32`           | `ImportRecord`       | Season data import records                       |
| `backupStore`          | `BackupId`        | `BackupEntry`        | Schema snapshots (serialized ObjectTypes + settings)|

### mo:core data structures in stable state

`mo:core/Map` and `mo:core/List` are designed for stable storage in Motoko's orthogonal persistence model. Use them as the primary collection types.

```motoko
import Map  "mo:core/Map";
import List "mo:core/List";

var users     : Map.Map<Principal, UserProfile>  = Map.empty();
var proposals : Map.Map<Nat32,     Proposal>     = Map.empty();
var history   : List.List<EventLogEntry>         = List.empty();
```

### Writing migration.mo for additive schema changes

When you add **new fields to an existing stable record type**, you must write a migration module to fill in default values for the new fields on existing data.

**Pattern:**

1. Copy the OLD record type as `OldFoo` inside `migration.mo` (inline, no import).
2. Define `NewFoo` matching the updated `Types.mo` exactly.
3. Implement `run(old: OldActor) : NewActor` filling in defaults.
4. Reference it in the actor: `(with migration = Migration.run)`.

```motoko
// migration.mo
module {
  type OldGovernanceSettings = {
    quorum    : Nat8;
    minStake  : Nat64;
    // ... original fields only
  };

  type NewGovernanceSettings = {
    quorum              : Nat8;
    minStake            : Nat64;
    // ... original fields
    heartbeatEnabled    : Bool;     // ← NEW
    heartbeatIntervalSecs : Nat64;  // ← NEW
  };

  type OldActor = { var governanceSettings : OldGovernanceSettings };
  type NewActor = { var governanceSettings : NewGovernanceSettings };

  public func run(old : OldActor) : NewActor {
    {
      var governanceSettings = {
        old.governanceSettings with
        heartbeatEnabled      = true;
        heartbeatIntervalSecs = 3_600 : Nat64;
      };
    };
  };
};
```

```motoko
// main.mo — wire migration
(with migration = Migration.run)
actor MyActor { ... }
```

### preupgrade / postupgrade hooks

With `mo:core` and orthogonal persistence, you generally **do not need** `preupgrade`/`postupgrade` hooks. The migration module handles schema evolution. Use hooks only when you need to:

- Convert a non-stable type to/from stable form (e.g., converting a `HashMap` to `[(K,V)]`)
- Reset timers after upgrade

```motoko
// Timer restart after upgrade — no preupgrade/postupgrade needed
// Just call your init function in the actor body; it runs on every start:
startHeartbeat<system>();
```

---

## 3. Actor Model & Architecture

### Single actor vs multi-canister

| Scenario                              | Recommendation                          |
|---------------------------------------|-----------------------------------------|
| < 400 GiB data, single domain         | Single actor; simpler, cheaper          |
| Data exceeds 400 GiB stable memory    | Shard via child canisters               |
| Independent services with own state   | Separate actors with inter-canister API |
| High-volume forum / feed data         | Separate canister (#NewForumCanister)   |

FootballHEIR uses a single actor with an auto-sharding proposal trigger at 400 GiB.

### System capability `<system>`

Functions that use **timers**, **cycle attachment**, or **system APIs** require the `<system>` capability declaration. It must propagate from the call site down through all callers.

```motoko
// ✅ Functions that START timers need <system>
func startHeartbeat<system>() {
  heartbeatTimerId := ?Timer.recurringTimer<system>(#nanoseconds interval, tick);
};

// ✅ Public methods that call <system> functions must also declare it
public shared ({ caller }) func setHeartbeatEnabled<system>(enabled : Bool) : async () {
  startHeartbeat<system>();
};

// Actor body initialization — call site provides <system> automatically
startHeartbeat<system>();   // top-level actor body
```

### query vs update methods

| Use case                                            | Method type |
|-----------------------------------------------------|-------------|
| Reading data, no state change                       | `query`     |
| Writing state, inter-canister calls, ICRC-1 calls   | `shared` (update) |
| Needs real-time ledger data                         | `shared` (update) — cannot call async from `query` |

```motoko
// ✅ query — fast (< 200ms), free, no consensus
public query func getProposal(id : ProposalId) : async ?Proposal {
  proposals.get(id)
};

// ✅ update — needs consensus, ~2s roundtrip, costs cycles
public shared ({ caller }) func submitProposal(...) : async ProposalId {
  await requireICFCBalance(caller, 1);  // inter-canister call → must be update
  ...
};
```

### Async/await patterns — inter-canister calls

Every `await` crosses an asynchronous boundary. State can change between `await` calls. Follow the **check-effects-interactions** pattern:

```motoko
// ✅ Correct: validate THEN mutate THEN transfer
public shared ({ caller }) func executeProposal(id : ProposalId) : async () {
  // 1. Validate (synchronous)
  let proposal = switch (proposals.get(id)) {
    case (?p) p;
    case null Runtime.trap("Not found");
  };
  if (now <= proposal.votingEndsAt) Runtime.trap("Still voting");

  // 2. Mutate state first (synchronous — committed before await)
  proposals.add(id, { proposal with status = #Executed });

  // 3. Then do async transfer (inter-canister)
  let _ = await transferFromCanister(proposal.proposer, proposal.stake);
};
```

### Caller validation

Always validate `msg.caller` (or `caller` in destructured form) at the top of every `shared` function.

```motoko
// requireAuth: rejects anonymous callers
func requireAuth(caller : Principal) {
  if (caller.isAnonymous()) Runtime.trap("Unauthorized: Authentication required");
};

// requireAdmin: checks role map
func requireAdmin(caller : Principal) {
  if (not isAdmin(caller)) Runtime.trap("Unauthorized: Admin required");
};

// Inline balance check: prevents spam without holding a lock
func requireICFCBalance(caller : Principal, minTokens : Nat64) : async () {
  requireAuth(caller);
  let account : Ledger.Account = { owner = caller; subaccount = null };
  let bal = await queryICFCBalance(account);
  if (bal < minTokens) Runtime.trap("Insufficient ICFC balance");
};
```

---

## 4. ICRC-1 Inter-Canister Calls (Ledger.mo)

### Defining the ICRC-1 interface

`Ledger.mo` defines the ICFC token interface as a typed actor alias. The ledger canister ID is passed as a constant to avoid hard-coding in multiple places:

```motoko
// Ledger.mo
import Principal "mo:core/Principal";

module {
  public type Account = {
    owner      : Principal;
    subaccount : ?Blob;
  };

  public type TransferArg = {
    from_subaccount : ?Blob;
    to              : Account;
    amount          : Nat;      // ICRC-1 uses Nat, not Nat64, for wire encoding
    fee             : ?Nat;
    memo            : ?Blob;
    created_at_time : ?Nat64;
  };

  public type TransferError = {
    #BadBurn        : { min_burn_amount : Nat };
    #BadFee         : { expected_fee   : Nat };
    #CreatedInFuture: { ledger_time    : Nat64 };
    #Duplicate      : { duplicate_of   : Nat };
    #GenericError   : { error_code : Nat; message : Text };
    #InsufficientFunds : { balance : Nat };
    #TemporarilyUnavailable;
    #TooOld;
  };

  public type TransferResult = { #Ok : Nat; #Err : TransferError };

  public type Self = actor {
    icrc1_balance_of : query Account -> async Nat;
    icrc1_transfer   : TransferArg  -> async TransferResult;
    icrc1_decimals   : query ()     -> async Nat8;
  };

  /// Factory: returns the ICFC ledger actor reference.
  public func ledger() : Self {
    actor "ddsp7-7iaaa-aaaaq-aacqq-cai" : Self
  };
};
```

### Principal vs AccountIdentifier

ICRC-1 uses `Account = { owner: Principal; subaccount: ?Blob }`. Do NOT use the legacy `AccountIdentifier` (32-byte hash) from ICP's older standards — ICRC-1 canisters require the `Account` record.

```motoko
// ✅ ICRC-1 style — use this
let acc : Ledger.Account = { owner = caller; subaccount = null };
let bal = await Ledger.ledger().icrc1_balance_of(acc);

// ❌ Do not use AccountIdentifier (legacy ICP standard)
// let accId = AccountIdentifier.fromPrincipal(caller, null);
```

### Cycle cost of inter-canister calls

Each `await` to the ICFC ledger costs:
- ~260K cycles (base inter-canister call)
- ~590K cycles (update call consensus on the target subnet)
- Total: ~850K–1M cycles per ledger call

Minimize ledger calls: cache balances in `UserProfile.icfcBalance` for read-heavy operations; only re-query when stale or before a state-mutating operation.

```motoko
// ✅ Cache balance for display; re-query before submit
// Display: use cached userProfiles[caller].icfcBalance
// Before submit: await requireICFCBalance(caller, 1) — live check
```

### Always handle all ICRC-1 transfer error variants

```motoko
let result = await Ledger.ledger().icrc1_transfer(arg);
switch result {
  case (#Ok(blockIdx)) { /* success — use blockIdx for dedup */ };
  case (#Err(e)) {
    let msg = switch e {
      case (#InsufficientFunds { balance }) "InsufficientFunds: " # Nat64.fromNat(balance).toText() # " e8s";
      case (#BadFee { expected_fee })       "BadFee: expected " # Nat64.fromNat(expected_fee).toText();
      case (#TemporarilyUnavailable)        "TemporarilyUnavailable";
      case (#TooOld)                        "TooOld";
      case (#CreatedInFuture { ledger_time = _ }) "CreatedInFuture";
      case (#Duplicate { duplicate_of = _ })      "Duplicate";
      case (#BadBurn { min_burn_amount })          "BadBurn";
      case (#GenericError { message; error_code = _ }) message;
    };
    // Never trap on transfer error — return #err instead
    return #err("Transfer failed: " # msg);
  };
};
```

---

## 5. Heartbeat Automation

### How the timer is started

The heartbeat uses `mo:base/Timer.recurringTimer` (mo:core has no Timer). It is started in the actor body so it re-arms on every upgrade:

```motoko
// ── Heartbeat state ───────────────────────────────────────────────
var heartbeatTimerId     : ?Timer.TimerId = null;   // NOT stable — reset on upgrade
var lastHeartbeatAt      : Nat64          = 0;
var lastBackupAt         : Nat64          = 0;
var shardProposalPending : Bool           = false;

func startHeartbeat<system>() {
  // Cancel existing timer to avoid duplicates on upgrade
  switch (heartbeatTimerId) {
    case (?id) Timer.cancelTimer(id);
    case null  ();
  };
  if (governanceSettings.heartbeatEnabled) {
    let intervalNs = governanceSettings.heartbeatIntervalSecs * 1_000_000_000;
    heartbeatTimerId := ?Timer.recurringTimer<system>(
      #nanoseconds(Nat64.toNat(intervalNs)),
      heartbeatTick
    );
  };
};

// Called once in actor body — automatically re-arms on every upgrade
startHeartbeat<system>();
```

### What runs on each tick

```motoko
func heartbeatTick() : async () {
  if (not governanceSettings.heartbeatEnabled) return;
  let nowSecs = Nat64.fromNat(Int.abs(Time.now()) / 1_000_000_000);
  lastHeartbeatAt := nowSecs;

  finalizeExpiredProposals();                                  // 1. Close expired proposals
  if (nowSecs >= lastBackupAt + governanceSettings.backupIntervalSecs) {
    performBackup("heartbeat");                                // 2. Auto-backup (default: weekly)
  };
  checkShardingTrigger();                                      // 3. Monitor heap; propose shard if needed
  await fetchAllEnabledFeeds();                                // 4. Poll HTTP data feeds
};
```

### Use cases

| Task                          | When triggered                                    | Cycle budget (approx)    |
|-------------------------------|---------------------------------------------------|--------------------------|
| `finalizeExpiredProposals()`  | Every tick; only acts on expired proposals        | ~100K (no async)         |
| `performBackup("heartbeat")`  | If `now >= lastBackupAt + backupIntervalSecs`     | ~1M (snapshot serialization) |
| `checkShardingTrigger()`      | Every tick; reads heap via `Prim.rts_heap_size()` | ~50K (pure read)         |
| `fetchAllEnabledFeeds()`      | Every tick; only if feeds are enabled             | ≥3B per feed (HTTP outcall) |

### Cycle cost implications

- **HTTP outcalls dominate.** Each enabled feed costs ≥3B cycles per tick.
- Keep `heartbeatIntervalSecs` ≥ 3600 (1 hour) by default to contain costs.
- Disable feeds or set `heartbeatEnabled = false` if the canister is low on cycles.
- Monitor: `getHeartbeatStatus()` returns `lastHeartbeatAt`, `lastBackupAt`, `timerId` presence.

### Controlling via governance

```motoko
// Toggle on/off (admin only — DAO sets via #ChangeGovernance proposal)
public shared ({ caller }) func setHeartbeatEnabled<system>(enabled : Bool) : async () {
  requireAdmin(caller);
  governanceSettings := { governanceSettings with heartbeatEnabled = enabled };
  startHeartbeat<system>();  // restarts or cancels based on new setting
};
```

---

## 6. Blob Upload Pipeline

### Use cases

The chunked blob upload pipeline stores large binary assets that cannot fit in a single ICP message (~2 MB cap). Used for:

- `#UpdateFrontend` proposals — React/JS bundles, CSS, HTML
- `#UpdateMotoko` proposals — Motoko source text (or compiled WASM)
- `#ImportSeasonData` proposals — CSV/JSON season data files
- HTTP feed full body storage (optional; `feedResults` stores snippet only by default)

### Chunked upload pattern

ICP messages are capped at **~2 MB** (exact: `1_990_656` bytes = 1.9 MB). Large files are split into chunks before upload:

```motoko
// Step 1: initialize a blob upload slot
public shared ({ caller }) func initBlobUpload(
  name       : Text;
  mimeType   : Text;
  totalSize  : Nat32;
  chunkCount : Nat32;
  sha256     : ?Blob;
) : async Types.BlobId {
  requireAdmin(caller);
  let id = nextBlobId();
  blobStore.add(id, { id; name; mimeType; totalSize; chunkCount;
    uploadedAt = Time.now(); uploadedBy = caller; isActive = false; sha256 });
  blobChunks.add(id, Map.empty());  // nested Map for chunk data
  id
};

// Step 2: upload each chunk (0-indexed, max 1.9 MB per call)
public shared ({ caller }) func uploadBlobChunk(
  blobId     : Types.BlobId;
  chunkIndex : Nat32;
  data       : Blob;
) : async () {
  requireAdmin(caller);
  let chunks = switch (blobChunks.get(blobId)) {
    case (?m) m;
    case null Runtime.trap("Blob not found");
  };
  chunks.add(chunkIndex, data);
};

// Step 3: finalize — marks blob as active and optionally links it as an asset
public shared ({ caller }) func finalizeBlob(
  blobId   : Types.BlobId;
  assetPath : ?Text;           // e.g., ?"/index.js" → activeFrontendAssets
) : async () {
  requireAdmin(caller);
  // ... verify chunk count, mark isActive = true, update activeFrontendAssets if path given
};
```

### Storage in stable Maps

```
blobStore:             BlobId → BlobEntry (metadata only — no binary in the metadata record)
blobChunks:            BlobId → Map<Nat32, Blob> (nested Map; each Nat32 is chunkIndex)
activeFrontendAssets:  Text → BlobId (path → currently active blob for HTTP serving)
activeMotokoSource:    Text → BlobId (module name → active source blobId)
```

### SHA-256 verification pattern

```motoko
// Caller optionally supplies expected SHA-256 during initBlobUpload
// finalizeBlob can verify: recompute hash over all chunk bytes and compare to sha256 field
// If mismatch → trap "SHA-256 mismatch — upload corrupted"
// If sha256 = null → skip verification (trust the uploader)
```

### Never eval() blobs on the frontend

Blob bytes stored in the canister are served as HTTP assets via `getHTTPAsset()`. The browser loads them through normal script/link tags — NOT runtime `eval()` or `new Function()`:

```typescript
// ❌ NEVER do this
const blob = await actor.getBlobChunk(blobId, 0);
eval(new TextDecoder().decode(blob));

// ✅ Blobs are served as HTTP assets; browser loads them normally
// canister HTTP endpoint: GET /assets/index.js → returns Blob bytes with Content-Type header
```

---

## 7. Event Log (XOR Hash Chain)

### Structure

Every state-mutating action appends an entry to `eventLog`:

```motoko
type EventLogEntry = {
  id           : EventId;    // Nat32 sequential
  timestamp    : Timestamp;  // Int nanoseconds (Time.now())
  eventType    : Text;       // e.g. "ProposalSubmitted", "Vote", "APIKeyRegistered"
  details      : Text;       // human-readable: "id=1 proposer=aaaaa-aa stake=1000000000"
  previousHash : ?Blob;      // null for entry #1; hash of previous entry otherwise
  hash         : Blob;       // 8-byte XOR chain hash (see below)
};
```

### Hash computation

The chain hash is an **8-byte XOR integrity seal**, not a cryptographic commitment:

```motoko
func computeHash(prevHash : ?Blob, id : EventId, timestamp : Int) : Blob {
  // 1. Extract 8 bytes from previous hash (zero-pad if null or shorter)
  // 2. Combine id and low bits of timestamp: mixed = tsNat XOR idNat
  // 3. Extract 8 bytes of mixed in little-endian order
  // 4. XOR each byte: result[i] = prevArr[i] XOR mixedArr[i]
  // → Returns 8-byte Blob
};
```

### How to verify the chain

```motoko
// Verify chain integrity: O(n) scan of all entries
for (entry in eventLog.vals()) {
  let expected = computeHash(entry.previousHash, entry.id, entry.timestamp);
  assert (entry.hash == expected);   // any mismatch → chain tampered
};
```

### Querying the log

```motoko
// Frontend: getEventLog(page, pageSize) returns paginated entries
public query func getEventLog(page : Nat32, pageSize : Nat32) : async [Types.EventLogEntry] {
  let start = page * pageSize;
  let all = eventLog.vals().toArray();
  let end = Nat32.min(start + pageSize, Nat32.fromNat(all.size()));
  Array.slice(all, start.toNat(), end.toNat())
};
```

### Auditability guarantees

- **Append-only:** No entry is ever deleted or updated — only `add()` is called.
- **Chain integrity:** Each entry's hash depends on the previous hash + its own ID + timestamp. Any tampering breaks the chain from that point forward.
- **Not cryptographic:** The XOR hash is lightweight and detects accidental corruption or simple tampering. It is NOT a secure Merkle tree — do not rely on it as a cryptographic proof.
- **Full replay audit:** By replaying all `EventLogEntry.eventType` + `details` fields in order, you can reconstruct the full governance history of the canister.

---

## 8. Cycle Management

### How cycles are consumed

| Operation                        | Approximate cost         |
|----------------------------------|--------------------------|
| Update call (base)               | ~590K cycles             |
| Storage (stable memory)          | ~127K cycles / GB / sec  |
| HTTP outcall (IC management)     | ≥ 3B cycles per call     |
| Inter-canister call (base)       | ~260K cycles             |
| Computation (WebAssembly ops)    | ~1 cycle per instruction  |

### ExperimentalCycles is deprecated — use `(with cycles = N)` syntax

```motoko
// ❌ Deprecated (will stop compiling in future Motoko versions)
import ExperimentalCycles "mo:base/ExperimentalCycles";
ExperimentalCycles.add(3_000_000_000);
let resp = await IC.http_request(req);

// ✅ Correct syntax — attach cycles inline at the call site
let resp = await (with cycles = 3_000_000_000) IC.http_request(req);
```

### HTTP outcall cycle budget

Always attach at least **3 billion cycles** (3B) per HTTP outcall. This covers:
- Base outcall fee
- Response ingress bytes
- Consensus overhead across all subnet nodes

```motoko
let response = await (with cycles = 3_000_000_000) IC.http_request({
  url               = cfg.url;
  max_response_bytes = ?500_000;  // safety cap: 500 KB
  method            = #get;
  headers           = [...];
  body              = null;
  transform         = null;
});
```

### Monitoring cycles / heap

```motoko
import Prim "mo:⛔";

// Heap size in bytes
let heapBytes : Nat = Prim.rts_heap_size();
let heapMb    : Nat32 = Nat32.fromNat(heapBytes / 1_048_576);

// Canister cycles balance (from mo:core)
import Cycles "mo:core/ExperimentalCycles";  // if available; otherwise use management canister query
```

### Stable storage cycle estimate

As a rough planning rule: **~4 cycles per byte per year** for stable memory on the IC (varies with subnet and time). A 1 GB schema store costs ~4B cycles/year ≈ ~$0.04/year at current rates.

---

## 9. Security Patterns

### Always validate msg.caller

The Internet Computer does not authenticate callers — the canister is responsible.

```motoko
// ✅ Reject anonymous calls on any state-mutating method
public shared ({ caller }) func createThread(title : Text, content : Text) : async () {
  requireAuth(caller);              // panics if caller.isAnonymous()
  await requireICFCBalance(caller, 1);  // check on-chain balance
  ...
};
```

### Principle of least privilege

Grant each principal only the capabilities it needs:

```motoko
// Admin-only: execute proposals, moderate forum, trigger backups
public shared ({ caller }) func executeProposal(id : ProposalId) : async () {
  requireAdmin(caller);
  ...
};

// Authenticated ICFC holders: submit proposals, vote, post
public shared ({ caller }) func submitProposal(...) : async ProposalId {
  requireAuth(caller);
  await requireICFCBalance(caller, 1);
  ...
};

// Public (no auth): read-only data access
public query func getAllProposals() : async [Proposal] {
  proposals.values().toArray()
};
```

### Rate limiting pattern

```motoko
// Check call rate before processing
func checkRateLimit(consumerId : Types.ConsumerId, limitPerMin : Nat32) : Bool {
  let nowNs = Time.now();
  let windowNs : Int = 60_000_000_000;  // 1 minute in nanoseconds
  switch (apiRateLimits.get(consumerId)) {
    case null {
      apiRateLimits.add(consumerId, { windowStart = nowNs; callCount = 1 });
      true
    };
    case (?entry) {
      if (nowNs - entry.windowStart > windowNs) {
        // New window
        apiRateLimits.add(consumerId, { windowStart = nowNs; callCount = 1 });
        true
      } else if (entry.callCount >= limitPerMin) {
        false  // rate limited
      } else {
        apiRateLimits.add(consumerId, { entry with callCount = entry.callCount + 1 });
        true
      };
    };
  };
};
```

### No eval() / dynamic code execution on the frontend

The DAO's `#UpdateFrontend` proposal stores blob bytes and maps them to a path. The frontend itself must never `eval()` or `new Function()` these bytes at runtime:

```typescript
// ❌ Never do this
const blob = await actor.getBlobChunk(blobId, 0);
eval(new TextDecoder().decode(blob));

// ✅ Correct: blobs are served as static HTTP assets via getHTTPAsset()
// and delivered through normal browser asset loading, NOT runtime eval
```

### CSP headers for canister-served frontends

The Vite build outputs a static asset canister. Ensure your canister's HTTP response includes:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
```

---

## 10. HTTP Outcalls

### When to use IC management canister `http_request`

Use IC HTTP outcalls when you need to fetch external data (football APIs, price feeds, etc.) from within the canister. All replicas in the subnet make the same request and must agree on the response — hence the `transform` function requirement for non-deterministic responses.

### The IC management canister actor interface

```motoko
let IC = actor "aaaaa-aa" : actor {
  http_request : ({
    url               : Text;
    max_response_bytes : ?Nat64;
    method            : { #get; #post; #head };
    headers           : [{ name : Text; value : Text }];
    body              : ?Blob;
    transform         : ?{
      function : shared query ({
        response : { status : Nat; headers : [{ name : Text; value : Text }]; body : Blob };
        context  : Blob;
      }) -> async { status : Nat; headers : [{ name : Text; value : Text }]; body : Blob };
      context : Blob;
    };
  }) -> async {
    status  : Nat;
    headers : [{ name : Text; value : Text }];
    body    : Blob;
  };
};
```

### Transform function

Pass `transform = null` only when the response is deterministic across all replicas (e.g., a static JSON endpoint with no timestamps or request IDs in the body). For most real-world APIs, implement a `shared query` transform to strip non-deterministic headers/fields:

```motoko
// Transform strips non-deterministic headers; replicas all agree on body
public shared query func transformResponse(raw : {
  response : { status : Nat; headers : [{ name : Text; value : Text }]; body : Blob };
  context  : Blob;
}) : async { status : Nat; headers : [{ name : Text; value : Text }]; body : Blob } {
  { status = raw.response.status; headers = []; body = raw.response.body }
};

// Pass it in the outcall
transform = ?{
  function = transformResponse;
  context  = Blob.fromArray([]);
};
```

### Cycle attachment and response size cap

```motoko
let response = try {
  await (with cycles = 3_000_000_000) IC.http_request({
    url               = cfg.url;
    max_response_bytes = ?(Nat64.fromNat(cfg.maxResponseBytes.toNat()));
    method            = #get;
    headers;
    body              = null;
    transform         = null;  // or ?{ function = transformFn; context = ... }
  })
} catch (_e) {
  return #err("HTTP outcall failed");
};
```

Set `max_response_bytes` to a reasonable cap (default 500 KB = `500_000`). Larger responses cost proportionally more cycles.

---

## 11. mo:core vs mo:base

### Module equivalents

| mo:base                  | mo:core equivalent          | Notes                                         |
|--------------------------|-----------------------------|-----------------------------------------------|
| `mo:base/HashMap`        | `mo:core/Map`               | `Map.empty()` creates mutable map             |
| `mo:base/OrderedMap`     | `mo:core/Map`               | Same; drop the ordered requirement            |
| `mo:base/Buffer`         | `mo:core/List`              | `List.empty()`, `list.add()`, `list.toArray()`|
| `mo:base/Array`          | Removed — use `[T]` methods | Dot-notation: `arr.size()`, `arr.concat()`    |
| `mo:base/Nat32`          | `mo:core/Nat32`             | Same API; dot notation for methods            |
| `mo:base/Text`           | `mo:core/Text`              | **Dot notation**: `iter.join(sep)` not `Text.join(sep,iter)` |
| `mo:base/Principal`      | `mo:core/Principal`         | `p.isAnonymous()`, `p.toText()` dot notation  |
| `mo:base/Timer`          | **No equivalent in mo:core**| `import Timer "mo:base/Timer"` — always use mo:base for timers |

### mo:core Map usage

```motoko
import Map "mo:core/Map";

var store : Map.Map<Nat32, Text> = Map.empty();

// Add / upsert
store.add(1, "hello");

// Get
let val : ?Text = store.get(1);

// Remove
store.remove(1);

// Iterate
for ((k, v) in store.entries()) { ... };

// Size
let n : Nat = store.size();

// Check membership
let exists : Bool = store.containsKey(1);
```

### mo:core List usage

```motoko
import List "mo:core/List";

var history : List.List<Text> = List.empty();
history.add("event1");
history.add("event2");

let arr : [Text] = history.toArray();
let n : Nat = history.size();

// Iterate
for (item in history.values()) { ... };

// Last element
let last : ?Text = history.last();
```

### Timer: always use mo:base/Timer

```motoko
// ✅ Correct — mo:core has no Timer module
import Timer "mo:base/Timer";

let timerId : Timer.TimerId = Timer.recurringTimer<system>(#nanoseconds interval, callback);
Timer.cancelTimer(timerId);
```

### Text module — dot notation differences

```motoko
// ✅ mo:core Text: iterator dot notation
let joined : Text = someIter.join(", ");          // iter.join(sep)
let encoded : Blob = myText.encodeUtf8();

// ❌ mo:base style — does NOT work with mo:core
let joined2 : Text = Text.join(", ", someIter);   // Wrong in mo:core

// ✅ Text iteration with takeWhile
let snippet : Text = Text.fromIter(
  bigText.toIter().takeWhile(func(_c : Char) : Bool {
    charCount += 1;
    charCount <= 500
  })
);
```

### Migration pattern: BaseToCore.mo

When migrating an existing canister from `mo:base` to `mo:core`, use a `BaseToCore.mo` bridge module to convert data structures during the upgrade, then remove it once fully migrated.

```motoko
// BaseToCore.mo — conversion helpers
module {
  import OldMap "mo:base/HashMap";
  import NewMap "mo:core/Map";

  public func hashMapToMap<K, V>(hm : OldMap.HashMap<K, V>) : NewMap.Map<K, V> {
    let m : NewMap.Map<K, V> = NewMap.empty();
    for ((k, v) in hm.entries()) { m.add(k, v) };
    m
  };
};
```

---

*Last updated: April 2026. Source of truth: `src/backend/main.mo`, `src/backend/Types.mo`, `src/backend/Ledger.mo`, `src/backend/migration.mo`.*
