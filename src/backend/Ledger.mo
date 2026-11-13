import Principal "mo:core/Principal";

module {
  public type Account = {
    owner      : Principal;
    subaccount : ?Blob;
  };

  public type TransferArg = {
    from_subaccount : ?Blob;
    to              : Account;
    amount          : Nat;
    fee             : ?Nat;
    memo            : ?Blob;
    created_at_time : ?Nat64;
  };

  public type TransferError = {
    #BadFee             : { expected_fee : Nat };
    #BadBurn            : { min_burn_amount : Nat };
    #InsufficientFunds  : { balance : Nat };
    #TooOld;
    #CreatedInFuture    : { ledger_time : Nat64 };
    #Duplicate          : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError       : { error_code : Nat; message : Text };
  };

  public type TransferResult = { #Ok : Nat; #Err : TransferError };

  public let LEDGER_CANISTER_ID : Text = "ddsp7-7iaaa-aaaaq-aacqq-cai";

  /// Returns the ICFC ICRC-1 ledger actor.
  public func ledger() : actor {
    icrc1_balance_of : (Account) -> async Nat;
    icrc1_transfer   : (TransferArg) -> async TransferResult;
  } {
    actor (LEDGER_CANISTER_ID)
  };
}
