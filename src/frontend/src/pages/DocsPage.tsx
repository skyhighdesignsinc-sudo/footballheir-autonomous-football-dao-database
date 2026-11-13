import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Info,
  Menu,
  Pencil,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDynamicDocs } from "../hooks/useQueries";

// ─── Static doc definitions ─────────────────────────────────────────────────

type DocCategory = "DAO" | "Developer" | "API";

interface StaticDoc {
  id: string;
  title: string;
  category: DocCategory;
  updatedAt: string;
  content: string;
}

// ─── ICP Coding Standards ────────────────────────────────────────────────────
const ICP_CODING_STANDARDS = `# ICP / Motoko Coding Standards

General best practices for writing performant, safe, and upgrade-proof code on the Internet Computer using Motoko.
This file is intentionally project-agnostic — it applies to any ICP canister.

---

## 1. Data Type Optimization (C++-like cycle minimization)

Choose the **smallest type that fits the domain**. Every extra byte costs cycles in storage and in message encoding.

### Integer sizing rules

| Domain | Type | Reasoning |
|--------|------|-----------|
| Percentages (0–100) | \`Nat8\` | Max 255 — no reason for a larger type |
| Small counts / enum-like IDs (≤ 65 535) | \`Nat16\` | Rare; prefer \`Nat32\` unless you truly need it |
| Primary keys / sequence IDs | \`Nat32\` | Supports 4 billion rows — sufficient for most DBs |
| Token amounts (e8s), timestamps (ns) | \`Nat64\` | ICP uses nanoseconds; ICRC-1 amounts are Nat |
| General integer math with no bound | \`Nat\` | Only when bounds genuinely unknown |
| Signed integers | \`Int\` | \`Time.now()\` returns \`Int\` (nanoseconds) |

### FootballHEIR data type decisions (from \`Types.mo\`)

| Field / Alias | Type | Cycle-cost justification |
|---------------|------|--------------------------|
| \`ProposalId\` | \`Nat32\` | Max 4 billion proposals; saves 4 bytes vs Nat64 per entry |
| \`ObjectId\` | \`Nat32\` | Max 4 billion object types; sufficient for any schema |
| \`TokenAmt\` | \`Nat64\` | ICRC-1 e8s amounts; IC convention requires full Nat64 range |
| \`Timestamp\` | \`Int\` | \`Time.now()\` returns \`Int\` nanoseconds; no conversion overhead |
| \`UserId\` | \`Principal\` | Native identity type; avoid re-encoding to Text |
| \`Pct\` | \`Nat8\` | Percentages 0–100; 1 byte vs 8 for Nat64 |
| \`APITokenId\` | \`Nat8\` | DAO approves at most a few dozen tokens; 1 byte each |
| \`apiKey\` | \`Blob\` | 32-byte random key; Blob stores raw bytes, Text wastes 2x storage |

\`\`\`motoko
// ✅ Good — tight types matching Types.mo
public type ProposalId = Nat32;   // up to ~4B proposals
public type Pct        = Nat8;    // 0–100 percent
public type TokenAmt   = Nat64;   // ICRC-1 e8s amounts
public type Timestamp  = Int;     // Time.now() is Int (nanoseconds)

// ❌ Bad — oversized
public type ProposalId = Nat;     // wastes encoding bytes on the wire
public type Pct        = Nat;     // 8x larger than needed
\`\`\`

---

## 2. Stable Memory & Upgrade Safety

### \`stable var\` vs heap variables

**Everything that must survive a canister upgrade MUST be \`stable var\`** or stored in stable memory structures.

\`\`\`motoko
// ✅ Stable — survives upgrades
var proposals : Map.Map<ProposalId, Proposal> = Map.empty();

// ❌ Will be reset on upgrade — heap-only
var cache : [Text] = [];   // fine if it's truly ephemeral
\`\`\`

### Stable Maps in main.mo

The actor declares all state at top-level. These survive upgrades without migration unless the record type changes. Key stable maps include: \`proposals\`, \`objectTypes\`, \`eventLog\`, \`apiConsumersV2\`, \`dynamicDocs\`, \`threads\`, \`blobStore\`, \`feedConfigs\`.

---

## 3. Actor Model & Architecture

### query vs update methods

| Use case | Method type |
|----------|-------------|
| Reading data, no state change | \`query\` |
| Writing state, inter-canister calls, ICRC-1 calls | \`shared\` (update) |
| Needs real-time ledger data | \`shared\` (update) — cannot call async from \`query\` |

\`\`\`motoko
// ✅ query — fast (< 200ms), free, no consensus
public query func getProposal(id : ProposalId) : async ?Proposal {
  proposals.get(id)
};

// ✅ update — needs consensus, ~2s roundtrip, costs cycles
public shared ({ caller }) func submitProposal(...) : async ProposalId {
  await requireICFCBalance(caller, 1);  // inter-canister call → must be update
  ...
};
\`\`\`

### Caller validation

Always validate \`msg.caller\` at the top of every \`shared\` function.

\`\`\`motoko
func requireAuth(caller : Principal) {
  if (caller.isAnonymous()) Runtime.trap("Unauthorized: Authentication required");
};
\`\`\`

---

## 4. ICRC-1 Inter-Canister Calls

### Principal vs AccountIdentifier

ICRC-1 uses \`Account = { owner: Principal; subaccount: ?Blob }\`. Do NOT use the legacy \`AccountIdentifier\`.

\`\`\`motoko
// ✅ ICRC-1 style
let acc : Ledger.Account = { owner = caller; subaccount = null };
let bal = await Ledger.ledger().icrc1_balance_of(acc);
\`\`\`

### Cycle cost of inter-canister calls

Each \`await\` to the ICFC ledger costs ~850K–1M cycles. Cache balances in \`UserProfile.icfcBalance\` for display; only re-query before state-mutating operations.

---

## 5. Heartbeat Automation

The heartbeat uses \`mo:base/Timer.recurringTimer\`. It is started in the actor body so it re-arms on every upgrade.

\`\`\`motoko
func heartbeatTick() : async () {
  finalizeExpiredProposals();      // 1. Close expired proposals
  if (nowSecs >= lastBackupAt + governanceSettings.backupIntervalSecs) {
    performBackup("heartbeat");    // 2. Auto-backup (default: weekly)
  };
  checkShardingTrigger();          // 3. Monitor heap
  await fetchAllEnabledFeeds();    // 4. Poll HTTP data feeds
};
\`\`\`

---

## 6. Cycle Management

| Operation | Approximate cost |
|-----------|------------------|
| Update call (base) | ~590K cycles |
| Storage (stable memory) | ~127K cycles / GB / sec |
| HTTP outcall (IC management) | ≥ 3B cycles per call |
| Inter-canister call (base) | ~260K cycles |

\`\`\`motoko
// ✅ Correct syntax — attach cycles inline
let resp = await (with cycles = 3_000_000_000) IC.http_request(req);
\`\`\`

---

## 7. mo:core vs mo:base

| mo:base | mo:core equivalent | Notes |
|---------|-------------------|-------|
| \`mo:base/HashMap\` | \`mo:core/Map\` | \`Map.empty()\` creates mutable map |
| \`mo:base/Buffer\` | \`mo:core/List\` | \`List.empty()\`, \`list.add()\`, \`list.toArray()\` |
| \`mo:base/Timer\` | **No equivalent** | Always use mo:base for timers |

---

*Last updated: April 2026. Source of truth: \`src/backend/main.mo\`, \`src/backend/Types.mo\`.*`;

