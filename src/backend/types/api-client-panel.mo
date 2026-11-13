import Time "mo:core/Time";
import Principal "mo:core/Principal";

module {
  // ── Shared primitive aliases (local to this domain) ──────────────────────────
  public type Timestamp  = Time.Time;   // Int (nanoseconds)
  public type ConsumerId = Nat32;
  public type ObjectId   = Nat32;
  public type TokenAmt   = Nat64;

  // ── APIKeyMeta ───────────────────────────────────────────────────────────────
  /// Per-key metadata record, supporting multiple keys per consumer in the future.
  public type APIKeyMeta = {
    id         : Nat32;        // sequential ID for this meta record
    consumerId : ConsumerId;   // FK to APIConsumerV2.id
    name       : Text;         // user-provided label (max 50 chars)
    apiKey     : Blob;         // 32-byte key
    createdAt  : Timestamp;
    lastUsedAt : Timestamp;
    isActive   : Bool;
  };

  // ── APICallRecord ────────────────────────────────────────────────────────────
  /// Append-only call log entry. Keyed by Nat64 (up to 18 trillion entries).
  public type APICallRecord = {
    id           : Nat64;           // sequential monotonic ID
    consumerId   : ConsumerId;      // FK to APIConsumerV2.id
    apiKey       : Blob;            // 32-byte key used for the call
    objectTypeId : ?ObjectId;       // null = global / unscoped call
    isBatch      : Bool;
    batchSize    : Nat8;
    cost         : TokenAmt;        // e8s deducted
    status       : Text;            // "ok" | "error: <msg>"
    timestamp    : Timestamp;
  };

  // ── APICallTypeBreakdown ─────────────────────────────────────────────────────
  /// Aggregated call counts per objectTypeId across a caller's keys in a date range.
  public type APICallTypeBreakdown = {
    objectTypeId : ?ObjectId;   // null = unscoped calls
    typeName     : Text;        // e.g. "Player", "Match", "Global"
    callCount    : Nat32;
    totalCost    : TokenAmt;
  };

  // ── TimeSeriesBucket ─────────────────────────────────────────────────────────
  /// One time bucket for time-series analytics (day or week granularity).
  public type TimeSeriesBucket = {
    bucketStart : Timestamp;   // start of bucket in nanoseconds
    bucketLabel : Text;        // human-readable label e.g. "2026-04-14"
    callCount   : Nat32;
    totalCost   : TokenAmt;
  };

  // ── RateLimitStatus ──────────────────────────────────────────────────────────
  /// Current rate-limit window status for a given API key.
  public type RateLimitStatus = {
    currentWindowCalls : Nat32;   // calls made in the current 1-minute window
    rateLimit          : Nat32;   // configured max calls per minute (0 = governance default)
    windowStart        : Timestamp;
    windowEndSecs      : Nat32;   // seconds until window resets
  };
};
