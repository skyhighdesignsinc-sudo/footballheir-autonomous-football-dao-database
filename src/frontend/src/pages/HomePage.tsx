import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  Check,
  Clock,
  Database,
  ExternalLink,
  FileText,
  GitBranch,
  Key,
  MessageSquare,
  Search,
  Shield,
  Vote,
  X,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { ProposalStatus } from "../backend";
import {
  useAllObjectTypes,
  useAllProposals,
  useEventLog,
  useGovernanceSettings,
} from "../hooks/useQueries";
import type { EventLogEntry, ObjectType, Page } from "../types";

interface HomePageProps {
  onNavigate: (page: Page) => void;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  isLoading?: boolean;
}

function StatCard({ label, value, isLoading }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 rounded border border-border/60 bg-card/60 min-w-0">
      {isLoading ? (
        <Skeleton className="h-8 w-16 mb-1" />
      ) : (
        <span className="text-2xl font-bold font-display text-primary tabular-nums">
          {value}
        </span>
      )}
      <span className="text-xs text-muted-foreground uppercase tracking-wider truncate">
        {label}
      </span>
    </div>
  );
}

// ─── Object Type Card ─────────────────────────────────────────────────────────

interface ObjectCardProps {
  obj: ObjectType;
  onNavigate: (page: Page) => void;
}