// ─── Project Conventions ─────────────────────────────────────────────────────
const PROJECT_CONVENTIONS = `# FootballHEIR Project Conventions

How this DAO is structured, how to extend it, and how to keep the codebase consistent.

---

## 1. Project Overview

**FootballHEIR** is a fully on-chain, DAO-governed football database deployed on the Internet Computer. The canister starts completely empty — no football entities exist at genesis. Every table, column, rule, frontend page, API endpoint, and governance parameter is created, modified, or deleted exclusively via proposals from ICFC token holders.

**Access model:**
- \`≥ 1 ICFC\` → full rights: propose, vote, post in forum
- \`0 ICFC\` → read-only public access (no login required)

### Key constants

| Constant | Value |
|----------|-------|
| ICFC ledger canister ID | \`ddsp7-7iaaa-aaaaq-aacqq-cai\` |
| Default quorum | \`0%\` (any positive vote count passes) |
| Default min stake | \`1_000_000_000\` e8s (10 ICFC) |
| Default voting period | \`604_800_000_000_000\` ns (7 days) |
| Default dispute window | \`86_400_000_000_000\` ns (24 hours) |
| Auto-sharding threshold | \`400\` GiB heap |
| Default API rate limit | \`10\` calls/min per consumer |
| Heartbeat interval | \`3_600\` s (1 hour) |
| Backup interval | \`604_800\` s (7 days) |

---

## 2. How to Add a New Proposal Type

### Step 1 — Add the variant to \`Types.mo\`

\`\`\`motoko
public type ProposalType = {
  // ... existing variants ...
  #YourNewProposalType;   // ← add here
};
\`\`\`

Re-run \`pnpm bindgen\` from the project root after any backend type change.

### Step 2 — Add execution logic to \`main.mo\`

In the \`executeProposal\` function's switch block:

\`\`\`motoko
case (#YourNewProposalType) {
  let parts = proposal.content.split(#char ',').toArray();
  // Apply the change to stable state
  appendEvent("YourNewProposalType", "id=" # id.toText());
};
\`\`\`

**CSV content format convention:** All proposal content uses comma-separated values. The first field is always the primary identifier or action keyword.

### Step 3 — Expose it in the frontend

After running \`pnpm bindgen\`, the new variant appears in the proposal type select automatically. Add a content template in \`ProposalsPage.tsx\`:

\`\`\`typescript
case "YourNewProposalType":
  return "field1,field2,field3";
\`\`\`

---

## 3. All 42 Proposal Types

All proposals use the same \`Proposal\` record; differentiation is via \`proposalType\` and \`content\` (CSV).

### Schema proposals

| Type | CSV format | Effect |
|------|-----------|--------|
| \`#NewObjectType\` | \`name,description\` | Creates ObjectType |
| \`#EditObjectType\` | \`objectId,name,description\` | Updates ObjectType |
| \`#DeleteObjectType\` | \`objectId\` | Removes ObjectType + attributes |
| \`#NewAttribute\` | \`objectId,name,dataType,isRequired,defaultValue\` | Appends Attribute |
| \`#EditAttribute\` | \`objectId,attrId,name,dataType,isRequired,defaultValue\` | Updates Attribute |
| \`#DeleteAttribute\` | \`objectId,attrId\` | Removes Attribute |

### Code update proposals

| Type | CSV format | Effect |
|------|-----------|--------|
| \`#UpdateFrontend\` | \`blobId,path\` | Sets \`activeFrontendAssets[path]\` |
| \`#UpdateMotoko\` | \`blobId,moduleName\` | Sets \`activeMotokoSource[moduleName]\` |
| \`#UpdateCSS\` | \`blobId\` | Updates active CSS blob |

### Governance proposals

| Type | CSV format | Effect |
|------|-----------|--------|
| \`#ChangeGovernance\` | \`field,value\` | Updates \`governanceSettings\` field |
| \`#TreasuryAction\` | \`action,tokenId,amount,recipient\` | Treasury transfer |
| \`#NewDynamicDoc\` | \`title,content\` | Creates DynamicDoc |
| \`#EditDynamicDoc\` | \`docId,title,content\` | Updates DynamicDoc |
| \`#DeleteDynamicDoc\` | \`docId\` | Removes DynamicDoc |

### API monetization proposals

| Type | CSV format | Effect |
|------|-----------|--------|
| \`#NewAPIPrice\` | \`name,tokenId,objectTypeId,pricePerCall,priceBatchCall,batchSizeThreshold\` | Creates APIPricePackage |
| \`#EditAPIPrice\` | \`pkgId,...\` | Updates APIPricePackage |
| \`#DeleteAPIPrice\` | \`pkgId\` | Deactivates APIPricePackage |

---

## 4. Frontend Architecture

### Page routing

FootballHEIR uses **manual state-based routing** — no React Router. Navigation state lives in \`App.tsx\`:

\`\`\`typescript
const [currentPage, setCurrentPage] = useState<Page>("home");
\`\`\`

**To add a new page:**
1. Create \`src/frontend/src/pages/YourPage.tsx\`
2. Add \`"yourpage"\` to the \`Page\` union in \`types.ts\`
3. Add \`{currentPage === "yourpage" && <YourPage />}\` in \`App.tsx\`
4. Add navigation links in \`Header.tsx\` and \`Footer.tsx\`

### Hook naming conventions

| Pattern | Convention |
|---------|-----------|
| Query hooks (read) | \`useNounVerb()\` e.g. \`useAllProposals\` |
| Mutation hooks (write) | \`useVerbNoun()\` e.g. \`useSubmitProposal\` |
| Stale time default | \`30_000\` ms (30 seconds) for governance data |

### Backend bindings generation

After any change to \`src/backend/main.mo\` or \`src/backend/Types.mo\`:

\`\`\`bash
pnpm bindgen   # run from project root (app/)
\`\`\`

---

## 5. Governance Settings Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| \`quorum\` | \`Nat8\` | \`0\` | Minimum % of total VP required |
| \`minStake\` | \`Nat64\` | \`1_000_000_000\` | Minimum e8s to propose |
| \`votingPeriod\` | \`Nat64\` | 7 days in ns | Duration proposals are open |
| \`disputeWindow\` | \`Nat64\` | 24h in ns | Time to file dispute after execution |
| \`heartbeatEnabled\` | \`Bool\` | \`true\` | Toggle heartbeat on/off |
| \`heartbeatIntervalSecs\` | \`Nat64\` | \`3_600\` | Seconds between ticks (1 hour) |
| \`defaultRateLimitPerMin\` | \`Nat32\` | \`10\` | Default API calls/min per consumer |

---

## 6. Deployment Commands

\`\`\`bash
# Backend typecheck
cd src/backend && mops check --fix

# Frontend typecheck
cd src/frontend && pnpm typecheck

# Frontend lint + format
cd src/frontend && pnpm fix

# Generate bindings after backend changes
pnpm bindgen    # from project root (app/)
\`\`\`

---

*Last updated: April 2026.*`;

