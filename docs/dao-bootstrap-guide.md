# FootballHEIR DAO Bootstrap Guide

Step-by-step genesis verification, first proposal walkthroughs, and post-deployment health checks.
This guide is for the deployer / first admin. After bootstrap, all future changes go through DAO proposals.

---

## 1. Genesis Verification Checklist

After first deployment, verify the canister is truly empty before submitting any proposals.
Run these checks via the Candid UI, `dfx`, or the app frontend (read-only, no login required).

### 1.1 Empty state checks

```bash
# All should return empty arrays / default values

# Proposals: must be []
dfx canister call football_heir getAllProposals '()'
# Expected: vec {}

# Object types: must be []
dfx canister call football_heir getAllObjectTypes '()'
# Expected: vec {}

# Event log: must be []
dfx canister call football_heir getEventLog '(0, 50)'
# Expected: vec {}

# Threads (forum): must be []
dfx canister call football_heir getAllThreads '()'
# Expected: vec {}

# API consumers V2: must be []
dfx canister call football_heir getAllAPIConsumersV2 '()'
# Expected: vec {}

# API price packages: must be []
dfx canister call football_heir getAPIPricePackages '()'
# Expected: vec {}

# Blob store: must be []
dfx canister call football_heir getAllBlobs '()'
# Expected: vec {}
```

### 1.2 Default governance settings check

```bash
dfx canister call football_heir getGovernanceSettings '()'
```

Expected output (values match the defaults in `main.mo`):

```
record {
  quorum                  = 0 : nat8;
  minStake                = 1_000_000_000 : nat64;   // 10 ICFC
  votingPeriod            = 604_800_000_000_000 : nat64; // 7 days
  disputeWindow           = 86_400_000_000_000 : nat64;  // 24 hours
  disputeReward           = 0 : nat8;
  vpAgeWeighting          = 0 : nat8;
  autoShardingThresholdGb = 400 : nat32;
  backupSubnetHint        = "";
  defaultRateLimitPerMin  = 10 : nat32;
  defaultAPITokenId       = 0 : nat8;
  heartbeatEnabled        = true;
  heartbeatIntervalSecs   = 3_600 : nat64;
  backupIntervalSecs      = 604_800 : nat64;
  autoShardingEnabled     = true;
}
```

### 1.3 Admin assignment check

The first call to any admin function auto-assigns the caller as admin (one-time bootstrap):

```bash
dfx canister call football_heir isAdmin '(principal "YOUR-PRINCIPAL-ID")'
# Expected after first admin action: true
```

> **Security note:** The first authenticated user to call an admin function (e.g., `addAPIToken`, `executeProposal`) becomes the admin. Deploy from a known, secure identity and call an admin function immediately after deployment to claim the admin role.

### 1.4 Heartbeat running check

```bash
dfx canister call football_heir getHeartbeatStatus '()'
```

Expected:

```
record {
  enabled           = true;
  lastHeartbeatAt   = 0 : nat64;  // 0 = not yet ticked (timer just started)
  lastBackupAt      = 0 : nat64;
  intervalSecs      = 3_600 : nat64;
  timerActive       = true;
}
```

`timerActive = true` confirms the timer was armed in the actor body. `lastHeartbeatAt = 0` is correct — the first tick happens after `heartbeatIntervalSecs` (1 hour by default).

---

## 2. First Real Proposal Walkthrough — `#NewObjectType: Player`

This is the canonical first proposal for any FootballHEIR instance. It creates the `Player` object type, establishing the foundation of the football schema.

### Prerequisites

- You hold ≥ 1 ICFC in your Internet Identity wallet
- You have already transferred ≥ 10 ICFC (default min stake = `1_000_000_000` e8s) to the **canister principal** on the ICFC ledger
- The canister principal is the `football_heir` canister ID shown in your deployment output

### Step 1 — Transfer the stake (via ICRC-1 transfer, before submitting)

```bash
# Transfer 10 ICFC to the canister before calling submitProposal
# (The canister does NOT pull funds — you push them)
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
```

### Step 2 — Submit the proposal

Content format for `#NewObjectType`: `"name,description"`

```bash
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "Player,Football player profile — individual athlete record including identity, position, and nationality",
  1_000_000_000
)'
# Returns the ProposalId (should be 1 if this is the first proposal)
```

- `proposalType` = `#NewObjectType`
- `content` = `"Player,Football player profile — individual athlete record including identity, position, and nationality"`
- `stake` = `1_000_000_000` (10 ICFC in e8s, matching the min stake you transferred)

### Step 3 — Vote on the proposal

