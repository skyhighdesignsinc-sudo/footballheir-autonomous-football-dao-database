import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Principal } from "@icp-sdk/core/principal";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Database,
  ExternalLink,
  FileText,
  HardDrive,
  Info,
  LayoutGrid,
  Lock,
  Package,
  RefreshCw,
  RotateCcw,
  Rss,
  Settings,
  Shield,
  Upload,
  Wallet,
  Zap,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { BlobEntry } from "../backend";
import { UserRole } from "../backend";
import { DataFeedsPanel } from "../components/DataFeedsPanel";
import { useActor } from "../hooks/useActor";
import {
  useActiveFrontendAssets,
  useAllBlobEntries,
  useAllObjectTypes,
  useBackups,
  useCallerICFCBalance,
  useDynamicDocs,
  useFinalizeBlob,
  useGovernanceSettings,
  useHeartbeatStatus,
  useInitBlobUpload,
  useIsAdmin,
  useRestoreFromBackup,
  useSetHeartbeatEnabled,
  useTemplates,
  useTriggerManualBackup,
  useUploadBlobChunk,
} from "../hooks/useQueries";
import type {
  DynamicDoc,
  GovernanceSettings,
  ObjectType,
  Template,
} from "../types";

// ─── Setting Card ─────────────────────────────────────────────────────────────

interface SettingCardProps {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  highlight?: "primary" | "gold" | "destructive";
}

