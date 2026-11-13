import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  APIConsumer,
  APIConsumerV2,
  APIPricePackage,
  APIToken,
  APITokenId,
  DynamicDoc,
  EventLogEntry,
  GovernanceSettings,
  ObjectType,
  Proposal,
  ProposalType,
  Template,
  Thread,
  UserProfile,
} from "../backend";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

// ─── User Profile ─────────────────────────────────────────────────────────────

export function useCallerProfile() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();

  const query = useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile", identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching && !!identity,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

/** @deprecated use useCallerProfile */
export const useGetCallerUserProfile = useCallerProfile;

export function useSaveProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("Actor not available");
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["currentUserProfile", identity?.getPrincipal().toString()],
      });
    },
  });
}

/** @deprecated use useSaveProfile */
export const useSaveCallerUserProfile = useSaveProfile;

export function useCallerICFCBalance() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<bigint>({
    queryKey: ["icfcBalance", identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor) return 0n;
      return actor.getCallerICFCBalance();
    },
    enabled: !!actor && !isFetching && !!identity,
    staleTime: 30_000,
  });
}

// ─── Proposals ────────────────────────────────────────────────────────────────

export function useAllProposals() {
  const { actor, isFetching } = useActor();

  return useQuery<Proposal[]>({
    queryKey: ["proposals"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllProposals();
    },
    enabled: !!actor && !isFetching,
  });
}

/** @deprecated use useAllProposals */
export const useGetAllProposals = useAllProposals;

export function useProposal(id: number | null) {
  const { actor, isFetching } = useActor();

  return useQuery<Proposal | null>({
    queryKey: ["proposal", id],
    queryFn: async () => {
      if (!actor || id === null) return null;
      return actor.getProposal(id);
    },
    enabled: !!actor && !isFetching && id !== null,
  });
}

/** @deprecated use useProposal */
export const useGetProposal = (id: bigint | null) =>
  useProposal(id !== null ? Number(id) : null);

export function useSubmitProposal() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      proposalType,
      stake,
      content,
    }: {
      proposalType: ProposalType;
      stake: bigint;
      content: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.submitProposal(proposalType, stake, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });
}

export function useVoteOnProposal() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      proposalId,
      inFavor,
    }: { proposalId: number; inFavor: boolean }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.voteOnProposal(proposalId, inFavor);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({
        queryKey: ["proposal", variables.proposalId],
      });
    },
  });
}

export function useDisputeProposal() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      proposalId,
      reason,
    }: { proposalId: number; reason: string }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.disputeProposal(proposalId, reason);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({
        queryKey: ["proposal", variables.proposalId],
      });
    },
  });
}

export function useSimulateProposal() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (proposalId: number) => {
      if (!actor) throw new Error("Actor not available");
      return actor.simulateProposal(proposalId);
    },
  });
}

export function useExecuteProposal() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proposalId: number) => {
      if (!actor) throw new Error("Actor not available");
      return actor.executeProposal(proposalId);
    },
    onSuccess: (_data, proposalId) => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] });
    },
  });
}

// ─── Governance ───────────────────────────────────────────────────────────────

export function useGovernanceSettings() {
  const { actor, isFetching } = useActor();

  return useQuery<GovernanceSettings>({
    queryKey: ["governanceSettings"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getGovernanceSettings();
    },
    enabled: !!actor && !isFetching,
    staleTime: 60_000,
  });
}

/** @deprecated use useGovernanceSettings */
export const useGetGovernanceSettings = useGovernanceSettings;

export function useAllObjectTypes() {
  const { actor, isFetching } = useActor();

  return useQuery<ObjectType[]>({
    queryKey: ["objectTypes"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllObjectTypes();
    },
    enabled: !!actor && !isFetching,
  });
}

/** @deprecated use useAllObjectTypes */
export const useGetAllObjectTypes = useAllObjectTypes;

// ─── Forum ────────────────────────────────────────────────────────────────────

export function useAllThreads() {
  const { actor, isFetching } = useActor();

  return useQuery<Thread[]>({
    queryKey: ["threads"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllThreads();
    },
    enabled: !!actor && !isFetching,
  });
}

/** @deprecated use useAllThreads */
export const useGetAllThreads = useAllThreads;

export function useThread(id: number | null) {
  const { actor, isFetching } = useActor();

  return useQuery<Thread | null>({
    queryKey: ["thread", id],
    queryFn: async () => {
      if (!actor || id === null) return null;
      return actor.getThread(id);
    },
    enabled: !!actor && !isFetching && id !== null,
  });
}

/** @deprecated use useThread */
export const useGetThread = (id: bigint | null) =>
  useThread(id !== null ? Number(id) : null);

export function useCreateThread() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      title,
      content,
    }: { title: string; content: string }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.createThread(title, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
  });
}

