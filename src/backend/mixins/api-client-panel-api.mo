import Types "../Types";
import ClientPanelTypes "../types/api-client-panel";
import ClientPanelLib "../lib/api-client-panel";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Nat32 "mo:core/Nat32";
import Blob "mo:core/Blob";

/// Public API mixin for the API client panel domain.
/// Each function validates Principal ownership before delegating to the lib module.
/// State slices are injected at actor composition (main.mo).
mixin (
  apiConsumersV2 : Map.Map<Types.ConsumerId, Types.APIConsumerV2>,
  apiKeyIndex    : Map.Map<Blob, Types.ConsumerId>,
  apiKeyNames    : Map.Map<Nat32, ClientPanelTypes.APIKeyMeta>,
  apiCallLog     : Map.Map<Nat64, ClientPanelTypes.APICallRecord>,
  apiRateLimits  : Map.Map<Types.ConsumerId, Types.RateLimitEntry>,
  defaultRateLimitPerMin : Nat32,        // from GovernanceSettings
  makeKeyFn      : (Principal, Types.ConsumerId) -> Blob,
) {

  // ── getAllConsumerKeys ───────────────────────────────────────────────────────
  /// Return all APIConsumerV2 records owned by the caller (active and revoked).
  /// Only the caller's own records are returned — zero cross-consumer leakage.
  public query ({ caller }) func getAllConsumerKeys() : async [Types.APIConsumerV2] {
    ClientPanelLib.getAllConsumerKeys(caller, apiConsumersV2);
  };

  // ── rotateAPIKey ─────────────────────────────────────────────────────────────
  /// Invalidate the caller's current API key and issue a fresh 32-byte key.
  /// Returns the new key blob. Caller must own the provided apiKey.
  public shared ({ caller }) func rotateAPIKey(apiKey : Blob) : async { #ok : Blob; #err : Text } {
    if (apiKey.size() != 32) return #err("Invalid API key: must be 32 bytes");
    // Verify caller owns this key
    let consumerId = switch (apiKeyIndex.get(apiKey)) {
      case null    return #err("API key not found");
      case (?cid)  cid;
    };
    let consumer = switch (apiConsumersV2.get(consumerId)) {
      case null   return #err("Consumer not found");
      case (?c)   c;
    };
    if (not Principal.equal(consumer.owner, caller)) return #err("Unauthorized: key not owned by caller");
    ClientPanelLib.rotateAPIKey(
      consumerId,
      apiConsumersV2,
      apiKeyIndex,
      apiKeyNames,
      func(cid : Types.ConsumerId) : Blob { makeKeyFn(caller, cid) },
      Time.now(),
    );
  };

  // ── revokeAPIKey ─────────────────────────────────────────────────────────────
  /// Mark the caller's API key as inactive. The key is preserved for audit purposes.
  /// Caller must own the provided apiKey.
  public shared ({ caller }) func revokeAPIKey(apiKey : Blob) : async { #ok; #err : Text } {
    if (apiKey.size() != 32) return #err("Invalid API key: must be 32 bytes");
    let consumerId = switch (apiKeyIndex.get(apiKey)) {
      case null    return #err("API key not found");
      case (?cid)  cid;
    };
    let consumer = switch (apiConsumersV2.get(consumerId)) {
      case null   return #err("Consumer not found");
      case (?c)   c;
    };
    if (not Principal.equal(consumer.owner, caller)) return #err("Unauthorized: key not owned by caller");
    ClientPanelLib.revokeAPIKey(
      apiKey,
      consumerId,
      apiConsumersV2,
      apiKeyNames,
      Time.now(),
    );
  };

  // ── renameAPIKey ─────────────────────────────────────────────────────────────
  /// Update the display name for the caller's API key (max 50 chars).
  /// Caller must own the provided apiKey.
  public shared ({ caller }) func renameAPIKey(apiKey : Blob, newName : Text) : async { #ok; #err : Text } {
    if (apiKey.size() != 32) return #err("Invalid API key: must be 32 bytes");
    let consumerId = switch (apiKeyIndex.get(apiKey)) {
      case null    return #err("API key not found");
      case (?cid)  cid;
    };
    let consumer = switch (apiConsumersV2.get(consumerId)) {
      case null   return #err("Consumer not found");
      case (?c)   c;
    };
    if (not Principal.equal(consumer.owner, caller)) return #err("Unauthorized: key not owned by caller");
    ClientPanelLib.renameAPIKey(apiKey, consumerId, newName, apiKeyNames);
  };

  // ── getAPICallHistory ────────────────────────────────────────────────────────
  /// Return paginated call history for the caller's API key.
  /// Results are filtered by [fromTs, toTs] and sorted descending by timestamp.
  /// Page size is 100 records. page=0 returns the most recent 100.
  /// Caller must own the provided apiKey.
  public shared ({ caller }) func getAPICallHistory(
    apiKey : Blob,
    fromTs : Int,
    toTs   : Int,
    page   : Nat32,
  ) : async { #ok : [ClientPanelTypes.APICallRecord]; #err : Text } {
    if (apiKey.size() != 32) return #err("Invalid API key: must be 32 bytes");
    let consumerId = switch (apiKeyIndex.get(apiKey)) {
      case null    return #err("API key not found");
      case (?cid)  cid;
    };
    let consumer = switch (apiConsumersV2.get(consumerId)) {
      case null   return #err("Consumer not found");
      case (?c)   c;
    };
    if (not Principal.equal(consumer.owner, caller)) return #err("Unauthorized: key not owned by caller");
    ClientPanelLib.getAPICallHistory(apiKey, fromTs, toTs, page, apiCallLog);
  };

  // ── getAPICallBreakdown ──────────────────────────────────────────────────────
  /// Return aggregate call counts and costs per objectTypeId for all of the caller's
  /// keys within the specified timestamp range.
  public shared ({ caller }) func getAPICallBreakdown(
    fromTs : Int,
    toTs   : Int,
  ) : async { #ok : [ClientPanelTypes.APICallTypeBreakdown]; #err : Text } {
    // Collect all consumer IDs owned by caller
    let consumerIds : [Types.ConsumerId] = apiConsumersV2.values()
      .filter(func(c : Types.APIConsumerV2) : Bool { Principal.equal(c.owner, caller) })
      .map<Types.APIConsumerV2, Types.ConsumerId>(func(c) { c.id })
      .toArray();
    if (consumerIds.size() == 0) return #ok([]);
    ClientPanelLib.getAPICallBreakdown(consumerIds, fromTs, toTs, apiCallLog);
  };

  // ── getCallTimeSeries ────────────────────────────────────────────────────────
  /// Return per-time-bucket call counts and costs for the caller's keys
  /// within the specified range. granularity must be "day" or "week".
  public shared ({ caller }) func getCallTimeSeries(
    fromTs      : Int,
    toTs        : Int,
    granularity : Text,
  ) : async { #ok : [ClientPanelTypes.TimeSeriesBucket]; #err : Text } {
    let consumerIds : [Types.ConsumerId] = apiConsumersV2.values()
      .filter(func(c : Types.APIConsumerV2) : Bool { Principal.equal(c.owner, caller) })
      .map<Types.APIConsumerV2, Types.ConsumerId>(func(c) { c.id })
      .toArray();
    if (consumerIds.size() == 0) return #ok([]);
    ClientPanelLib.getCallTimeSeries(consumerIds, fromTs, toTs, granularity, apiCallLog);
  };

  // ── getAPIRateLimitStatus ────────────────────────────────────────────────────
  /// Return the current rate-limit window status for the caller's API key.
  /// Caller must own the provided apiKey.
  public shared ({ caller }) func getAPIRateLimitStatus(
    apiKey : Blob,
  ) : async { #ok : ClientPanelTypes.RateLimitStatus; #err : Text } {
    if (apiKey.size() != 32) return #err("Invalid API key: must be 32 bytes");
    let consumerId = switch (apiKeyIndex.get(apiKey)) {
      case null    return #err("API key not found");
      case (?cid)  cid;
    };
    let consumer = switch (apiConsumersV2.get(consumerId)) {
      case null   return #err("Consumer not found");
      case (?c)   c;
    };
    if (not Principal.equal(consumer.owner, caller)) return #err("Unauthorized: key not owned by caller");
    ClientPanelLib.getAPIRateLimitStatus(
      consumerId,
      apiConsumersV2,
      apiRateLimits,
      defaultRateLimitPerMin,
      Time.now(),
    );
  };
};
