# FootballHEIR Project Conventions

How this DAO is structured, how to extend it, and how to keep the codebase consistent.
Use this alongside `docs/icp-coding-standards.md` for the full picture.

---

## 1. Project Overview

**FootballHEIR** is a fully on-chain, DAO-governed football database deployed on the Internet Computer. The canister starts completely empty — no football entities exist at genesis. Every table, column, rule, frontend page, API endpoint, and governance parameter is created, modified, or deleted exclusively via proposals from ICFC token holders.

**Access model:**
- `≥ 1 ICFC` → full rights: propose, vote, post in forum
- `0 ICFC` → read-only public access (no login required)

### Key constants

| Constant                        | Value                                        |
|---------------------------------|----------------------------------------------|
| ICFC ledger canister ID         | `ddsp7-7iaaa-aaaaq-aacqq-cai`                |
| Default quorum                  | `0%` (any positive vote count passes)        |
| Default min stake               | `1_000_000_000` e8s (10 ICFC)                |
| Default voting period           | `604_800_000_000_000` ns (7 days)            |
| Default dispute window          | `86_400_000_000_000` ns (24 hours)           |
| Default dispute reward          | `0%` (DAO-configurable up to 20%)            |
| Auto-sharding threshold         | `400` GiB heap                               |
| Default API rate limit          | `10` calls/min per consumer                  |
| Heartbeat interval              | `3_600` s (1 hour)                           |
| Backup interval                 | `604_800` s (7 days)                         |
| Max blob chunk size             | `1_990_656` bytes (1.9 MB — ICP message cap) |

### File structure map

```
app/
├── src/
│   ├── backend/
│   │   ├── main.mo          # Sole actor — all stable state, all public API
│   │   ├── Types.mo         # All shared types (no logic)
│   │   ├── Ledger.mo        # ICRC-1 ledger interface for ICFC
│   │   ├── migration.mo     # Schema migration: adds new GovernanceSettings fields
│   │   └── BaseToCore.mo    # (internal) mo:base → mo:core conversion helpers
│   └── frontend/
│       └── src/
│           ├── App.tsx                # Router (manual state) + providers
│           ├── types.ts               # Re-exports from backend.d.ts + UI extensions
│           ├── i18n.ts                # i18n context, translations (en/es/vi)
│           ├── backend.d.ts           # Auto-generated — DO NOT EDIT
│           ├── backend.ts             # Auto-generated — DO NOT EDIT
│           ├── hooks/
│           │   ├── useActor.ts        # Generated actor factory — DO NOT EDIT
│           │   ├── useInternetIdentity.ts
│           │   └── useQueries.ts      # ALL React Query hooks live here
│           ├── pages/
│           │   ├── HomePage.tsx
│           │   ├── ProposalsPage.tsx
│           │   ├── GovernancePage.tsx
│           │   ├── ForumPage.tsx
│           │   └── APIPage.tsx
│           ├── components/
│           │   ├── Header.tsx
│           │   ├── Footer.tsx
│           │   ├── Layout.tsx
│           │   ├── ProfileSetupModal.tsx
│           │   └── DataFeedsPanel.tsx
│           └── mocks/
│               └── backend.ts         # Mock backend for local dev / visual tests
├── docs/
│   ├── icp-coding-standards.md    # General ICP/Motoko best practices
│   ├── project-conventions.md     # This file
│   └── dao-bootstrap-guide.md     # Genesis verification + first proposals walkthrough
└── AGENTS.md                      # Verified CLI commands for this project
```

---

## 2. How to Add a New Proposal Type

Adding a proposal type involves three steps: the backend type definition, the execution logic, and the frontend UI.

### Step 1 — Add the variant to `Types.mo`

Open `src/backend/Types.mo` and add your new variant to the `ProposalType` variant type:

```motoko
// Types.mo
public type ProposalType = {
  // ... existing variants ...
  #NewAPIPrice;
  #EditAPIPrice;
  #DeleteAPIPrice;
  #YourNewProposalType;   // ← add here
};
```

Re-run `pnpm bindgen` from the project root after any backend type change.

### Step 2 — Add execution logic to `main.mo`

In `src/backend/main.mo`, find the `executeProposal` function. Inside the `if (approved)` branch, locate the `switch (proposal.proposalType)` block and add your case:

```motoko
case (#YourNewProposalType) {
  // Parse the proposal.content field (CSV format is the convention)
  // CSV example: "field1,field2,field3"
  let parts = proposal.content.split(#char ',').toArray();
  if (parts.size() < 3) Runtime.trap("YourNewProposalType: invalid content format");

  // Apply the change to stable state
  let id = nextSomeId();
  someStore.add(id, {
    id;
    name      = parts[0];
    someValue = switch (Nat.fromText(parts[1])) { case (?n) n.toNat32(); case null 0 };
  });

  // Always append to event log
  appendEvent("YourNewProposalType", "id=" # id.toText() # " name=" # parts[0]);
};
```

