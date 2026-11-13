import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  Globe,
  PlayCircle,
  Plus,
  RefreshCw,
  Rss,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { FeedConfig, FeedResult, ImportRecord } from "../backend";
import {
  useFeedConfigs,
  useFeedResults,
  useImportHistory,
  useIsAdmin,
  useManualFetchFeed,
  useTriggerFeedPoll,
} from "../hooks/useQueries";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(ts: bigint): string {
  if (!ts || ts === 0n) return "Never";
  return new Date(Number(ts) / 1_000_000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateUrl(url: string, max = 48): string {
  return url.length > max ? `${url.slice(0, max)}…` : url;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function FeedStatusBadge({
  enabled,
  status,
}: { enabled: boolean; status: string }) {
  const isOk = status === "ok" || status === "";
  const isError = status.startsWith("error") || status.startsWith("err");

  if (!enabled) {
    return (
      <Badge
        variant="secondary"
        className="gap-1 text-xs"
        aria-label="Feed disabled"
      >
        <XCircle className="h-3 w-3" aria-hidden="true" />
        Disabled
      </Badge>
    );
  }

  if (isError) {
    return (
      <Badge
        variant="destructive"
        className="gap-1 text-xs"
        aria-label={`Feed error: ${status}`}
      >
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Error
      </Badge>
    );
  }

  if (isOk && status !== "") {
    return (
      <Badge
        variant="default"
        className="gap-1 text-xs bg-primary/20 text-primary border-primary/40 hover:bg-primary/30"
        aria-label="Feed active and healthy"
      >
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Active
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 text-xs"
      aria-label="Feed enabled, not yet polled"
    >
      <Clock className="h-3 w-3" aria-hidden="true" />
      Pending
    </Badge>
  );
}

// ─── Response Code Badge ──────────────────────────────────────────────────────

function ResponseCodeBadge({ code }: { code: number }) {
  const isOk = code >= 200 && code < 300;
  const isRedirect = code >= 300 && code < 400;
  return (
    <Badge
      variant={isOk ? "default" : isRedirect ? "secondary" : "destructive"}
      className={`font-mono text-xs shrink-0${isOk ? " bg-primary/20 text-primary border-primary/40" : ""}`}
      aria-label={`HTTP response code ${code}`}
    >
      {code}
    </Badge>
  );
}

// ─── Feed Results Accordion ───────────────────────────────────────────────────

function FeedResultsAccordion({ feedId }: { feedId: number }) {
  const [open, setOpen] = useState(false);
  const { data: results = [], isLoading } = useFeedResults(
    open ? feedId : null,
  );
  const skeletonKeys = ["r1", "r2", "r3"] as const;

  return (
    <div className="border-t border-border/40 pt-3 mt-3">
      <button
        type="button"
        className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        aria-expanded={open}
        aria-controls={`feed-results-${feedId}`}
        onClick={() => setOpen((v) => !v)}
        data-ocid={`feed-results-toggle-${feedId}`}
      >
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <Activity className="h-3 w-3" aria-hidden="true" />
        {open ? "Hide history" : "Show last 10 results"}
      </button>

      {open && (
        <section
          id={`feed-results-${feedId}`}
          className="mt-3 space-y-2"
          aria-label={`Fetch history for feed ${feedId}`}
        >
          {isLoading ? (
            skeletonKeys.map((k) => (
              <Skeleton key={k} className="h-12 w-full" />
            ))
          ) : results.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No fetch results yet.
            </p>
          ) : (
            (results as FeedResult[]).slice(0, 10).map((r) => (
              <div
                key={`${r.feedId}-${r.fetchedAt}`}
                className="rounded bg-muted/30 border border-border/40 px-3 py-2 space-y-1"
                data-ocid="feed-result-row"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <ResponseCodeBadge code={r.responseCode} />
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatTs(r.fetchedAt)}
                  </span>
                </div>
                {r.bodySnippet && (
                  <p className="text-xs font-mono text-muted-foreground/80 line-clamp-2 break-all">
                    {r.bodySnippet}
                  </p>
                )}
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}

// ─── Feed Card ────────────────────────────────────────────────────────────────

function FeedCard({ feed, isAdmin }: { feed: FeedConfig; isAdmin: boolean }) {
  const { mutate: fetchFeed, isPending: fetching } = useManualFetchFeed();

  function handleFetch() {
    fetchFeed(feed.id, {
      onSuccess: (result) => {
        toast.success(
          `Fetched feed "${feed.name}" — HTTP ${result.responseCode}`,
        );
      },
      onError: (err) => {
        toast.error(
          `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      },
    });
  }

  return (
    <Card
      className="hover:border-primary/40 transition-colors"
      data-ocid="feed-card"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-display flex items-center gap-2 flex-wrap">
              <Rss
                className="h-4 w-4 text-primary shrink-0"
                aria-hidden="true"
              />
              <span className="truncate">{feed.name}</span>
              <Badge
                variant="outline"
                className="font-mono text-xs shrink-0"
                aria-label={`Feed ID ${feed.id}`}
              >
                #{feed.id}
              </Badge>
              <FeedStatusBadge
                enabled={feed.enabled}
                status={feed.lastFetchStatus}
              />
            </CardTitle>
            <CardDescription className="mt-1 flex items-center gap-1 text-xs">
              <Globe className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="font-mono truncate max-w-sm" title={feed.url}>
                {truncateUrl(feed.url)}
              </span>
            </CardDescription>
          </div>

          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-primary/40 text-primary hover:bg-primary/10"
              onClick={handleFetch}
              disabled={fetching}
              aria-label={`Manually fetch feed ${feed.name}`}
              data-ocid={`fetch-now-btn-${feed.id}`}
            >
              {fetching ? (
                <RefreshCw
                  className="h-3.5 w-3.5 mr-1.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <PlayCircle className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              )}
              {fetching ? "Fetching…" : "Fetch Now"}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Last fetch: {formatTs(feed.lastFetchAt)}
          </span>
          <span className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Poll every {Number(feed.pollIntervalSecs)}s
          </span>
          {feed.maxResponseBytes > 0 && (
            <span className="text-xs text-muted-foreground/70 font-mono">
              max {feed.maxResponseBytes.toLocaleString()}B
            </span>
          )}
          {feed.apiKeyHeader && (
            <Badge variant="outline" className="text-xs gap-1">
              <span className="font-mono">{feed.apiKeyHeader}</span> protected
            </Badge>
          )}
        </div>

        <FeedResultsAccordion feedId={feed.id} />
      </CardContent>
    </Card>
  );
}

// ─── Add Feed Dialog ──────────────────────────────────────────────────────────

interface AddFeedDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (csvContent: string) => void;
}

function AddFeedDialog({ open, onClose, onSubmit }: AddFeedDialogProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [apiKeyHeader, setApiKeyHeader] = useState("");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [pollInterval, setPollInterval] = useState("300");
  const [enabled, setEnabled] = useState(true);
  const [maxResponseBytes, setMaxResponseBytes] = useState("2097152");

  function buildCsv() {
    const header =
      "action,name,url,apiKeyHeader,apiKeyValue,pollIntervalSecs,enabled,maxResponseBytes";
    const values = [
      "create",
      name.trim(),
      url.trim(),
      apiKeyHeader.trim(),
      apiKeyValue.trim(),
      pollInterval.trim(),
      enabled ? "true" : "false",
      maxResponseBytes.trim(),
    ].join(",");
    return `${header}\n${values}`;
  }

  function handleSubmit() {
    if (!name.trim() || !url.trim()) {
      toast.error("Name and URL are required.");
      return;
    }
    onSubmit(buildCsv());
    onClose();
    setName("");
    setUrl("");
    setApiKeyHeader("");
    setApiKeyValue("");
    setPollInterval("300");
    setEnabled(true);
    setMaxResponseBytes("2097152");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Add Real-Time Feed
          </DialogTitle>
          <DialogDescription>
            Creates a{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">
              #ConfigureRealTimeFeeds
            </code>{" "}
            proposal. Once approved by the DAO, the feed will be polled
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="feed-name"
              className="text-xs font-mono text-muted-foreground uppercase tracking-wide"
            >
              Feed Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="feed-name"
              placeholder="API-Football Premier League"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-ocid="add-feed-name-input"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="feed-url"
              className="text-xs font-mono text-muted-foreground uppercase tracking-wide"
            >
              URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="feed-url"
              placeholder="https://api-football-v1.p.rapidapi.com/v3/fixtures"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="font-mono text-sm"
              data-ocid="add-feed-url-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="feed-key-header"
                className="text-xs font-mono text-muted-foreground uppercase tracking-wide"
              >
                API Key Header
              </Label>
              <Input
                id="feed-key-header"
                placeholder="X-RapidAPI-Key"
                value={apiKeyHeader}
                onChange={(e) => setApiKeyHeader(e.target.value)}
                className="font-mono text-sm"
                data-ocid="add-feed-key-header-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="feed-key-value"
                className="text-xs font-mono text-muted-foreground uppercase tracking-wide"
              >
                API Key Value
              </Label>
              <Input
                id="feed-key-value"
                placeholder="••••••••"
                type="password"
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                className="font-mono text-sm"
                data-ocid="add-feed-key-value-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="feed-poll-interval"
                className="text-xs font-mono text-muted-foreground uppercase tracking-wide"
              >
                Poll Interval (secs)
              </Label>
              <Input
                id="feed-poll-interval"
                type="number"
                min={60}
                placeholder="300"
                value={pollInterval}
                onChange={(e) => setPollInterval(e.target.value)}
                className="font-mono text-sm"
                data-ocid="add-feed-poll-interval-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="feed-max-bytes"
                className="text-xs font-mono text-muted-foreground uppercase tracking-wide"
              >
                Max Response Bytes
              </Label>
              <Input
                id="feed-max-bytes"
                type="number"
                min={1024}
                placeholder="2097152"
                value={maxResponseBytes}
                onChange={(e) => setMaxResponseBytes(e.target.value)}
                className="font-mono text-sm"
                data-ocid="add-feed-max-bytes-input"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
            <Label htmlFor="feed-enabled" className="text-sm cursor-pointer">
              Enable feed immediately after approval
            </Label>
            <Switch
              id="feed-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              data-ocid="add-feed-enabled-switch"
              aria-label="Enable feed after approval"
            />
          </div>

          <div className="rounded-md bg-muted/40 border border-border/60 p-3">
            <p className="text-xs font-mono text-muted-foreground mb-1.5 uppercase tracking-wide">
              Proposal CSV preview
            </p>
            <pre className="text-xs font-mono text-foreground/80 break-all whitespace-pre-wrap leading-relaxed">
              {buildCsv()}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-ocid="add-feed-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !url.trim()}
            data-ocid="add-feed-submit-btn"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Generate Proposal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Import History Table ─────────────────────────────────────────────────────

function ImportHistoryTable({ records }: { records: ImportRecord[] }) {
  if (records.length === 0) {
    return (
      <p
        className="text-sm text-muted-foreground text-center py-6"
        data-ocid="import-history-empty"
      >
        No import records yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm" aria-label="Import history">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30">
            <th
              scope="col"
              className="px-4 py-2.5 text-left text-xs font-mono uppercase tracking-wide text-muted-foreground"
            >
              Proposal ID
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-left text-xs font-mono uppercase tracking-wide text-muted-foreground"
            >
              Blob ID
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-left text-xs font-mono uppercase tracking-wide text-muted-foreground"
            >
              Date
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-left text-xs font-mono uppercase tracking-wide text-muted-foreground"
            >
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((rec) => {
            const isOk = rec.status === "ok";
            const isError = rec.status.startsWith("error");
            return (
              <tr
                key={`${rec.proposalId}-${rec.blobId}`}
                className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors"
                data-ocid="import-history-row"
              >
                <td className="px-4 py-2.5 font-mono text-xs text-primary">
                  #{rec.proposalId}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  #{rec.blobId}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {formatTs(rec.importedAt)}
                </td>
                <td className="px-4 py-2.5">
                  <Badge
                    variant={
                      isOk ? "default" : isError ? "destructive" : "secondary"
                    }
                    className={`text-xs${isOk ? " bg-primary/20 text-primary border-primary/40" : ""}`}
                    aria-label={`Import status: ${rec.status}`}
                  >
                    {isOk ? (
                      <CheckCircle2
                        className="h-3 w-3 mr-1"
                        aria-hidden="true"
                      />
                    ) : isError ? (
                      <AlertCircle
                        className="h-3 w-3 mr-1"
                        aria-hidden="true"
                      />
                    ) : (
                      <Clock className="h-3 w-3 mr-1" aria-hidden="true" />
                    )}
                    {rec.status}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── DataFeedsPanel ───────────────────────────────────────────────────────────

interface DataFeedsPanelProps {
  onNavigateProposals: () => void;
}

export function DataFeedsPanel({ onNavigateProposals }: DataFeedsPanelProps) {
  const { data: feeds = [], isLoading: feedsLoading } = useFeedConfigs();
  const { data: importHistory = [], isLoading: historyLoading } =
    useImportHistory();
  const { data: isAdmin } = useIsAdmin();
  const { mutate: triggerPoll, isPending: polling } = useTriggerFeedPoll();
  const [addFeedOpen, setAddFeedOpen] = useState(false);
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);

  const skeletonFeedKeys = ["f1", "f2", "f3"] as const;
  const skeletonHistoryKeys = ["h1", "h2", "h3"] as const;

  function handleTriggerAll() {
    triggerPoll(undefined, {
      onSuccess: () =>
        toast.success("Feed poll triggered for all active feeds."),
      onError: (err) =>
        toast.error(
          `Poll failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
    });
  }

  function handleAddFeedSubmit(csv: string) {
    toast.info(
      "Proposal content copied. Open the Proposals page and submit a #ConfigureRealTimeFeeds proposal.",
      { duration: 6000 },
    );
    navigator.clipboard.writeText(csv).catch(() => {
      /* clipboard not available */
    });
    onNavigateProposals();
  }

  const activeFeedCount = (feeds as FeedConfig[]).filter(
    (f) => f.enabled,
  ).length;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Rss className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>
              <span className="font-semibold text-foreground">
                {activeFeedCount}
              </span>{" "}
              active of{" "}
              <span className="font-semibold text-foreground">
                {feeds.length}
              </span>{" "}
              feed{feeds.length !== 1 ? "s" : ""}
            </span>
          </div>
          {isAdmin && feeds.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleTriggerAll}
              disabled={polling}
              aria-label="Trigger all active feeds"
              data-ocid="trigger-all-feeds-btn"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5${polling ? " animate-spin" : ""}`}
                aria-hidden="true"
              />
              {polling ? "Polling…" : "Trigger All Feeds"}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => setAddFeedOpen(true)}
              className="gap-1.5"
              aria-label="Add a new data feed via proposal"
              data-ocid="add-feed-btn"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add Feed
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setImportHistoryOpen((v) => !v)}
            aria-expanded={importHistoryOpen}
            aria-label="Toggle import history"
            data-ocid="toggle-import-history-btn"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            Import History
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <ExternalLink
          className="h-4 w-4 text-primary mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">
          All feed endpoints are DAO-configurable via{" "}
          <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
            #ConfigureRealTimeFeeds
          </code>{" "}
          proposals. Only ICFC holders can add, edit, or remove sources.
          {!isAdmin && (
            <>
              {" "}
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                onClick={onNavigateProposals}
                data-ocid="feeds-info-proposals-link"
              >
                Submit a proposal
              </button>{" "}
              to configure feeds.
            </>
          )}
        </p>
      </div>

      {/* Feed list */}
      {feedsLoading ? (
        <div className="space-y-4">
          {skeletonFeedKeys.map((k) => (
            <Card key={k}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : feeds.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 text-center"
          data-ocid="feeds-empty-state"
        >
          <Rss
            className="h-12 w-12 text-muted-foreground/30 mb-4"
            aria-hidden="true"
          />
          <h3 className="font-display font-semibold text-foreground mb-2">
            No feeds configured yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Submit a{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">
              #ConfigureRealTimeFeeds
            </code>{" "}
            proposal to add your first data source. The DAO controls all
            real-time data ingestion.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={isAdmin ? () => setAddFeedOpen(true) : onNavigateProposals}
            data-ocid="feeds-empty-cta"
          >
            {isAdmin ? (
              <>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add First Feed
              </>
            ) : (
              <>
                Submit #ConfigureRealTimeFeeds Proposal
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {(feeds as FeedConfig[]).map((feed) => (
            <FeedCard key={feed.id} feed={feed} isAdmin={!!isAdmin} />
          ))}
        </div>
      )}

      {/* Import History */}
      {importHistoryOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" aria-hidden="true" />
              Season Import History
            </CardTitle>
            <CardDescription>
              All{" "}
              <code className="font-mono text-xs bg-muted px-1 rounded">
                #ImportSeasonData
              </code>{" "}
              executions — proposal ID, blob, date, and status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-2">
                {skeletonHistoryKeys.map((k) => (
                  <Skeleton key={k} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <ImportHistoryTable records={importHistory as ImportRecord[]} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Feed Dialog */}
      <AddFeedDialog
        open={addFeedOpen}
        onClose={() => setAddFeedOpen(false)}
        onSubmit={handleAddFeedSubmit}
      />
    </div>
  );
}
