import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { ProposalType } from "../backend";
import {
  useGetGovernanceSettings,
  useSubmitProposal,
} from "../hooks/useQueries";

interface CreateProposalDialogProps {
  open: boolean;
  onClose: () => void;
}

const PROPOSAL_CATEGORIES: Record<string, { value: string; label: string }[]> =
  {
    Schema: [
      { value: "NewObjectType", label: "#NewObjectType — Create Object Type" },
      { value: "EditObjectType", label: "#EditObjectType — Edit Object Type" },
      {
        value: "DeleteObjectType",
        label: "#DeleteObjectType — Delete Object Type",
      },
      { value: "NewAttribute", label: "#NewAttribute — Add Attribute" },
      { value: "EditAttribute", label: "#EditAttribute — Edit Attribute" },
      {
        value: "DeleteAttribute",
        label: "#DeleteAttribute — Remove Attribute",
      },
      { value: "NewMethod", label: "#NewMethod — Add Method" },
      { value: "EditMethod", label: "#EditMethod — Edit Method" },
      { value: "DeleteMethod", label: "#DeleteMethod — Remove Method" },
    ],
    Code: [
      {
        value: "UpdateFrontend",
        label: "#UpdateFrontend — Upload React/HTML/CSS Blobs",
      },
      { value: "UpdateCSS", label: "#UpdateCSS — Update Tailwind Theme" },
      { value: "UpdateHTML", label: "#UpdateHTML — Upload HTML Templates" },
      {
        value: "UpdateMotoko",
        label: "#UpdateMotoko — Compile New Backend Logic",
      },
      {
        value: "UpdateCanister",
        label: "#UpdateCanister — Full Canister Upgrade",
      },
    ],
    Governance: [
      {
        value: "ChangeGovernance",
        label: "#ChangeGovernance — Modify DAO Parameters",
      },
      {
        value: "TreasuryAction",
        label: "#TreasuryAction — Transfer ICFC from Treasury",
      },
      { value: "BatchOp", label: "#BatchOp — Execute Multiple Ops Atomically" },
      {
        value: "NewTemplate",
        label: "#NewTemplate — Create Proposal Template",
      },
      { value: "EditTemplate", label: "#EditTemplate — Edit Template" },
      { value: "DeleteTemplate", label: "#DeleteTemplate — Remove Template" },
      {
        value: "NewDashboard",
        label: "#NewDashboard — Create Analytics Dashboard",
      },
      { value: "EditDashboard", label: "#EditDashboard — Edit Dashboard" },
      {
        value: "DeleteDashboard",
        label: "#DeleteDashboard — Remove Dashboard",
      },
    ],
    Data: [
      {
        value: "SetInitialData",
        label: "#SetInitialData — Bootstrap Season Data",
      },
      {
        value: "ImportSeasonData",
        label: "#ImportSeasonData — Import Fixtures/Results",
      },
      {
        value: "NewDynamicDoc",
        label: "#NewDynamicDoc — Create Documentation",
      },
      {
        value: "EditDynamicDoc",
        label: "#EditDynamicDoc — Edit Documentation",
      },
      {
        value: "DeleteDynamicDoc",
        label: "#DeleteDynamicDoc — Remove Documentation",
      },
      { value: "BackupSchema", label: "#BackupSchema — Export Schema + Data" },
      {
        value: "RestoreSchema",
        label: "#RestoreSchema — Import Schema + Data",
      },
      {
        value: "ConfigureRealTimeFeeds",
        label: "#ConfigureRealTimeFeeds — Toggle HTTP Outcall Sources",
      },
      {
        value: "SimulateProposal",
        label: "#SimulateProposal — Dry-Run in Clone Canister",
      },
    ],
    API: [
      { value: "NewAPIPrice", label: "#NewAPIPrice — Create Pricing Package" },
      { value: "EditAPIPrice", label: "#EditAPIPrice — Edit Pricing Package" },
      {
        value: "DeleteAPIPrice",
        label: "#DeleteAPIPrice — Deactivate Pricing Package",
      },
      {
        value: "AdjustRateLimit",
        label: "#AdjustRateLimit — Set API Rate Limits",
      },
      {
        value: "NewDataCanister",
        label: "#NewDataCanister — Shard Data Canister",
      },
      {
        value: "NewForumCanister",
        label: "#NewForumCanister — Shard Forum Canister",
      },
      {
        value: "DisputeProposal",
        label: "#DisputeProposal — Challenge Executed Proposal",
      },
    ],
    Moderation: [
      { value: "BanUser", label: "#BanUser — Ban Principal" },
      { value: "UnbanUser", label: "#UnbanUser — Remove Ban" },
      { value: "DeletePost", label: "#DeletePost — Remove Discussion Post" },
      {
        value: "DeleteThread",
        label: "#DeleteThread — Remove Discussion Thread",
      },
      { value: "PinPost", label: "#PinPost — Pin Discussion Post" },
    ],
  };

export function CreateProposalDialog({
  open,
  onClose,
}: CreateProposalDialogProps) {
  const { data: governanceSettings } = useGetGovernanceSettings();
  const submitProposal = useSubmitProposal();

  const [proposalType, setProposalType] = useState<string>("");
  const [content, setContent] = useState("");
  const [stake, setStake] = useState(
    governanceSettings ? Number(governanceSettings.minStake).toString() : "10",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!proposalType) {
      toast.error("Please select a proposal type");
      return;
    }

    if (!content.trim()) {
      toast.error("Please provide proposal content");
      return;
    }

    const stakeAmount = BigInt(stake);
    const minStake = governanceSettings
      ? governanceSettings.minStake
      : BigInt(10);

    if (stakeAmount < minStake) {
      toast.error(`Minimum stake is ${Number(minStake)} ICFC`);
      return;
    }

    try {
      const typeEnum = ProposalType[proposalType as keyof typeof ProposalType];
      await submitProposal.mutateAsync({
        proposalType: typeEnum,
        stake: stakeAmount,
        content: content.trim(),
      });
      toast.success("Proposal submitted successfully!");
      onClose();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit proposal",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Proposal</DialogTitle>
          <DialogDescription>
            Submit a proposal to the DAO for community voting
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="type">Proposal Type</Label>
            <Select value={proposalType} onValueChange={setProposalType}>
              <SelectTrigger id="type" data-ocid="proposal-type-select">
                <SelectValue placeholder="Select proposal type" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {Object.entries(PROPOSAL_CATEGORIES).map(
                  ([category, types]) => (
                    <div key={category}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 sticky top-0">
                        {category}
                      </div>
                      {types.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </div>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Proposal Content</Label>
            <Textarea
              id="content"
              placeholder="Describe your proposal in detail..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              data-ocid="proposal-content-input"
            />
            <p className="text-xs text-muted-foreground">
              Provide a clear description of what this proposal aims to achieve
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stake">Stake Amount (ICFC)</Label>
            <Input
              id="stake"
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              min={
                governanceSettings ? Number(governanceSettings.minStake) : 10
              }
              data-ocid="proposal-stake-input"
            />
            <p className="text-xs text-muted-foreground">
              Minimum:{" "}
              {governanceSettings ? Number(governanceSettings.minStake) : 10}{" "}
              ICFC. Stake will be refunded if proposal succeeds, burned if
              rejected.
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={submitProposal.isPending}
              className="flex-1"
              data-ocid="proposal-submit-btn"
            >
              {submitProposal.isPending ? "Submitting..." : "Submit Proposal"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
