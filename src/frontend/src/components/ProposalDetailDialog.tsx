import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Play, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Proposal } from "../backend";
import { ProposalStatus } from "../backend";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useDisputeProposal,
  useSimulateProposal,
  useVoteOnProposal,
} from "../hooks/useQueries";

interface ProposalDetailDialogProps {
  proposal: Proposal;
  open: boolean;
  onClose: () => void;
}

export function ProposalDetailDialog({
  proposal,
  open,
  onClose,
}: ProposalDetailDialogProps) {
  const { identity } = useInternetIdentity();
  const voteOnProposal = useVoteOnProposal();
  const disputeProposal = useDisputeProposal();
  const simulateProposal = useSimulateProposal();
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  const isAuthenticated = !!identity;
  const canVote =
    isAuthenticated &&
    (proposal.status === ProposalStatus.Voting ||
      proposal.status === ProposalStatus.Simulated);
  const canDispute =
    isAuthenticated && proposal.status === ProposalStatus.Executed;
  const canSimulate =
    isAuthenticated && proposal.status === ProposalStatus.Submitted;

  const hasVoted =
    identity &&
    proposal.voters.some(
      (v) => v.voter.toString() === identity.getPrincipal().toString(),
    );

  const handleVote = async (inFavor: boolean) => {
    try {
      await voteOnProposal.mutateAsync({ proposalId: proposal.id, inFavor });
      toast.success(
        `Vote ${inFavor ? "for" : "against"} recorded successfully`,
      );
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to vote");
    }
  };

  const handleSimulate = async () => {
    try {
      const result = await simulateProposal.mutateAsync(proposal.id);
      toast.success(`Simulation completed: ${result}`);
    } catch (error: any) {
      toast.error(error.message || "Simulation failed");
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      toast.error("Please provide a reason for the dispute");
      return;
    }

    try {
      await disputeProposal.mutateAsync({
        proposalId: proposal.id,
        reason: disputeReason,
      });
      toast.success("Dispute submitted successfully");
      setShowDisputeForm(false);
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to submit dispute");
    }
  };

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) / 1_000_000).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getProposalTypeLabel = (type: Proposal["proposalType"]) => {
    return type.replace(/([A-Z])/g, " $1").trim();
  };

  const totalVotes = Number(proposal.votesFor) + Number(proposal.votesAgainst);
  const forPercentage =
    totalVotes > 0 ? (Number(proposal.votesFor) / totalVotes) * 100 : 0;
  const againstPercentage =
    totalVotes > 0 ? (Number(proposal.votesAgainst) / totalVotes) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Proposal #{Number(proposal.id)}
          </DialogTitle>
          <DialogDescription>
            <Badge variant="outline" className="mt-2">
              {getProposalTypeLabel(proposal.proposalType)}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {proposal.content}
            </p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Proposer</div>
              <div className="font-mono text-sm">
                {proposal.proposer.toString().slice(0, 16)}...
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Stake</div>
              <div className="font-semibold">{Number(proposal.stake)} ICFC</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Created</div>
              <div className="text-sm">{formatDate(proposal.createdAt)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">
                Voting Ends
              </div>
              <div className="text-sm">{formatDate(proposal.votingEndsAt)}</div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-4">Voting Results</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-green-600 dark:text-green-400">
                    For: {Number(proposal.votesFor)}
                  </span>
                  <span>{forPercentage.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 dark:bg-green-400 transition-all"
                    style={{ width: `${forPercentage}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-red-600 dark:text-red-400">
                    Against: {Number(proposal.votesAgainst)}
                  </span>
                  <span>{againstPercentage.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 dark:bg-red-400 transition-all"
                    style={{ width: `${againstPercentage}%` }}
                  />
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Total votes: {totalVotes} ({proposal.voters.length} voters)
              </div>
            </div>
          </div>

          {proposal.simulationResult && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Simulation Result</h3>
                <p className="text-sm text-muted-foreground">
                  {proposal.simulationResult}
                </p>
              </div>
            </>
          )}

          {proposal.executionResult && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Execution Result</h3>
                <p className="text-sm text-muted-foreground">
                  {proposal.executionResult}
                </p>
              </div>
            </>
          )}

          {canSimulate && (
            <>
              <Separator />
              <Button
                onClick={handleSimulate}
                disabled={simulateProposal.isPending}
                variant="outline"
                className="w-full"
              >
                <Play className="mr-2 h-4 w-4" />
                {simulateProposal.isPending
                  ? "Simulating..."
                  : "Run Simulation"}
              </Button>
            </>
          )}

          {canVote && !hasVoted && (
            <>
              <Separator />
              <div className="flex gap-4">
                <Button
                  onClick={() => handleVote(true)}
                  disabled={voteOnProposal.isPending}
                  className="flex-1"
                >
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Vote For
                </Button>
                <Button
                  onClick={() => handleVote(false)}
                  disabled={voteOnProposal.isPending}
                  variant="destructive"
                  className="flex-1"
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  Vote Against
                </Button>
              </div>
            </>
          )}

          {hasVoted && (
            <div className="text-center py-4 bg-secondary/50 rounded-lg">
              <p className="text-sm font-medium">
                You have already voted on this proposal
              </p>
            </div>
          )}

          {canDispute && !showDisputeForm && (
            <>
              <Separator />
              <Button
                onClick={() => setShowDisputeForm(true)}
                variant="destructive"
                className="w-full"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Dispute This Proposal
              </Button>
            </>
          )}

          {showDisputeForm && (
            <>
              <Separator />
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Dispute Reason</h3>
                  <Textarea
                    placeholder="Explain why this proposal should be disputed..."
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex gap-4">
                  <Button
                    onClick={handleDispute}
                    disabled={disputeProposal.isPending}
                    variant="destructive"
                    className="flex-1"
                  >
                    {disputeProposal.isPending
                      ? "Submitting..."
                      : "Submit Dispute"}
                  </Button>
                  <Button
                    onClick={() => setShowDisputeForm(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