function ObjectCard({ obj, onNavigate }: ObjectCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card
        className="group cursor-pointer border-border/60 hover:border-primary/50 transition-colors duration-200 bg-card/80"
        onClick={() => onNavigate("governance")}
        tabIndex={0}
        aria-label={`Browse ${obj.name} schema`}
        onKeyDown={(e) => e.key === "Enter" && onNavigate("governance")}
        data-ocid="object-type-card"
      >
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold font-display text-foreground group-hover:text-primary transition-colors duration-200 truncate">
              {obj.name}
            </CardTitle>
            <Badge
              variant="outline"
              className="text-xs shrink-0 border-primary/40 text-primary font-mono"
            >
              {obj.attributes.length} attrs
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {obj.description || "No description provided."}
          </p>
          {obj.attributes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {obj.attributes.slice(0, 3).map((attr) => (
                <span
                  key={attr.id}
                  className="text-xs font-mono bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded"
                >
                  {attr.name}
                </span>
              ))}
              {obj.attributes.length > 3 && (
                <span className="text-xs text-muted-foreground px-1.5 py-0.5">
                  +{obj.attributes.length - 3} more
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Event Log Entry Row ──────────────────────────────────────────────────────

interface EventRowProps {
  entry: EventLogEntry;
}

function formatTimestamp(ts: bigint): string {
  const ms = Number(ts / 1_000_000n);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const EVENT_BADGE_COLORS: Record<string, string> = {
  ProposalSubmitted: "bg-primary/15 text-primary border-primary/30",
  ProposalExecuted: "bg-chart-2/20 text-gold border-gold/30",
  ProposalRejected: "bg-destructive/15 text-destructive border-destructive/30",
  ProposalDisputed: "bg-chart-3/20 text-destructive border-destructive/30",
  SchemaChanged: "bg-primary/10 text-primary border-primary/20",
  UserBanned: "bg-destructive/10 text-destructive border-destructive/20",
};

function EventRow({ entry }: EventRowProps) {
  const badgeClass =
    EVENT_BADGE_COLORS[entry.eventType] ??
    "bg-muted text-muted-foreground border-border";

  return (
    <div
      className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0"
      data-ocid="event-log-row"
    >
      <Badge
        variant="outline"
        className={`text-[10px] font-mono shrink-0 mt-0.5 whitespace-nowrap border ${badgeClass}`}
      >
        {entry.eventType}
      </Badge>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground/80 truncate leading-snug">
          {entry.details}
        </p>
      </div>
      <span className="text-xs font-mono text-muted-foreground shrink-0">
        {formatTimestamp(entry.timestamp)}
      </span>
    </div>
  );
}

// ─── Access Level Row ─────────────────────────────────────────────────────────

interface AccessRowProps {
  label: string;
  public?: boolean;
  holder?: boolean;
  onClick?: () => void;
  tooltip?: string;
}

function AccessRow({
  label,
  public: pub = false,
  holder = false,
  onClick,
  tooltip,
}: AccessRowProps) {
  const content = (
    <div
      className={`flex items-center gap-0 border-b border-border/30 last:border-0 ${onClick ? "cursor-pointer hover:bg-muted/30 transition-colors rounded" : ""}`}
      onClick={onClick}
      title={tooltip}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
    >
      <span className="flex-1 text-sm py-2.5 pr-2 text-foreground/80 flex items-center gap-1.5">
        {label}
        {tooltip && (
          <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-1 py-0.5 rounded hidden sm:inline">
            ℹ
          </span>
        )}
      </span>
      <span
        className="w-20 text-center py-2.5"
        aria-label={pub ? "available for public" : "not available for public"}
      >
        {pub ? (
          <Check className="h-4 w-4 text-primary mx-auto" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
        )}
      </span>
      <span
        className="w-20 text-center py-2.5"
        aria-label={
          holder ? "available for holder" : "not available for holder"
        }
      >
        {holder ? (
          <Check className="h-4 w-4 text-gold mx-auto" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
        )}
      </span>
    </div>
  );
  return content;
}

// ─── Home Page ────────────────────────────────────────────────────────────────

export function HomePage({ onNavigate }: HomePageProps) {
  const [search, setSearch] = useState("");

  const { data: proposals = [], isLoading: proposalsLoading } =
    useAllProposals();
  const { data: objectTypes = [], isLoading: objectTypesLoading } =
    useAllObjectTypes();
  const { data: governance, isLoading: governanceLoading } =
    useGovernanceSettings();
  const { data: eventLog = [], isLoading: eventLogLoading } = useEventLog();

  const activeProposals = useMemo(
    () =>
      proposals.filter(
        (p) =>
          p.status === ProposalStatus.Voting ||
          p.status === ProposalStatus.Submitted,
      ),
    [proposals],
  );

  const filteredTypes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return objectTypes;
    return objectTypes.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q),
    );
  }, [objectTypes, search]);

  const recentEvents = useMemo(
    () =>
      [...eventLog]
        .sort((a, b) => Number(b.timestamp - a.timestamp))
        .slice(0, 5),
    [eventLog],
  );

  const minStake = governance ? Number(governance.minStake) : 10;

  return (
    <div className="w-full">
      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border/40 bg-card scanline">
        {/* terminal grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04] terminal-grid"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/10"
          aria-hidden="true"
        />

        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            {/* terminal prefix */}
            <div className="flex items-center gap-2 mb-4 sm:mb-5">
              <span className="font-mono text-xs text-primary opacity-80">
                $ football-god --version 1.0.0
              </span>
              <span
                className="inline-block w-2 h-4 bg-primary animate-pulse"
                aria-hidden="true"
              />
            </div>

            <h1 className="font-display text-2xl sm:text-4xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-4 sm:mb-5">
              The{" "}
              <span className="text-primary relative">
                On-Chain
                <span
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary/60 rounded"
                  aria-hidden="true"
                />
              </span>{" "}
              Football Database
            </h1>

            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground mb-6 sm:mb-8 leading-relaxed max-w-2xl">
              Every table, rule, and API endpoint — created by ICFC holders via
              proposals.{" "}
              <span className="text-foreground/70 font-medium">
                Zero hard-coded data.
              </span>
            </p>

            <div className="flex flex-col xs:flex-row flex-wrap gap-3 mb-8 sm:mb-10">
              <Button
                size="lg"
                onClick={() => onNavigate("governance")}
                className="font-semibold min-h-[44px]"
                aria-label="Browse the database"
                data-ocid="hero-browse-cta"
              >
                Browse Database
                <Database className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => onNavigate("proposals")}
                className="font-semibold border-border/60 min-h-[44px]"
                aria-label="View all proposals"
                data-ocid="hero-proposals-cta"
              >
                View Proposals
                <Vote className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Total Proposals"
                value={proposals.length}
                isLoading={proposalsLoading}
              />
              <StatCard
                label="Active Votes"
                value={activeProposals.length}
                isLoading={proposalsLoading}
              />
              <StatCard
                label="Object Types"
                value={objectTypes.length}
                isLoading={objectTypesLoading}
              />
              <StatCard
                label="Min Stake"
                value={governanceLoading ? "…" : `${minStake} ICFC`}
                isLoading={governanceLoading}
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SEARCH + OBJECT BROWSER ───────────────────────────────── */}
      <section className="bg-background py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-8">
              <div>
                <h2 className="font-display text-2xl font-bold mb-1">
                  Schema Explorer
                </h2>
                <p className="text-sm text-muted-foreground">
                  Browse object types defined by the DAO. Each type is a
                  community-proposed database table.
                </p>
              </div>
              <div className="sm:ml-auto">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    className="pl-9 font-mono w-full sm:w-64 bg-card border-border/60"
                    placeholder="Search types..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search object types"
                    data-ocid="schema-search-input"
                  />
                </div>
              </div>
            </div>

            {/* Loading */}
            {objectTypesLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(["a", "b", "c", "d", "e", "f"] as const).map((k) => (
                  <Skeleton key={`skel-obj-${k}`} className="h-32 rounded" />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!objectTypesLoading && objectTypes.length === 0 && (
              <div
                className="rounded border border-dashed border-border/60 py-16 flex flex-col items-center gap-4 text-center"
                data-ocid="object-types-empty"
                aria-live="polite"
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold font-display text-foreground mb-1">
                    No object types yet
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Be the first to propose a Player, Club, or Match schema. The
                    database starts empty — the DAO builds it.
                  </p>
                </div>
                <Button
                  onClick={() => onNavigate("proposals")}
                  size="sm"
                  aria-label="Submit your first proposal"
                  data-ocid="empty-submit-proposal-cta"
                >
                  Submit Proposal
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {/* No search results */}
            {!objectTypesLoading &&
              objectTypes.length > 0 &&
              filteredTypes.length === 0 && (
                <p
                  className="text-sm text-muted-foreground py-8 text-center"
                  aria-live="polite"
                >
                  No object types match &ldquo;{search}&rdquo;
                </p>
              )}

            {/* Grid */}
            {!objectTypesLoading && filteredTypes.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTypes.map((obj, i) => (
                  <motion.div
                    key={obj.id}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                  >
                    <ObjectCard obj={obj} onNavigate={onNavigate} />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── ACCESS LEVELS ─────────────────────────────────────────── */}
      <section className="bg-muted/30 border-y border-border/40 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <div className="mb-8 text-center">
              <h2 className="font-display text-2xl font-bold mb-2">
                Access Levels
              </h2>
              <p className="text-sm text-muted-foreground">
                Your role is determined solely by your ICFC token balance
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <Card className="bg-card/80 border-border/60 overflow-hidden">
                {/* Column headers */}
                <div className="flex items-center gap-0 bg-muted/40 border-b border-border/50 px-4 py-2.5">
                  <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Permission
                  </span>
                  <span className="w-20 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Public
                    <br />
                    <span className="text-[10px] font-normal font-mono normal-case">
                      0 ICFC
                    </span>
                  </span>
                  <span className="w-20 text-center text-xs font-semibold uppercase tracking-wider text-gold">
                    Holder
                    <br />
                    <span className="text-[10px] font-normal font-mono normal-case text-muted-foreground">
                      ≥1 ICFC
                    </span>
                  </span>
                </div>
                <div className="px-4">
                  <AccessRow label="Browse database" public holder />
                  <AccessRow label="Search all object types" public holder />
                  <AccessRow label="Read proposals" public holder />
                  <AccessRow label="Read forum threads" public holder />
                  <AccessRow
                    label="Get API Access"
                    public={false}
                    holder
                    onClick={() => onNavigate("api")}
                    tooltip="Requires API key registration + prepaid token deposit (ICFC, ICP, or DAO-approved ICRC-1 token). Pay-as-you-go pricing."
                  />
                  <AccessRow label="Submit proposals (with stake)" holder />
                  <AccessRow label="Vote on active proposals" holder />
                  <AccessRow label="Post in forum" holder />
                  <AccessRow label="Dispute executed proposals" holder />
                  <AccessRow label="Create API keys" holder />
                </div>
              </Card>

              <p className="text-xs text-center text-muted-foreground mt-4">
                Access is fully trustless — verified on-chain via ICFC ledger
                balance.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── RECENT ACTIVITY ───────────────────────────────────────── */}
      <section className="bg-background py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-2xl font-bold mb-1">
                  Recent Activity
                </h2>
                <p className="text-sm text-muted-foreground">
                  Immutable, hash-chained event log — every DAO action recorded
                  on-chain
                </p>
              </div>
              <Badge
                variant="outline"
                className="font-mono text-xs border-primary/30 text-primary hidden sm:flex"
              >
                <Zap className="h-3 w-3 mr-1" />
                Live
              </Badge>
            </div>

            <Card className="bg-card/80 border-border/60">
              <CardContent className="p-0 px-4">
                <div className="max-h-64 sm:max-h-none overflow-y-auto">
                  {eventLogLoading && (
                    <div className="py-4 space-y-3">
                      {(["a", "b", "c", "d"] as const).map((k) => (
                        <Skeleton
                          key={`skel-evt-${k}`}
                          className="h-9 rounded"
                        />
                      ))}
                    </div>
                  )}

                  {!eventLogLoading && recentEvents.length === 0 && (
                    <div
                      className="py-12 text-center"
                      data-ocid="event-log-empty"
                      aria-live="polite"
                    >
                      <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground font-medium">
                        Activity log is empty
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        The DAO hasn&apos;t made any moves yet.
                      </p>
                    </div>
                  )}

                  {!eventLogLoading &&
                    recentEvents.map((entry) => (
                      <EventRow key={entry.id} entry={entry} />
                    ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ── CALL TO ACTION ────────────────────────────────────────── */}
      <section className="bg-muted/30 border-t border-border/40 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl mx-auto"
          >
            <Card className="relative overflow-hidden border-primary/20 bg-card/90">
              {/* Glow accent */}
              <div
                className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
                aria-hidden="true"
              />
              <CardContent className="p-8 sm:p-10 relative">
                <div className="grid sm:grid-cols-2 gap-8 items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded bg-primary/15 flex items-center justify-center">
                        <Shield className="h-4 w-4 text-primary" />
                      </div>
                      <h2 className="font-display text-xl font-bold">
                        Own the Database
                      </h2>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      Connect with Internet Identity, then acquire{" "}
                      <span className="text-foreground font-medium">
                        ≥1 ICFC token
                      </span>{" "}
                      to unlock full DAO participation. Propose new schemas,
                      vote on changes, and dispute bad proposals.
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <GitBranch className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>
                          Login with Internet Identity (no seed phrase)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Key className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>
                          Hold ≥1 ICFC from ledger{" "}
                          <span className="font-mono text-xs">
                            ddsp7-7i…cai
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Vote className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>Voting power = your ICFC balance</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="rounded border border-border/60 bg-muted/30 p-4 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          ICFC Token Details
                        </span>
                      </div>
                      <div className="font-mono text-xs text-foreground/70 break-all">
                        ddsp7-7iaaa-aaaaq-aacqq-cai
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        Standard ICRC-1 fungible token
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full border-border/60 text-sm"
                      onClick={() =>
                        window.open(
                          "https://dashboard.internetcomputer.org/canister/ddsp7-7iaaa-aaaaq-aacqq-cai",
                          "_blank",
                          "noopener noreferrer",
                        )
                      }
                      aria-label="View ICFC token on IC Dashboard (opens in new tab)"
                      data-ocid="icfc-dashboard-link"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View on IC Dashboard
                    </Button>
                    <Button
                      className="w-full"
                      onClick={() => onNavigate("proposals")}
                      aria-label="Browse all DAO proposals"
                      data-ocid="home-proposals-cta"
                    >
                      Browse Proposals
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