**CSV content format convention:**

All proposal content uses comma-separated values. The first field is always the primary identifier or action keyword. When a field is optional or should represent "null", use an empty string `""`.

```
// NewAPIPrice: name,tokenId,objectTypeId,pricePerCall,priceBatchCall,batchSizeThreshold
"Player Query,0,,100,80,5"        // objectTypeId = "" (wildcard)
"Match Query,0,2,200,150,5"       // objectTypeId = 2 (scoped to Match)

// ConfigureRealTimeFeeds: action,... (create|update|delete)
"create,API-Football,https://api-football.com/v3,X-RapidAPI-Key,myKey,3600,true,500000"
"delete,1"
```

### Step 3 — Expose it in the frontend proposal creation dialog

In `src/frontend/src/pages/ProposalsPage.tsx`, the proposal type select is driven by the `ProposalType` variant exported from `backend.d.ts`. After running `pnpm bindgen`, the new variant will automatically appear in the select list.

To add a pre-built form template for the new type, add a case to the content template helper (look for the `proposalContentTemplate` function or similar in `ProposalsPage.tsx`):

```typescript
// ProposalsPage.tsx
function getContentTemplate(type: ProposalTypeKey): string {
  switch (type) {
    case "NewAPIPrice":
      return "name,tokenId,objectTypeId,pricePerCall,priceBatchCall,batchSizeThreshold";
    case "YourNewProposalType":
      return "field1,field2,field3";  // ← add here
    default:
      return "";
  }
}
```

---

## 3. All 42 Proposal Types — Reference

All proposals use the same `Proposal` record; differentiation is via `proposalType` and `content` (CSV).
`executeProposal()` switches on `proposalType` to determine execution logic.

### Schema proposals

| Type              | CSV content format                                              | Execution effect                                      |
|-------------------|-----------------------------------------------------------------|-------------------------------------------------------|
| `#NewObjectType`  | `name,description`                                              | Creates ObjectType entry in `objectTypes`             |
| `#EditObjectType` | `objectId,name,description`                                     | Updates name/description of existing ObjectType       |
| `#DeleteObjectType`| `objectId`                                                     | Removes ObjectType + its attributes from stable Maps  |
| `#NewAttribute`   | `objectId,name,dataType,isRequired,defaultValue`               | Appends Attribute to ObjectType.attributes            |
| `#EditAttribute`  | `objectId,attrId,name,dataType,isRequired,defaultValue`        | Updates existing Attribute                            |
| `#DeleteAttribute`| `objectId,attrId`                                               | Removes Attribute from ObjectType                     |
| `#NewMethod`      | `objectId,name,description,codeHex`                            | Appends MethodDefinition to ObjectType.methods        |
| `#EditMethod`     | `objectId,methodId,name,description,codeHex`                   | Updates existing MethodDefinition                     |
| `#DeleteMethod`   | `objectId,methodId`                                             | Removes MethodDefinition from ObjectType              |

### Code update proposals

| Type              | CSV content format                        | Execution effect                                          |
|-------------------|-------------------------------------------|-----------------------------------------------------------|
| `#UpdateFrontend` | `blobId,path`                             | Sets `activeFrontendAssets[path] = blobId`                |
| `#UpdateCSS`      | `blobId`                                  | Updates active CSS blob reference                         |
| `#UpdateHTML`     | `blobId`                                  | Updates active HTML blob reference                        |
| `#UpdateMotoko`   | `blobId,moduleName`                       | Sets `activeMotokoSource[moduleName] = blobId`            |
| `#UpdateCanister` | `blobId`                                  | Triggers WASM upgrade with blob (future integration)      |

### Governance proposals

| Type               | CSV content format                            | Execution effect                                           |
|--------------------|-----------------------------------------------|------------------------------------------------------------|
| `#ChangeGovernance`| `field,value` (one field per proposal)        | Updates `governanceSettings` field; restarts heartbeat if timing fields change |
| `#TreasuryAction`  | `action,tokenId,amount,recipient`             | Transfers from canister treasury to recipient via ledger   |
| `#BatchOp`         | `proposalId1,proposalId2,...`                 | Executes multiple proposals atomically                     |
| `#SimulateProposal`| same as target proposal content               | Dry-runs execution; writes to `simulationResult`, no state change |

### Template / dashboard / doc proposals

| Type              | CSV content format                        | Execution effect                                 |
|-------------------|-------------------------------------------|--------------------------------------------------|
| `#NewTemplate`    | `name,description,content`               | Creates Template in `templates`                  |
| `#EditTemplate`   | `templateId,name,description,content`    | Updates Template                                 |
| `#DeleteTemplate` | `templateId`                             | Removes Template                                 |
| `#NewDashboard`   | `userId,layout,widget1,widget2,...`       | Creates DashboardConfig in `dashboardConfigs`    |
| `#EditDashboard`  | `dashId,layout,widget1,widget2,...`       | Updates DashboardConfig                          |
| `#DeleteDashboard`| `dashId`                                  | Removes DashboardConfig                          |
| `#NewDynamicDoc`  | `title,content`                           | Creates DynamicDoc in `dynamicDocs`              |
| `#EditDynamicDoc` | `docId,title,content`                     | Updates DynamicDoc                               |
| `#DeleteDynamicDoc`| `docId`                                  | Removes DynamicDoc                               |