// ─── DAO Bootstrap Guide ─────────────────────────────────────────────────────
const DAO_BOOTSTRAP_GUIDE = `# FootballHEIR DAO Bootstrap Guide

Step-by-step genesis verification, first proposal walkthroughs, and post-deployment health checks.
This guide is for the deployer / first admin. After bootstrap, all future changes go through DAO proposals.

---

## 1. Genesis Verification Checklist

After first deployment, verify the canister is truly empty before submitting any proposals.

\`\`\`bash
# All should return empty arrays / default values

dfx canister call football_heir getAllProposals '()'
# Expected: vec {}

dfx canister call football_heir getAllObjectTypes '()'
# Expected: vec {}

dfx canister call football_heir getEventLog '(0, 50)'
# Expected: vec {}

dfx canister call football_heir getGovernanceSettings '()'
# Should match the documented defaults
\`\`\`

### Default governance settings

\`\`\`
quorum                  = 0 : nat8
minStake                = 1_000_000_000 : nat64   // 10 ICFC
votingPeriod            = 604_800_000_000_000 : nat64  // 7 days
disputeWindow           = 86_400_000_000_000 : nat64   // 24 hours
heartbeatEnabled        = true
heartbeatIntervalSecs   = 3_600 : nat64
autoShardingThresholdGb = 400 : nat32
\`\`\`

---

## 2. First Real Proposal — \`#NewObjectType: Player\`

### Prerequisites

- You hold ≥ 1 ICFC in your Internet Identity wallet
- You have transferred ≥ 10 ICFC to the **canister principal** on the ICFC ledger

### Step 1 — Transfer the stake

\`\`\`bash
# Transfer 10 ICFC to the canister before calling submitProposal
dfx canister call ddsp7-7iaaa-aaaaq-aacqq-cai icrc1_transfer '(record {
  from_subaccount = null;
  to = record {
    owner = principal "FOOTBALL_HEIR_CANISTER_ID";
    subaccount = null;
  };
  amount = 1_000_000_000;   // 10 ICFC in e8s
  fee = null;
  memo = null;
  created_at_time = null;
})'
\`\`\`

### Step 2 — Submit the proposal

\`\`\`bash
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "Player,Football player profile — individual athlete record",
  1_000_000_000
)'
\`\`\`

### Step 3 — Vote

\`\`\`bash
dfx canister call football_heir voteOnProposal '(1, true)'
\`\`\`

### Step 4 — Execute (admin only)

\`\`\`bash
dfx canister call football_heir executeProposal '(1)'
\`\`\`

### Step 5 — Verify

\`\`\`bash
dfx canister call football_heir getAllObjectTypes '()'
# Expected: Player (id=1) with empty attributes and methods
\`\`\`

---

## 3. Bootstrap Sequence — 5 Founding Proposals

Submit these 5 proposals in order. All use \`#NewObjectType\` with CSV format: \`"name,description"\`.

### Proposal 1 — Player

\`\`\`bash
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "Player,Football player profile — individual athlete record",
  1_000_000_000
)'
\`\`\`

Core attributes: \`playerId (Nat32)\`, \`fullName (Text64)\`, \`dateOfBirth (Nat64)\`, \`nationalityCode (Text3)\`, \`positionCode (Text3)\`

### Proposal 2 — Club

\`\`\`bash
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "Club,Football club — professional football organization",
  1_000_000_000
)'
\`\`\`

Core attributes: \`clubId (Nat32)\`, \`name (Text64)\`, \`countryCode (Text3)\`, \`founded (Nat32)\`

### Proposal 3 — League

\`\`\`bash
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "League,Football league — competition structure within a country",
  1_000_000_000
)'
\`\`\`

### Proposal 4 — Match

\`\`\`bash
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "Match,A single football fixture between two clubs",
  1_000_000_000
)'
\`\`\`

### Proposal 5 — Season

\`\`\`bash
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "Season,A competitive season within a league",
  1_000_000_000
)'
\`\`\`

---

## 4. Adding Attributes via \`#NewAttribute\`

Content format: \`"objectId,name,dataType,isRequired,defaultValue"\`

\`\`\`bash
# Add fullName to Player (objectId = 1)
dfx canister call football_heir submitProposal '(
  variant { NewAttribute },
  "1,fullName,Text(64),true,",
  1_000_000_000
)'
\`\`\`

---

## 5. Staking & Burning Test Flow

\`\`\`bash
# Submit a test proposal
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "TestEntity,Test proposal to verify stake burning — vote to reject",
  1_000_000_000
)'

# Vote against
dfx canister call football_heir voteOnProposal '(6, false)'

# Execute (results in rejection)
dfx canister call football_heir executeProposal '(6)'

# After dispute window, burn the stake
dfx canister call football_heir burnStake '(6)'
\`\`\`

---

## 6. API Monetization Flow Test

\`\`\`bash
# 1. Add ICFC as payment token (admin)
dfx canister call football_heir addAPIToken '(
  principal "ddsp7-7iaaa-aaaaq-aacqq-cai",
  "ICFC", 8, 100_000_000
)'

# 2. Register an API key
dfx canister call football_heir registerAPIKey '(0)'
# Returns: 32-byte API key blob

# 3. Deposit balance
dfx canister call football_heir depositAPIBalance '(blob "YOUR_API_KEY", 10_000_000_000)'

# 4. Simulate a deduction
dfx canister call football_heir deductAPICall '(blob "YOUR_API_KEY", null, false, 1)'
\`\`\`

---

## 7. Post-Deployment Health Checks

\`\`\`bash
# Heartbeat running
dfx canister call football_heir getHeartbeatStatus '()'
# Expected: timerActive = true

# Event log chain integrity
dfx canister call football_heir getEventLog '(0, 50)'
# Verify each entry's previousHash matches prev entry's hash

# Five founding ObjectTypes present
dfx canister call football_heir getAllObjectTypes '()'
# Expected: Player (id=1), Club (id=2), League (id=3), Match (id=4), Season (id=5)
\`\`\`

---

## 8. Quickstart Checklist

\`\`\`
Genesis verification:
  [ ] getAllProposals() returns []
  [ ] getAllObjectTypes() returns []
  [ ] getEventLog(0, 50) returns []
  [ ] getGovernanceSettings() matches defaults
  [ ] isAdmin(deployerPrincipal) = true
  [ ] getHeartbeatStatus().timerActive = true

Bootstrap sequence:
  [ ] Player ObjectType created (id=1)
  [ ] Club ObjectType created (id=2)
  [ ] League ObjectType created (id=3)
  [ ] Match ObjectType created (id=4)
  [ ] Season ObjectType created (id=5)
  [ ] Core attributes added to each ObjectType

System tests:
  [ ] Staking & burning test completed
  [ ] API monetization test completed
\`\`\`

---

*Last updated: April 2026. After bootstrap, all changes are governed exclusively by ICFC token holder proposals.*`;