Wait for others to vote, or as admin, cast your vote (if you hold ICFC):

```bash
dfx canister call football_heir voteOnProposal '(1, true)'
# Args: (proposalId, inFavor)
```

Your voting power equals your ICFC balance in e8s at time of vote, queried live from the ledger.

### Step 4 — Execute the proposal (admin only)

After voting ends (default: 7 days) or once quorum is satisfied:

```bash
dfx canister call football_heir executeProposal '(1)'
```

Expected result:
- Proposal status changes to `#Executed`
- `getAllObjectTypes()` now returns a single ObjectType: `Player`
- Your 10 ICFC stake is automatically returned to your wallet
- Event log gains an entry: `eventType = "ProposalExecuted"`, `details = "id=1 type=NewObjectType"`

### Step 5 — Verify

```bash
dfx canister call football_heir getAllObjectTypes '()'
# Expected:
# vec {
#   record {
#     id = 1 : nat32;
#     name = "Player";
#     description = "Football player profile — ...";
#     attributes = vec {};
#     methods = vec {};
#     createdAt = ...; updatedAt = ...;
#   }
# }
```

---

## 3. Bootstrap Sequence — 5 Founding Proposals

Submit these 5 proposals in order to establish the core football schema. Each builds on the previous.
All use the `#NewObjectType` type with the CSV format: `"name,description"`.

> **Important:** Submit and execute each proposal before the next. ObjectType IDs are assigned sequentially (1, 2, 3, 4, 5) in order of execution.

### Proposal 1 — Player

```bash
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "Player,Football player profile — individual athlete record including identity, position, and nationality",
  1_000_000_000
)'
```

After execution, add attributes via `#NewAttribute` proposals (see Section 4):

| Attribute       | Data type  | Required | Default |
|-----------------|------------|----------|---------|
| `playerId`      | `Nat32`    | true     | —       |
| `fullName`      | `Text(64)` | true     | —       |
| `dateOfBirth`   | `Nat64`    | true     | —       |
| `nationalityCode`| `Text(3)` | true     | —       |
| `positionCode`  | `Text(3)`  | true     | —       |
| `preferredFoot` | `Nat8`     | false    | `0`     |

### Proposal 2 — Club

```bash
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "Club,Football club — professional football organization with its stadium and founding details",
  1_000_000_000
)'
```

| Attribute     | Data type  | Required | Default |
|---------------|------------|----------|---------|
| `clubId`      | `Nat32`    | true     | —       |
| `name`        | `Text(64)` | true     | —       |
| `countryCode` | `Text(3)`  | true     | —       |
| `founded`     | `Nat32`    | false    | `0`     |
| `stadiumId`   | `Nat32`    | false    | `0`     |

### Proposal 3 — League

```bash
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "League,Football league — competition structure within a country or continent",
  1_000_000_000
)'
```

| Attribute          | Data type | Required | Default |
|--------------------|-----------|----------|---------|
| `leagueId`         | `Nat32`   | true     | —       |
| `name`             | `Text(64)`| true     | —       |
| `countryCode`      | `Text(3)` | true     | —       |
| `tier`             | `Nat8`    | true     | `1`     |
| `seasonStartMonth` | `Nat8`    | false    | `8`     |

### Proposal 4 — Match

```bash
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "Match,A single football fixture between two clubs in a league or cup competition",
  1_000_000_000
)'
```

| Attribute        | Data type | Required | Default |
|------------------|-----------|----------|---------|
| `matchId`        | `Nat32`   | true     | —       |
| `homeClubId`     | `Nat32`   | true     | —       |
| `awayClubId`     | `Nat32`   | true     | —       |
| `startTimestamp` | `Nat64`   | true     | —       |
| `leagueId`       | `Nat32`   | true     | —       |
| `seasonId`       | `Nat32`   | true     | —       |

### Proposal 5 — Season

```bash
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "Season,A competitive season within a league — spanning start and end dates",
  1_000_000_000
)'
```

| Attribute   | Data type | Required | Default |
|-------------|-----------|----------|---------|
| `seasonId`  | `Nat32`   | true     | —       |
| `leagueId`  | `Nat32`   | true     | —       |
| `year`      | `Nat32`   | true     | —       |
| `startDate` | `Nat64`   | true     | —       |
| `endDate`   | `Nat64`   | true     | —       |

---

## 4. Adding Attributes via `#NewAttribute` Proposals

After creating an ObjectType, add its columns via `#NewAttribute` proposals.

Content format: `"objectId,name,dataType,isRequired,defaultValue"`