### Data feed / import proposals

| Type                   | CSV content format                                                              | Execution effect                                 |
|------------------------|---------------------------------------------------------------------------------|--------------------------------------------------|
| `#ConfigureRealTimeFeeds` | `create/update/delete,...` (see CSV format above)                           | Creates/updates/deletes FeedConfig in `feedConfigs` |
| `#SetInitialData`      | `objectTypeId,data` (JSON/CSV data blob reference)                              | Seeds initial records for an ObjectType          |
| `#ImportSeasonData`    | `blobId,objectTypeId`                                                           | Imports CSV blob into ObjectType dynamic store   |

### Infrastructure proposals

| Type                | CSV content format               | Execution effect                                         |
|---------------------|----------------------------------|----------------------------------------------------------|
| `#BackupSchema`     | *(empty)*                        | Calls `performBackup("proposal")`; stores BackupEntry    |
| `#RestoreSchema`    | `backupId,reason`                | Logs restore intent + event; full restore requires admin |
| `#AdjustRateLimit`  | `consumerId,newLimit`            | Updates `APIConsumerV2.rateLimit` for consumer           |
| `#NewDataCanister`  | `subnetHint`                     | Logs intent to create a child data canister (sharding)   |
| `#NewForumCanister` | `subnetHint`                     | Logs intent to create a dedicated forum canister         |

### API monetization proposals

| Type           | CSV content format                                                       | Execution effect                                |
|----------------|--------------------------------------------------------------------------|-------------------------------------------------|
| `#NewAPIPrice` | `name,tokenId,objectTypeId,pricePerCall,priceBatchCall,batchSizeThreshold` | Creates APIPricePackage in `apiPricePackages` |
| `#EditAPIPrice`| `pkgId,name,tokenId,objectTypeId,pricePerCall,priceBatchCall,batchSizeThreshold` | Updates APIPricePackage                  |
| `#DeleteAPIPrice` | `pkgId`                                                               | Marks APIPricePackage as inactive               |

### Moderation / dispute proposals

| Type               | CSV content format               | Execution effect                                            |
|--------------------|----------------------------------|-------------------------------------------------------------|
| `#BanUser`         | `principal,reason`               | Sets `bannedUsers[principal] = true`; logs event            |
| `#UnbanUser`       | `principal`                      | Removes from `bannedUsers`; logs event                      |
| `#DisputeProposal` | `targetProposalId,reason`        | Opens dispute on executed proposal within window            |
| `#DeletePost`      | `threadId,postId`                | Sets `post.isDeleted = true`                                |
| `#DeleteThread`    | `threadId`                       | Sets `thread.isDeleted = true`                              |
| `#PinPost`         | `threadId,postId`                | Sets `post.isPinned = true`                                 |

---

## 4. Backend Architecture

### Actor structure (`main.mo`)

The actor is organized in sections separated by comment banners:

```
1. Imports
2. ICFC Token Ledger constant + burn account
3. Access control state (adminRoles, adminAssigned)
4. Core storage (proposals, objectTypes, eventLog, etc.)
5. API monetization storage (apiTokens, apiPricePackages, apiConsumersV2)
6. Blob pipeline storage (blobStore, blobChunks, activeFrontendAssets)
7. HTTP Feed storage (feedConfigs, feedResults, importHistory)
8. GovernanceSettings singleton
9. Heartbeat state (timerId, lastRun, lastBackupAt, etc.)
10. Internal helpers (isAdmin, requireAuth, appendEvent, hash functions, etc.)
11. Feed helpers (fetchFeed, fetchAllEnabledFeeds)
12. Public API — ICFC balance queries
13. Public API — proposals (submit, vote, execute, simulate, dispute)
14. Public API — object types
15. Public API — event log
16. Public API — templates, dashboards, docs
17. Public API — API consumers (legacy + V2)
18. Public API — API monetization (registerAPIKey, depositAPIBalance, deductAPICall)
19. Public API — blob pipeline (initBlobUpload, uploadBlobChunk, finalizeBlob)
20. Public API — forum (createThread, addPost, getThread)
21. Public API — moderation (deletePost, deleteThread, pinPost, banUser, unbanUser)
22. Public API — HTTP feed management (getFeedConfigs, manualFetchFeed, triggerFeedPoll)
23. Public API — season import history
24. Public API — heartbeat (getHeartbeatStatus, triggerManualBackup, restoreFromBackup)
```

### Proposal lifecycle: submit → vote → execute