// ─── Genesis Validation Guide ────────────────────────────────────────────────
const GENESIS_VALIDATION_GUIDE = `# Genesis Validation Guide

How to verify the FootballHEIR canister starts with an empty state, run the full proposal lifecycle end-to-end, and stress-test staking and burn logic.

---

## 1. Purpose

This guide is for deployers, admins, and auditors who need to confirm that:

1. The canister deployed at genesis contains **zero pre-populated data** — no hidden records, no seeded proposals
2. The full governance lifecycle (submit → vote → execute → finalize) works correctly with real ICFC tokens
3. The staking, rejection, and burn mechanics behave exactly as specified
4. The event log is hash-chained and tamper-evident

---

## 2. Tools Required

| Tool | Purpose |
|------|---------|
| \`dfx\` CLI | Direct canister calls |
| Internet Identity | Authenticated wallet (holds ICFC) |
| ICFC ledger (\`ddsp7-7iaaa-aaaaq-aacqq-cai\`) | Balance verification, transfers |
| FootballHEIR frontend | UI verification (optional) |
| Candid UI (\`/_/candid\`) | Raw call exploration |

---

## 3. Step 1 — Verify Empty Genesis State

Run immediately after canister deployment, before any other action:

\`\`\`bash
# Core entities — all must return empty
dfx canister call football_heir getAllProposals '()'        # expect: vec {}
dfx canister call football_heir getAllObjectTypes '()'      # expect: vec {}
dfx canister call football_heir getEventLog '(0, 50)'      # expect: vec {}
dfx canister call football_heir getAllThreads '()'          # expect: vec {}
dfx canister call football_heir getAllAPIConsumersV2 '()'   # expect: vec {}
dfx canister call football_heir getAPIPricePackages '()'   # expect: vec {}
dfx canister call football_heir getAllBlobs '()'            # expect: vec {}
dfx canister call football_heir getDynamicDocs '()'        # expect: vec {}
\`\`\`

If **any** of these returns non-empty data, stop. The canister was deployed with pre-seeded data. You must re-deploy from a clean \`dfx deploy\` or investigate the source of the pre-populated records.

### Governance settings baseline

\`\`\`bash
dfx canister call football_heir getGovernanceSettings '()'
\`\`\`

Confirm every field matches the documented defaults. Any deviation means the \`main.mo\` genesis initialization was modified.

---

## 4. Step 2 — Claim Admin Role

The first authenticated user to call an admin function becomes the admin (one-time bootstrap, no pre-assigned role):

\`\`\`bash
# Trigger admin claim by adding the ICFC token (first admin action)
dfx canister call football_heir addAPIToken '(
  principal "ddsp7-7iaaa-aaaaq-aacqq-cai",
  "ICFC",
  8,
  100_000_000
)'

# Verify admin was assigned
dfx canister call football_heir isAdmin '(principal "YOUR-DEPLOYER-PRINCIPAL")'
# Expected: true
\`\`\`

⚠️ **Do this immediately after deployment** before any other caller can claim admin.

---

## 5. Step 3 — Full Proposal Lifecycle Test

This test runs the complete governance loop: submit → vote → execute → verify state change.

### 5.1 Transfer stake to canister

\`\`\`bash
dfx canister call ddsp7-7iaaa-aaaaq-aacqq-cai icrc1_transfer '(record {
  from_subaccount = null;
  to = record { owner = principal "FOOTBALL_HEIR_CANISTER_ID"; subaccount = null };
  amount = 1_000_000_000;
  fee = null; memo = null; created_at_time = null;
})'
\`\`\`

### 5.2 Submit proposal

\`\`\`bash
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "ValidationTest,Lifecycle test entity — do not use for production schema",
  1_000_000_000
)'
# Returns: proposalId = 1
\`\`\`

### 5.3 Verify proposal state

\`\`\`bash
dfx canister call football_heir getProposal '(1)'
# Expected:
# status = variant { Submitted }
# votesFor = 0 : nat64
# votesAgainst = 0 : nat64
# content = "ValidationTest,Lifecycle test entity..."
# stake = 1_000_000_000 : nat64
\`\`\`

### 5.4 Vote in favor

\`\`\`bash
dfx canister call football_heir voteOnProposal '(1, true)'
# Voting power = your live ICFC balance in e8s
\`\`\`

### 5.5 Execute

\`\`\`bash
dfx canister call football_heir executeProposal '(1)'
# Expected: proposal status → #Executed
\`\`\`

### 5.6 Verify state change

\`\`\`bash
dfx canister call football_heir getAllObjectTypes '()'
# Expected: [ { id=1; name="ValidationTest"; attributes=[]; methods=[] } ]

# Verify stake was auto-returned
dfx canister call ddsp7-7iaaa-aaaaq-aacqq-cai icrc1_balance_of '(record {
  owner = principal "YOUR-PRINCIPAL"; subaccount = null
})'
# Balance should be back to original (minus ledger fees)
\`\`\`

### 5.7 Verify event log entry

\`\`\`bash
dfx canister call football_heir getEventLog '(0, 10)'
# Expected entries:
# id=1: eventType="ProposalSubmitted", details="id=1 type=NewObjectType"
# id=2: eventType="Vote", details="proposalId=1 voter=... inFavor=true"
# id=3: eventType="ProposalExecuted", details="id=1 type=NewObjectType"
\`\`\`

---

## 6. Step 4 — Rejection & Burn Test

\`\`\`bash
# Transfer stake again
dfx canister call ddsp7-7iaaa-aaaaq-aacqq-cai icrc1_transfer '(...amount=1_000_000_000...)'

# Submit a proposal to reject
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "BurnTest,Stake burn verification — vote against this proposal",
  1_000_000_000
)'
# proposalId = 2

# Vote AGAINST
dfx canister call football_heir voteOnProposal '(2, false)'

# Execute (rejection)
dfx canister call football_heir executeProposal '(2)'
# Expected: status = #Rejected, stake stays in canister

# Wait for dispute window (24h default), then burn
dfx canister call football_heir burnStake '(2)'
# Expected: variant { ok }
# Stake transferred to IC management canister (burn account: aaaaa-aa)
\`\`\`

Verify in event log:

\`\`\`bash
dfx canister call football_heir getEventLog '(0, 20)'
# Look for: eventType = "StakeBurned", details = "proposalId=2 amount=1000000000"
\`\`\`

---

## 7. Step 5 — Event Log Chain Integrity Check

For each consecutive pair of entries, verify the hash chain:

\`\`\`bash
dfx canister call football_heir getEventLog '(0, 50)'
\`\`\`

Manual check:
- Entry 1: \`previousHash = null\`
- Entry N: \`previousHash == entry[N-1].hash\`

If any entry's \`previousHash\` does not match the previous entry's \`hash\`, the chain is broken (tampering or upgrade data loss).

The hash algorithm is an **8-byte XOR integrity seal** — not cryptographic. It detects accidental corruption and simple tampering.

---

## 8. Step 6 — DAO Documentation Validation

Verify that dynamic docs can be created and queried via proposal:

\`\`\`bash
# Transfer stake
# Then:
dfx canister call football_heir submitProposal '(
  variant { NewDynamicDoc },
  "Test Doc,# Hello World\\nThis is a test dynamic document created via proposal.",
  1_000_000_000
)'

# Vote + execute, then verify
dfx canister call football_heir getDynamicDocs '()'
# Expected: one DynamicDoc with title="Test Doc"
\`\`\`

---

## 9. Validation Completion Checklist

\`\`\`
Empty genesis verified:
  [ ] All core entity queries return empty arrays
  [ ] Governance settings match defaults
  [ ] No pre-seeded proposals or records

Admin setup:
  [ ] Deployer principal assigned as admin
  [ ] isAdmin(deployerPrincipal) = true

Proposal lifecycle:
  [ ] Submit → Vote → Execute works end-to-end
  [ ] State change applied (ObjectType created)
  [ ] Stake auto-returned on approval
  [ ] Event log entries written

Rejection & burn:
  [ ] Rejected proposal stake stays in canister
  [ ] burnStake() transfers to burn account after dispute window
  [ ] StakeBurned event in log

Event log:
  [ ] Chain integrity verified (previousHash links correct)
  [ ] Entry 1 has previousHash = null

Dynamic docs:
  [ ] #NewDynamicDoc proposal creates document
  [ ] getDynamicDocs() returns the new document
\`\`\`

---

*Last updated: April 2026. Run this guide against every new deployment and every major upgrade.*`;

