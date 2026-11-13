import Types "../Types";
import ClientPanelTypes "../types/api-client-panel";
import Map "mo:core/Map";
import Array "mo:core/Array";
import Iter "mo:core/Iter";
import Nat "mo:core/Nat";
import Nat32 "mo:core/Nat32";
import Nat64 "mo:core/Nat64";
import Int "mo:core/Int";
import Text "mo:core/Text";
import Blob "mo:core/Blob";
import Principal "mo:core/Principal";

/// Domain logic for the API client panel.
/// All functions receive the relevant state slices as parameters (stateless module).
module {

  // ── Type aliases ────────────────────────────────────────────────────────────
  public type ConsumerId     = Types.ConsumerId;
  public type APIConsumerV2  = Types.APIConsumerV2;
  public type APIKeyMeta     = ClientPanelTypes.APIKeyMeta;
  public type APICallRecord  = ClientPanelTypes.APICallRecord;
  public type APICallTypeBreakdown = ClientPanelTypes.APICallTypeBreakdown;
  public type TimeSeriesBucket     = ClientPanelTypes.TimeSeriesBucket;
  public type RateLimitStatus      = ClientPanelTypes.RateLimitStatus;
  public type RateLimitEntry = Types.RateLimitEntry;

  // ── Time constants ────────────────────────────────────────────────────────────
  let NS_PER_SEC  : Int = 1_000_000_000;
  let NS_PER_DAY  : Int = 86_400_000_000_000;
  let NS_PER_WEEK : Int = 604_800_000_000_000;

  // ── appendCallRecord ─────────────────────────────────────────────────────────
  /// Append a new APICallRecord to the apiCallLog and update the lastUsedAt
  /// timestamp on the corresponding APIKeyMeta record.
  /// Returns the new nextCallLogId value (caller must persist it).
  public func appendCallRecord(
    consumerId    : ConsumerId,
    apiKey        : Blob,
    objectTypeId  : ?Types.ObjectId,
    isBatch       : Bool,
    batchSize     : Nat8,
    cost          : Types.TokenAmt,
    status        : Text,
    apiCallLog    : Map.Map<Nat64, APICallRecord>,
    apiKeyNames   : Map.Map<Nat32, APIKeyMeta>,
    nextCallLogId : Nat64,
    now           : Types.Timestamp,
  ) : Nat64 {
    let record : APICallRecord = {
      id           = nextCallLogId;
      consumerId;
      apiKey;
      objectTypeId;
      isBatch;
      batchSize;
      cost;
      status;
      timestamp    = now;
    };
    apiCallLog.add(nextCallLogId, record);
    // Update lastUsedAt on any matching APIKeyMeta entry for this consumer
    for ((metaId, meta) in apiKeyNames.entries()) {
      if (meta.consumerId == consumerId) {
        apiKeyNames.add(metaId, { meta with lastUsedAt = now });
      };
    };
    nextCallLogId + 1;
  };

  // ── getAllConsumerKeys ───────────────────────────────────────────────────────
  /// Return all APIConsumerV2 records (active and revoked) that belong to the
  /// given principal. NEVER returns any other principal's data.
  public func getAllConsumerKeys(
    owner          : Types.UserId,
    apiConsumersV2 : Map.Map<ConsumerId, APIConsumerV2>,
  ) : [APIConsumerV2] {
    apiConsumersV2.values()
      .filter(func(c : APIConsumerV2) : Bool { Principal.equal(c.owner, owner) })
      .toArray();
  };

  // ── rotateAPIKey ─────────────────────────────────────────────────────────────
  /// Generate a new 32-byte key for the given consumer, remove old key from the
  /// reverse index, insert new key, and return the new Blob key.
  /// Caller must equal consumer.owner — enforced at mixin boundary before calling here.
  public func rotateAPIKey(
    consumerId     : ConsumerId,
    apiConsumersV2 : Map.Map<ConsumerId, APIConsumerV2>,
    apiKeyIndex    : Map.Map<Blob, ConsumerId>,
    apiKeyNames    : Map.Map<Nat32, APIKeyMeta>,
    makeKey        : (ConsumerId) -> Blob,
    now            : Types.Timestamp,
  ) : { #ok : Blob; #err : Text } {
    let consumer = switch (apiConsumersV2.get(consumerId)) {
      case null    return #err("Consumer not found");
      case (?c)    c;
    };
    if (not consumer.isActive) return #err("Consumer account is inactive");
    let oldKey = consumer.apiKey;
    let newKey = makeKey(consumerId);
    // Swap keys in reverse index
    apiKeyIndex.remove(oldKey);
    apiKeyIndex.add(newKey, consumerId);
    // Update consumer record with new key
    apiConsumersV2.add(consumerId, { consumer with apiKey = newKey; lastCallAt = now });
    // Update APIKeyMeta to reflect the new key value
    for ((metaId, meta) in apiKeyNames.entries()) {
      if (meta.consumerId == consumerId) {
        apiKeyNames.add(metaId, { meta with apiKey = newKey; lastUsedAt = now });
      };
    };
    #ok(newKey);
  };

  // ── revokeAPIKey ─────────────────────────────────────────────────────────────
  /// Mark the given API consumer as inactive (isActive = false).
  /// The key is kept in state for historical record purposes.
  /// Caller must equal consumer.owner — enforced at mixin boundary before calling here.
  public func revokeAPIKey(
    apiKey         : Blob,
    consumerId     : ConsumerId,
    apiConsumersV2 : Map.Map<ConsumerId, APIConsumerV2>,
    apiKeyNames    : Map.Map<Nat32, APIKeyMeta>,
    now            : Types.Timestamp,
  ) : { #ok; #err : Text } {
    let consumer = switch (apiConsumersV2.get(consumerId)) {
      case null   return #err("Consumer not found");
      case (?c)   c;
    };
    if (not consumer.isActive) return #err("Consumer account is already inactive");
    apiConsumersV2.add(consumerId, { consumer with isActive = false; lastCallAt = now });
    // Mark matching APIKeyMeta entries inactive
    for ((metaId, meta) in apiKeyNames.entries()) {
      if (meta.consumerId == consumerId and Blob.equal(meta.apiKey, apiKey)) {
        apiKeyNames.add(metaId, { meta with isActive = false; lastUsedAt = now });
      };
    };
    #ok;
  };

  // ── renameAPIKey ─────────────────────────────────────────────────────────────
  /// Update the name field on the APIKeyMeta record for the given API key.
  /// Caller must equal consumer.owner — enforced at mixin boundary before calling here.
  /// Max name length: 50 chars.
  public func renameAPIKey(
    apiKey      : Blob,
    consumerId  : ConsumerId,
    newName     : Text,
    apiKeyNames : Map.Map<Nat32, APIKeyMeta>,
  ) : { #ok; #err : Text } {
    if (newName.size() > 50) return #err("Name too long: max 50 characters");
    if (newName.size() == 0) return #err("Name must not be empty");
    var found = false;
    for ((metaId, meta) in apiKeyNames.entries()) {
      if (meta.consumerId == consumerId and Blob.equal(meta.apiKey, apiKey)) {
        apiKeyNames.add(metaId, { meta with name = newName });
        found := true;
      };
    };
    if (not found) return #err("API key metadata not found");
    #ok;
  };

  // ── getAPICallHistory ────────────────────────────────────────────────────────
  /// Return up to 100 call records for the given apiKey, filtered by timestamp range,
  /// sorted descending by timestamp, starting at the given page offset (page 0 = latest).
  /// Caller must equal consumer.owner — enforced at mixin boundary before calling here.
  public func getAPICallHistory(
    apiKey     : Blob,
    fromTs     : Types.Timestamp,
    toTs       : Types.Timestamp,
    page       : Nat32,
    apiCallLog : Map.Map<Nat64, APICallRecord>,
  ) : { #ok : [APICallRecord]; #err : Text } {
    let PAGE_SIZE : Nat = 100;
    // Collect all records matching this apiKey within the timestamp range
    let matching : [APICallRecord] = apiCallLog.values()
      .filter(func(r : APICallRecord) : Bool {
        Blob.equal(r.apiKey, apiKey) and r.timestamp >= fromTs and r.timestamp <= toTs
      })
      .toArray();
    // Sort descending by timestamp (newest first)
    let sorted = matching.sort(func(a : APICallRecord, b : APICallRecord) : { #less; #equal; #greater } {
      if (a.timestamp > b.timestamp)      #less
      else if (a.timestamp < b.timestamp) #greater
      else                                #equal
    });
    // Paginate: page 0 = first 100, page 1 = next 100, etc.
    let start : Nat = Nat.fromNat32(page) * PAGE_SIZE;
    if (start >= sorted.size()) return #ok([]);
    let end : Nat = if (start + PAGE_SIZE > sorted.size()) sorted.size() else start + PAGE_SIZE;
    #ok(sorted.sliceToArray(start.toInt(), end.toInt()));
  };

  // ── getAPICallBreakdown ──────────────────────────────────────────────────────
  /// Aggregate call counts and costs per objectTypeId across all of a caller's
  /// keys within the specified timestamp range.
  public func getAPICallBreakdown(
    consumerIds : [ConsumerId],
    fromTs      : Types.Timestamp,
    toTs        : Types.Timestamp,
    apiCallLog  : Map.Map<Nat64, APICallRecord>,
  ) : { #ok : [APICallTypeBreakdown]; #err : Text } {
    // Map from bucket key (Text) -> aggregated stats
    let buckets : Map.Map<Text, { callCount : Nat32; totalCost : Nat64; objectTypeId : ?Types.ObjectId }> = Map.empty();
    for ((_, record) in apiCallLog.entries()) {
      let owned = consumerIds.find(func(cid : ConsumerId) : Bool { cid == record.consumerId });
      if (owned != null and record.timestamp >= fromTs and record.timestamp <= toTs) {
        let bucketKey : Text = switch (record.objectTypeId) {
          case null      "__global__";
          case (?oid)    Nat.fromNat32(oid).toText();
        };
        let existing = switch (buckets.get(bucketKey)) {
          case null    ({ callCount = 0 : Nat32; totalCost = 0 : Nat64; objectTypeId = record.objectTypeId });
          case (?b)    b;
        };
        buckets.add(bucketKey, {
          existing with
          callCount = existing.callCount + 1;
          totalCost = existing.totalCost + record.cost;
        });
      };
    };
    let result : [APICallTypeBreakdown] = buckets.values()
      .map<{ callCount : Nat32; totalCost : Nat64; objectTypeId : ?Types.ObjectId }, APICallTypeBreakdown>(
        func(b) : APICallTypeBreakdown {
          let lbl : Text = switch (b.objectTypeId) {
            case null    "Global";
            case (?oid)  "Type#" # Nat.fromNat32(oid).toText();
          };
          {
            objectTypeId = b.objectTypeId;
            typeName     = lbl;
            callCount    = b.callCount;
            totalCost    = b.totalCost;
          }
        }
      )
      .toArray();
    #ok(result);
  };

  // ── getCallTimeSeries ────────────────────────────────────────────────────────
  /// Return per-time-bucket call counts and costs for all of a caller's keys
  /// within the specified range. granularity must be "day" or "week".
  public func getCallTimeSeries(
    consumerIds : [ConsumerId],
    fromTs      : Types.Timestamp,
    toTs        : Types.Timestamp,
    granularity : Text,
    apiCallLog  : Map.Map<Nat64, APICallRecord>,
  ) : { #ok : [TimeSeriesBucket]; #err : Text } {
    if (granularity != "day" and granularity != "week") {
      return #err("granularity must be 'day' or 'week'");
    };
    if (fromTs > toTs) return #err("fromTs must be <= toTs");
    let bucketSize : Int = if (granularity == "week") NS_PER_WEEK else NS_PER_DAY;
    // Map from bucketStart (Int) -> aggregated stats
    let buckets : Map.Map<Int, { callCount : Nat32; totalCost : Nat64 }> = Map.empty();
    for ((_, record) in apiCallLog.entries()) {
      let owned = consumerIds.find(func(cid : ConsumerId) : Bool { cid == record.consumerId });
      if (owned != null and record.timestamp >= fromTs and record.timestamp <= toTs) {
        let bucketStart : Int = (record.timestamp / bucketSize) * bucketSize;
        let existing = switch (buckets.get(bucketStart)) {
          case null  ({ callCount = 0 : Nat32; totalCost = 0 : Nat64 });
          case (?b)  b;
        };
        buckets.add(bucketStart, {
          callCount = existing.callCount + 1;
          totalCost = existing.totalCost + record.cost;
        });
      };
    };
    // Convert to array and sort ascending by bucketStart
    let unsorted : [TimeSeriesBucket] = buckets.entries()
      .map<(Int, { callCount : Nat32; totalCost : Nat64 }), TimeSeriesBucket>(
        func((bucketStart, b)) : TimeSeriesBucket {
          let epochSecs : Int = bucketStart / NS_PER_SEC;
          {
            bucketStart;
            bucketLabel = formatDateLabel(epochSecs, granularity);
            callCount   = b.callCount;
            totalCost   = b.totalCost;
          }
        }
      )
      .toArray();
    let sorted = unsorted.sort(func(a : TimeSeriesBucket, b : TimeSeriesBucket) : { #less; #equal; #greater } {
      if (a.bucketStart < b.bucketStart)      #less
      else if (a.bucketStart > b.bucketStart) #greater
      else                                     #equal
    });
    #ok(sorted);
  };

  // ── getAPIRateLimitStatus ────────────────────────────────────────────────────
  /// Return the rate-limit status for the given consumerId.
  public func getAPIRateLimitStatus(
    consumerId     : ConsumerId,
    apiConsumersV2 : Map.Map<ConsumerId, APIConsumerV2>,
    apiRateLimits  : Map.Map<ConsumerId, RateLimitEntry>,
    defaultLimit   : Nat32,
    now            : Types.Timestamp,
  ) : { #ok : RateLimitStatus; #err : Text } {
    let consumer = switch (apiConsumersV2.get(consumerId)) {
      case null   return #err("Consumer not found");
      case (?c)   c;
    };
    let rateLimit : Nat32 = if (consumer.rateLimit == 0) defaultLimit else consumer.rateLimit;
    let windowNs : Int = 60_000_000_000; // 1 minute in nanoseconds
    switch (apiRateLimits.get(consumerId)) {
      case null {
        #ok({
          currentWindowCalls = 0 : Nat32;
          rateLimit;
          windowStart        = now;
          windowEndSecs      = 60 : Nat32;
        });
      };
      case (?entry) {
        let windowEnd : Int = entry.windowStart + windowNs;
        let remaining : Int = windowEnd - now;
        if (remaining <= 0) {
          // Window has expired
          #ok({
            currentWindowCalls = 0 : Nat32;
            rateLimit;
            windowStart        = now;
            windowEndSecs      = 60 : Nat32;
          });
        } else {
          let windowEndSecs : Nat32 = (Int.abs(remaining) / 1_000_000_000).toNat32();
          #ok({
            currentWindowCalls = entry.callCount;
            rateLimit;
            windowStart        = entry.windowStart;
            windowEndSecs;
          });
        };
      };
    };
  };

  // ── formatDateLabel ──────────────────────────────────────────────────────────
  /// Generate a human-readable date label from Unix epoch seconds.
  /// Returns "YYYY-MM-DD" for day granularity, "YYYY-WNN" for weekly.
  func formatDateLabel(epochSecs : Int, granularity : Text) : Text {
    // Civil calendar calculation for Gregorian date from days since Unix epoch
    let daysSinceEpoch : Int = epochSecs / 86400;
    let z = daysSinceEpoch + 719468;
    let era = (if (z >= 0) z else z - 146096) / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y   = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp  = (5 * doy + 2) / 153;
    let d   = doy - (153 * mp + 2) / 5 + 1;
    let m   = if (mp < 10) mp + 3 else mp - 9;
    let yr  = if (m <= 2) y + 1 else y;
    let pad2 = func(n : Int) : Text {
      let s = Int.abs(n).toText();
      if (s.size() < 2) "0" # s else s
    };
    if (granularity == "week") {
      // ISO week number approximation
      let weekNum : Int = doy / 7 + 1;
      Int.abs(yr).toText() # "-W" # pad2(weekNum)
    } else {
      Int.abs(yr).toText() # "-" # pad2(m) # "-" # pad2(d)
    }
  };
};