```
submitProposal()
  ├─ requireAuth(caller)
  ├─ requireICFCBalance(caller, 1)      ← live ledger check
  ├─ if stake < minStake → trap
  ├─ Create Proposal { status = #Submitted, votingEndsAt = now + votingPeriod }
  └─ appendEvent("ProposalSubmitted", ...)

voteOnProposal()
  ├─ requireAuth(caller)
  ├─ if now > votingEndsAt → trap
  ├─ if already voted → trap
  ├─ VP = await icrc1_balance_of(caller)  ← live ledger
  ├─ accumulate votesFor / votesAgainst
  └─ appendEvent("Vote", ...)

executeProposal()        [admin only]
  ├─ requireAdmin(caller)
  ├─ if still in voting period → trap
  ├─ approved = votesFor > votesAgainst
  ├─ if approved → run side-effects switch(proposalType)
  │     → set status = #Executed, disputeWindowEnd = now + disputeWindow
  │     → auto-return stake via icrc1_transfer
  └─ if rejected → set status = #Rejected, disputeWindowEnd = now + disputeWindow
       [stake burns after dispute window via burnStake()]

Heartbeat finalizeExpiredProposals() [async, periodic]
  └─ Moves #Submitted/#Voting proposals past votingEndsAt to #Approved or #Rejected
     (does NOT execute — admin must call executeProposal for that)
```

### Staking flow

1. **Before calling `submitProposal`**: The frontend must transfer `stake` e8s from the proposer's wallet to the canister principal via `icrc1_transfer` on the ICFC ledger directly. The canister does NOT pull funds itself at submission time.
2. **At submission**: Canister records `stake` in the `Proposal` struct, sets `executionResult = "StakePending"`.
3. **On pass + execution**: Canister auto-calls `transferFromCanister(proposer, stake)` to return the stake.
4. **On rejection**: Stake stays in canister until the dispute window closes, then admin calls `burnStake(proposalId)` which calls `transferFromCanister(BURN_ACCOUNT, stake)`.
5. **Burn account**: `Principal.fromText("aaaaa-aa")` (IC management canister) — effectively destroys the tokens.

### API monetization flow

```
addAPIToken() [admin]          → creates APIToken { id, ledgerId, symbol, decimals, minDeposit }
#NewAPIPrice proposal          → creates APIPricePackage { pricePerCall, priceBatchCall, batchSizeThreshold }

registerAPIKey(tokenId)        → creates APIConsumerV2 { apiKey: Blob(32), balance: 0 }
depositAPIBalance(apiKey, amt) → pulls amt from caller via icrc1_transfer → credits consumer.balance
deductAPICall(apiKey, ...)     → resolvePrice() → if balance >= price → deduct → #ok else #err

resolvePrice() logic:
  1. Find packages matching consumer.tokenId
  2. Prefer package scoped to objectTypeId over wildcard (null)
  3. If isBatch AND batchSize >= pkg.batchSizeThreshold → use priceBatchCall, else pricePerCall
```

#### APIConsumerV2 fields

| Field           | Type         | Purpose                                               |
|-----------------|--------------|-------------------------------------------------------|
| `id`            | `ConsumerId` | Sequential Nat32 primary key                          |
| `owner`         | `Principal`  | Who registered this key                               |
| `apiKey`        | `Blob`       | 32-byte random key; used as lookup token              |
| `tokenId`       | `APITokenId` | Which token (ICFC, ICP, etc.) this consumer pays with |
| `balance`       | `TokenAmt`   | Prepaid balance in e8s (decremented per call)         |
| `totalDeposited`| `TokenAmt`   | Lifetime deposits (for auditing)                      |
| `totalSpent`    | `TokenAmt`   | Lifetime spend (for auditing)                         |
| `callCount`     | `Nat32`      | Total single calls made                               |
| `batchCallCount`| `Nat32`      | Total batch calls made                                |
| `createdAt`     | `Timestamp`  | Registration timestamp                                |
| `lastCallAt`    | `Timestamp`  | Last API call timestamp (for rate-limit window)       |
| `isActive`      | `Bool`       | Admin can deactivate without deleting                 |
| `rateLimit`     | `Nat32`      | Calls/min; 0 = use `governanceSettings.defaultRateLimitPerMin` |

#### APIPricePackage fields

| Field                | Type         | Purpose                                                  |
|----------------------|--------------|----------------------------------------------------------|
| `id`                 | `APIPkgId`   | Nat8 — max 255 packages                                  |
| `name`               | `Text`       | Human label e.g. "Player Query Standard"                 |
| `tokenId`            | `APITokenId` | Which payment token applies                              |
| `objectTypeId`       | `?ObjectId`  | null = wildcard (any object type); Nat32 = scoped        |
| `pricePerCall`       | `TokenAmt`   | e8s per single call                                      |
| `priceBatchCall`     | `TokenAmt`   | e8s per batch call (must be ≤ pricePerCall)              |
| `batchSizeThreshold` | `Nat8`       | Min items in batch to qualify for batch price            |
| `isActive`           | `Bool`       | Inactive packages are not used for price resolution      |