Example — add `fullName` attribute to Player (objectId = 1):

```bash
dfx canister call football_heir submitProposal '(
  variant { NewAttribute },
  "1,fullName,Text(64),true,",
  1_000_000_000
)'
```

- `objectId` = `1` (Player)
- `name` = `fullName`
- `dataType` = `Text(64)` — free-text field (enforced by consuming apps, not the canister)
- `isRequired` = `true`
- `defaultValue` = `` (empty = no default)

Example — add `preferredFoot` (0=unknown, 1=left, 2=right):

```bash
dfx canister call football_heir submitProposal '(
  variant { NewAttribute },
  "1,preferredFoot,Nat8,false,0",
  1_000_000_000
)'
```

---

## 5. Staking & Burning Test Flow

Verify the staking/burning mechanics work before going live.

### Step 1 — Submit a proposal and vote to reject it

```bash
# Submit a test proposal (e.g., a bogus NewObjectType with a descriptive title)
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "TestEntity,This is a test proposal to verify stake burning — vote to reject",
  1_000_000_000
)'
# Note the proposalId (e.g., 6)

# Vote against
dfx canister call football_heir voteOnProposal '(6, false)'
```

### Step 2 — Execute (results in rejection)

```bash
dfx canister call football_heir executeProposal '(6)'
# Proposal should move to #Rejected
# Stake remains in canister during dispute window (24 hours by default)
```

Verify:

```bash
dfx canister call football_heir getProposal '(6)'
# Expected: status = variant { Rejected }, disputeWindowEnd = now + 86_400_000_000_000
```

### Step 3 — Wait for dispute window, then burn

After 24 hours (or to test immediately, the DAO can lower `disputeWindow` via `#ChangeGovernance`):

```bash
dfx canister call football_heir burnStake '(6)'
# Expected: stake transferred to burn account (Principal "aaaaa-aa")
```

Verify event log:

```bash
dfx canister call football_heir getEventLog '(0, 50)'
# Look for: eventType = "StakeBurned", details = "proposalId=6 amount=1000000000"
```

---

## 6. Dispute Flow Test

Verify `#DisputeProposal` works correctly (stake refund + reward from treasury).

### Step 1 — Submit and pass a proposal

```bash
# Submit
dfx canister call football_heir submitProposal '(
  variant { NewObjectType },
  "DisputeTest,Test entity for dispute flow verification",
  1_000_000_000
)'
# ProposalId = 7

# Vote in favor
dfx canister call football_heir voteOnProposal '(7, true)'

# Execute
dfx canister call football_heir executeProposal '(7)'
# Status = #Executed, disputeWindowEnd = now + 24h
```

### Step 2 — Submit a dispute within the window

```bash
dfx canister call football_heir submitProposal '(
  variant { DisputeProposal },
  "7,The executed proposal contained an invalid entity description",
  1_000_000_000
)'
# DisputeProposalId = 8
```

### Step 3 — Vote to uphold the dispute

```bash
dfx canister call football_heir voteOnProposal '(8, true)'
dfx canister call football_heir executeProposal '(8)'
```

Expected outcome:
- Proposal 7 status changes to `#Disputed`
- Original proposer receives stake refund (10 ICFC returned via ICRC-1 transfer)
- If `disputeReward > 0%`: disputer receives `stake * disputeReward / 100` from treasury
- Default `disputeReward = 0%` means no reward is paid out of the box

Verify:

```bash
dfx canister call football_heir getEventLog '(0, 50)'
# Look for: eventType = "DisputeUpheld", details = "proposalId=7 disputeId=8"
```

---

## 7. API Monetization Flow Test

Verify the pay-as-you-go API system end-to-end.

### Step 1 — Add ICFC as a payment token (admin)

```bash
dfx canister call football_heir addAPIToken '(
  principal "ddsp7-7iaaa-aaaaq-aacqq-cai",
  "ICFC",
  8,
  100_000_000
)'
# Returns APITokenId = 0 (first token)
```

### Step 2 — Create a price package via proposal

```bash
dfx canister call football_heir submitProposal '(
  variant { NewAPIPrice },
  "Global Query Standard,0,,1000000,800000,5",
  1_000_000_000
)'
# Content: "name,tokenId,objectTypeId,pricePerCall,priceBatchCall,batchSizeThreshold"
# objectTypeId = "" (wildcard — applies to all object types)
# pricePerCall = 1_000_000 e8s = 0.01 ICFC per call
# priceBatchCall = 800_000 e8s = 0.008 ICFC per batch call
# batchSizeThreshold = 5 (need ≥5 items to qualify for batch pricing)
```