export function useAddPost() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      content,
    }: { threadId: number; content: string }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.addPost(threadId, content);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      queryClient.invalidateQueries({
        queryKey: ["thread", variables.threadId],
      });
    },
  });
}

// ─── Event Log ────────────────────────────────────────────────────────────────

export function useEventLog() {
  const { actor, isFetching } = useActor();

  return useQuery<EventLogEntry[]>({
    queryKey: ["eventLog"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getEventLog();
    },
    enabled: !!actor && !isFetching,
  });
}

/** @deprecated use useEventLog */
export const useGetEventLog = useEventLog;

// ─── Templates & Docs ─────────────────────────────────────────────────────────

export function useTemplates() {
  const { actor, isFetching } = useActor();

  return useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTemplates();
    },
    enabled: !!actor && !isFetching,
  });
}

/** @deprecated use useTemplates */
export const useGetTemplates = useTemplates;

export function useDynamicDocs() {
  const { actor, isFetching } = useActor();

  return useQuery<DynamicDoc[]>({
    queryKey: ["dynamicDocs"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getDynamicDocs();
    },
    enabled: !!actor && !isFetching,
  });
}

/** @deprecated use useDynamicDocs */
export const useGetDynamicDocs = useDynamicDocs;

// ─── API Consumer ─────────────────────────────────────────────────────────────

export function useAPIConsumer() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<APIConsumerV2 | null>({
    queryKey: ["apiConsumerV2", identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getAPIConsumerByPrincipal();
    },
    enabled: !!actor && !isFetching && !!identity,
  });
}

/** @deprecated use useAPIConsumer */
export function useGetAPIConsumer() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<APIConsumer | null>({
    queryKey: ["apiConsumer", identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getAPIConsumer();
    },
    enabled: !!actor && !isFetching && !!identity,
  });
}

export function useAPIPricePackages() {
  const { actor, isFetching } = useActor();

  return useQuery<APIPricePackage[]>({
    queryKey: ["apiPricePackages"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAPIPricePackages();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAPITokens() {
  const { actor, isFetching } = useActor();

  return useQuery<APIToken[]>({
    queryKey: ["apiTokens"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAPITokens();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useRegisterAPIKey() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async (tokenId: APITokenId) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.registerAPIKey(tokenId);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["apiConsumerV2", identity?.getPrincipal().toString()],
      });
    },
  });
}

export function useDepositAPIBalance() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async ({
      apiKey,
      amount,
    }: { apiKey: Uint8Array; amount: bigint }) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.depositAPIBalance(apiKey, amount);
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["apiConsumerV2", identity?.getPrincipal().toString()],
      });
    },
  });
}

export function useDeductAPICall() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({
      apiKey,
      objectTypeId,
      isBatch,
      batchSize,
    }: {
      apiKey: Uint8Array;
      objectTypeId: number | null;
      isBatch: boolean;
      batchSize: number;
    }) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.deductAPICall(
        apiKey,
        objectTypeId,
        isBatch,
        batchSize,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
    },
  });
}

// ─── Heartbeat & Backups ──────────────────────────────────────────────────────

export type HeartbeatStatus = {
  enabled: boolean;
  lastRun: bigint;
  nextRun: bigint;
  lastBackupAt: bigint;
  heapSizeMb: number;
};

export type BackupSummary = {
  id: number;
  triggeredBy: string;
  timestamp: bigint;
  objectCount: number;
};

export function useHeartbeatStatus() {
  const { actor, isFetching } = useActor();

  return useQuery<HeartbeatStatus>({
    queryKey: ["heartbeatStatus"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getHeartbeatStatus();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

export function useBackups() {
  const { actor, isFetching } = useActor();

  return useQuery<BackupSummary[]>({
    queryKey: ["backups"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getBackups();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useTriggerManualBackup() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.triggerManualBackup();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backups"] });
      queryClient.invalidateQueries({ queryKey: ["heartbeatStatus"] });
    },
  });
}

export function useRestoreFromBackup() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (backupId: number) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.restoreFromBackup(backupId);
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backups"] });
      queryClient.invalidateQueries({ queryKey: ["heartbeatStatus"] });
    },
  });
}

export function useSetHeartbeatEnabled() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!actor) throw new Error("Actor not available");
      return actor.setHeartbeatEnabled(enabled);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["heartbeatStatus"] });
    },
  });
}

// ─── Blob Upload ──────────────────────────────────────────────────────────────

import type { BlobEntry } from "../backend";