// ─── Built-in docs list ───────────────────────────────────────────────────────
const STATIC_DOCS: StaticDoc[] = [
  {
    id: "dao-bootstrap-guide",
    title: "DAO Bootstrap Guide",
    category: "DAO",
    updatedAt: "April 2026",
    content: DAO_BOOTSTRAP_GUIDE,
  },
  {
    id: "genesis-validation-guide",
    title: "Genesis Validation Guide",
    category: "DAO",
    updatedAt: "April 2026",
    content: GENESIS_VALIDATION_GUIDE,
  },
  {
    id: "icp-coding-standards",
    title: "ICP / Motoko Coding Standards",
    category: "Developer",
    updatedAt: "April 2026",
    content: ICP_CODING_STANDARDS,
  },
  {
    id: "project-conventions",
    title: "Project Conventions",
    category: "Developer",
    updatedAt: "April 2026",
    content: PROJECT_CONVENTIONS,
  },
];

// ─── Minimal Markdown Renderer ───────────────────────────────────────────────

function renderMarkdown(md: string): string {
  let html = md
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Fenced code blocks
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_m, _lang, code) =>
        `<pre class="bg-muted/60 border border-border rounded-md p-4 overflow-x-auto my-4 text-xs font-mono leading-relaxed"><code>${code.trim()}</code></pre>`,
    )
    // Headings
    .replace(
      /^### (.+)$/gm,
      '<h3 class="text-base font-semibold font-display mt-6 mb-2 text-foreground">$1</h3>',
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 class="text-lg font-bold font-display mt-8 mb-3 text-foreground border-b border-border pb-1.5">$1</h2>',
    )
    .replace(
      /^# (.+)$/gm,
      '<h1 class="text-2xl font-bold font-display mt-2 mb-4 text-foreground">$1</h1>',
    )
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="border-border my-6" />')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="text-foreground font-semibold">$1</strong>',
    )
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(
      /`([^`\n]+)`/g,
      '<code class="font-mono text-xs bg-muted/60 border border-border rounded px-1.5 py-0.5 text-primary">$1</code>',
    )
    // Tables — convert markdown table to HTML
    .replace(/((?:^\|.+\|\n?)+)/gm, (table) => {
      const rows = table.trim().split("\n");
      let html =
        '<div class="overflow-x-auto my-4"><table class="w-full text-sm border-collapse">';
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (/^\|[-| :]+\|$/.test(row)) continue; // separator row
        const cells = row
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        html += "<tr>";
        for (const cell of cells) {
          const tag = i === 0 ? "th" : "td";
          const cls =
            i === 0
              ? 'class="border border-border bg-muted/40 px-3 py-2 text-left text-xs font-semibold font-mono text-muted-foreground uppercase tracking-wide"'
              : 'class="border border-border px-3 py-2 text-xs"';
          html += `<${tag} ${cls}>${cell}</${tag}>`;
        }
        html += "</tr>";
      }
      html += "</table></div>";
      return html;
    })
    // Numbered lists
    .replace(
      /^(\d+)\. (.+)$/gm,
      '<li class="ml-4 mb-1 list-decimal text-sm">$2</li>',
    )
    // Bullet lists
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 mb-1 list-disc text-sm">$1</li>')
    // Wrap consecutive <li> in <ul> or <ol>
    .replace(
      /(<li class="ml-4 mb-1 list-disc[^"]*">[^<]*<\/li>\n?)+/g,
      (match) =>
        `<ul class="my-3 space-y-0.5 text-muted-foreground">${match}</ul>`,
    )
    .replace(
      /(<li class="ml-4 mb-1 list-decimal[^"]*">[^<]*<\/li>\n?)+/g,
      (match) =>
        `<ol class="my-3 space-y-0.5 text-muted-foreground">${match}</ol>`,
    )
    // Links
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener" class="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">$1</a>',
    )
    // Paragraphs — lines not already in tags
    .replace(/^(?!<[a-z])(.+)$/gm, (line) => {
      if (line.trim() === "") return "";
      return `<p class="text-sm leading-relaxed text-muted-foreground mb-3">${line}</p>`;
    });

  return html;
}

// ─── Category badge ────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<DocCategory, string> = {
  DAO: "bg-primary/10 text-primary border-primary/20",
  Developer: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  API: "bg-chart-3/10 text-chart-3 border-chart-3/20",
};

function CategoryBadge({ category }: { category: DocCategory }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-mono px-1.5 py-0 h-4 ${CATEGORY_STYLES[category]}`}
    >
      {category}
    </Badge>
  );
}