### Event log — hash chaining

Every state-mutating action calls `appendEvent(eventType, details)`:

```motoko
func appendEvent(eventType : Text, details : Text) {
  let id      = nextEventId();     // sequential Nat32
  let now     = Time.now();
  let prevHash : ?Blob = switch (eventLog.get(Nat32.fromNat(eventLog.size()))) {
    case (?e) ?e.hash;
    case null  null;
  };
  let hash = computeHash(prevHash, id, now);  // XOR-based 8-byte chain hash
  eventLog.add(id, { id; timestamp = now; eventType; details; previousHash = prevHash; hash });
};
```

The hash chain uses XOR of (previous hash XOR little-endian bytes of `id XOR timestamp`). It is an integrity chain, not a cryptographic commitment — do not use it as a cryptographic proof.

### Heartbeat: what runs on each tick

`heartbeatTick()` is called by `Timer.recurringTimer` every `heartbeatIntervalSecs` (default: 1 hour):

```
heartbeatTick()
  1. if not governanceSettings.heartbeatEnabled → return
  2. finalizeExpiredProposals()      — auto-close proposals past votingEndsAt
  3. if nowSecs >= lastBackupAt + backupIntervalSecs → performBackup("heartbeat")
  4. checkShardingTrigger()          — if heap >= threshold → auto-create #NewDataCanister proposal
  5. await fetchAllEnabledFeeds()    — fetch all enabled HTTP data feeds
```

**To add a new periodic task**, add a function call inside `heartbeatTick()`:

```motoko
func heartbeatTick() : async () {
  if (not governanceSettings.heartbeatEnabled) return;
  let nowSecs = Nat64.fromNat(Int.abs(Time.now()) / 1_000_000_000);
  lastHeartbeatAt := nowSecs;
  finalizeExpiredProposals();
  if (nowSecs >= lastBackupAt + governanceSettings.backupIntervalSecs) {
    performBackup("heartbeat");
  };
  checkShardingTrigger();
  await fetchAllEnabledFeeds();
  // yourNewPeriodicTask();   ← add here
};
```

---

## 5. Frontend Architecture

### Page routing

FootballHEIR uses **manual state-based routing** — no React Router, no TanStack Router. Navigation state lives in `App.tsx`:

```typescript
// App.tsx
const [currentPage, setCurrentPage] = useState<Page>("home");

// Render the active page
{currentPage === "home"       && <HomePage onNavigate={setCurrentPage} />}
{currentPage === "proposals"  && <ProposalsPage />}
{currentPage === "governance" && <GovernancePage />}
{currentPage === "forum"      && <ForumPage />}
{currentPage === "api"        && <APIPage />}
```

The `Page` type is defined in `src/frontend/src/types.ts`:

```typescript
export type Page = "home" | "proposals" | "governance" | "forum" | "api";
```

**To add a new page:**
1. Create `src/frontend/src/pages/YourPage.tsx`
2. Add `"yourpage"` to the `Page` union in `types.ts`
3. Add `{currentPage === "yourpage" && <YourPage />}` in `App.tsx`
4. Add navigation links in `Header.tsx` and `Footer.tsx`

### Hook naming conventions

All hooks live in `src/frontend/src/hooks/useQueries.ts`. Follow these conventions strictly:

| Pattern                        | Convention                                                      |
|--------------------------------|-----------------------------------------------------------------|
| Prefix                         | All hooks start with `use`                                      |
| Query hooks (read)             | `useNounVerb()` e.g. `useAllProposals`, `useProposal(id)`       |
| Mutation hooks (write)         | `useVerbNoun()` e.g. `useSubmitProposal`, `useVoteOnProposal`   |
| Query return shape             | `{ data, isLoading, error }` from `useQuery`                    |
| Mutation return shape          | `{ mutate, mutateAsync, isPending, error }` from `useMutation`  |
| Query key naming               | Array with entity name + params: `["proposal", id]`             |
| Stale time default             | `30_000` ms (30 seconds) for governance data                    |

### useQueries.ts — adding a new hook

All data fetching lives in `src/frontend/src/hooks/useQueries.ts`. The pattern is consistent:

**Read hook (useQuery):**

```typescript
export function useYourData() {
  const { actor, isFetching } = useActor();

  return useQuery<YourType[]>({
    queryKey: ["yourData"],       // unique cache key
    queryFn: async () => {
      if (!actor) return [];      // return safe default when actor not ready
      return actor.yourBackendMethod();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,            // optional: cache for 30s
  });
}
```

**Write hook (useMutation):**

```typescript
export function useYourMutation() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: { field1: string; field2: number }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.yourWriteMethod(args.field1, args.field2);
    },
    onSuccess: () => {
      // Invalidate any queries that should refresh
      queryClient.invalidateQueries({ queryKey: ["yourData"] });
    },
  });
}
```

**Result variant handling** — backend methods that return `{ #ok: T; #err: Text }` are exposed in TypeScript as `{ __kind__: "ok"; ok: T } | { __kind__: "err"; err: string }`:

```typescript
mutationFn: async (tokenId: APITokenId) => {
  const result = await actor.registerAPIKey(tokenId);
  if (result.__kind__ === "err") throw new Error(result.err);
  return result.ok;   // unwrapped success value
},
```

### Backend bindings generation

After any change to `src/backend/main.mo` or `src/backend/Types.mo`, regenerate the frontend bindings:

```bash
pnpm bindgen   # run from project root (app/)
```

This updates `src/frontend/src/backend.d.ts` and `src/frontend/src/backend.ts`. **Never manually edit these files.**

### Mock backend (src/frontend/src/mocks/backend.ts)

The mock must mirror the real backend interface. When you add a new public method in `main.mo` and run `bindgen`, add a corresponding implementation in the mock:

```typescript
// mocks/backend.ts
export const mockBackend = {
  // ... existing mocks ...
  yourNewMethod: async (arg1: string, arg2: number) => {
    // Return realistic mock data
    return [{ id: 1, name: arg1, value: arg2 }];
  },
};
```

The mock is used by visual tests (Playwright) to avoid needing a live canister.

### i18n — adding a new locale or translation key

**To add a new translation key:**

1. Open `src/frontend/src/i18n.ts`
2. Add the key to the `en` locale (required — English is the fallback)
3. Add translations for `es` and `vi` (or leave as English text temporarily)

```typescript
// i18n.ts
const translations: Record<Locale, Messages> = {
  en: {
    // ... existing keys ...
    "yourFeature.label": "Your Label",       // ← add here
    "yourFeature.action": "Do Something",
  },
  es: {
    "yourFeature.label": "Tu Etiqueta",
    "yourFeature.action": "Hacer Algo",
  },
  vi: {
    "yourFeature.label": "Nhãn của bạn",
    "yourFeature.action": "Thực hiện",
  },
};
```

**To add a new locale:**

1. Add the locale string to `Locale` type in `types.ts`: `export type Locale = "en" | "es" | "vi" | "ar";`
2. Add a full translation object in `i18n.ts` translations map
3. The locale selector in the profile modal will automatically show it

---

## 6. How to Extend the Backend (Full Walkthrough)

This walkthrough adds a new domain — `Stadium` — from types through to a usable frontend hook.

### Step 1 — Define types in `Types.mo`

```motoko
// Types.mo
public type StadiumId = Nat32;

public type Stadium = {
  id       : StadiumId;
  name     : Text;
  capacity : Nat32;      // Nat32: max ~4B seats, no Nat needed
  cityCode : Text;       // ISO city/country code
  openedAt : Nat32;      // calendar year, Nat32 is plenty
};
```

### Step 2 — Add stable Map in `main.mo`

```motoko
// main.mo — in "Core storage" section
var stadiums : Map.Map<Types.StadiumId, Types.Stadium> = Map.empty();
var nextStadiumIdCounter : Types.StadiumId = 1;

func nextStadiumId() : Types.StadiumId {
  let id = nextStadiumIdCounter;
  nextStadiumIdCounter += 1;
  id
};
```

### Step 3 — Add query method

```motoko
// Public API — query (no state change, fast)
public query func getAllStadiums() : async [Types.Stadium] {
  stadiums.vals().toArray()
};

public query func getStadium(id : Types.StadiumId) : async ?Types.Stadium {
  stadiums.get(id)
};
```

### Step 4 — Add update method (if needed for direct creation, outside proposals)

For FootballHEIR, all structural changes go through proposals. Direct creation is admin-only for bootstrapping:

```motoko
// Admin-only direct creation (for genesis bootstrapping only)
public shared ({ caller }) func adminCreateStadium(
  name     : Text;
  capacity : Nat32;
  cityCode : Text;
  openedAt : Nat32;
) : async Types.StadiumId {
  requireAdmin(caller);
  let id = nextStadiumId();
  stadiums.add(id, { id; name; capacity; cityCode; openedAt });
  appendEvent("StadiumCreated", "id=" # id.toText() # " name=" # name);
  id
};
```

### Step 5 — Add proposal type (for DAO creation)

Follow Section 2 above. Add `#NewStadium` to `ProposalType` variant and handle in `executeProposal`:

```motoko
case (#NewStadium) {
  let parts = proposal.content.split(#char ',').toArray();
  // "name,capacity,cityCode,openedAt"
  if (parts.size() < 4) Runtime.trap("#NewStadium: expected name,capacity,cityCode,openedAt");
  let id = nextStadiumId();
  let capacity = switch (Nat.fromText(parts[1])) { case (?n) n.toNat32(); case null 0 };
  let openedAt = switch (Nat.fromText(parts[3])) { case (?n) n.toNat32(); case null 0 };
  stadiums.add(id, { id; name = parts[0]; capacity; cityCode = parts[2]; openedAt });
  appendEvent("NewStadium", "id=" # id.toText() # " name=" # parts[0]);
};
```