export function useAllBlobEntries() {
  const { actor, isFetching } = useActor();

  return useQuery<BlobEntry[]>({
    queryKey: ["blobEntries"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllBlobEntries();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useActiveFrontendAssets() {
  const { actor, isFetching } = useActor();

  return useQuery<Array<[string, number]>>({
    queryKey: ["activeFrontendAssets"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getActiveFrontendAssets();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useInitBlobUpload() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({
      name,
      mimeType,
      totalSize,
      chunkCount,
    }: {
      name: string;
      mimeType: string;
      totalSize: number;
      chunkCount: number;
    }) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.initBlobUpload(
        name,
        mimeType,
        totalSize,
        chunkCount,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
  });
}

export function useUploadBlobChunk() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({
      blobId,
      chunkIndex,
      data,
    }: {
      blobId: number;
      chunkIndex: number;
      data: Uint8Array;
    }) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.uploadBlobChunk(blobId, chunkIndex, data);
      if (result.__kind__ === "err") throw new Error(result.err);
    },
  });
}

export function useFinalizeBlob() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      blobId,
      sha256,
    }: {
      blobId: number;
      sha256: Uint8Array | null;
    }) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.finalizeBlob(blobId, sha256);
      if (result.__kind__ === "err") throw new Error(result.err);
      return blobId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blobEntries"] });
      queryClient.invalidateQueries({ queryKey: ["activeFrontendAssets"] });
    },
  });
}

// ─── Data Feeds ───────────────────────────────────────────────────────────────

export function useFeedConfigs() {
  const { actor, isFetching } = useActor();

  return useQuery({
    queryKey: ["feedConfigs"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getFeedConfigs();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 60_000,
  });
}

export function useFeedResults(feedId: number | null) {
  const { actor, isFetching } = useActor();

  return useQuery({
    queryKey: ["feedResults", feedId],
    queryFn: async () => {
      if (!actor || feedId === null) return [];
      return actor.getFeedResults(feedId);
    },
    enabled: !!actor && !isFetching && feedId !== null,
    refetchInterval: 60_000,
  });
}

export function useLatestFeedResult(feedId: number | null) {
  const { actor, isFetching } = useActor();

  return useQuery({
    queryKey: ["latestFeedResult", feedId],
    queryFn: async () => {
      if (!actor || feedId === null) return null;
      return actor.getLatestFeedResult(feedId);
    },
    enabled: !!actor && !isFetching && feedId !== null,
  });
}

export function useManualFetchFeed() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feedId: number) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.manualFetchFeed(feedId);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: (_data, feedId) => {
      queryClient.invalidateQueries({ queryKey: ["feedResults", feedId] });
      queryClient.invalidateQueries({ queryKey: ["latestFeedResult", feedId] });
      queryClient.invalidateQueries({ queryKey: ["feedConfigs"] });
    },
  });
}

export function useTriggerFeedPoll() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.triggerFeedPoll();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedConfigs"] });
      queryClient.invalidateQueries({ queryKey: ["feedResults"] });
      queryClient.invalidateQueries({ queryKey: ["latestFeedResult"] });
    },
  });
}

export function useImportHistory() {
  const { actor, isFetching } = useActor();

  return useQuery({
    queryKey: ["importHistory"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getImportHistory();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

// ─── Advanced API Dashboard ───────────────────────────────────────────────────

import type {
  APICallRecord,
  APICallTypeBreakdown,
  RateLimitStatus,
  TimeSeriesBucket,
} from "../backend";
import type { APIKeyMeta } from "../types";

/** Rotate an API key — returns the new key bytes */
export function useRotateAPIKey() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async (apiKey: Uint8Array) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.rotateAPIKey(apiKey);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["apiConsumerV2", identity?.getPrincipal().toString()],
      });
      queryClient.invalidateQueries({ queryKey: ["allConsumerKeys"] });
    },
  });
}

/** Revoke an API key permanently */
export function useRevokeAPIKey() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async (apiKey: Uint8Array) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.revokeAPIKey(apiKey);
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["apiConsumerV2", identity?.getPrincipal().toString()],
      });
      queryClient.invalidateQueries({ queryKey: ["allConsumerKeys"] });
    },
  });
}

/** Rename an API key */
export function useRenameAPIKey() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      apiKey,
      newName,
    }: { apiKey: Uint8Array; newName: string }) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.renameAPIKey(apiKey, newName);
      if (result.__kind__ === "err") throw new Error(result.err);
      // Persist name client-side so it survives across sessions
      persistKeyName(apiKey, newName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allConsumerKeys"] });
    },
  });
}