Vote and execute. `getAPIPricePackages()` should return the new package.

### Step 3 — Register an API key

```bash
dfx canister call football_heir registerAPIKey '(0)'
# Args: (tokenId)
# Returns: record { __kind__ = "ok"; ok = blob "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" }
# Save the returned 32-byte blob — this is the API key
```

### Step 4 — Verify consumer record

```bash
dfx canister call football_heir getAPIConsumerByKey '(blob "YOUR_API_KEY_BLOB")'
# Expected:
# record {
#   id = 1 : nat32;
#   owner = principal "YOUR_PRINCIPAL";
#   apiKey = blob "...";
#   tokenId = 0 : nat8;
#   balance = 0 : nat64;
#   callCount = 0 : nat32;
#   isActive = true;
#   ...
# }
```

### Step 5 — Deposit balance

```bash
# First, transfer 100 ICFC to the canister on the ICFC ledger:
dfx canister call ddsp7-7iaaa-aaaaq-aacqq-cai icrc1_transfer '(record {
  from_subaccount = null;
  to = record { owner = principal "FOOTBALL_HEIR_CANISTER_ID"; subaccount = null };
  amount = 10_000_000_000;   // 100 ICFC
  fee = null;
  memo = null;
  created_at_time = null;
})'

# Then credit the consumer account
dfx canister call football_heir depositAPIBalance '(blob "YOUR_API_KEY_BLOB", 10_000_000_000)'
# Returns: variant { ok = 10_000_000_000 : nat64 }
```

Verify:

```bash
dfx canister call football_heir getAPIConsumerByKey '(blob "YOUR_API_KEY_BLOB")'
# balance should now be 10_000_000_000
```

### Step 6 — Simulate an API call deduction

```bash
dfx canister call football_heir deductAPICall '(blob "YOUR_API_KEY_BLOB", null, false, 1)'
# Args: (apiKey, objectTypeId?, isBatch, batchSize)
# Returns: variant { ok = 9_999_000_000 : nat64 }  ← new balance after deduction
```

Verify balance decremented by `pricePerCall` (1_000_000 e8s = 0.01 ICFC).

---

## 8. Post-Deployment Health Checks

Run these after completing the bootstrap sequence to confirm all systems are operational.

### 8.1 Heartbeat running

```bash
dfx canister call football_heir getHeartbeatStatus '()'
# After the first tick (1 hour after deployment):
# lastHeartbeatAt > 0
# timerActive = true
```

### 8.2 Event log chain integrity

The frontend Governance page shows the event log. To verify chain integrity programmatically:

```bash
dfx canister call football_heir getEventLog '(0, 50)'
```

For each consecutive pair of entries `(prev, curr)`:
- `curr.previousHash == prev.hash`
- Entry 1's `previousHash == null`

If any entry's `previousHash` does not match the previous entry's `hash`, the chain has been tampered with or an upgrade reset part of the log.

### 8.3 Governance defaults unchanged

```bash
dfx canister call football_heir getGovernanceSettings '()'
# Confirm: no fields have changed from the defaults listed in Section 1.2
```

### 8.4 Five founding ObjectTypes present

```bash
dfx canister call football_heir getAllObjectTypes '()'
# Expected: Player (id=1), Club (id=2), League (id=3), Match (id=4), Season (id=5)
```

### 8.5 Admin assignment correct

```bash
dfx canister call football_heir isAdmin '(principal "YOUR-DEPLOYER-PRINCIPAL")'
# Expected: true
```

### 8.6 ICFC balance queries working

```bash
dfx canister call football_heir getICFCBalance '(principal "YOUR-DEPLOYER-PRINCIPAL")'
# Expected: your actual ICFC balance in e8s
# If returns 0 unexpectedly, the ledger canister (ddsp7-7iaaa-aaaaq-aacqq-cai) may be unreachable
```

---

## 9. Quickstart Checklist

Use this as a final sign-off before declaring the DAO operational:

```
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
  [ ] Dispute flow test completed
  [ ] API monetization test completed (registerAPIKey + depositAPIBalance + deductAPICall)

Health checks:
  [ ] Heartbeat ticked at least once (lastHeartbeatAt > 0)
  [ ] Event log chain integrity verified
  [ ] Governance settings unchanged from defaults
  [ ] ICFC balance queries returning live data
```

---

*Last updated: April 2026. Intended for the deployer / first admin of a FootballHEIR canister instance.*
*After bootstrap, all changes are governed exclusively by ICFC token holder proposals.*