### Step 6 — Run `pnpm bindgen`

```bash
pnpm bindgen   # from project root (app/)
```

Regenerates `backend.d.ts` and `backend.ts`. New method signatures appear automatically.

### Step 7 — Add frontend hooks in `useQueries.ts`

```typescript
// hooks/useQueries.ts
export function useAllStadiums() {
  const { actor, isFetching } = useActor();
  return useQuery<Stadium[]>({
    queryKey: ["stadiums"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllStadiums();
    },
    enabled: !!actor && !isFetching,
    staleTime: 60_000,
  });
}

export function useStadium(id: number) {
  const { actor, isFetching } = useActor();
  return useQuery<Stadium | null>({
    queryKey: ["stadium", id],
    queryFn: async () => {
      if (!actor) return null;
      const result = await actor.getStadium(id);
      return result.length > 0 ? result[0] : null;  // Motoko ?T → [] | [T]
    },
    enabled: !!actor && !isFetching && id > 0,
  });
}
```

---

## 7. Governance Settings Reference

All fields are in `Types.GovernanceSettings` and modified via the `#ChangeGovernance` proposal type.

| Field                      | Type      | Default                      | Description                                                    |
|----------------------------|-----------|------------------------------|----------------------------------------------------------------|
| `quorum`                   | `Nat8`    | `0`                          | Minimum % of total VP required for a vote to be valid (0 = any vote passes) |
| `minStake`                 | `Nat64`   | `1_000_000_000` (10 ICFC)    | Minimum e8s the proposer must transfer before submitting       |
| `votingPeriod`             | `Nat64`   | `604_800_000_000_000` ns     | Duration proposals are open for voting (7 days in nanoseconds) |
| `disputeWindow`            | `Nat64`   | `86_400_000_000_000` ns      | Time after execution during which a #DisputeProposal can be filed (24h) |
| `disputeReward`            | `Nat8`    | `0`                          | % of stake paid from treasury to successful challenger (0–20%) |
| `vpAgeWeighting`           | `Nat8`    | `0`                          | Voting power age bonus in % per year held (0–5%). Not yet applied in VP calculation. |
| `autoShardingThresholdGb`  | `Nat32`   | `400`                        | Heap GiB threshold that triggers auto #NewDataCanister proposal |
| `backupSubnetHint`         | `Text`    | `""`                         | Preferred subnet for backup canister (informational for DAO operators) |
| `defaultRateLimitPerMin`   | `Nat32`   | `10`                         | Default API calls per minute per consumer (overridable per consumer) |
| `defaultAPITokenId`        | `Nat8`    | `0`                          | Default payment token index for new API consumers              |
| `heartbeatEnabled`         | `Bool`    | `true`                       | Toggle heartbeat timer on/off                                  |
| `heartbeatIntervalSecs`    | `Nat64`   | `3_600`                      | Seconds between heartbeat ticks (1 hour)                       |
| `backupIntervalSecs`       | `Nat64`   | `604_800`                    | Seconds between automatic schema backups (7 days)              |
| `autoShardingEnabled`      | `Bool`    | `true`                       | If false, heap monitoring runs but no proposal is auto-created |

---

## 8. Data Type Reference

All types are defined in `src/backend/Types.mo`.

### ID aliases

| Type          | Motoko type | Used for                               |
|---------------|-------------|----------------------------------------|
| `UserId`      | `Principal` | User/canister identity                 |
| `Timestamp`   | `Int`       | Nanoseconds since epoch (Time.now())   |
| `TokenAmt`    | `Nat64`     | ICFC/ICP amounts in e8s               |
| `ProposalId`  | `Nat32`     | Proposal primary key                   |
| `ObjectId`    | `Nat32`     | ObjectType primary key                 |
| `AttrId`      | `Nat32`     | Attribute primary key                  |
| `MethodId`    | `Nat32`     | MethodDefinition primary key           |
| `EventId`     | `Nat32`     | EventLog entry primary key             |
| `TemplateId`  | `Nat32`     | Template primary key                   |
| `DashId`      | `Nat32`     | DashboardConfig primary key            |
| `DocId`       | `Nat32`     | DynamicDoc primary key                 |
| `ConsumerId`  | `Nat32`     | APIConsumer primary key                |
| `ThreadId`    | `Nat32`     | Forum thread primary key               |
| `PostId`      | `Nat32`     | Forum post primary key (per-thread)    |
| `BlobId`      | `Nat32`     | Blob upload primary key                |
| `FeedId`      | `Nat32`     | HTTP feed config primary key           |
| `BackupId`    | `Nat32`     | Schema backup primary key              |
| `APITokenId`  | `Nat8`      | Payment token index (max 255 tokens)   |
| `APIPkgId`    | `Nat8`      | Price package index (max 255 packages) |
| `Pct`         | `Nat8`      | Percentage 0–100                       |

### Core record types