// ─── Suggest Edit Modal ────────────────────────────────────────────────────────

function SuggestEditModal({
  open,
  onClose,
  docTitle,
}: {
  open: boolean;
  onClose: () => void;
  docTitle: string;
}) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-lg bg-card border-border"
        data-ocid="suggest-edit.dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-sm font-semibold flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" aria-hidden />
            Suggest an edit — {docTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          <Textarea
            placeholder="Describe the change you'd like to see in this document..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[160px] font-mono text-xs resize-y bg-muted/30 border-border focus-visible:ring-primary"
            data-ocid="suggest-edit.textarea"
          />

          <div className="rounded-md bg-muted/30 border border-border/60 p-3 text-xs text-muted-foreground leading-relaxed">
            <Info
              className="h-3.5 w-3.5 inline-block mr-1.5 text-primary align-middle"
              aria-hidden
            />
            Copy your text and submit it as a{" "}
            <code className="font-mono text-primary bg-primary/10 px-1 rounded">
              #NewDynamicDoc
            </code>{" "}
            or{" "}
            <code className="font-mono text-primary bg-primary/10 px-1 rounded">
              #EditDynamicDoc
            </code>{" "}
            proposal in the Proposals page. The DAO will review and approve or
            reject your change.
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-ocid="suggest-edit.cancel_button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCopy}
              disabled={!text.trim()}
              className="gap-1.5"
              data-ocid="suggest-edit.copy_button"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
              {copied ? "Copied!" : "Copy text for proposal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main DocsPage ─────────────────────────────────────────────────────────────

export function DocsPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    STATIC_DOCS[0].id,
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const { data: dynamicDocs = [] } = useDynamicDocs();

  // Merge static + dynamic docs
  const allDocs = useMemo(() => {
    const dynamic = dynamicDocs.map((d) => ({
      id: `dynamic-${d.id}`,
      title: d.title,
      category: "DAO" as DocCategory,
      updatedAt: new Date(
        Number(d.generatedAt) / 1_000_000,
      ).toLocaleDateString(),
      content: d.content,
    }));
    return [...STATIC_DOCS, ...dynamic];
  }, [dynamicDocs]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allDocs;
    const q = search.toLowerCase();
    return allDocs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q),
    );
  }, [allDocs, search]);

  const selectedDoc = allDocs.find((d) => d.id === selectedId) ?? allDocs[0];

  const grouped = useMemo(() => {
    const map: Partial<Record<DocCategory, typeof filtered>> = {};
    for (const doc of filtered) {
      if (!map[doc.category]) map[doc.category] = [];
      map[doc.category]!.push(doc);
    }
    return map;
  }, [filtered]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const SidebarContent = () => (
    <nav aria-label="Documentation navigation" className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Input
            type="search"
            placeholder="Search docs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs pr-8 bg-muted/30 border-border focus-visible:ring-primary font-mono"
            aria-label="Search documentation"
            data-ocid="docs.search_input"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-sm"
              aria-label="Clear search"
              data-ocid="docs.search_clear_button"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Doc list */}
      <div className="flex-1 overflow-y-auto py-2">
        {(Object.keys(grouped) as DocCategory[]).length === 0 ? (
          <div
            className="px-4 py-8 text-center text-xs text-muted-foreground"
            data-ocid="docs.empty_state"
          >
            No docs found for &ldquo;{search}&rdquo;
          </div>
        ) : (
          (["DAO", "Developer", "API"] as DocCategory[]).map((cat) => {
            const docs = grouped[cat];
            if (!docs?.length) return null;
            return (
              <div key={cat} className="mb-4">
                <div className="px-3 py-1.5 flex items-center gap-2">
                  <CategoryBadge category={cat} />
                  <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                    {docs.length} doc{docs.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {docs.map((doc, idx) => {
                  const isActive = doc.id === selectedId;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => handleSelect(doc.id)}
                      data-ocid={`docs.sidebar_item.${idx + 1}`}
                      aria-current={isActive ? "page" : undefined}
                      className={[
                        "w-full text-left px-3 py-2 text-sm transition-colors duration-150 border-l-2 min-h-[44px] flex items-center",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                        isActive
                          ? "border-l-primary bg-primary/10 text-foreground font-medium"
                          : "border-l-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
                      ].join(" ")}
                    >
                      {doc.title}
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]" data-ocid="docs.page">
      {/* ── Desktop sidebar ───────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-64 shrink-0 border-r border-border bg-card sticky top-14 h-[calc(100vh-3.5rem)] overflow-hidden"
        aria-label="Documentation sidebar"
      >
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen
              className="h-3.5 w-3.5 text-primary shrink-0"
              aria-hidden
            />
            <span className="text-xs font-semibold font-mono uppercase tracking-widest text-muted-foreground">
              Documentation
            </span>
          </div>
        </div>
        <SidebarContent />
      </aside>

      {/* ── Content area ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* DAO-owned banner */}
        <div className="bg-primary/5 border-b border-primary/20 px-4 py-2.5 flex items-center gap-2 shrink-0">
          <Info className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
          <p className="text-xs text-muted-foreground leading-snug min-w-0">
            This documentation is maintained by the DAO. Updates are submitted
            via{" "}
            <code className="font-mono text-primary bg-primary/10 px-1 rounded text-[10px]">
              #NewDynamicDoc
            </code>{" "}
            and{" "}
            <code className="font-mono text-primary bg-primary/10 px-1 rounded text-[10px]">
              #EditDynamicDoc
            </code>{" "}
            proposals.
          </p>
        </div>

        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card">
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Open docs navigation"
                data-ocid="docs.mobile_menu_button"
              >
                <Menu className="h-4 w-4" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 p-0 bg-card border-border"
            >
              <SheetTitle className="sr-only">
                Documentation Navigation
              </SheetTitle>
              <div className="p-3 border-b border-border flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span className="text-xs font-semibold font-mono uppercase tracking-widest text-muted-foreground">
                  Documentation
                </span>
              </div>
              <div className="h-[calc(100vh-3.5rem-49px)] overflow-y-auto">
                <SidebarContent />
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <ChevronRight
              className="h-3 w-3 text-muted-foreground shrink-0"
              aria-hidden
            />
            <span className="text-sm font-medium truncate">
              {selectedDoc?.title}
            </span>
          </div>
        </div>

        {/* Doc content */}
        <main
          className="flex-1 px-4 sm:px-6 lg:px-10 py-6 max-w-3xl w-full"
          id="doc-content"
          aria-label="Document content"
        >
          {selectedDoc ? (
            <>
              {/* Doc header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 pb-4 border-b border-border">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <CategoryBadge category={selectedDoc.category} />
                    <span className="text-[10px] font-mono text-muted-foreground/60">
                      Updated {selectedDoc.updatedAt}
                    </span>
                  </div>
                  <h1 className="text-xl font-bold font-display text-foreground leading-tight break-words">
                    {selectedDoc.title}
                  </h1>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSuggestOpen(true)}
                  className="shrink-0 gap-1.5 text-xs h-8 border-border focus-visible:ring-2 focus-visible:ring-primary"
                  data-ocid="docs.suggest_edit_button"
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                  Suggest an edit
                </Button>
              </div>

              {/* Rendered markdown — content is generated server-side from static strings, not user input */}
              {/* biome-ignore lint/security/noDangerouslySetInnerHtml: content is sanitized static markdown */}
              <article
                className="prose-custom"
                data-ocid="docs.content"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: static markdown only
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(selectedDoc.content),
                }}
              />
            </>
          ) : (
            <div
              className="flex flex-col items-center justify-center min-h-[400px] text-center"
              data-ocid="docs.empty_state"
            >
              <BookOpen
                className="h-12 w-12 text-muted-foreground/30 mb-4"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">
                Select a document from the sidebar to begin.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Suggest Edit Modal */}
      <SuggestEditModal
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        docTitle={selectedDoc?.title ?? ""}
      />
    </div>
  );
}