function SettingCard({
  label,
  value,
  description,
  icon,
  highlight,
}: SettingCardProps) {
  const valueClass =
    highlight === "primary"
      ? "text-primary"
      : highlight === "gold"
        ? "text-gold"
        : highlight === "destructive"
          ? "text-destructive"
          : "text-foreground";

  return (
    <div
      className="relative flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4 hover:border-primary/40 transition-colors"
      data-ocid="governance-setting-card"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <span className="text-muted-foreground/60">{icon}</span>
      </div>
      <div className={`text-2xl font-display font-bold ${valueClass}`}>
        {value}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

// ─── Settings Skeleton ────────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["q", "ms", "vp", "dw", "dr", "vpw", "rl", "dat"] as const).map(
          (k) => (
            <div
              key={k}
              className="rounded-lg border border-border/60 bg-card p-4 space-y-2"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-full" />
            </div>
          ),
        )}
      </div>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({
  settings,
  onNavigateProposals,
}: { settings: GovernanceSettings; onNavigateProposals: () => void }) {
  const votingDays =
    Number(settings.votingPeriod) / (24 * 60 * 60 * 1_000_000_000);
  const disputeHours =
    Number(settings.disputeWindow) / (60 * 60 * 1_000_000_000);

  const cards: SettingCardProps[] = [
    {
      label: "Quorum",
      value: `${settings.quorum}%`,
      description: "Minimum participation needed for a proposal to be valid.",
      icon: <Zap className="h-4 w-4" />,
      highlight: "primary",
    },
    {
      label: "Min Stake",
      value: `${Number(settings.minStake)} ICFC`,
      description:
        "Tokens locked when submitting a proposal. Burned if rejected.",
      icon: <Lock className="h-4 w-4" />,
      highlight: "gold",
    },
    {
      label: "Voting Period",
      value: `${votingDays}d`,
      description:
        "How long token holders have to vote after a proposal is submitted.",
      icon: <Settings className="h-4 w-4" />,
    },
    {
      label: "Dispute Window",
      value: `${disputeHours}h`,
      description:
        "Time after execution during which the proposal can be challenged.",
      icon: <AlertTriangle className="h-4 w-4" />,
      highlight: "destructive",
    },
    {
      label: "Dispute Reward",
      value: `${settings.disputeReward}%`,
      description:
        "Treasury reward paid to a successful challenger. DAO-configurable up to 20%.",
      icon: <Coins className="h-4 w-4" />,
      highlight: "gold",
    },
    {
      label: "VP Age Weighting",
      value: `${settings.vpAgeWeighting}%/yr`,
      description:
        "Bonus voting power granted per year a holder has held ICFC.",
      icon: <Shield className="h-4 w-4" />,
    },
    {
      label: "Rate Limit",
      value: `${settings.defaultRateLimitPerMin}/min`,
      description: "Default API call rate limit per IP for public queries.",
      icon: <Zap className="h-4 w-4" />,
    },
    {
      label: "Default API Token",
      value: `Token #${settings.defaultAPITokenId}`,
      description:
        "Default payment token for API access unless overridden per package.",
      icon: <Coins className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">
            Only ICFC holders can propose changes.
          </span>{" "}
          Submit a{" "}
          <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
            #ChangeGovernance
          </code>{" "}
          proposal to modify any parameter below.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto shrink-0 border-primary/40 text-primary hover:bg-primary/10"
          onClick={onNavigateProposals}
          data-ocid="change-governance-btn"
        >
          Change via Proposal
          <ExternalLink className="ml-1.5 h-3 w-3" />
        </Button>
      </div>

      {/* Parameter grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <SettingCard key={card.label} {...card} />
        ))}
      </div>

      {/* Proposal lifecycle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">
            Proposal Lifecycle
          </CardTitle>
          <CardDescription>
            How proposals move from submission to execution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="relative border-l border-border/60 ml-3 space-y-4">
            {[
              {
                step: "Submit",
                desc: `Stake ≥ ${Number(settings.minStake)} ICFC. Proposal enters review queue.`,
              },
              {
                step: "Simulate",
                desc: "Optional dry-run in isolated clone canister to catch errors before voting.",
              },
              {
                step: "Vote",
                desc: `Token holders vote for ${votingDays} day(s). VP = balance + age weighting.`,
              },
              {
                step: "Execute",
                desc: "Approved proposals auto-execute. Stake returned on success, burned on rejection.",
              },
              {
                step: "Dispute",
                desc: `${disputeHours}h window to challenge. Reward: ${settings.disputeReward}% of stake (DAO-configurable).`,
              },
            ].map(({ step, desc }, i) => (
              <li key={step} className="ml-6 pb-2">
                <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-muted border border-border text-xs font-mono text-primary">
                  {i + 1}
                </span>
                <h4 className="text-sm font-semibold">{step}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Stake outcomes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">
            Stake Outcomes
          </CardTitle>
          <CardDescription>What happens to your staked ICFC</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              label: "Approved + Executed",
              desc: "Full stake returned to proposer automatically.",
              variant: "default" as const,
            },
            {
              label: "Rejected / Failed",
              desc: `Stake burned after ${disputeHours}h dispute window expires.`,
              variant: "destructive" as const,
            },
            {
              label: "Dispute Upheld",
              desc: `Stake refunded to proposer + ${settings.disputeReward}% reward from treasury to challenger.`,
              variant: "secondary" as const,
            },
          ].map(({ label, desc, variant }) => (
            <div key={label} className="flex items-start gap-3">
              <Badge variant={variant} className="shrink-0 mt-0.5">
                {label}
              </Badge>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Treasury Tab ─────────────────────────────────────────────────────────────

function TreasuryTab({
  onNavigateProposals,
}: { onNavigateProposals: () => void }) {
  const CANISTER_ID = "ddsp7-7iaaa-aaaaq-aacqq-cai";
  const dashboardUrl = `https://dashboard.internetcomputer.org/canister/${CANISTER_ID}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Wallet className="h-4 w-4 text-gold" />
                Treasury Balance
              </CardTitle>
              <CardDescription>
                Canister ICFC holdings managed by the DAO
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-gold/40 text-gold hover:bg-gold/10"
              onClick={onNavigateProposals}
              data-ocid="treasury-action-btn"
            >
              Treasury Actions
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="flex items-start gap-3 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3"
            data-ocid="treasury-balance"
          >
            <Info className="h-4 w-4 text-gold mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">
                Treasury Balance: Managed by the DAO canister.
              </span>{" "}
              Submit a{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                #TreasuryAction
              </code>{" "}
              proposal to transfer ICFC.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-4 py-3">
            <span className="text-xs font-mono text-muted-foreground">
              Canister ID:
            </span>
            <a
              href={dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
              data-ocid="treasury-canister-link"
            >
              {CANISTER_ID}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">
            About Treasury
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>The treasury holds ICFC tokens used for:</p>
          <ul className="list-disc list-inside space-y-1.5 text-sm">
            <li>Dispute rewards paid to successful challengers</li>
            <li>
              DAO-approved token transfers via{" "}
              <code className="font-mono text-xs bg-muted px-1 rounded">
                #TreasuryAction
              </code>
            </li>
            <li>Funding operational costs when the DAO decides</li>
          </ul>
          <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3 mt-2">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <span>
              Multi-signature threshold is configurable by DAO via{" "}
              <code className="font-mono text-xs bg-muted px-1 rounded">
                #ChangeGovernance
              </code>
              .
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab({
  onNavigateProposals,
}: { onNavigateProposals: () => void }) {
  const { data: templates = [], isLoading } = useTemplates();

  return (
    <div className="space-y-4">
      {isLoading ? (
        (["t1", "t2", "t3"] as const).map((k) => (
          <Card key={k}>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))
      ) : templates.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 text-center"
          data-ocid="templates-empty-state"
        >
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-4" />
          <h3 className="font-display font-semibold text-foreground mb-2">
            No templates yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Propose a{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">
              #NewTemplate
            </code>{" "}
            to add reusable proposal forms. Templates make it easier for token
            holders to submit structured proposals.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigateProposals}
            data-ocid="new-template-cta"
          >
            Submit #NewTemplate Proposal
            <ExternalLink className="ml-1.5 h-3 w-3" />
          </Button>
        </div>
      ) : (
        templates.map((template: Template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onUse={onNavigateProposals}
          />
        ))
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onUse,
}: { template: Template; onUse: () => void }) {
  return (
    <Card
      className="hover:border-primary/40 transition-colors"
      data-ocid="template-card"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-base font-display">
              {template.name}
            </CardTitle>
            <CardDescription className="mt-0.5">
              {template.description}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-primary/40 text-primary hover:bg-primary/10"
            onClick={onUse}
            data-ocid="use-template-btn"
          >
            Use Template
          </Button>
        </div>
      </CardHeader>
      {template.content && (
        <CardContent>
          <pre className="text-xs font-mono bg-muted/40 border border-border/60 rounded p-3 overflow-x-auto text-muted-foreground whitespace-pre-wrap">
            {template.content.slice(0, 300)}
            {template.content.length > 300 ? "…" : ""}
          </pre>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Docs Tab ─────────────────────────────────────────────────────────────────

function DocsTab({ onNavigateProposals }: { onNavigateProposals: () => void }) {
  const { data: docs = [], isLoading } = useDynamicDocs();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  function toggleDoc(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function formatDate(ts: bigint) {
    return new Date(Number(ts) / 1_000_000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        (["d1", "d2"] as const).map((k) => (
          <Card key={k}>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-24 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))
      ) : docs.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 text-center"
          data-ocid="docs-empty-state"
        >
          <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-4" />
          <h3 className="font-display font-semibold text-foreground mb-2">
            No documentation yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            The DAO hasn't created any guides. Submit a{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">
              #NewDynamicDoc
            </code>{" "}
            proposal to add Markdown guides, OpenAPI specs, or CSV templates.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigateProposals}
            data-ocid="new-doc-cta"
          >
            Submit #NewDynamicDoc Proposal
            <ExternalLink className="ml-1.5 h-3 w-3" />
          </Button>
        </div>
      ) : (
        docs.map((doc: DynamicDoc) => {
          const expanded = expandedIds.has(doc.id);
          const preview = doc.content.slice(0, 200);
          const hasMore = doc.content.length > 200;
          return (
            <Card
              key={doc.id}
              className="hover:border-primary/40 transition-colors"
              data-ocid="doc-card"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-base font-display">
                      {doc.title}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs mt-0.5">
                      Generated {formatDate(doc.generatedAt)}
                    </CardDescription>
                  </div>
                  {hasMore && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleDoc(doc.id)}
                      aria-expanded={expanded}
                      aria-controls={`doc-content-${doc.id}`}
                      data-ocid="doc-expand-btn"
                    >
                      {expanded ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-1" />
                          Collapse
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          View Full Doc
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div
                  id={`doc-content-${doc.id}`}
                  className="rounded-md bg-muted/30 border border-border/60 p-4"
                >
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed overflow-x-auto">
                    {expanded ? doc.content : hasMore ? `${preview}…` : preview}
                  </pre>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ─── Schema Tab ───────────────────────────────────────────────────────────────

function SchemaTab({
  onNavigateProposals,
}: { onNavigateProposals: () => void }) {
  const { data: objectTypes = [], isLoading } = useAllObjectTypes();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          Read-only schema view. All object types, attributes, and methods are
          created and managed exclusively via DAO proposals.
        </p>
      </div>

      {isLoading ? (
        (["s1", "s2"] as const).map((k) => (
          <Card key={k}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-64 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))
      ) : objectTypes.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 text-center"
          data-ocid="schema-empty-state"
        >
          <Database className="h-10 w-10 text-muted-foreground/40 mb-4" />
          <h3 className="font-display font-semibold text-foreground mb-2">
            Schema is empty at genesis
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Submit a{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">
              #NewObjectType
            </code>{" "}
            proposal to create Player, Club, Match, or any football entity.
            Everything starts from zero.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigateProposals}
            data-ocid="new-object-type-cta"
          >
            Submit #NewObjectType Proposal
            <ExternalLink className="ml-1.5 h-3 w-3" />
          </Button>
        </div>
      ) : (
        objectTypes.map((ot: ObjectType) => (
          <ObjectTypeCard key={ot.id} objectType={ot} />
        ))
      )}
    </div>
  );
}

function ObjectTypeCard({ objectType }: { objectType: ObjectType }) {
  const [expanded, setExpanded] = useState(false);

  function formatDate(ts: bigint) {
    return new Date(Number(ts) / 1_000_000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <Card
      className="hover:border-primary/40 transition-colors"
      data-ocid="object-type-card"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              {objectType.name}
              <Badge variant="outline" className="font-mono text-xs">
                #{objectType.id}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-0.5">
              {objectType.description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground font-mono">
              {objectType.attributes.length} attr · {objectType.methods.length}{" "}
              method
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls={`ot-detail-${objectType.id}`}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <span className="sr-only">
                {expanded ? "Collapse" : "Expand"} {objectType.name}
              </span>
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent
          id={`ot-detail-${objectType.id}`}
          className="space-y-4 pt-0"
        >
          {objectType.attributes.length > 0 && (
            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                Attributes
              </h4>
              <div className="space-y-1">
                {objectType.attributes.map((attr) => (
                  <div
                    key={attr.id}
                    className="flex items-center gap-3 rounded px-3 py-2 bg-muted/30 border border-border/40"
                  >
                    <span className="font-mono text-xs text-primary">
                      {attr.name}
                    </span>
                    <Badge variant="secondary" className="text-xs font-mono">
                      {attr.dataType}
                    </Badge>
                    {attr.isRequired && (
                      <Badge variant="outline" className="text-xs">
                        required
                      </Badge>
                    )}
                    {attr.defaultValue && (
                      <span className="text-xs text-muted-foreground ml-auto font-mono">
                        default: {attr.defaultValue}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {objectType.methods.length > 0 && (
            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                Methods
              </h4>
              <div className="space-y-1">
                {objectType.methods.map((method) => (
                  <div
                    key={method.id}
                    className="flex items-center gap-3 rounded px-3 py-2 bg-muted/30 border border-border/40"
                  >
                    <span className="font-mono text-xs text-primary">
                      {method.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {method.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Created {formatDate(objectType.createdAt)} · Updated{" "}
            {formatDate(objectType.updatedAt)}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

// ─── System Status Tab ────────────────────────────────────────────────────────

function formatTs(ts: bigint): string {
  if (ts === 0n) return "Never";
  return new Date(Number(ts) / 1_000_000).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SystemStatusTab({ isAdmin }: { isAdmin: boolean }) {
  const { data: status, isLoading: statusLoading } = useHeartbeatStatus();
  const { data: backups = [], isLoading: backupsLoading } = useBackups();
  const triggerBackup = useTriggerManualBackup();
  const restoreBackup = useRestoreFromBackup();
  const setHeartbeat = useSetHeartbeatEnabled();
  const [confirmRestore, setConfirmRestore] = useState<number | null>(null);

  async function handleToggleHeartbeat(enabled: boolean) {
    try {
      await setHeartbeat.mutateAsync(enabled);
      toast.success(`Heartbeat ${enabled ? "enabled" : "disabled"}.`);
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleManualBackup() {
    try {
      const id = await triggerBackup.mutateAsync();
      toast.success(`Backup #${id} created successfully.`);
    } catch (e) {
      toast.error(
        `Backup failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async function handleRestore(backupId: number) {
    try {
      await restoreBackup.mutateAsync(backupId);
      toast.success(
        `Restore from backup #${backupId} logged. A #RestoreSchema proposal is required to apply.`,
      );
      setConfirmRestore(null);
    } catch (e) {
      toast.error(
        `Restore failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  const sortedBackups = [...backups].sort((a, b) =>
    b.timestamp > a.timestamp ? 1 : -1,
  );

  return (
    <div className="space-y-6">
      {/* Auto-sharding banner */}
      {status?.enabled === false && (
        <div
          className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3"
          role="alert"
          data-ocid="shard-pending-banner"
        >
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-200">
            <span className="font-semibold">Heartbeat is disabled.</span>{" "}
            Auto-backups and sharding triggers are paused.
          </p>
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {statusLoading ? (
          (["a", "b", "c", "d"] as const).map((k) => (
            <div
              key={k}
              className="rounded-lg border border-border/60 bg-card p-4 space-y-2"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))
        ) : status ? (
          <>
            <div
              className="rounded-lg border border-border/60 bg-card p-4 space-y-1.5"
              data-ocid="heartbeat-status-card"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  Heartbeat
                </span>
                <Activity className="h-3.5 w-3.5 text-muted-foreground/50" />
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-lg font-bold font-display ${status.enabled ? "text-green-400" : "text-destructive"}`}
                >
                  {status.enabled ? "Active" : "Paused"}
                </span>
                {isAdmin && (
                  <Switch
                    checked={status.enabled}
                    onCheckedChange={handleToggleHeartbeat}
                    disabled={setHeartbeat.isPending}
                    aria-label="Toggle heartbeat"
                    data-ocid="heartbeat-toggle"
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-backup + shard trigger
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  Last Run
                </span>
                <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
              </div>
              <div
                className="text-sm font-mono text-foreground truncate"
                title={formatTs(status.lastRun)}
              >
                {formatTs(status.lastRun)}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  Last Backup
                </span>
                <HardDrive className="h-3.5 w-3.5 text-muted-foreground/50" />
              </div>
              <div
                className="text-sm font-mono text-foreground truncate"
                title={formatTs(status.lastBackupAt)}
              >
                {formatTs(status.lastBackupAt)}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  Heap
                </span>
                <Database className="h-3.5 w-3.5 text-muted-foreground/50" />
              </div>
              <div className="text-2xl font-bold font-display text-primary">
                {status.heapSizeMb} MB
              </div>
              <p className="text-xs text-muted-foreground">
                Canister heap size
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  Next Run
                </span>
                <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
              </div>
              <div
                className="text-sm font-mono text-foreground truncate"
                title={formatTs(status.nextRun)}
              >
                {formatTs(status.nextRun)}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Manual backup */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              Manual Backup
            </CardTitle>
            <CardDescription>
              Trigger an immediate schema + data backup to the secondary
              canister.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              onClick={handleManualBackup}
              disabled={triggerBackup.isPending}
              data-ocid="trigger-backup-btn"
              aria-busy={triggerBackup.isPending}
            >
              {triggerBackup.isPending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Backing up…
                </>
              ) : (
                <>
                  <HardDrive className="h-3.5 w-3.5 mr-2" />
                  Trigger Manual Backup
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Backup history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            Backup History
          </CardTitle>
          <CardDescription>
            Most recent first — sorted by timestamp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backupsLoading ? (
            <div className="space-y-2">
              {(["b1", "b2", "b3"] as const).map((k) => (
                <Skeleton key={k} className="h-12 w-full" />
              ))}
            </div>
          ) : sortedBackups.length === 0 ? (
            <div
              className="text-center py-8 text-muted-foreground text-sm"
              data-ocid="backups-empty-state"
            >
              <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>
                No backups yet. Trigger one above or wait for the heartbeat.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Backup history">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-2 pr-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      ID
                    </th>
                    <th className="text-left py-2 pr-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="text-left py-2 pr-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      Triggered By
                    </th>
                    <th className="text-right py-2 pr-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      Objects
                    </th>
                    {isAdmin && (
                      <th className="text-right py-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedBackups.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                      data-ocid="backup-row"
                    >
                      <td className="py-2.5 pr-4 font-mono text-primary">
                        #{b.id}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground font-mono text-xs whitespace-nowrap">
                        {formatTs(b.timestamp)}
                      </td>
                      <td
                        className="py-2.5 pr-4 text-muted-foreground font-mono text-xs truncate max-w-[160px]"
                        title={b.triggeredBy}
                      >
                        {b.triggeredBy}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono">
                        {b.objectCount}
                      </td>
                      {isAdmin && (
                        <td className="py-2.5 text-right">
                          {confirmRestore === b.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-amber-400">
                                Confirm?
                              </span>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleRestore(b.id)}
                                disabled={restoreBackup.isPending}
                                data-ocid="restore-confirm-btn"
                              >
                                {restoreBackup.isPending ? "…" : "Yes"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setConfirmRestore(null)}
                              >
                                No
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                              onClick={() => setConfirmRestore(b.id)}
                              data-ocid="restore-btn"
                              aria-label={`Restore from backup #${b.id}`}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Restore
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Assets Tab ───────────────────────────────────────────────────────────────

const CHUNK_SIZE = 1_900_000; // 1.9 MB

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; current: number; total: number; blobId: number }
  | { phase: "done"; blobId: number };

function getMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mo: "text/plain",
    wasm: "application/wasm",
    tsx: "text/typescript",
    ts: "text/typescript",
    js: "application/javascript",
    jsx: "text/javascript",
    css: "text/css",
    html: "text/html",
    json: "application/json",
  };
  return map[ext ?? ""] ?? "application/octet-stream";
}

function AssetsTab({ isHolder }: { isHolder: boolean }) {
  const { data: blobs = [], isLoading: blobsLoading } = useAllBlobEntries();
  const { data: activeAssets = [], isLoading: assetsLoading } =
    useActiveFrontendAssets();
  const initUpload = useInitBlobUpload();
  const uploadChunk = useUploadBlobChunk();
  const finalizeBlob = useFinalizeBlob();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    phase: "idle",
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPendingFile(file);
    setUploadState({ phase: "idle" });
  }

  async function handleUpload() {
    if (!pendingFile) return;
    const chunkCount = Math.ceil(pendingFile.size / CHUNK_SIZE);
    const mimeType = getMimeType(pendingFile);

    try {
      // Step 1 — init
      const blobId = await initUpload.mutateAsync({
        name: pendingFile.name,
        mimeType,
        totalSize: pendingFile.size,
        chunkCount,
      });

      setUploadState({
        phase: "uploading",
        current: 0,
        total: chunkCount,
        blobId,
      });

      // Step 2 — upload chunks
      const buffer = await pendingFile.arrayBuffer();
      for (let i = 0; i < chunkCount; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, pendingFile.size);
        const chunk = new Uint8Array(buffer.slice(start, end));
        await uploadChunk.mutateAsync({ blobId, chunkIndex: i, data: chunk });
        setUploadState({
          phase: "uploading",
          current: i + 1,
          total: chunkCount,
          blobId,
        });
      }

      // Step 3 — finalize
      const finalId = await finalizeBlob.mutateAsync({ blobId, sha256: null });
      setUploadState({ phase: "done", blobId: finalId ?? blobId });
      toast.success(
        `Blob ID: ${finalId ?? blobId} — use this in your #UpdateFrontend or #UpdateMotoko proposal`,
        {
          duration: 8000,
        },
      );
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      toast.error(
        `Upload failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      setUploadState({ phase: "idle" });
    }
  }

  const uploadProgress =
    uploadState.phase === "uploading"
      ? Math.round((uploadState.current / uploadState.total) * 100)
      : uploadState.phase === "done"
        ? 100
        : 0;

  const isUploading = uploadState.phase === "uploading";

  return (
    <div className="space-y-6">
      {/* Upload panel */}
      <Card className={!isHolder ? "opacity-60 pointer-events-none" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Upload Asset Blob
            {!isHolder && (
              <Badge variant="outline" className="text-xs font-normal ml-2">
                ≥1 ICFC required
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Upload JS, TS, CSS, HTML, Motoko, or WASM files. Large files are
            split automatically into 1.9 MB chunks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="blob-file-input"
              className="text-xs font-mono text-muted-foreground"
            >
              Select file
            </Label>
            <Input
              id="blob-file-input"
              ref={fileInputRef}
              type="file"
              accept=".js,.ts,.tsx,.jsx,.css,.html,.mo,.wasm,.json"
              onChange={handleFileChange}
              disabled={isUploading}
              className="cursor-pointer"
              aria-label="Select asset file to upload"
              data-ocid="blob-file-input"
            />
          </div>

          {pendingFile && (
            <div className="rounded-md border border-border/60 bg-muted/30 px-4 py-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono text-foreground truncate min-w-0 mr-3">
                  {pendingFile.name}
                </span>
                <Badge
                  variant="secondary"
                  className="font-mono text-xs shrink-0"
                >
                  {getMimeType(pendingFile)}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{formatBytes(pendingFile.size)}</span>
                <span>
                  {Math.ceil(pendingFile.size / CHUNK_SIZE)} chunk
                  {Math.ceil(pendingFile.size / CHUNK_SIZE) !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}

          {(isUploading || uploadState.phase === "done") && (
            <div
              className="space-y-1.5"
              aria-live="polite"
              aria-label="Upload progress"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {uploadState.phase === "uploading" ? (
                  <span>
                    Uploading chunk {uploadState.current} of {uploadState.total}
                    …
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Upload complete — Blob ID: {uploadState.blobId}
                  </span>
                )}
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <Progress
                value={uploadProgress}
                className="h-2"
                aria-valuenow={uploadProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!pendingFile || isUploading || !isHolder}
            data-ocid="blob-upload-btn"
            aria-busy={isUploading}
            className="w-full sm:w-auto min-h-[44px]"
          >
            {isUploading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5 mr-2" />
                Upload Blob
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Active frontend asset map */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Active Frontend Assets
          </CardTitle>
          <CardDescription>
            Path → Blob ID mapping for active frontend blobs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assetsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : activeAssets.length === 0 ? (
            <div
              className="text-center py-6 text-sm text-muted-foreground"
              data-ocid="active-assets-empty"
            >
              <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No active frontend assets mapped yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full text-sm"
                aria-label="Active frontend assets"
              >
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-2 pr-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      Path
                    </th>
                    <th className="text-right py-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      Blob ID
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeAssets.map(([path, id]) => (
                    <tr
                      key={path}
                      className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                      data-ocid="active-asset-row"
                    >
                      <td className="py-2.5 pr-4 font-mono text-xs text-foreground">
                        {path}
                      </td>
                      <td className="py-2.5 text-right font-mono text-primary">
                        #{id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All blob entries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            All Blobs
          </CardTitle>
          <CardDescription>
            All uploaded blobs — active and inactive. Use the ID in a DAO
            proposal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {blobsLoading ? (
            <div className="space-y-2">
              {(["b1", "b2", "b3"] as const).map((k) => (
                <Skeleton key={k} className="h-12 w-full" />
              ))}
            </div>
          ) : blobs.length === 0 ? (
            <div
              className="text-center py-8 text-sm text-muted-foreground"
              data-ocid="blobs-empty-state"
            >
              <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No blobs uploaded yet. Upload a file above to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="All blob entries">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-2 pr-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      ID
                    </th>
                    <th className="text-left py-2 pr-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-left py-2 pr-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      MIME
                    </th>
                    <th className="text-right py-2 pr-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      Size
                    </th>
                    <th className="text-left py-2 pr-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th className="text-center py-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      Active
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...blobs]
                    .sort((a, b) => (b.uploadedAt > a.uploadedAt ? 1 : -1))
                    .map((blob: BlobEntry) => (
                      <tr
                        key={blob.id}
                        className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                        data-ocid="blob-row"
                      >
                        <td className="py-2.5 pr-3 font-mono text-primary">
                          #{blob.id}
                        </td>
                        <td
                          className="py-2.5 pr-3 font-mono text-xs truncate max-w-[160px]"
                          title={blob.name}
                        >
                          {blob.name}
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs"
                          >
                            {blob.mimeType}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono text-xs text-muted-foreground">
                          {formatBytes(blob.totalSize)}
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {formatTs(blob.uploadedAt)}
                        </td>
                        <td className="py-2.5 text-center">
                          {blob.isActive ? (
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500/15 text-green-400"
                              aria-label="Active"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground"
                              aria-label="Inactive"
                            >
                              <Clock className="h-3 w-3" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Admin Tab ────────────────────────────────────────────────────────────────

function AdminTab() {
  const { actor } = useActor();
  const [principalInput, setPrincipalInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [initializing, setInitializing] = useState(false);

  async function handleInitialize() {
    if (!actor) return;
    setInitializing(true);
    try {
      await actor.initializeAccessControl();
      toast.success("Access control initialized successfully.");
    } catch (e) {
      toast.error(
        `Failed to initialize: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setInitializing(false);
    }
  }

  async function handleAssignRole() {
    if (!actor || !principalInput.trim() || !selectedRole) return;
    setAssigning(true);
    try {
      const { Principal } = await import("@icp-sdk/core/principal");
      const principal = Principal.fromText(principalInput.trim()) as Principal;
      const role = selectedRole === "admin" ? UserRole.admin : UserRole.user;
      await actor.assignCallerUserRole(principal, role);
      toast.success(
        `Role "${selectedRole}" assigned to ${principalInput.trim().slice(0, 12)}…`,
      );
      setPrincipalInput("");
      setSelectedRole("");
    } catch (e) {
      toast.error(
        `Failed to assign role: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Initialize */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Shield className="h-4 w-4 text-destructive" />
            Initialize Access Control
          </CardTitle>
          <CardDescription>
            One-time setup to bootstrap the admin role on the canister. Only
            required once at genesis deployment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleInitialize}
            disabled={initializing}
            data-ocid="initialize-access-control-btn"
          >
            {initializing ? "Initializing…" : "Initialize Access Control"}
          </Button>
        </CardContent>
      </Card>

      {/* Assign role */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">Assign Role</CardTitle>
          <CardDescription>
            Grant Admin or User role to a Principal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label
                htmlFor="assign-principal"
                className="text-xs font-mono text-muted-foreground"
              >
                Principal ID
              </Label>
              <Input
                id="assign-principal"
                placeholder="aaaaa-aa"
                value={principalInput}
                onChange={(e) => setPrincipalInput(e.target.value)}
                className="font-mono text-sm w-full"
                data-ocid="assign-principal-input"
                aria-required="true"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="assign-role"
                className="text-xs font-mono text-muted-foreground"
              >
                Role
              </Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger
                  id="assign-role"
                  className="w-full sm:w-32"
                  data-ocid="assign-role-select"
                >
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAssignRole}
              disabled={assigning || !principalInput.trim() || !selectedRole}
              size="default"
              className="w-full sm:w-auto min-h-[44px]"
              data-ocid="assign-role-submit"
            >
              {assigning ? "Assigning…" : "Assign Role"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface GovernancePageProps {
  onNavigate?: (page: string) => void;
}

export function GovernancePage({ onNavigate }: GovernancePageProps = {}) {
  const { data: settings, isLoading: settingsLoading } =
    useGovernanceSettings();
  const { data: isAdmin } = useIsAdmin();
  const { data: balance } = useCallerICFCBalance();
  const isHolder = (balance ?? 0n) >= 1n;

  function goToProposals() {
    onNavigate?.("proposals");
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-5xl">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-2">
          <span className="text-primary">▶</span>
          <span>DAO / Governance</span>
        </div>
        <h1 className="text-3xl font-display font-bold">Governance Hub</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Parameters, treasury, templates, docs, schema, system status, and
          assets — all controlled by ICFC token holders.
        </p>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <div className="overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="flex w-max sm:grid sm:w-full sm:grid-cols-8 mb-6 min-w-full">
            <TabsTrigger
              value="settings"
              className="gap-1.5 shrink-0 sm:shrink"
              data-ocid="tab-settings"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="sm:hidden lg:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger
              value="treasury"
              className="gap-1.5 shrink-0 sm:shrink"
              data-ocid="tab-treasury"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span className="sm:hidden lg:inline">Treasury</span>
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="gap-1.5 shrink-0 sm:shrink"
              data-ocid="tab-templates"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="sm:hidden lg:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger
              value="docs"
              className="gap-1.5 shrink-0 sm:shrink"
              data-ocid="tab-docs"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="sm:hidden lg:inline">Docs</span>
            </TabsTrigger>
            <TabsTrigger
              value="schema"
              className="gap-1.5 shrink-0 sm:shrink"
              data-ocid="tab-schema"
            >
              <Database className="h-3.5 w-3.5" />
              <span className="sm:hidden lg:inline">Schema</span>
            </TabsTrigger>
            <TabsTrigger
              value="system"
              className="gap-1.5 shrink-0 sm:shrink"
              data-ocid="tab-system"
            >
              <Activity className="h-3.5 w-3.5" />
              <span className="sm:hidden lg:inline">System</span>
            </TabsTrigger>
            <TabsTrigger
              value="assets"
              className="gap-1.5 shrink-0 sm:shrink"
              data-ocid="tab-assets"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="sm:hidden lg:inline">Assets</span>
            </TabsTrigger>
            <TabsTrigger
              value="feeds"
              className="gap-1.5 shrink-0 sm:shrink"
              data-ocid="tab-feeds"
            >
              <Rss className="h-3.5 w-3.5" />
              <span className="sm:hidden lg:inline">Feeds</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger
                value="admin"
                className="gap-1.5 text-destructive shrink-0 sm:shrink"
                data-ocid="tab-admin"
              >
                <Shield className="h-3.5 w-3.5" />
                <span className="sm:hidden lg:inline">Admin</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Settings */}
        <TabsContent
          value="settings"
          role="tabpanel"
          aria-label="Governance Settings"
        >
          {settingsLoading || !settings ? (
            <SettingsSkeleton />
          ) : (
            <SettingsTab
              settings={settings}
              onNavigateProposals={goToProposals}
            />
          )}
        </TabsContent>

        {/* Treasury */}
        <TabsContent value="treasury" role="tabpanel" aria-label="Treasury">
          <TreasuryTab onNavigateProposals={goToProposals} />
        </TabsContent>

        {/* Templates */}
        <TabsContent
          value="templates"
          role="tabpanel"
          aria-label="Proposal Templates"
        >
          <TemplatesTab onNavigateProposals={goToProposals} />
        </TabsContent>

        {/* Docs */}
        <TabsContent
          value="docs"
          role="tabpanel"
          aria-label="Dynamic Documentation"
        >
          <DocsTab onNavigateProposals={goToProposals} />
        </TabsContent>

        {/* Schema */}
        <TabsContent value="schema" role="tabpanel" aria-label="Schema Viewer">
          <SchemaTab onNavigateProposals={goToProposals} />
        </TabsContent>

        {/* System Status */}
        <TabsContent value="system" role="tabpanel" aria-label="System Status">
          <SystemStatusTab isAdmin={!!isAdmin} />
        </TabsContent>

        {/* Assets / Blob Upload */}
        <TabsContent value="assets" role="tabpanel" aria-label="Asset Blobs">
          <AssetsTab isHolder={isHolder} />
        </TabsContent>

        {/* Data Feeds */}
        <TabsContent value="feeds" role="tabpanel" aria-label="Data Feeds">
          <DataFeedsPanel onNavigateProposals={goToProposals} />
        </TabsContent>

        {/* Admin — only rendered if isAdmin */}
        {isAdmin && (
          <TabsContent value="admin" role="tabpanel" aria-label="Admin Panel">
            <AdminTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
