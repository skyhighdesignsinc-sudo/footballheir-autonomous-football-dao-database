import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Plus,
  Search,
  Shield,
  ThumbsDown,
  ThumbsUp,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Proposal } from "../backend";
import { ProposalStatus, ProposalType } from "../backend";

// Seed data proposals carry an optional isSeedData flag added by the mock layer
type ProposalWithSeedFlag = Proposal & { isSeedData?: boolean };
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useAllProposals,
  useCallerICFCBalance,
  useDisputeProposal,
  useGovernanceSettings,
  useSubmitProposal,
  useVoteOnProposal,
} from "../hooks/useQueries";

// ─── Constants ────────────────────────────────────────────────────────────────

type FilterTab =
  | "all"
  | "active"
  | "passed"
  | "rejected"
  | "pending"
  | "disputed";
type SortOption = "newest" | "oldest" | "votes";

const PROPOSAL_CATEGORIES: Record<string, ProposalType[]> = {
  Schema: [
    ProposalType.NewObjectType,
    ProposalType.EditObjectType,
    ProposalType.DeleteObjectType,
    ProposalType.NewAttribute,
    ProposalType.EditAttribute,
    ProposalType.DeleteAttribute,
    ProposalType.NewMethod,
    ProposalType.EditMethod,
    ProposalType.DeleteMethod,
  ],
  Code: [
    ProposalType.UpdateFrontend,
    ProposalType.UpdateCSS,
    ProposalType.UpdateHTML,
    ProposalType.UpdateMotoko,
    ProposalType.UpdateCanister,
  ],
  Governance: [
    ProposalType.ChangeGovernance,
    ProposalType.TreasuryAction,
    ProposalType.BatchOp,
    ProposalType.NewTemplate,
    ProposalType.EditTemplate,
    ProposalType.DeleteTemplate,
    ProposalType.NewDashboard,
    ProposalType.EditDashboard,
    ProposalType.DeleteDashboard,
  ],
  Data: [
    ProposalType.SetInitialData,
    ProposalType.ImportSeasonData,
    ProposalType.NewDynamicDoc,
    ProposalType.EditDynamicDoc,
    ProposalType.DeleteDynamicDoc,
    ProposalType.BackupSchema,
    ProposalType.RestoreSchema,
    ProposalType.ConfigureRealTimeFeeds,
    ProposalType.SimulateProposal,
  ],
  API: [
    ProposalType.NewAPIPrice,
    ProposalType.EditAPIPrice,
    ProposalType.DeleteAPIPrice,
    ProposalType.AdjustRateLimit,
    ProposalType.NewDataCanister,
    ProposalType.NewForumCanister,
    ProposalType.DisputeProposal,
  ],
  Moderation: [
    ProposalType.BanUser,
    ProposalType.UnbanUser,
    ProposalType.DeletePost,
    ProposalType.DeleteThread,
    ProposalType.PinPost,
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncatePrincipal(p: { toString(): string }): string {
  const s = p.toString();
  return `${s.slice(0, 5)}…${s.slice(-4)}`;
}

function formatTimestamp(ts: bigint): string {
  return new Date(Number(ts) / 1_000_000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTimeAgo(ts: bigint): string {
  const ms = Date.now() - Number(ts) / 1_000_000;
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function timeRemaining(endTs: bigint): string {
  const ms = Number(endTs) / 1_000_000 - Date.now();
  if (ms <= 0) return "Voting closed";
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h remaining`;
  const m = Math.floor(ms / 60_000);
  if (h > 0) return `${h}h ${m % 60}m remaining`;
  return `${m}m remaining`;
}

function getStatusConfig(status: ProposalStatus): {
  label: string;
  color: string;
  icon: React.ElementType;
} {
  switch (status) {
    case ProposalStatus.Voting:
      return {
        label: "Active",
        color: "bg-primary/20 text-primary border-primary/40",
        icon: Clock,
      };
    case ProposalStatus.Submitted:
      return {
        label: "Pending",
        color: "bg-blue-500/20 text-blue-400 border-blue-400/40",
        icon: Clock,
      };
    case ProposalStatus.Simulated:
      return {
        label: "Simulated",
        color: "bg-purple-500/20 text-purple-400 border-purple-400/40",
        icon: Zap,
      };
    case ProposalStatus.Approved:
    case ProposalStatus.Executed:
    case ProposalStatus.Finalized:
      return {
        label: status,
        color: "bg-primary/20 text-primary border-primary/40",
        icon: CheckCircle,
      };
    case ProposalStatus.Rejected:
      return {
        label: "Rejected",
        color: "bg-destructive/20 text-destructive border-destructive/40",
        icon: XCircle,
      };
    case ProposalStatus.Disputed:
      return {
        label: "Disputed",
        color: "bg-yellow-500/20 text-yellow-400 border-yellow-400/40",
        icon: AlertTriangle,
      };
    default:
      return {
        label: status,
        color: "bg-muted text-muted-foreground border-border",
        icon: Clock,
      };
  }
}

function matchesFilter(p: Proposal, tab: FilterTab): boolean {
  switch (tab) {
    case "all":
      return true;
    case "active":
      return p.status === ProposalStatus.Voting;
    case "passed":
      return (
        p.status === ProposalStatus.Approved ||
        p.status === ProposalStatus.Executed ||
        p.status === ProposalStatus.Finalized
      );
    case "rejected":
      return p.status === ProposalStatus.Rejected;
    case "pending":
      return (
        p.status === ProposalStatus.Submitted ||
        p.status === ProposalStatus.Simulated
      );
    case "disputed":
      return p.status === ProposalStatus.Disputed;
    default:
      return true;
  }
}

function getVotePct(p: Proposal): { forPct: number; againstPct: number } {
  const total = Number(p.votesFor) + Number(p.votesAgainst);
  if (total === 0) return { forPct: 50, againstPct: 50 };
  return {
    forPct: Math.round((Number(p.votesFor) / total) * 100),
    againstPct: Math.round((Number(p.votesAgainst) / total) * 100),
  };
}

// ─── Test Data Badge ──────────────────────────────────────────────────────────

function SeedDataBadge() {
  return (
    <span
      title="Placeholder proposal — not a real governance action. The canister starts with zero real proposals at genesis."
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-amber-500/15 text-amber-600 border-amber-500/40 dark:text-amber-400"
      aria-label="Test Data — placeholder proposal"
    >
      🧪 Test Data
    </span>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProposalStatus }) {
  const cfg = getStatusConfig(status);
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cfg.color}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ProposalType }) {
  const category =
    Object.entries(PROPOSAL_CATEGORIES).find(([, types]) =>
      types.includes(type),
    )?.[0] ?? "Other";

  const colorMap: Record<string, string> = {
    Schema: "bg-blue-500/10 text-blue-400 border-blue-400/30",
    Code: "bg-purple-500/10 text-purple-400 border-purple-400/30",
    Governance: "bg-yellow-500/10 text-yellow-400 border-yellow-400/30",
    Data: "bg-cyan-500/10 text-cyan-400 border-cyan-400/30",
    API: "bg-orange-500/10 text-orange-400 border-orange-400/30",
    Moderation: "bg-red-500/10 text-red-400 border-red-400/30",
    Other: "bg-muted text-muted-foreground border-border",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${colorMap[category]}`}
    >
      #{type}
    </span>
  );
}

// ─── Vote Bar ─────────────────────────────────────────────────────────────────

function VoteBar({
  proposal,
  compact = false,
}: { proposal: Proposal; compact?: boolean }) {
  const { forPct, againstPct } = getVotePct(proposal);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="text-primary font-medium">FOR {forPct}%</span>
        <span className="text-destructive font-medium">
          {againstPct}% AGAINST
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
        <div
          className="bg-primary transition-all duration-500"
          style={{ width: `${forPct}%` }}
          role="presentation"
        />
        <div
          className="bg-destructive transition-all duration-500"
          style={{ width: `${againstPct}%` }}
          role="presentation"
        />
      </div>
      {!compact && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{Number(proposal.votesFor).toLocaleString()} VP for</span>
          <span>
            {Number(proposal.votesAgainst).toLocaleString()} VP against
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Proposal Card ────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  onSelect,
}: { proposal: ProposalWithSeedFlag; onSelect: () => void }) {
  const preview =
    proposal.content.slice(0, 100) + (proposal.content.length > 100 ? "…" : "");
  return (
    <Card
      className="group hover:border-primary/40 hover:bg-card/80 transition-all duration-200 cursor-pointer"
      onClick={onSelect}
      data-ocid="proposal-card"
    >
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <StatusBadge status={proposal.status} />
            <TypeBadge type={proposal.proposalType} />
            {proposal.isSeedData && <SeedDataBadge />}
          </div>
          <span className="text-xs text-muted-foreground shrink-0 font-mono">
            #{proposal.id}
          </span>
        </div>

        {/* Content preview */}
        <p className="text-sm text-foreground line-clamp-2 font-body leading-relaxed">
          {preview || (
            <span className="text-muted-foreground italic">No content</span>
          )}
        </p>

        {/* Proposer */}
        <div className="flex items-center gap-1.5 text-xs">
          <Shield className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">by</span>
          <span className="font-mono text-accent-foreground">
            {truncatePrincipal(proposal.proposer)}
          </span>
          <span className="ml-auto text-muted-foreground">
            {formatTimeAgo(proposal.createdAt)}
          </span>
        </div>

        {/* Votes */}
        <VoteBar proposal={proposal} compact />

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span
            className="text-xs text-muted-foreground"
            aria-label={`Voting status: ${timeRemaining(proposal.votingEndsAt)}`}
          >
            {timeRemaining(proposal.votingEndsAt)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-primary hover:bg-primary/10 group-hover:opacity-100 opacity-60 transition-opacity"
            aria-label={`View details for proposal ${proposal.id}`}
            data-ocid="view-proposal-btn"
          >
            View Details <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Proposal List Skeletons ──────────────────────────────────────────────────

function ProposalSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded" />
          <Skeleton className="h-5 w-24 rounded" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-24 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── New Proposal Modal ───────────────────────────────────────────────────────

function NewProposalModal({
  open,
  onClose,
  minStake,
  userBalance,
}: {
  open: boolean;
  onClose: () => void;
  minStake: bigint;
  userBalance: bigint;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedType, setSelectedType] = useState<ProposalType | "">("");
  const [content, setContent] = useState("");
  const submitMutation = useSubmitProposal();

  function handleClose() {
    setStep(1);
    setSelectedCategory("");
    setSelectedType("");
    setContent("");
    onClose();
  }

  async function handleSubmit() {
    if (!selectedType) return;
    try {
      await submitMutation.mutateAsync({
        proposalType: selectedType as ProposalType,
        stake: minStake,
        content,
      });
      toast.success("Proposal submitted successfully!", {
        description: `Staked ${Number(minStake)} ICFC. Voting is now open.`,
      });
      handleClose();
    } catch (e) {
      toast.error("Failed to submit proposal", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  const canAfford = userBalance >= minStake;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="w-full sm:max-w-lg max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto bg-card border-border mx-0 sm:mx-auto rounded-none sm:rounded-lg p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            New Proposal{" "}
            <span className="text-muted-foreground font-normal text-sm ml-2">
              Step {step} of 4
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Step progress */}
        <div className="flex gap-1 mb-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all ${s <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {/* Step 1: Category + Type */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={selectedCategory}
                onValueChange={(v) => {
                  setSelectedCategory(v);
                  setSelectedType("");
                }}
              >
                <SelectTrigger data-ocid="proposal-category-select">
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(PROPOSAL_CATEGORIES).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCategory && (
              <div className="space-y-2">
                <Label>Proposal Type</Label>
                <ScrollArea className="h-48 rounded border border-border">
                  <div className="p-2 space-y-1">
                    {PROPOSAL_CATEGORIES[selectedCategory].map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`w-full text-left px-3 py-2 rounded text-sm font-mono transition-colors ${
                          selectedType === type
                            ? "bg-primary/20 text-primary"
                            : "hover:bg-accent text-foreground"
                        }`}
                        onClick={() => setSelectedType(type)}
                        data-ocid="proposal-type-option"
                      >
                        #{type}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Button
              className="w-full"
              disabled={!selectedType}
              onClick={() => setStep(2)}
              data-ocid="proposal-step-next"
            >
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 2: Content */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <TypeBadge type={selectedType as ProposalType} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposal-content">Proposal Content</Label>
              <Textarea
                id="proposal-content"
                placeholder={`Describe your ${selectedType} proposal. Use JSON for structured data, or plain text for simple proposals.\n\nExample:\n{\n  "name": "Player",\n  "description": "Represents a football player"\n}`}
                className="font-mono text-sm h-48 resize-none bg-background border-input"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                data-ocid="proposal-content-input"
              />
              <p className="text-xs text-muted-foreground">
                {content.length} characters
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={!content.trim()}
                onClick={() => setStep(3)}
                data-ocid="proposal-step-next"
              >
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm + stake preview */}
        {step === 3 && (
          <div className="space-y-4">
            <Card className="bg-background border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Proposal Type</span>
                  <TypeBadge type={selectedType as ProposalType} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Stake Required</span>
                  <span className="font-mono font-semibold text-gold">
                    {Number(minStake)} ICFC
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your Balance</span>
                  <span
                    className={`font-mono font-semibold ${canAfford ? "text-primary" : "text-destructive"}`}
                  >
                    {Number(userBalance)} ICFC
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">After Staking</span>
                  <span className="font-mono font-semibold">
                    {canAfford ? Number(userBalance - minStake) : "—"} ICFC
                  </span>
                </div>
              </CardContent>
            </Card>

            {!canAfford && (
              <div className="flex items-center gap-2 p-3 rounded bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Insufficient ICFC balance. You need {Number(minStake)} ICFC to
                submit.
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Stake is returned on pass. Burned on rejection after the dispute
              window.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(2)}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={!canAfford}
                onClick={() => setStep(4)}
                data-ocid="proposal-step-confirm"
              >
                Confirm Details
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Submit */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="p-4 rounded bg-muted/30 border border-border space-y-2">
              <p className="text-sm font-medium">Ready to submit</p>
              <p className="text-xs text-muted-foreground font-mono">
                Type: #{selectedType}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-3">
                {content}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(3)}
              >
                Back
              </Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                data-ocid="proposal-submit-btn"
              >
                {submitMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                    Submitting…
                  </span>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-1" />
                    Submit Proposal
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail View ──────────────────────────────────────────────────────────────

function ProposalDetail({
  proposal,
  onBack,
  userBalance,
}: {
  proposal: ProposalWithSeedFlag;
  onBack: () => void;
  userBalance: bigint;
}) {
  const { identity } = useInternetIdentity();
  const voteMutation = useVoteOnProposal();
  const disputeMutation = useDisputeProposal();
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [userVote, setUserVote] = useState<boolean | null>(null);

  const canVote =
    userBalance >= 1n && identity && proposal.status === ProposalStatus.Voting;

  // Check if user already voted
  const callerPrincipal = identity?.getPrincipal().toString();
  const existingVote = proposal.voters.find(
    (v) => v.voter.toString() === callerPrincipal,
  );

  // Dispute window check
  const inDisputeWindow =
    proposal.disputeWindowEnd &&
    Number(proposal.disputeWindowEnd) / 1_000_000 > Date.now();

  async function handleVote(inFavor: boolean) {
    try {
      await voteMutation.mutateAsync({ proposalId: proposal.id, inFavor });
      setUserVote(inFavor);
      toast.success(inFavor ? "Voted FOR ✓" : "Voted AGAINST ✓", {
        description: "Your vote has been recorded on-chain.",
      });
    } catch (e) {
      toast.error("Vote failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  async function handleDispute() {
    if (!disputeReason.trim()) return;
    try {
      await disputeMutation.mutateAsync({
        proposalId: proposal.id,
        reason: disputeReason,
      });
      toast.success("Dispute submitted", {
        description: "Your dispute is now under review.",
      });
      setShowDisputeForm(false);
      setDisputeReason("");
    } catch (e) {
      toast.error("Dispute failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Back to proposals list"
          data-ocid="proposals-back-btn"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-mono text-muted-foreground">
          Proposal #{proposal.id}
        </span>
      </div>

      {/* Title card */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={proposal.status} />
            <TypeBadge type={proposal.proposalType} />
            {proposal.isSeedData && <SeedDataBadge />}
          </div>
          <h2 className="font-display text-xl font-semibold">
            Proposal #{proposal.id}
          </h2>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>Created {formatTimestamp(proposal.createdAt)}</span>
            <span>Updated {formatTimestamp(proposal.updatedAt)}</span>
            <span>
              Stake:{" "}
              <span className="font-mono text-gold">
                {Number(proposal.stake)} ICFC
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Proposer */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Proposer
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <span className="font-mono text-sm">
              {proposal.proposer.toString()}
            </span>
            <a
              href={`https://dashboard.internetcomputer.org/account/${proposal.proposer.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors ml-auto"
              aria-label="View proposer on IC dashboard"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Content
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <pre className="font-mono text-sm whitespace-pre-wrap break-all bg-background p-4 rounded border border-border max-h-64 overflow-auto text-foreground">
            {(() => {
              try {
                return JSON.stringify(JSON.parse(proposal.content), null, 2);
              } catch {
                return proposal.content;
              }
            })()}
          </pre>
        </CardContent>
      </Card>

      {/* Voting */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Voting
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <VoteBar proposal={proposal} />

          <div
            className="text-sm text-muted-foreground"
            aria-label={`Voting status: ${timeRemaining(proposal.votingEndsAt)}`}
          >
            <Clock className="inline h-3.5 w-3.5 mr-1 mb-0.5" />
            {timeRemaining(proposal.votingEndsAt)}
          </div>

          {/* User's existing vote */}
          {(existingVote || userVote !== null) && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm border ${
                (existingVote?.inFavor ?? userVote)
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              {(existingVote?.inFavor ?? userVote) ? (
                <ThumbsUp className="h-4 w-4" />
              ) : (
                <ThumbsDown className="h-4 w-4" />
              )}
              You voted{" "}
              {(existingVote?.inFavor ?? userVote) ? "FOR" : "AGAINST"} this
              proposal
            </div>
          )}

          {/* Vote buttons */}
          {canVote && !existingVote && userVote === null && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 min-h-[44px]"
                variant="outline"
                onClick={() => handleVote(true)}
                disabled={voteMutation.isPending}
                aria-label="Vote FOR this proposal"
                data-ocid="vote-for-btn"
              >
                <ThumbsUp className="h-4 w-4 mr-2" />
                Vote FOR
              </Button>
              <Button
                className="flex-1 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/40 min-h-[44px]"
                variant="outline"
                onClick={() => handleVote(false)}
                disabled={voteMutation.isPending}
                aria-label="Vote AGAINST this proposal"
                data-ocid="vote-against-btn"
              >
                <ThumbsDown className="h-4 w-4 mr-2" />
                Vote AGAINST
              </Button>
            </div>
          )}

          {!identity && (
            <p className="text-xs text-muted-foreground">
              Login with Internet Identity to vote.
            </p>
          )}
          {identity && userBalance < 1n && (
            <p className="text-xs text-muted-foreground">
              You need ≥1 ICFC to vote.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Simulation result */}
      {proposal.simulationResult && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Simulation Result
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <pre className="font-mono text-xs whitespace-pre-wrap bg-background p-3 rounded border border-border text-primary max-h-40 overflow-auto">
              {proposal.simulationResult}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Execution result */}
      {proposal.executionResult && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-primary" />
              Execution Result
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <pre className="font-mono text-xs whitespace-pre-wrap bg-background p-3 rounded border border-border text-foreground max-h-40 overflow-auto">
              {proposal.executionResult}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Dispute */}
      {(inDisputeWindow || proposal.status === ProposalStatus.Disputed) && (
        <Card className="bg-card border-yellow-500/20">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Dispute
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-3">
            {proposal.status === ProposalStatus.Disputed && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-400/40">
                Under dispute
              </Badge>
            )}
            {inDisputeWindow &&
              proposal.status !== ProposalStatus.Disputed &&
              identity && (
                <div>
                  {!showDisputeForm ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
                      onClick={() => setShowDisputeForm(true)}
                      data-ocid="dispute-proposal-btn"
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Dispute This Proposal
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Explain why this proposal should be disputed (evidence, links, reasoning)…"
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        className="text-sm bg-background h-28 resize-none"
                        data-ocid="dispute-reason-input"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDisputeForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 hover:bg-yellow-500/30"
                          onClick={handleDispute}
                          disabled={
                            disputeMutation.isPending || !disputeReason.trim()
                          }
                          data-ocid="dispute-submit-btn"
                        >
                          Submit Dispute
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            {proposal.disputeWindowEnd && (
              <p className="text-xs text-muted-foreground">
                Dispute window closes{" "}
                {formatTimestamp(proposal.disputeWindowEnd)}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ProposalsPage() {
  const { identity } = useInternetIdentity();
  const { data: rawProposals = [], isLoading } = useAllProposals();
  const proposals = rawProposals as ProposalWithSeedFlag[];
  const { data: govSettings } = useGovernanceSettings();
  const { data: icfcBalance = 0n } = useCallerICFCBalance();

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newProposalOpen, setNewProposalOpen] = useState(false);

  const minStake = govSettings?.minStake ?? 10n;
  const canPropose = icfcBalance >= 1n;

  // Reset selected when proposals list changes
  useEffect(() => {
    if (selectedId !== null && proposals.length > 0) {
      const still = proposals.find((p) => p.id === selectedId);
      if (!still) setSelectedId(null);
    }
  }, [proposals, selectedId]);

  const selectedProposal = useMemo(
    () => proposals.find((p) => p.id === selectedId) ?? null,
    [proposals, selectedId],
  );

  const filtered = useMemo(() => {
    let result = proposals.filter((p) => matchesFilter(p, activeTab));

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.proposalType.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          String(p.id).includes(q),
      );
    }

    result = [...result].sort((a, b) => {
      if (sort === "newest") return Number(b.createdAt - a.createdAt);
      if (sort === "oldest") return Number(a.createdAt - b.createdAt);
      // votes: by total voting power
      const totalA = Number(a.votesFor) + Number(a.votesAgainst);
      const totalB = Number(b.votesFor) + Number(b.votesAgainst);
      return totalB - totalA;
    });

    return result;
  }, [proposals, activeTab, search, sort]);

  const tabCounts: Record<FilterTab, number> = useMemo(
    () => ({
      all: proposals.length,
      active: proposals.filter((p) => p.status === ProposalStatus.Voting)
        .length,
      passed: proposals.filter((p) =>
        [
          ProposalStatus.Approved,
          ProposalStatus.Executed,
          ProposalStatus.Finalized,
        ].includes(p.status),
      ).length,
      rejected: proposals.filter((p) => p.status === ProposalStatus.Rejected)
        .length,
      pending: proposals.filter((p) =>
        [ProposalStatus.Submitted, ProposalStatus.Simulated].includes(p.status),
      ).length,
      disputed: proposals.filter((p) => p.status === ProposalStatus.Disputed)
        .length,
    }),
    [proposals],
  );

  const TAB_LABELS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "passed", label: "Passed" },
    { key: "rejected", label: "Rejected" },
    { key: "pending", label: "Pending" },
    { key: "disputed", label: "Disputed" },
  ];

  // ─── Detail view ────────────────────────────────────────────────────────────
  if (selectedProposal) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-3xl">
        <ProposalDetail
          proposal={selectedProposal}
          onBack={() => setSelectedId(null)}
          userBalance={icfcBalance}
        />
      </div>
    );
  }

  // ─── List view ───────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-6xl">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Proposals</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Every change to the football database is voted on here.
          </p>
        </div>
        {identity && canPropose && (
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
            onClick={() => setNewProposalOpen(true)}
            data-ocid="new-proposal-btn"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Proposal
          </Button>
        )}
        {identity && !canPropose && (
          <Badge className="bg-muted border-border text-muted-foreground text-xs">
            Need ≥1 ICFC to propose
          </Badge>
        )}
      </div>

      {/* Filter tabs */}
      <div
        className="flex gap-1 overflow-x-auto pb-1 mb-4 scrollbar-none"
        role="tablist"
        aria-label="Proposal filters"
      >
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === key
                ? "bg-primary/20 text-primary border border-primary/40"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            onClick={() => setActiveTab(key)}
            data-ocid={`filter-tab-${key}`}
          >
            {label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === key ? "bg-primary/30" : "bg-muted"
              }`}
            >
              {tabCounts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by type, content, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background border-input text-sm w-full"
            aria-label="Search proposals"
            data-ocid="proposals-search"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
          <SelectTrigger
            className="w-full sm:w-36 bg-background border-input text-sm"
            aria-label="Sort proposals"
            data-ocid="proposals-sort"
          >
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="votes">Most Votes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Proposal grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {["sk1", "sk2", "sk3", "sk4", "sk5", "sk6"].map((id) => (
            <ProposalSkeleton key={id} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 text-center"
          data-ocid="proposals-empty-state"
        >
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-lg font-semibold mb-2">
            {search ? "No proposals match your search" : "No proposals yet"}
          </h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            {search
              ? "Try a different search term or clear the filter."
              : "Be the first to shape the football database. Submit a proposal to get started."}
          </p>
          {!search && identity && canPropose && (
            <Button
              className="mt-6 bg-primary text-primary-foreground"
              onClick={() => setNewProposalOpen(true)}
              data-ocid="empty-state-new-proposal"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              New Proposal
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onSelect={() => setSelectedId(p.id)}
            />
          ))}
        </div>
      )}

      {/* New Proposal Modal */}
      <NewProposalModal
        open={newProposalOpen}
        onClose={() => setNewProposalOpen(false)}
        minStake={minStake}
        userBalance={icfcBalance}
      />
    </div>
  );
}