| Type                 | Purpose                                                              |
|----------------------|----------------------------------------------------------------------|
| `Proposal`           | DAO proposal: type, status, stake, votes, voters, content, timings  |
| `Vote`               | Single vote: voter Principal, VP (Nat64), inFavor, timestamp        |
| `GovernanceSettings` | Singleton: all DAO-configurable parameters                          |
| `ObjectType`         | Dynamic schema entity: id, name, description, attributes[], methods[] |
| `Attribute`          | Schema column: id, name, dataType (Text), isRequired, defaultValue  |
| `MethodDefinition`   | Custom logic: id, name, description, code (Blob)                    |
| `EventLogEntry`      | Immutable log entry: id, timestamp, eventType, details, hash chain  |
| `Template`           | Reusable proposal form: id, name, description, content              |
| `DashboardConfig`    | User analytics config: id, user Principal, layout, widgets[]        |
| `DynamicDoc`         | Markdown/OpenAPI doc: id, title, content, generatedAt               |
| `APIToken`           | ICRC-1 payment token: id, ledgerId, symbol, decimals, minDeposit   |
| `APIPricePackage`    | Per-call pricing: id, tokenId, objectTypeId?, pricePerCall/Batch    |
| `APIConsumerV2`      | Pay-as-you-go consumer: apiKey (Blob32), balance, callCount         |
| `BlobEntry`          | Upload metadata: id, name, mimeType, totalSize, chunkCount, sha256  |
| `FeedConfig`         | HTTP feed source: id, url, apiKey?, pollIntervalSecs, enabled       |
| `FeedResult`         | Feed fetch result: feedId, fetchedAt, responseCode, bodySnippet     |
| `ImportRecord`       | Season data import: proposalId, blobId, importedAt, status          |
| `BackupEntry`        | Schema snapshot: id, timestamp, schemaBlob, triggeredBy, objectCount|
| `Thread`             | Forum thread: id, title, author, posts[], isDeleted                 |
| `Post`               | Forum post: id, author, content, isPinned, isDeleted                |
| `UserProfile`        | User name + cached ICFC balance + lastBalanceCheck                  |

---

## 9. Deployment & Operations

### Check backend (Motoko typecheck)

```bash
cd src/backend && mops check --fix
```

This runs the Motoko compiler in check mode and auto-applies safe fixes. Always run before committing backend changes.

### Typecheck frontend

```bash
cd src/frontend && pnpm typecheck
```

Runs `tsc --noEmit`. Catches type errors in React + TypeScript without building.

### Lint + format frontend

```bash
cd src/frontend && pnpm fix
```

Runs ESLint with `--fix` and Prettier. Run before every commit.

### Generate bindings after backend changes

```bash
pnpm bindgen    # from project root (app/)
```

Run this **every time** you change `src/backend/main.mo` public methods or `src/backend/Types.mo`. Updates:
- `src/frontend/src/backend.d.ts` — TypeScript type definitions
- `src/frontend/src/backend.ts` — actor factory

After running, check `src/frontend/src/mocks/backend.ts` and add any new methods.

### Trigger a manual backup

**Via admin UI:** Navigate to the Governance page → Heartbeat section → "Trigger Backup" button.

**Via Candid/dfx:**

```bash
dfx canister call football_heir triggerManualBackup '()'
```

Returns the `BackupId` of the new backup. Retrieve it with `getBackup(id)`.

### Restore from a backup

Full schema re-application requires a `#RestoreSchema` DAO proposal for auditability. The `restoreFromBackup(backupId)` admin function only logs the intent:

```bash
dfx canister call football_heir restoreFromBackup '(1)'
```

Then submit a `#RestoreSchema` proposal with `content = "backupId,reason"` for the DAO to vote on.

### Add a new DAO-approved API token

API tokens can only be added by an admin directly (not via proposal, for security):

```bash
dfx canister call football_heir addAPIToken '(
  principal "ryjl3-tyaaa-aaaaa-aaaba-cai",   # ICP ledger
  "ICP",
  8,                                           # decimals
  100_000_000                                  # minDeposit: 1 ICP
)'
```

Returns the `APITokenId` (Nat8). Use this ID when creating `APIPricePackage` entries via `#NewAPIPrice` proposals.

### Internet Identity authentication flow

The frontend uses `useInternetIdentity()` from `src/frontend/src/hooks/useInternetIdentity.ts`:

```typescript
const { identity, login, clear, loginStatus } = useInternetIdentity();

// Login — opens II popup
login();

// Logout
clear();

// Check if authenticated
const isAuthenticated = !!identity;
const principal = identity?.getPrincipal();
```

Authentication state is used as the `enabled` condition in all `useQuery` hooks that require identity (e.g., `useCallerProfile`, `useCallerICFCBalance`).

---

*Last updated: April 2026. Generated from actual codebase at `src/backend/main.mo` (1687 lines), `src/backend/Types.mo` (335 lines), `src/frontend/src/hooks/useQueries.ts` (846 lines), and associated files.*