/** Paginated API call history for a given key and time range */
export function useAPICallHistory(params: {
  apiKey: Uint8Array | null;
  fromTs: bigint;
  toTs: bigint;
  page: number;
}) {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<APICallRecord[]>({
    queryKey: [
      "apiCallHistory",
      params.apiKey ? Array.from(params.apiKey).join(",") : null,
      params.fromTs.toString(),
      params.toTs.toString(),
      params.page,
    ],
    queryFn: async () => {
      if (!actor || !params.apiKey) return [];
      const result = await actor.getAPICallHistory(
        params.apiKey,
        params.fromTs,
        params.toTs,
        params.page,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    enabled: !!actor && !isFetching && !!identity && !!params.apiKey,
    staleTime: 30_000,
  });
}

/** Object-type breakdown of calls within a time range */
export function useAPICallBreakdown(params: {
  fromTs: bigint;
  toTs: bigint;
  enabled?: boolean;
}) {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<APICallTypeBreakdown[]>({
    queryKey: [
      "apiCallBreakdown",
      params.fromTs.toString(),
      params.toTs.toString(),
    ],
    queryFn: async () => {
      if (!actor) return [];
      const result = await actor.getAPICallBreakdown(
        params.fromTs,
        params.toTs,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    enabled: !!actor && !isFetching && !!identity && (params.enabled ?? true),
    staleTime: 60_000,
  });
}

/** Time series of calls per granularity bucket */
export function useCallTimeSeries(params: {
  fromTs: bigint;
  toTs: bigint;
  granularity: "hour" | "day" | "week";
  enabled?: boolean;
}) {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<TimeSeriesBucket[]>({
    queryKey: [
      "callTimeSeries",
      params.fromTs.toString(),
      params.toTs.toString(),
      params.granularity,
    ],
    queryFn: async () => {
      if (!actor) return [];
      const result = await actor.getCallTimeSeries(
        params.fromTs,
        params.toTs,
        params.granularity,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    enabled: !!actor && !isFetching && !!identity && (params.enabled ?? true),
    staleTime: 60_000,
  });
}

/** Rate limit status for the caller's API key */
export function useAPIRateLimitStatus(apiKey: Uint8Array | null) {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<RateLimitStatus | null>({
    queryKey: [
      "apiRateLimitStatus",
      apiKey ? Array.from(apiKey).join(",") : null,
    ],
    queryFn: async () => {
      if (!actor || !apiKey) return null;
      const result = await actor.getAPIRateLimitStatus(apiKey);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    enabled: !!actor && !isFetching && !!identity && !!apiKey,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

/** All API key metadata for the caller's consumer account.
 *  Backend returns APIConsumerV2[]; we merge with locally-persisted names.
 */
export function useAllConsumerKeys() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<APIKeyMeta[]>({
    queryKey: ["allConsumerKeys", identity?.getPrincipal().toString()],
    queryFn: async (): Promise<APIKeyMeta[]> => {
      if (!actor) return [];
      const consumers = await actor.getAllConsumerKeys();
      // Merge persisted names from localStorage
      const stored = getStoredKeyNames();
      return consumers.map((c, idx) => {
        const hexKey = Array.from(c.apiKey)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        return {
          id: c.id,
          consumerId: c.id,
          name: stored[hexKey] ?? `Key #${idx + 1}`,
          apiKey: c.apiKey,
          createdAt: c.createdAt,
          lastUsedAt: c.lastCallAt,
          isActive: c.isActive,
        };
      });
    },
    enabled: !!actor && !isFetching && !!identity,
    staleTime: 30_000,
  });
}

// ─── Local key name storage (client-side persistence for names) ───────────────

const KEY_NAMES_STORAGE_KEY = "footballheir:apiKeyNames";

function getStoredKeyNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY_NAMES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function persistKeyName(apiKeyBytes: Uint8Array, name: string): void {
  const hexKey = Array.from(apiKeyBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const stored = getStoredKeyNames();
  stored[hexKey] = name;
  try {
    localStorage.setItem(KEY_NAMES_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // localStorage full — ignore silently
  }
}

// ─── Admin / Moderation ───────────────────────────────────────────────────────

export function useIsAdmin() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<boolean>({
    queryKey: ["isAdmin", identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor) return false;
      return actor.isCallerAdmin();
    },
    enabled: !!actor && !isFetching && !!identity,
  });
}

/** @deprecated use useIsAdmin */
export const useIsCallerAdmin = useIsAdmin;

export function useIsUserBanned(principal: Principal | null) {
  const { actor, isFetching } = useActor();

  return useQuery<boolean>({
    queryKey: ["isBanned", principal?.toString()],
    queryFn: async () => {
      if (!actor || !principal) return false;
      return actor.isUserBanned(principal);
    },
    enabled: !!actor && !isFetching && !!principal,
  });
}

export function useBanUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (principal: Principal) => {
      if (!actor) throw new Error("Actor not available");
      return actor.banUser(principal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isBanned"] });
    },
  });
}

export function useUnbanUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (principal: Principal) => {
      if (!actor) throw new Error("Actor not available");
      return actor.unbanUser(principal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isBanned"] });
    },
  });
}
