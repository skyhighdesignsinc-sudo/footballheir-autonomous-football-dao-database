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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Coins,
  Copy,
  Database,
  Edit2,
  ExternalLink,
  Eye,
  Key,
  Layers,
  Plus,
  RefreshCw,
  RotateCw,
  Settings2,
  ShieldOff,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { APIConsumerV2, APIPricePackage, APIToken } from "../backend";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  persistKeyName,
  useAPICallBreakdown,
  useAPICallHistory,
  useAPIConsumer,
  useAPIPricePackages,
  useAPIRateLimitStatus,
  useAPITokens,
  useAllConsumerKeys,
  useCallTimeSeries,
  useCallerICFCBalance,
  useDepositAPIBalance,
  useRegisterAPIKey,
  useRenameAPIKey,
  useRevokeAPIKey,
  useRotateAPIKey,
} from "../hooks/useQueries";
import { useI18n } from "../i18n";
import type { APIKeyMeta, DevPortalTab } from "../types";

// ─── Chart imports ──────────────────────────────────────────────────────────

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

// ─── Utilities ───────────────────────────────────────────────────────────────

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function maskKey(bytes: Uint8Array): string {
  const hex = toHex(bytes);
  return `${hex.slice(0, 8)}••••••••••••••••${hex.slice(-4)}`;
}

function formatAmt(amt: bigint, decimals = 8): string {
  const val = Number(amt) / 10 ** decimals;
  return val.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatDate(ts: bigint): string {
  if (ts === 0n) return "—";
  return new Date(Number(ts / 1_000_000n)).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(ts: bigint): string {
  if (ts === 0n) return "—";
  return new Date(Number(ts / 1_000_000n)).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function nowMs(): bigint {
  return BigInt(Date.now()) * 1_000_000n;
}

function daysAgoMs(days: number): bigint {
  return BigInt(Date.now() - days * 86_400_000) * 1_000_000n;
}

// ─── Chart colors ─────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "hsl(var(--chart-1, 142 76% 36%))",
  "hsl(var(--chart-2, 217 91% 60%))",
  "hsl(var(--chart-3, 47 96% 53%))",
  "hsl(var(--chart-4, 12 76% 61%))",
  "hsl(var(--chart-5, 265 89% 78%))",
];

// ─── Unauthenticated prompt ────────────────────────────────────────────────────

function UnauthenticatedPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <section
      className="flex flex-col items-center justify-center py-20 gap-4 text-center"
      aria-label="Authentication required"
    >
      <div className="p-4 rounded-full bg-muted/60 border border-border">
        <Key className="h-8 w-8 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="font-display text-base font-semibold text-foreground">
          Authentication Required
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Connect your Internet Identity to access the Developer Portal and
          manage your API keys.
        </p>
      </div>
      <Button
        onClick={onConnect}
        data-ocid="api.auth-connect-button"
        className="mt-2"
      >
        Connect Internet Identity
      </Button>
    </section>
  );
}

// ─── Rate Limit Gauge ────────────────────────────────────────────────────────

function RateLimitGauge({
  current,
  limit,
}: {
  current: number;
  limit: number;
}) {
  const pct =
    limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  const remaining = limit - current;
  const remainingPct = 100 - pct;

  // SVG donut gauge
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const usedStroke = (pct / 100) * circumference;
  const freeStroke = circumference - usedStroke;
  const color =
    pct >= 90
      ? "hsl(var(--destructive, 0 84% 60%))"
      : pct >= 70
        ? "hsl(var(--chart-3, 47 96% 53%))"
        : "hsl(142 76% 36%)";

  return (
    <div
      className="flex flex-col items-center gap-2"
      aria-label={`Rate limit: ${pct}% used`}
    >
      <svg
        width="140"
        height="140"
        viewBox="0 0 140 140"
        role="img"
        aria-label={`${remainingPct}% remaining calls`}
      >
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="hsl(var(--muted, 217 19% 17%))"
          strokeWidth="14"
        />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeDasharray={`${freeStroke} ${usedStroke}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        <text
          x="70"
          y="64"
          textAnchor="middle"
          fontSize="22"
          fontWeight="700"
          fill="currentColor"
          className="fill-foreground"
        >
          {remainingPct}%
        </text>
        <text
          x="70"
          y="82"
          textAnchor="middle"
          fontSize="10"
          fill="currentColor"
          className="fill-muted-foreground"
        >
          Remaining Calls
        </text>
      </svg>
      <div className="text-center space-y-0.5">
        <p className="text-xs text-muted-foreground">
          {remaining.toLocaleString()} / {limit.toLocaleString()} remaining
        </p>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  consumer,
  packages,
  tokens,
  consumerLoading,
  packagesLoading,
}: {
  consumer: APIConsumerV2 | null | undefined;
  packages: APIPricePackage[];
  tokens: APIToken[];
  consumerLoading: boolean;
  packagesLoading: boolean;
}) {
  const activePackages = packages.filter((p) => p.isActive);

  const tokenSymbol = (tokenId: number) =>
    tokens.find((t) => t.id === tokenId)?.symbol ?? `Token #${tokenId}`;
  const tokenDecimals = (tokenId: number) =>
    tokens.find((t) => t.id === tokenId)?.decimals ?? 8;

  const { data: rateLimitStatus } = useAPIRateLimitStatus(
    consumer?.apiKey ?? null,
  );

  const summaryCards = [
    {
      label: "Total Calls",
      value: consumer ? consumer.callCount.toLocaleString() : "0",
      sub: consumer ? `+${consumer.batchCallCount.toLocaleString()} batch` : "",
      icon: TrendingUp,
      loading: consumerLoading,
      ocid: "api.overview-calls-card",
    },
    {
      label: "Balance",
      value: consumer
        ? `${formatAmt(consumer.balance, tokenDecimals(consumer.tokenId))} ${tokenSymbol(consumer.tokenId)}`
        : "—",
      sub: "",
      icon: Wallet,
      loading: consumerLoading,
      ocid: "api.overview-balance-card",
    },
    {
      label: "Active Keys",
      value: consumer ? (consumer.isActive ? "1" : "0") : "0",
      sub: "",
      icon: Key,
      loading: consumerLoading,
      ocid: "api.overview-keys-card",
    },
    {
      label: "Total Deposited",
      value: consumer
        ? `${formatAmt(consumer.totalDeposited, tokenDecimals(consumer.tokenId))} ${tokenSymbol(consumer.tokenId)}`
        : "—",
      sub: "",
      icon: Coins,
      loading: consumerLoading,
      ocid: "api.overview-deposited-card",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary + rate limit row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick stats */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {summaryCards.map(
            ({ label, value, sub, icon: Icon, loading, ocid }) => (
              <Card
                key={label}
                className="bg-card border-border"
                data-ocid={ocid}
              >
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                        {label}
                      </p>
                      {loading ? (
                        <Skeleton className="h-6 w-24" />
                      ) : (
                        <p className="font-display font-bold text-lg text-foreground truncate">
                          {value}
                        </p>
                      )}
                      {sub && (
                        <p className="text-[10px] text-muted-foreground">
                          {sub}
                        </p>
                      )}
                    </div>
                    <div className="p-2 rounded-md bg-primary/10 shrink-0 ml-3">
                      <Icon className="h-4 w-4 text-primary" aria-hidden />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ),
          )}
        </div>

        {/* Rate limit gauge */}
        <Card
          className="bg-card border-border"
          data-ocid="api.overview-rate-limit-card"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" aria-hidden />
              Rate Limit
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-2">
            {consumerLoading ? (
              <Skeleton className="h-36 w-36 rounded-full" />
            ) : (
              <RateLimitGauge
                current={rateLimitStatus?.currentWindowCalls ?? 0}
                limit={rateLimitStatus?.rateLimit ?? consumer?.rateLimit ?? 10}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pricing table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-semibold tracking-wide flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" aria-hidden />
                DAO-Configured Pricing
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Pay-as-you-go. All rates set by ICFC token holder proposals.
              </CardDescription>
            </div>
            <a
              href="/docs/dao-bootstrap-guide.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              data-ocid="api.docs-link"
            >
              Documentation
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </div>
        </CardHeader>
        <CardContent>
          {packagesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : activePackages.length === 0 ? (
            <div
              className="flex flex-col items-center py-10 text-center gap-2"
              data-ocid="api.pricing-empty_state"
            >
              <Database
                className="h-8 w-8 text-muted-foreground/40"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">
                No pricing packages configured yet.
              </p>
              <p className="text-xs text-muted-foreground">
                Submit a{" "}
                <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">
                  #NewAPIPrice
                </code>{" "}
                proposal via Governance to add pricing.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" aria-label="API pricing table">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      "Package",
                      "Scope",
                      "Per Call",
                      "Batch Price",
                      "Batch Min",
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`py-2 pr-4 font-semibold text-muted-foreground uppercase tracking-wide ${i === 0 ? "text-left" : i <= 1 ? "text-left" : "text-right"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activePackages.map((pkg, idx) => (
                    <tr
                      key={pkg.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      data-ocid={`api.pricing-item.${idx + 1}`}
                    >
                      <td className="py-2.5 pr-4 font-medium text-foreground">
                        {pkg.name}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {pkg.objectTypeId !== undefined ? (
                          <Badge variant="outline" className="text-[10px]">
                            ObjectType #{pkg.objectTypeId}
                          </Badge>
                        ) : (
                          <span>Global</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono">
                        {formatAmt(
                          pkg.pricePerCall,
                          tokenDecimals(pkg.tokenId),
                        )}{" "}
                        <span className="text-muted-foreground">
                          {tokenSymbol(pkg.tokenId)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono">
                        {formatAmt(
                          pkg.priceBatchCall,
                          tokenDecimals(pkg.tokenId),
                        )}{" "}
                        <span className="text-muted-foreground">
                          {tokenSymbol(pkg.tokenId)}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono">
                        {pkg.batchSizeThreshold}+
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick start */}
      <Card className="bg-muted/30 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-wide flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" aria-hidden />
            Quick Start
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Query any object type with your API key. Balance is deducted per
            call.
          </p>
          <pre className="bg-background border border-border rounded-sm p-3 text-[11px] font-mono text-muted-foreground overflow-x-auto">
            {`GET /api/v1/objecttype/{type}?apiKey=<32-byte-hex>&format=json

# Batch (cheaper per item)
GET /api/v1/objecttype/{type}/batch?apiKey=<32-byte-hex>&ids=1,2,3`}
          </pre>
          <p className="text-[10px] text-muted-foreground">
            Routing governed by{" "}
            <code className="font-mono bg-muted/60 px-1 rounded-sm">
              #NewMethod
            </code>{" "}
            proposals. Pricing via{" "}
            <code className="font-mono bg-muted/60 px-1 rounded-sm">
              #NewAPIPrice
            </code>{" "}
            proposals.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── My Keys Tab ──────────────────────────────────────────────────────────────

type KeySortField =
  | "name"
  | "createdAt"
  | "lastUsedAt"
  | "isActive"
  | "callCount";
type KeySortDir = "asc" | "desc";

interface KeyRowData extends APIKeyMeta {
  balance?: bigint;
  totalCalls?: number;
  totalSpent?: bigint;
  tokenId?: number;
  totalDeposited?: bigint;
}

function RegisterKeyModal({
  open,
  tokens,
  registering,
  onConfirm,
  onClose,
}: {
  open: boolean;
  tokens: APIToken[];
  registering: boolean;
  onConfirm: (tokenId: number) => void;
  onClose: () => void;
}) {
  const activeTokens = tokens.filter((t) => t.isActive);
  const [selectedId, setSelectedId] = useState<number>(
    activeTokens[0]?.id ?? 0,
  );
  useEffect(() => {
    const first = tokens.filter((t) => t.isActive)[0];
    if (first) setSelectedId(first.id);
  }, [tokens]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        data-ocid="api.register-key-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" aria-hidden />
            Register New API Key
          </DialogTitle>
          <DialogDescription>
            Select a payment token. Your key is generated on-chain. No monthly
            fee — you only pay for calls made.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="rk-token" className="text-xs font-medium">
              Payment Token
            </Label>
            {activeTokens.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No accepted tokens configured. A DAO proposal is required.
              </p>
            ) : (
              <select
                id="rk-token"
                value={selectedId}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                className="w-full h-9 rounded-sm border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                data-ocid="api.register-token-select"
              >
                {activeTokens.map((tok) => (
                  <option key={tok.id} value={tok.id}>
                    {tok.symbol}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-600 dark:text-amber-400">
            <AlertTriangle
              className="h-3.5 w-3.5 mt-0.5 shrink-0"
              aria-hidden
            />
            <span>
              After registration, deposit tokens to fund API calls. The key will
              be shown <strong>once</strong> — save it immediately.
            </span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={registering}
            data-ocid="api.register-key-cancel-button"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(selectedId)}
            disabled={registering || activeTokens.length === 0}
            aria-busy={registering}
            data-ocid="api.register-key-confirm-button"
          >
            {registering ? "Registering…" : "Register Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewKeyRevealModal({
  open,
  keyHex,
  onClose,
}: {
  open: boolean;
  keyHex: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(keyHex).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-lg"
        data-ocid="api.new-key-reveal-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Key className="h-4 w-4" aria-hidden />
            Your New API Key
          </DialogTitle>
          <DialogDescription className="text-destructive font-medium">
            ⚠ This key will not be shown again. Copy and store it securely now.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <code className="block font-mono text-xs text-primary bg-primary/5 border border-primary/30 px-3 py-3 rounded-sm break-all select-all">
            {keyHex}
          </code>
          <Button
            className="w-full gap-2"
            onClick={handleCopy}
            data-ocid="api.copy-new-key-button"
            aria-label="Copy new API key to clipboard"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" aria-hidden />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden />
                Copy Key to Clipboard
              </>
            )}
          </Button>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-ocid="api.new-key-reveal-close-button"
          >
            I've saved my key — Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RotateConfirmModal({
  open,
  keyName,
  rotating,
  onConfirm,
  onClose,
}: {
  open: boolean;
  keyName: string;
  rotating: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        data-ocid="api.rotate-confirm-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCw className="h-4 w-4 text-primary" aria-hidden />
            Rotate API Key
          </DialogTitle>
          <DialogDescription>
            This will revoke <strong>{keyName}</strong> and generate a new key
            immediately. Any applications using the current key will stop
            working.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={rotating}
            data-ocid="api.rotate-confirm-cancel-button"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={rotating}
            aria-busy={rotating}
            data-ocid="api.rotate-confirm-button"
          >
            <RotateCw className="h-3.5 w-3.5 mr-1.5" aria-hidden />
            {rotating ? "Rotating…" : "Yes, Rotate Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevokeConfirmModal({
  open,
  keyName,
  revoking,
  onConfirm,
  onClose,
}: {
  open: boolean;
  keyName: string;
  revoking: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        data-ocid="api.revoke-confirm-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldOff className="h-4 w-4" aria-hidden />
            Revoke API Key
          </DialogTitle>
          <DialogDescription>
            Revoking <strong>{keyName}</strong> is permanent and cannot be
            undone. The key will immediately stop accepting API calls.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={revoking}
            data-ocid="api.revoke-confirm-cancel-button"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={revoking}
            aria-busy={revoking}
            data-ocid="api.revoke-confirm-button"
          >
            <ShieldOff className="h-3.5 w-3.5 mr-1.5" aria-hidden />
            {revoking ? "Revoking…" : "Yes, Revoke Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DepositKeyModal({
  open,
  keyName,
  tokens,
  consumer,
  depositing,
  onConfirm,
  onClose,
}: {
  open: boolean;
  keyName: string;
  tokens: APIToken[];
  consumer: APIConsumerV2 | null | undefined;
  depositing: boolean;
  onConfirm: (amount: bigint) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const tokenId =
    consumer?.tokenId ?? tokens.filter((t) => t.isActive)[0]?.id ?? 0;
  const token = tokens.find((t) => t.id === tokenId);
  const decimals = token?.decimals ?? 8;
  const minDeposit = token?.minDeposit ?? 0n;
  const amountBigInt = (() => {
    const n = Number.parseFloat(amount);
    if (Number.isNaN(n) || n <= 0) return null;
    return BigInt(Math.round(n * 10 ** decimals));
  })();
  const belowMin = amountBigInt !== null && amountBigInt < minDeposit;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" data-ocid="api.deposit-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" aria-hidden />
            Deposit Balance
          </DialogTitle>
          <DialogDescription>
            Top up <strong>{keyName}</strong>. Tokens are deducted per API call.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {consumer && (
            <div className="flex items-center justify-between p-3 rounded-sm bg-muted/30 border border-border/50">
              <span className="text-xs text-muted-foreground">
                Current Balance
              </span>
              <span className="font-mono text-sm font-semibold text-foreground">
                {formatAmt(consumer.balance, decimals)} {token?.symbol ?? ""}
              </span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="dk-amount" className="text-xs font-medium">
              Amount ({token?.symbol ?? "—"})
            </Label>
            <Input
              id="dk-amount"
              type="number"
              min="0"
              step="0.0001"
              placeholder={
                token ? `Min: ${formatAmt(minDeposit, decimals)}` : "0.0000"
              }
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono"
              data-ocid="api.deposit-modal-amount-input"
            />
            {belowMin && (
              <p
                className="text-[11px] text-destructive"
                role="alert"
                data-ocid="api.deposit-modal-amount-field_error"
              >
                Below minimum deposit of {formatAmt(minDeposit, decimals)}{" "}
                {token?.symbol}.
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={depositing}
            data-ocid="api.deposit-cancel-button"
          >
            Cancel
          </Button>
          <Button
            onClick={() => amountBigInt && onConfirm(amountBigInt)}
            disabled={depositing || !amountBigInt || belowMin}
            aria-busy={depositing}
            data-ocid="api.deposit-confirm-button"
          >
            {depositing ? "Depositing…" : "Deposit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KeyRow({
  row,
  index,
  tokens,
  consumer,
  onRotate,
  onRevoke,
  onDeposit,
}: {
  row: KeyRowData;
  index: number;
  tokens: APIToken[];
  consumer: APIConsumerV2 | null | undefined;
  onRotate: (r: KeyRowData) => void;
  onRevoke: (r: KeyRowData) => void;
  onDeposit: (r: KeyRowData) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(row.name);
  const nameRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: renameKey, isPending: renaming } = useRenameAPIKey();

  useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

  const tokenId = row.tokenId ?? consumer?.tokenId ?? 0;
  const token = tokens.find((t) => t.id === tokenId);
  const decimals = token?.decimals ?? 8;
  const symbol = token?.symbol ?? `#${tokenId}`;
  const balance = row.balance ?? consumer?.balance;
  const totalDeposited = row.totalDeposited ?? consumer?.totalDeposited;
  const isLowBalance =
    balance !== undefined &&
    totalDeposited !== undefined &&
    totalDeposited > 0n &&
    balance < totalDeposited / 10n;
  const isRevoked = !row.isActive;

  const handleSaveRename = async () => {
    if (!nameInput.trim()) return;
    try {
      await renameKey({ apiKey: row.apiKey, newName: nameInput.trim() });
      toast.success("Key renamed");
      setEditingName(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Rename failed");
    }
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(toHex(row.apiKey));
    toast.success("API key copied");
  };

  const NameCell = () =>
    editingName ? (
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSaveRename();
        }}
      >
        <Input
          ref={nameRef}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          className="h-7 text-sm w-32"
          aria-label="Key name"
          data-ocid={`api.key-name-input.${index}`}
        />
        <Button
          type="submit"
          size="sm"
          className="h-7 px-2"
          disabled={renaming}
          aria-label="Save name"
          data-ocid={`api.key-save-name-button.${index}`}
        >
          <Check className="h-3 w-3" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => {
            setNameInput(row.name);
            setEditingName(false);
          }}
          aria-label="Cancel rename"
        >
          ✕
        </Button>
      </form>
    ) : (
      <div className="flex items-center gap-1.5 min-w-0 group/name">
        <span
          className={`text-sm font-medium truncate ${isRevoked ? "text-muted-foreground" : "text-foreground"}`}
        >
          {row.name || "Unnamed Key"}
        </span>
        {!isRevoked && (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="opacity-0 group-hover/name:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground"
            aria-label={`Rename key ${row.name}`}
            data-ocid={`api.key-rename-button.${index}`}
          >
            <Edit2 className="h-3 w-3" aria-hidden />
          </button>
        )}
        {isLowBalance && !isRevoked && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle
                  className="h-3.5 w-3.5 text-amber-500 shrink-0 cursor-help"
                  aria-label="Low balance"
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-xs">
                Low balance — deposit to continue API calls
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );

  return (
    <>
      {/* Desktop row */}
      <tr
        className={`border-b border-border/50 transition-colors group hidden md:table-row ${isRevoked ? "opacity-50" : "hover:bg-muted/20"}`}
        data-ocid={`api.key-row.${index}`}
      >
        <td className="py-3 pr-3 pl-3">
          <NameCell />
        </td>
        <td className="py-3 pr-3 text-xs text-muted-foreground whitespace-nowrap">
          {formatDate(row.createdAt)}
        </td>
        <td className="py-3 pr-3 text-xs text-muted-foreground whitespace-nowrap">
          {formatDate(row.lastUsedAt)}
        </td>
        <td className="py-3 pr-3">
          <Badge
            variant={row.isActive ? "default" : "secondary"}
            className={`text-[10px] ${row.isActive ? "bg-primary/20 text-primary border border-primary/30" : ""}`}
          >
            {row.isActive ? "Active" : "Revoked"}
          </Badge>
        </td>
        <td className="py-3 pr-3 font-mono text-xs text-right whitespace-nowrap">
          {balance !== undefined ? (
            <span
              className={isLowBalance ? "text-amber-500" : "text-foreground"}
            >
              {formatAmt(balance, decimals)} {symbol}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="py-3 pr-3 font-mono text-xs text-right">
          {(row.totalCalls ?? consumer?.callCount ?? 0).toLocaleString()}
        </td>
        <td className="py-3 pr-3">
          <div className="flex items-center gap-1 justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => setExpanded((v) => !v)}
              aria-label={isRevoked ? "View last usage" : "View usage details"}
              aria-expanded={expanded}
              data-ocid={`api.key-expand-button.${index}`}
            >
              <Eye className="h-3 w-3 mr-1" aria-hidden />
              {expanded ? "Hide" : "Usage"}
            </Button>
            {!isRevoked && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => onDeposit(row)}
                  aria-label={`Deposit to ${row.name}`}
                  data-ocid={`api.key-deposit-button.${index}`}
                >
                  <Wallet className="h-3 w-3 mr-1" aria-hidden />
                  Deposit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => onRotate(row)}
                  aria-label={`Rotate key ${row.name}`}
                  data-ocid={`api.key-rotate-button.${index}`}
                >
                  <RotateCw className="h-3 w-3 mr-1" aria-hidden />
                  Rotate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onRevoke(row)}
                  aria-label={`Revoke key ${row.name}`}
                  data-ocid={`api.key-revoke-button.${index}`}
                >
                  <ShieldOff className="h-3 w-3 mr-1" aria-hidden />
                  Revoke
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded usage row */}
      {expanded && (
        <tr className="hidden md:table-row bg-muted/10">
          <td colSpan={7} className="px-3 py-3 border-b border-border/50">
            <div className="flex items-center gap-6 text-xs flex-wrap">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Key className="h-3 w-3 shrink-0" aria-hidden />
                <code className="font-mono truncate max-w-[200px]">
                  {maskKey(row.apiKey)}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-0.5 rounded hover:bg-muted/60"
                  aria-label="Copy key"
                >
                  <Copy className="h-3 w-3" aria-hidden />
                </button>
              </div>
              <div className="text-muted-foreground">
                Total calls:{" "}
                <span className="text-foreground font-mono">
                  {(
                    row.totalCalls ??
                    consumer?.callCount ??
                    0
                  ).toLocaleString()}
                </span>
              </div>
              <div className="text-muted-foreground">
                Last used:{" "}
                <span className="text-foreground">
                  {formatDateTime(row.lastUsedAt)}
                </span>
              </div>
              {row.totalSpent !== undefined && (
                <div className="text-muted-foreground">
                  Total spent:{" "}
                  <span className="text-foreground font-mono">
                    {formatAmt(row.totalSpent, decimals)} {symbol}
                  </span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}

      {/* Mobile card */}
      <tr
        className="md:hidden border-b border-border/50"
        data-ocid={`api.key-card-mobile.${index}`}
      >
        <td colSpan={7} className="py-1 px-1">
          <div
            className={`p-4 space-y-3 rounded-sm border border-border/40 ${isRevoked ? "opacity-60 bg-muted/10" : "bg-card"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <NameCell />
              </div>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant={row.isActive ? "default" : "secondary"}
                  className={`text-[10px] ${row.isActive ? "bg-primary/20 text-primary border border-primary/30" : ""}`}
                >
                  {row.isActive ? "Active" : "Revoked"}
                </Badge>
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground"
                  aria-label={expanded ? "Collapse" : "Expand"}
                  aria-expanded={expanded}
                >
                  {expanded ? (
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="font-mono text-[10px] text-primary bg-primary/5 border border-primary/20 px-2 py-1 rounded-sm flex-1 truncate">
                {maskKey(row.apiKey)}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground"
                aria-label="Copy API key"
              >
                <Copy className="h-3 w-3" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Created
                </p>
                <p className="text-foreground">{formatDate(row.createdAt)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Last Used
                </p>
                <p className="text-foreground">{formatDate(row.lastUsedAt)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Balance
                </p>
                <p
                  className={`font-mono ${isLowBalance ? "text-amber-500" : "text-foreground"}`}
                >
                  {balance !== undefined ? formatAmt(balance, decimals) : "—"}
                </p>
              </div>
            </div>
            {expanded && (
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Total Calls
                  </p>
                  <p className="font-mono text-foreground">
                    {(
                      row.totalCalls ??
                      consumer?.callCount ??
                      0
                    ).toLocaleString()}
                  </p>
                </div>
                {row.totalSpent !== undefined && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Total Spent
                    </p>
                    <p className="font-mono text-foreground">
                      {formatAmt(row.totalSpent, decimals)} {symbol}
                    </p>
                  </div>
                )}
              </div>
            )}
            {!isRevoked && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setEditingName(true)}
                  aria-label="Rename"
                  data-ocid={`api.key-rename-mobile-button.${index}`}
                >
                  <Edit2 className="h-3 w-3" aria-hidden />
                  Rename
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => onDeposit(row)}
                  aria-label="Deposit"
                  data-ocid={`api.key-deposit-mobile-button.${index}`}
                >
                  <Wallet className="h-3 w-3" aria-hidden />
                  Deposit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => onRotate(row)}
                  aria-label="Rotate key"
                  data-ocid={`api.key-rotate-mobile-button.${index}`}
                >
                  <RotateCw className="h-3 w-3" aria-hidden />
                  Rotate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => onRevoke(row)}
                  aria-label="Revoke key"
                  data-ocid={`api.key-revoke-mobile-button.${index}`}
                >
                  <ShieldOff className="h-3 w-3" aria-hidden />
                  Revoke
                </Button>
              </div>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}

function MyKeysTab({
  consumer,
  tokens,
  consumerLoading,
  tokensEmpty,
}: {
  consumer: APIConsumerV2 | null | undefined;
  tokens: APIToken[];
  consumerLoading: boolean;
  tokensEmpty: boolean;
}) {
  const { mutateAsync: rotateKey, isPending: rotating } = useRotateAPIKey();
  const { mutateAsync: revokeKey, isPending: revoking } = useRevokeAPIKey();
  const { mutateAsync: depositBalance, isPending: depositing } =
    useDepositAPIBalance();
  const { mutateAsync: registerKey, isPending: registering } =
    useRegisterAPIKey();
  const { data: allKeys = [], isLoading: keysLoading } = useAllConsumerKeys();

  const [sortField, setSortField] = useState<KeySortField>("createdAt");
  const [sortDir, setSortDir] = useState<KeySortDir>("desc");
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newKeyHex, setNewKeyHex] = useState<string | null>(null);
  const [rotateTarget, setRotateTarget] = useState<KeyRowData | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<KeyRowData | null>(null);
  const [depositTarget, setDepositTarget] = useState<KeyRowData | null>(null);

  const rows: KeyRowData[] = useCallback(() => {
    if (allKeys.length > 0) {
      return allKeys.map((k) => ({
        ...k,
        balance: consumer?.balance,
        totalCalls: consumer?.callCount,
        totalSpent: consumer?.totalSpent,
        tokenId: consumer?.tokenId,
        totalDeposited: consumer?.totalDeposited,
      }));
    }
    if (consumer) {
      return [
        {
          id: consumer.id,
          consumerId: consumer.id,
          name: "Primary Key",
          apiKey: consumer.apiKey,
          createdAt: consumer.createdAt,
          lastUsedAt: consumer.lastCallAt,
          isActive: consumer.isActive,
          balance: consumer.balance,
          totalCalls: consumer.callCount,
          totalSpent: consumer.totalSpent,
          tokenId: consumer.tokenId,
          totalDeposited: consumer.totalDeposited,
        },
      ];
    }
    return [];
  }, [allKeys, consumer])();

  const sortedRows = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortField === "name") cmp = (a.name || "").localeCompare(b.name || "");
    else if (sortField === "createdAt")
      cmp = a.createdAt < b.createdAt ? -1 : 1;
    else if (sortField === "lastUsedAt")
      cmp = a.lastUsedAt < b.lastUsedAt ? -1 : 1;
    else if (sortField === "isActive")
      cmp = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0);
    else if (sortField === "callCount")
      cmp = (a.totalCalls ?? 0) - (b.totalCalls ?? 0);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (field: KeySortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortBtn = ({
    field,
    label,
  }: {
    field: KeySortField;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      aria-label={`Sort by ${label}`}
      data-ocid={`api.keys-sort-${label.toLowerCase().replace(/ /g, "-")}`}
    >
      {label}
      {sortField === field ? (
        sortDir === "asc" ? (
          <ChevronUp className="h-3 w-3 text-primary" aria-hidden />
        ) : (
          <ChevronDown className="h-3 w-3 text-primary" aria-hidden />
        )
      ) : (
        <ChevronDown className="h-3 w-3 opacity-30" aria-hidden />
      )}
    </button>
  );

  const handleRegister = async (tokenId: number) => {
    try {
      const keyBytes = await registerKey(tokenId);
      setShowRegisterModal(false);
      setNewKeyHex(toHex(keyBytes));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    }
  };

  const handleRotateConfirm = async () => {
    if (!rotateTarget) return;
    try {
      const newKeyBytes = await rotateKey(rotateTarget.apiKey);
      setRotateTarget(null);
      setNewKeyHex(toHex(newKeyBytes));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Rotate failed");
    }
  };

  const handleRevokeConfirm = async () => {
    if (!revokeTarget) return;
    try {
      await revokeKey(revokeTarget.apiKey);
      toast.success("API key revoked");
      setRevokeTarget(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Revoke failed");
    }
  };

  const handleDepositConfirm = async (amount: bigint) => {
    if (!depositTarget) return;
    try {
      await depositBalance({ apiKey: depositTarget.apiKey, amount });
      toast.success("Deposit successful! Balance updated.");
      setDepositTarget(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Deposit failed");
    }
  };

  if (consumerLoading || keysLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading keys">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-sm font-semibold text-foreground">
            My API Keys
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sortedRows.length === 0
              ? "No keys registered"
              : `${sortedRows.filter((r) => r.isActive).length} active · ${sortedRows.filter((r) => !r.isActive).length} revoked`}
          </p>
        </div>
        <Button
          onClick={() => setShowRegisterModal(true)}
          disabled={registering || tokensEmpty}
          aria-busy={registering}
          data-ocid="api.register-key-button"
          size="sm"
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Register New Key
        </Button>
      </div>

      {sortedRows.length === 0 ? (
        <div
          className="flex flex-col items-center py-16 text-center gap-4"
          data-ocid="api.keys-empty_state"
        >
          <div className="p-4 rounded-full bg-muted/60 border border-border">
            <Key className="h-7 w-7 text-muted-foreground" aria-hidden />
          </div>
          <div className="space-y-1 max-w-xs">
            <p className="font-display font-semibold text-foreground">
              No API Keys Yet
            </p>
            <p className="text-sm text-muted-foreground">
              Register your first key to start accessing football data via the
              pay-as-you-go system.
            </p>
          </div>
          <div className="flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400 max-w-xs text-left">
            <AlertTriangle
              className="h-3.5 w-3.5 mt-0.5 shrink-0"
              aria-hidden
            />
            <span>
              Requires a token deposit after registration. You only pay for
              calls made — no monthly fee.
            </span>
          </div>
          <Button
            onClick={() => setShowRegisterModal(true)}
            disabled={registering || tokensEmpty}
            data-ocid="api.register-button-empty"
            aria-busy={registering}
          >
            <Plus className="h-4 w-4 mr-2" aria-hidden />
            {registering ? "Registering…" : "Register New Key"}
          </Button>
          {tokensEmpty && (
            <p className="text-xs text-muted-foreground">
              No accepted tokens configured yet. A DAO proposal is required.
            </p>
          )}
        </div>
      ) : (
        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" aria-label="API keys table">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-border">
                  {(
                    [
                      {
                        f: "name" as KeySortField,
                        l: "Name",
                        right: false,
                      },
                      {
                        f: "createdAt" as KeySortField,
                        l: "Created",
                        right: false,
                      },
                      {
                        f: "lastUsedAt" as KeySortField,
                        l: "Last Used",
                        right: false,
                      },
                      {
                        f: "isActive" as KeySortField,
                        l: "Status",
                        right: false,
                      },
                      {
                        f: "callCount" as KeySortField,
                        l: "Balance",
                        right: true,
                      },
                      {
                        f: "callCount" as KeySortField,
                        l: "Calls",
                        right: true,
                      },
                    ] as { f: KeySortField; l: string; right: boolean }[]
                  ).map(({ f, l, right }, i) => (
                    <th
                      key={`${f}-${l}`}
                      className={`py-3 pr-3 font-semibold text-muted-foreground uppercase tracking-wide ${i === 0 ? "pl-3" : ""} ${right ? "text-right" : "text-left"}`}
                    >
                      <SortBtn field={f} label={l} />
                    </th>
                  ))}
                  <th className="py-3 pr-3 text-right font-semibold text-muted-foreground uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, idx) => (
                  <KeyRow
                    key={`${row.id}-${toHex(row.apiKey).slice(0, 8)}`}
                    row={row}
                    index={idx + 1}
                    tokens={tokens}
                    consumer={consumer}
                    onRotate={setRotateTarget}
                    onRevoke={setRevokeTarget}
                    onDeposit={setDepositTarget}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        All key data is isolated to your principal. Zero cross-consumer leakage
        — each API call is validated on-chain.
      </p>

      {/* Modals */}
      <RegisterKeyModal
        open={showRegisterModal}
        tokens={tokens}
        registering={registering}
        onConfirm={(tokenId) => void handleRegister(tokenId)}
        onClose={() => setShowRegisterModal(false)}
      />
      {newKeyHex && (
        <NewKeyRevealModal
          open={!!newKeyHex}
          keyHex={newKeyHex}
          onClose={() => setNewKeyHex(null)}
        />
      )}
      <RotateConfirmModal
        open={!!rotateTarget}
        keyName={rotateTarget?.name ?? "this key"}
        rotating={rotating}
        onConfirm={() => void handleRotateConfirm()}
        onClose={() => setRotateTarget(null)}
      />
      <RevokeConfirmModal
        open={!!revokeTarget}
        keyName={revokeTarget?.name ?? "this key"}
        revoking={revoking}
        onConfirm={() => void handleRevokeConfirm()}
        onClose={() => setRevokeTarget(null)}
      />
      {depositTarget && (
        <DepositKeyModal
          open={!!depositTarget}
          keyName={depositTarget.name ?? "this key"}
          tokens={tokens}
          consumer={consumer}
          depositing={depositing}
          onConfirm={(amount) => void handleDepositConfirm(amount)}
          onClose={() => setDepositTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Usage Analytics Tab ──────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { label: "Last 7 days", shortLabel: "7d", days: 7 },
  { label: "Last 30 days", shortLabel: "30d", days: 30 },
  { label: "Last 90 days", shortLabel: "90d", days: 90 },
] as const;

type RangeOption = (typeof RANGE_OPTIONS)[number]["shortLabel"];

function KeyRateLimitGauge({
  keyMeta,
}: {
  keyMeta: {
    apiKey: Uint8Array;
    name: string;
    isActive: boolean;
    id: number;
  };
}) {
  const { data: status } = useAPIRateLimitStatus(
    keyMeta.isActive ? keyMeta.apiKey : null,
  );
  const current = status?.currentWindowCalls ?? 0;
  const limit = status?.rateLimit ?? 10;
  const windowEndSecs = status?.windowEndSecs ?? 0;
  const pct =
    limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  const barColor =
    pct >= 80 ? "bg-destructive" : pct >= 50 ? "bg-gold" : "bg-primary";
  const textColor =
    pct >= 80 ? "text-destructive" : pct >= 50 ? "text-gold" : "text-primary";
  return (
    <div
      className="p-3 rounded-sm bg-muted/20 border border-border/50 space-y-2"
      aria-label={`Key "${keyMeta.name || "Unnamed"}: ${current} of ${limit} calls used this minute`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Key className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
          <span className="text-xs font-medium text-foreground truncate">
            {keyMeta.name || "Unnamed Key"}
          </span>
          {!keyMeta.isActive && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              Revoked
            </Badge>
          )}
        </div>
        <span
          className={`text-xs font-mono font-semibold shrink-0 ${textColor}`}
        >
          {current}/{limit}
        </span>
      </div>
      <div
        className="w-full h-1.5 rounded-full bg-muted overflow-hidden"
        aria-label={`${pct}% of rate limit consumed`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{pct}% of limit used</span>
        {windowEndSecs > 0 && (
          <span className="font-mono">resets in {windowEndSecs}s</span>
        )}
      </div>
    </div>
  );
}

function PieLegendWithPct({
  data,
}: {
  data: Array<{ name: string; value: number; fill: string }>;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <ul className="space-y-2" aria-label="Object type breakdown legend">
      {data.map((entry) => {
        const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
        return (
          <li key={entry.name} className="flex items-center gap-2 text-[11px]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: entry.fill }}
              aria-hidden
            />
            <span className="text-foreground min-w-0 truncate flex-1">
              {entry.name}
            </span>
            <span className="font-mono font-semibold text-foreground shrink-0">
              {pct}%
            </span>
            <span className="font-mono text-muted-foreground/60 shrink-0 text-[10px]">
              ({entry.value.toLocaleString()})
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function UsageAnalyticsTab({
  consumer,
  tokens,
  consumerLoading,
}: {
  consumer: APIConsumerV2 | null | undefined;
  tokens: APIToken[];
  consumerLoading: boolean;
}) {
  const tokenDecimals = (tokenId: number) =>
    tokens.find((t) => t.id === tokenId)?.decimals ?? 8;

  const [range, setRange] = useState<RangeOption>("30d");
  const [granularity, setGranularity] = useState<"day" | "week">("day");
  const days = RANGE_OPTIONS.find((r) => r.shortLabel === range)?.days ?? 30;

  const toTs = nowMs();
  const fromTs = daysAgoMs(days);

  const { data: breakdown = [], isLoading: breakdownLoading } =
    useAPICallBreakdown({ fromTs, toTs, enabled: !!consumer });

  const { data: timeSeries = [], isLoading: timeSeriesLoading } =
    useCallTimeSeries({ fromTs, toTs, granularity, enabled: !!consumer });

  const { data: callHistory = [], isLoading: historyLoading } =
    useAPICallHistory({
      apiKey: consumer?.apiKey ?? null,
      fromTs,
      toTs,
      page: 0,
    });

  const { data: allKeys = [], isLoading: keysLoading } = useAllConsumerKeys();
  const activeKeys = allKeys.filter((k) => k.isActive);

  if (consumerLoading) {
    return (
      <div
        className="space-y-4"
        aria-busy="true"
        aria-label="Loading analytics"
      >
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-20 ml-auto" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!consumer) {
    return (
      <div
        className="flex flex-col items-center py-16 text-center gap-3"
        data-ocid="api.analytics-empty_state"
      >
        <BarChart3 className="h-8 w-8 text-muted-foreground/40" aria-hidden />
        <p className="text-sm font-medium text-foreground">No usage data yet</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Register an API key and make your first call to start tracking usage
          analytics.
        </p>
      </div>
    );
  }

  const timeSeriesData = timeSeries.map((b) => ({
    label: b.bucketLabel,
    calls: b.callCount,
    cost: Number(b.totalCost) / 10 ** tokenDecimals(consumer.tokenId),
  }));

  const breakdownData = breakdown.map((b, i) => ({
    name:
      b.objectTypeId === null
        ? "Other"
        : b.typeName || `Type #${b.objectTypeId}`,
    value: b.callCount,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const totalCalls = breakdownData.reduce((s, d) => s + d.value, 0);
  const hasTimeSeries = timeSeriesData.length > 0;
  const hasBreakdown = breakdownData.length > 0;

  const tooltipStyle = {
    background: "oklch(var(--card))",
    border: "1px solid oklch(var(--border))",
    borderRadius: "4px",
    fontSize: "11px",
    color: "oklch(var(--foreground))",
  };

  return (
    <div className="space-y-5">
      {/* Controls: date range selector + granularity toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Select time range"
          className="flex gap-1 p-1 rounded-md bg-muted/40"
        >
          {RANGE_OPTIONS.map(({ label, shortLabel }) => (
            <button
              key={shortLabel}
              type="button"
              role="tab"
              aria-selected={range === shortLabel}
              tabIndex={range === shortLabel ? 0 : -1}
              onClick={() => setRange(shortLabel)}
              className={[
                "px-3 py-1.5 text-xs font-medium rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                range === shortLabel
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
              data-ocid={`api.analytics-range-${shortLabel}`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setGranularity((g) => (g === "day" ? "week" : "day"))}
          aria-pressed={granularity === "week"}
          aria-label={`Switch to ${granularity === "day" ? "weekly" : "daily"} view`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-border/40"
          data-ocid="api.analytics-granularity-toggle"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          <span className="font-mono">
            {granularity === "day" ? "Day" : "Week"}
          </span>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-mono text-muted-foreground/50">
            {granularity === "day" ? "Week" : "Day"}
          </span>
        </button>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Time series bar chart */}
        <Card
          className="bg-card border-border"
          data-ocid="api.analytics-timeseries-card"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden />
              Calls per {granularity === "day" ? "Day" : "Week"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeSeriesLoading ? (
              <div aria-busy="true" aria-label="Loading time series chart">
                <Skeleton className="h-52 w-full" />
              </div>
            ) : !hasTimeSeries ? (
              <div
                className="flex flex-col items-center py-10 gap-2 text-center"
                data-ocid="api.analytics-timeseries-empty_state"
              >
                <BarChart3
                  className="h-7 w-7 text-muted-foreground/40"
                  aria-hidden
                />
                <p className="text-sm text-muted-foreground">
                  No API calls recorded in this period
                </p>
              </div>
            ) : (
              <div
                role="img"
                aria-label={`Bar chart: ${timeSeriesData.reduce((s, d) => s + d.calls, 0).toLocaleString()} total API calls over the last ${days} days`}
              >
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={timeSeriesData}
                    margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="label"
                      tick={{
                        fontSize: 9,
                        fill: "oklch(var(--muted-foreground))",
                      }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{
                        fontSize: 9,
                        fill: "oklch(var(--muted-foreground))",
                      }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <RechartsTooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{
                        color: "oklch(var(--foreground))",
                        fontWeight: 600,
                      }}
                      cursor={{ fill: "oklch(var(--muted) / 0.4)" }}
                    />
                    <Bar
                      dataKey="calls"
                      fill={CHART_COLORS[0]}
                      radius={[2, 2, 0, 0]}
                      name="Calls"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Object type doughnut chart */}
        <Card
          className="bg-card border-border"
          data-ocid="api.analytics-breakdown-card"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" aria-hidden />
              Object Type Breakdown
              {totalCalls > 0 && (
                <span className="ml-auto text-[10px] font-normal text-muted-foreground/60 normal-case tracking-normal">
                  {totalCalls.toLocaleString()} calls
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {breakdownLoading ? (
              <div aria-busy="true" aria-label="Loading breakdown chart">
                <Skeleton className="h-52 w-full" />
              </div>
            ) : !hasBreakdown ? (
              <div
                className="flex flex-col items-center py-10 gap-2 text-center"
                data-ocid="api.analytics-breakdown-empty_state"
              >
                <Layers
                  className="h-7 w-7 text-muted-foreground/40"
                  aria-hidden
                />
                <p className="text-sm text-muted-foreground">
                  No API calls recorded in this period
                </p>
              </div>
            ) : (
              <div
                role="img"
                aria-label={`Doughnut chart: ${breakdownData.map((d) => `${d.name} ${totalCalls > 0 ? Math.round((d.value / totalCalls) * 100) : 0}%`).join(", ")}`}
              >
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="shrink-0">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie
                          data={breakdownData}
                          cx="50%"
                          cy="50%"
                          innerRadius={46}
                          outerRadius={72}
                          paddingAngle={2}
                          dataKey="value"
                          tabIndex={0}
                          aria-label="API calls by object type"
                        >
                          {breakdownData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: number, name: string) => {
                            const pct =
                              totalCalls > 0
                                ? Math.round((value / totalCalls) * 100)
                                : 0;
                            return [
                              `${value.toLocaleString()} calls (${pct}%)`,
                              name,
                            ];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 min-w-0 w-full">
                    <PieLegendWithPct data={breakdownData} />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rate limit gauges per active key */}
      <Card
        className="bg-card border-border"
        data-ocid="api.analytics-ratelimit-card"
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" aria-hidden />
            Rate Limit Status
            <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-muted-foreground/60">
              per minute window
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {keysLoading ? (
            <div
              className="space-y-3"
              aria-busy="true"
              aria-label="Loading rate limit status"
            >
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : activeKeys.length === 0 ? (
            <div
              className="flex flex-col items-center py-8 gap-2 text-center"
              data-ocid="api.analytics-ratelimit-empty_state"
            >
              <Zap className="h-7 w-7 text-muted-foreground/40" aria-hidden />
              <p className="text-sm text-muted-foreground">
                No active keys to monitor
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeKeys.map((keyMeta) => (
                <KeyRateLimitGauge key={keyMeta.id} keyMeta={keyMeta} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call history table */}
      <Card
        className="bg-card border-border"
        data-ocid="api.analytics-history-card"
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Recent Call History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div
              className="space-y-2"
              aria-busy="true"
              aria-label="Loading call history"
            >
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : callHistory.length === 0 ? (
            <div
              className="flex flex-col items-center py-8 gap-2 text-center"
              data-ocid="api.analytics-history-empty_state"
            >
              <Clock className="h-7 w-7 text-muted-foreground/40" aria-hidden />
              <p className="text-sm text-muted-foreground">
                No API calls recorded in this period
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full text-xs"
                aria-label={`API call history — ${callHistory.length} records`}
              >
                <thead>
                  <tr className="border-b border-border">
                    {["Time", "Type", "Batch", "Cost", "Status"].map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={`py-2 pr-4 font-semibold text-muted-foreground uppercase tracking-wide ${i === 0 ? "text-left" : i === 4 ? "text-right" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {callHistory.slice(0, 20).map((record, idx) => (
                    <tr
                      key={`${record.id}`}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      data-ocid={`api.history-item.${idx + 1}`}
                    >
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                        {formatDateTime(record.timestamp)}
                      </td>
                      <td className="py-2 pr-4 text-foreground">
                        {record.objectTypeId !== null
                          ? `#${record.objectTypeId}`
                          : "Global"}
                      </td>
                      <td className="py-2 pr-4">
                        {record.isBatch ? (
                          <Badge variant="outline" className="text-[10px]">
                            {record.batchSize}x
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 font-mono text-foreground">
                        {formatAmt(
                          record.cost,
                          tokenDecimals(consumer.tokenId),
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <Badge
                          variant={
                            record.status === "ok" ? "default" : "destructive"
                          }
                          className="text-[10px]"
                        >
                          {record.status}
                        </Badge>
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

// ─── Billing Tab ──────────────────────────────────────────────────────────────

/** Derive a synthetic transaction list from call history + deposit totals */
interface TxRow {
  id: string;
  date: bigint;
  keyName: string;
  type: "Deposit" | "API Call" | "Deduction";
  token: string;
  amount: bigint; // positive = credit, negative = debit
  balanceAfter: bigint | null;
  isBatch?: boolean;
}

const BILLING_PAGE_SIZE = 25;
const BILLING_RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;
type BillingRange = (typeof BILLING_RANGE_OPTIONS)[number]["label"];

function BillingTab({
  consumer,
  tokens,
  consumerLoading,
}: {
  consumer: APIConsumerV2 | null | undefined;
  tokens: APIToken[];
  consumerLoading: boolean;
}) {
  const { t } = useI18n();
  const { data: icfcBalance } = useCallerICFCBalance();
  const { mutateAsync: depositBalance, isPending: depositing } =
    useDepositAPIBalance();
  const { data: allKeys = [] } = useAllConsumerKeys();

  // ── Deposit form state ────────────────────────────────────────────────────
  const activeTokens = tokens.filter((tok) => tok.isActive);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(
    activeTokens[0]?.id ?? null,
  );
  const [amount, setAmount] = useState("");
  const [depositSuccess, setDepositSuccess] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositForKeyId, setDepositForKeyId] = useState<number | null>(null);

  // ── Low-balance threshold ──────────────────────────────────────────────────
  const [thresholdPct, setThresholdPct] = useState(10);
  const [thresholdInput, setThresholdInput] = useState("10");
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<number>>(
    new Set(),
  );

  // ── Filters + pagination ──────────────────────────────────────────────────
  const [billingRange, setBillingRange] = useState<BillingRange>("30d");
  const [selectedKeyFilter, setSelectedKeyFilter] = useState<number | "all">(
    "all",
  );
  const [page, setPage] = useState(0);
  // Track how many backend pages have been loaded (0 = first page only)
  const [backendPage, setBackendPage] = useState(0);

  const rangeDays =
    BILLING_RANGE_OPTIONS.find((r) => r.label === billingRange)?.days ?? 30;
  const fromTs = daysAgoMs(rangeDays);
  const toTs = nowMs();

  const filteredApiKey =
    selectedKeyFilter !== "all"
      ? (allKeys.find((k) => k.id === selectedKeyFilter)?.apiKey ?? null)
      : (consumer?.apiKey ?? null);

  const { data: callHistory = [], isLoading: historyLoading } =
    useAPICallHistory({
      apiKey: filteredApiKey,
      fromTs,
      toTs,
      page: backendPage,
    });
  const hasMoreBackendPages = callHistory.length === 100; // backend returns max 100/page
  // ── Helpers ───────────────────────────────────────────────────────────────
  const tokenSymbolById = (tokenId: number) =>
    tokens.find((t) => t.id === tokenId)?.symbol ?? `Token#${tokenId}`;
  const tokenDecimalsById = (tokenId: number) =>
    tokens.find((t) => t.id === tokenId)?.decimals ?? 8;

  const selectedToken = tokens.find((tok) => tok.id === selectedTokenId);
  const decimals = selectedToken?.decimals ?? 8;
  const tokenSymbol = selectedToken?.symbol ?? "—";

  const amountBigInt = (() => {
    const n = Number.parseFloat(amount);
    if (Number.isNaN(n) || n <= 0) return null;
    return BigInt(Math.round(n * 10 ** decimals));
  })();
  const minDeposit = selectedToken?.minDeposit ?? 0n;
  const belowMin = amountBigInt !== null && amountBigInt < minDeposit;

  const icfcAmt = icfcBalance ?? 0n;
  const icfcDecimals =
    tokens.find((tok) => tok.symbol === "ICFC")?.decimals ?? 8;

  // ── Compute monthly spend for threshold calc ───────────────────────────────
  // Use 30 days of history for avg monthly spend
  const avgMonthlySpend = (() => {
    if (callHistory.length === 0 || !consumer) return 0n;
    const total = callHistory.reduce((acc, r) => acc + r.cost, 0n);
    // Scale to 30 days if range differs
    const scaleFactor = rangeDays > 0 ? 30 / rangeDays : 1;
    return BigInt(Math.round(Number(total) * scaleFactor));
  })();

  // ── Low-balance keys ─────────────────────────────────────────────────────
  const lowBalanceKeys = (() => {
    if (!consumer) return [];
    const threshold =
      avgMonthlySpend > 0n
        ? (avgMonthlySpend * BigInt(thresholdPct)) / 100n
        : consumer.totalDeposited > 0n
          ? (consumer.totalDeposited * BigInt(thresholdPct)) / 100n
          : 0n;
    if (threshold === 0n) return [];
    // For now we have one key per consumer; future: iterate allKeys
    const keyName =
      allKeys.find((k) => k.apiKey.every((b, i) => b === consumer.apiKey[i]))
        ?.name ?? "API Key";
    if (consumer.balance < threshold && consumer.isActive) {
      return [{ id: consumer.id, name: keyName, balance: consumer.balance }];
    }
    return [];
  })();

  // ── Build transaction rows ────────────────────────────────────────────────
  const txRows: TxRow[] = (() => {
    if (!consumer) return [];
    const sym = tokenSymbolById(consumer.tokenId);
    const rows: TxRow[] = [];

    // Synthesize a "Deposit" row for the total deposited (since we don't have a separate deposit log)
    if (consumer.totalDeposited > 0n) {
      rows.push({
        id: "deposit-total",
        date: consumer.createdAt,
        keyName:
          allKeys.find((k) =>
            k.apiKey.every((b, i) => b === consumer.apiKey[i]),
          )?.name ?? "API Key",
        type: "Deposit",
        token: sym,
        amount: consumer.totalDeposited,
        balanceAfter: null,
      });
    }

    // Add call records as deductions
    for (const record of callHistory) {
      const keyName =
        allKeys.find((k) => k.apiKey.every((b, i) => b === record.apiKey[i]))
          ?.name ?? "API Key";
      rows.push({
        id: `call-${record.id.toString()}`,
        date: record.timestamp,
        keyName,
        type: record.isBatch ? "API Call" : "Deduction",
        token: sym,
        amount: -record.cost,
        balanceAfter: null,
        isBatch: record.isBatch,
      });
    }

    // Sort desc by date
    rows.sort((a, b) => (a.date > b.date ? -1 : 1));
    return rows;
  })();

  const totalPages = Math.max(1, Math.ceil(txRows.length / BILLING_PAGE_SIZE));
  const pagedRows = txRows.slice(
    page * BILLING_PAGE_SIZE,
    (page + 1) * BILLING_PAGE_SIZE,
  );

  const handleDeposit = useCallback(async () => {
    if (!consumer || !amountBigInt) return;
    const targetKey =
      depositForKeyId !== null
        ? (allKeys.find((k) => k.id === depositForKeyId)?.apiKey ??
          consumer.apiKey)
        : consumer.apiKey;
    try {
      await depositBalance({ apiKey: targetKey, amount: amountBigInt });
      toast.success("Deposit successful! Balance updated.");
      setAmount("");
      setShowDepositForm(false);
      setDepositForKeyId(null);
      setDepositSuccess(true);
      setTimeout(() => setDepositSuccess(false), 5000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Deposit failed");
    }
  }, [consumer, amountBigInt, depositBalance, allKeys, depositForKeyId]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (consumerLoading) {
    return (
      <div
        className="space-y-4"
        aria-busy="true"
        aria-label="Loading billing"
        data-ocid="api.billing.loading_state"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // ── No consumer state ────────────────────────────────────────────────────
  if (!consumer) {
    return (
      <div
        className="flex flex-col items-center py-16 text-center gap-3"
        data-ocid="api.billing.empty_state"
      >
        <AlertCircle className="h-8 w-8 text-muted-foreground/40" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Register an API key first to access billing.
        </p>
      </div>
    );
  }

  // ── Keys for balance cards (currently 1 per consumer; future: multiple) ──
  const keyCards = [
    {
      id: consumer.id,
      name:
        allKeys.find((k) => k.apiKey.every((b, i) => b === consumer.apiKey[i]))
          ?.name ?? "API Key",
      balance: consumer.balance,
      tokenId: consumer.tokenId,
      isActive: consumer.isActive,
    },
  ];

  return (
    <div className="space-y-6" data-ocid="api.billing.panel">
      {/* ── Low-balance alert banners ────────────────────────────────────────── */}
      {lowBalanceKeys
        .filter((k) => !dismissedAlerts.has(k.id))
        .map((k) => (
          <div
            key={k.id}
            role="alert"
            aria-live="polite"
            className="flex items-start justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400"
            data-ocid={`api.billing.low-balance-alert.${k.id}`}
          >
            <div className="flex items-start gap-2 min-w-0">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
              <span>
                Key{" "}
                <strong className="font-semibold">
                  &ldquo;{k.name}&rdquo;
                </strong>{" "}
                is running low (
                <span className="font-mono">
                  {formatAmt(k.balance, tokenDecimalsById(consumer.tokenId))}{" "}
                  {tokenSymbolById(consumer.tokenId)}
                </span>{" "}
                remaining). Deposit now to avoid interruption.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                onClick={() => {
                  setDepositForKeyId(k.id);
                  setShowDepositForm(true);
                }}
                data-ocid={`api.billing.low-balance-deposit-button.${k.id}`}
              >
                Deposit now
              </Button>
              <button
                type="button"
                aria-label="Dismiss alert"
                onClick={() =>
                  setDismissedAlerts((prev) => new Set([...prev, k.id]))
                }
                className="p-1 rounded hover:bg-amber-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                data-ocid={`api.billing.low-balance-dismiss.${k.id}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        ))}

      {/* ── Threshold setting row ─────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground"
        data-ocid="api.billing.threshold-settings"
      >
        <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <label
          htmlFor="billing-threshold-input"
          className="text-xs text-muted-foreground"
        >
          Alert me when balance drops below
        </label>
        <div className="flex items-center gap-1">
          <input
            id="billing-threshold-input"
            type="number"
            min="1"
            max="100"
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
            onBlur={() => {
              const n = Number.parseInt(thresholdInput, 10);
              if (!Number.isNaN(n) && n >= 1 && n <= 100) setThresholdPct(n);
              else setThresholdInput(String(thresholdPct));
            }}
            aria-label="Low balance threshold percentage"
            className="w-14 h-7 rounded border border-input bg-background px-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            data-ocid="api.billing.threshold-input"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
        <span className="text-muted-foreground/60">
          of monthly average spend
        </span>
        {avgMonthlySpend > 0n && (
          <span className="ml-auto text-[11px] text-muted-foreground/70">
            Avg. monthly spend:{" "}
            <span className="font-mono">
              {formatAmt(avgMonthlySpend, tokenDecimalsById(consumer.tokenId))}{" "}
              {tokenSymbolById(consumer.tokenId)}
            </span>
          </span>
        )}
      </div>

      {/* ── Balance cards ────────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        data-ocid="api.billing.balance-cards"
      >
        {keyCards.map((kc, idx) => {
          const sym = tokenSymbolById(kc.tokenId);
          const dec = tokenDecimalsById(kc.tokenId);
          const isLow = lowBalanceKeys.some((lk) => lk.id === kc.id);
          return (
            <Card
              key={kc.id}
              className={[
                "bg-card border",
                isLow ? "border-amber-500/40" : "border-border",
              ].join(" ")}
              data-ocid={`api.billing.key-balance-card.${idx + 1}`}
            >
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5" aria-hidden />
                    {kc.name}
                  </CardTitle>
                  <Badge
                    variant={kc.isActive ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {kc.isActive ? "Active" : "Revoked"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {sym} Balance
                  </p>
                  <p
                    className={[
                      "font-display font-bold text-2xl",
                      isLow
                        ? "text-amber-500 dark:text-amber-400"
                        : "text-gold",
                    ].join(" ")}
                    aria-label={`Balance: ${formatAmt(kc.balance, dec)} ${sym}`}
                  >
                    {formatAmt(kc.balance, dec)}
                    <span className="text-sm font-normal text-muted-foreground ml-1.5">
                      {sym}
                    </span>
                  </p>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    Spent:{" "}
                    <span className="font-mono text-foreground">
                      {formatAmt(consumer.totalSpent, dec)} {sym}
                    </span>
                  </span>
                  <span>
                    In:{" "}
                    <span className="font-mono text-foreground">
                      {formatAmt(consumer.totalDeposited, dec)} {sym}
                    </span>
                  </span>
                </div>
                <Button
                  size="sm"
                  className="w-full gap-1.5 bg-primary/90 hover:bg-primary text-primary-foreground"
                  onClick={() => {
                    setDepositForKeyId(kc.id);
                    setShowDepositForm(true);
                  }}
                  data-ocid={`api.billing.deposit-button.${idx + 1}`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Deposit
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Deposit form (inline, shown on demand) ──────────────────────────── */}
      {showDepositForm && (
        <Card
          className="bg-card border-border"
          data-ocid="api.billing.deposit-form"
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold tracking-wide flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" aria-hidden />
                {t("api.deposit")}
              </CardTitle>
              <button
                type="button"
                aria-label="Close deposit form"
                onClick={() => {
                  setShowDepositForm(false);
                  setDepositForKeyId(null);
                }}
                className="p-1 rounded hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-ocid="api.billing.deposit-form-close-button"
              >
                <X className="h-4 w-4 text-muted-foreground" aria-hidden />
              </button>
            </div>
            <CardDescription className="text-xs">
              Tokens are deducted per API call at DAO-configured rates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-md">
            {depositSuccess && (
              <div
                className="flex items-start gap-2 rounded border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary"
                role="alert"
                data-ocid="api.billing.deposit-success_state"
              >
                <Zap className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
                <span>Deposit confirmed. Balance updated.</span>
              </div>
            )}

            {/* Current balance */}
            <div className="flex items-center justify-between p-2.5 rounded-sm bg-muted/30 border border-border/50 text-xs">
              <span className="text-muted-foreground">Current Balance</span>
              <span className="font-mono font-semibold text-foreground">
                {formatAmt(consumer.balance, decimals)}{" "}
                <span className="text-muted-foreground font-normal">
                  {tokenSymbol}
                </span>
              </span>
            </div>

            {/* Token selector */}
            <div className="space-y-1.5">
              <Label htmlFor="deposit-token" className="text-xs font-medium">
                Payment Token
              </Label>
              {activeTokens.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No accepted tokens configured. Submit a DAO proposal.
                </p>
              ) : (
                <select
                  id="deposit-token"
                  value={selectedTokenId ?? ""}
                  onChange={(e) => setSelectedTokenId(Number(e.target.value))}
                  className="w-full h-9 rounded-sm border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  data-ocid="api.billing.token-select"
                >
                  {activeTokens.map((token) => (
                    <option key={token.id} value={token.id}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label
                htmlFor="billing-deposit-amount"
                className="text-xs font-medium"
              >
                Amount
              </Label>
              <Input
                id="billing-deposit-amount"
                type="number"
                min="0"
                step="0.0001"
                placeholder="e.g. 10.0000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono"
                aria-describedby="billing-deposit-amount-hint"
                data-ocid="api.billing.deposit-amount-input"
              />
              <p
                id="billing-deposit-amount-hint"
                className="text-[11px] text-muted-foreground"
              >
                {selectedToken
                  ? `Min: ${formatAmt(selectedToken.minDeposit, decimals)} ${tokenSymbol}`
                  : "Select a token"}
                {selectedToken?.symbol === "ICFC" && (
                  <span className="ml-2 text-foreground/60">
                    · ICFC balance: {formatAmt(icfcAmt, icfcDecimals)}
                  </span>
                )}
              </p>
              {belowMin && (
                <p
                  className="text-[11px] text-destructive"
                  role="alert"
                  data-ocid="api.billing.deposit-amount-field_error"
                >
                  Below minimum deposit of {formatAmt(minDeposit, decimals)}{" "}
                  {tokenSymbol}.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleDeposit}
                disabled={
                  depositing ||
                  !amountBigInt ||
                  belowMin ||
                  activeTokens.length === 0
                }
                aria-busy={depositing}
                data-ocid="api.billing.deposit-submit-button"
              >
                {depositing ? "Processing…" : t("api.deposit")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDepositForm(false);
                  setDepositForKeyId(null);
                }}
                data-ocid="api.billing.deposit-cancel-button"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Transaction history ──────────────────────────────────────────────── */}
      <Card
        className="bg-card border-border"
        data-ocid="api.billing.history-card"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-sm font-semibold tracking-wide flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" aria-hidden />
                Transaction History
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Deposits and API call deductions for this period.
              </CardDescription>
            </div>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Key selector */}
              <div>
                <label htmlFor="billing-key-filter" className="sr-only">
                  Filter by key
                </label>
                <select
                  id="billing-key-filter"
                  value={
                    selectedKeyFilter === "all" ? "all" : selectedKeyFilter
                  }
                  onChange={(e) => {
                    setPage(0);
                    setSelectedKeyFilter(
                      e.target.value === "all" ? "all" : Number(e.target.value),
                    );
                  }}
                  aria-label="Filter transactions by API key"
                  className="h-8 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  data-ocid="api.billing.key-filter-select"
                >
                  <option value="all">All Keys</option>
                  {allKeys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                  {allKeys.length === 0 && (
                    <option value={consumer.id}>API Key</option>
                  )}
                </select>
              </div>
              {/* Date range */}
              <div
                aria-label="Date range filter"
                className="flex gap-0.5 p-0.5 rounded-md bg-muted/40"
              >
                {BILLING_RANGE_OPTIONS.map(({ label }) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={billingRange === label}
                    onClick={() => {
                      setBillingRange(label);
                      setPage(0);
                    }}
                    aria-label={`Show transactions from last ${label}`}
                    className={[
                      "px-2.5 py-1 text-[11px] font-medium rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      billingRange === label
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                    data-ocid={`api.billing.range-filter-${label}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div
              className="space-y-2"
              aria-busy="true"
              data-ocid="api.billing.history-loading_state"
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : pagedRows.length === 0 ? (
            <div
              className="flex flex-col items-center py-10 text-center gap-2"
              data-ocid="api.billing.history-empty_state"
            >
              <Clock className="h-8 w-8 text-muted-foreground/30" aria-hidden />
              <p className="text-sm text-muted-foreground">
                No transactions found in this period.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-2">
                <table
                  className="w-full text-xs min-w-[640px]"
                  aria-label="Billing transaction history"
                >
                  <thead>
                    <tr className="border-b border-border">
                      <th
                        scope="col"
                        className="py-2 pl-2 pr-4 text-left font-semibold text-muted-foreground uppercase tracking-wide"
                      >
                        Date
                      </th>
                      <th
                        scope="col"
                        className="py-2 pr-4 text-left font-semibold text-muted-foreground uppercase tracking-wide"
                      >
                        Key Name
                      </th>
                      <th
                        scope="col"
                        className="py-2 pr-4 text-left font-semibold text-muted-foreground uppercase tracking-wide"
                      >
                        Type
                      </th>
                      <th
                        scope="col"
                        className="py-2 pr-4 text-left font-semibold text-muted-foreground uppercase tracking-wide"
                      >
                        Token
                      </th>
                      <th
                        scope="col"
                        className="py-2 pr-4 text-right font-semibold text-muted-foreground uppercase tracking-wide"
                      >
                        Amount
                      </th>
                      <th
                        scope="col"
                        className="py-2 pr-2 text-right font-semibold text-muted-foreground uppercase tracking-wide"
                      >
                        Balance After
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row, idx) => {
                      const isCredit = row.amount >= 0n;
                      const absAmt = row.amount < 0n ? -row.amount : row.amount;
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                          data-ocid={`api.billing.tx-item.${page * BILLING_PAGE_SIZE + idx + 1}`}
                        >
                          <td className="py-2.5 pl-2 pr-4 text-muted-foreground whitespace-nowrap">
                            {formatDateTime(row.date)}
                          </td>
                          <td className="py-2.5 pr-4 text-foreground max-w-[120px] truncate">
                            {row.keyName}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span
                              className={[
                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-medium",
                                row.type === "Deposit"
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : row.type === "API Call"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-muted/60 text-muted-foreground",
                              ].join(" ")}
                            >
                              {row.type === "Deposit" ? (
                                <ArrowDownLeft
                                  className="h-2.5 w-2.5"
                                  aria-hidden
                                />
                              ) : (
                                <ArrowUpRight
                                  className="h-2.5 w-2.5"
                                  aria-hidden
                                />
                              )}
                              {row.type}
                              {row.isBatch && (
                                <span className="ml-0.5 opacity-70">
                                  (batch)
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-muted-foreground">
                            {row.token}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-mono font-medium">
                            <span
                              className={
                                isCredit
                                  ? "text-emerald-500 dark:text-emerald-400"
                                  : "text-foreground"
                              }
                            >
                              {isCredit ? "+" : "−"}
                              {formatAmt(
                                absAmt,
                                tokenDecimalsById(consumer.tokenId),
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 pr-2 text-right font-mono text-muted-foreground">
                            {row.balanceAfter !== null
                              ? formatAmt(
                                  row.balanceAfter,
                                  tokenDecimalsById(consumer.tokenId),
                                )
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div
                  className="flex items-center justify-between pt-4 border-t border-border/40 mt-2"
                  aria-label="Transaction pagination"
                >
                  <p className="text-[11px] text-muted-foreground">
                    Showing {page * BILLING_PAGE_SIZE + 1}–
                    {Math.min((page + 1) * BILLING_PAGE_SIZE, txRows.length)} of{" "}
                    {txRows.length}
                    {hasMoreBackendPages && "+"}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      aria-label="Previous page"
                      className="h-7 w-7 p-0"
                      data-ocid="api.billing.pagination_prev"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <span className="text-xs text-muted-foreground px-2">
                      {page + 1} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      disabled={page >= totalPages - 1}
                      aria-label="Next page"
                      className="h-7 w-7 p-0"
                      data-ocid="api.billing.pagination_next"
                    >
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>
              )}

              {/* Load more from backend */}
              {hasMoreBackendPages && page >= totalPages - 1 && (
                <div className="pt-3 flex justify-center border-t border-border/40 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBackendPage((p) => p + 1);
                      setPage((p) => p + 1);
                    }}
                    disabled={historyLoading}
                    aria-busy={historyLoading}
                    data-ocid="api.billing.load-more-button"
                  >
                    {historyLoading ? (
                      <>
                        <RefreshCw
                          className="h-3.5 w-3.5 mr-1.5 animate-spin"
                          aria-hidden
                        />
                        Loading…
                      </>
                    ) : (
                      <>
                        <ChevronDown
                          className="h-3.5 w-3.5 mr-1.5"
                          aria-hidden
                        />
                        Load more
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab configuration ────────────────────────────────────────────────────────

const TABS: {
  id: DevPortalTab;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "overview", label: "Overview", icon: Layers },
  { id: "keys", label: "My Keys", icon: Key },
  { id: "analytics", label: "Usage Analytics", icon: BarChart3 },
  { id: "billing", label: "Billing", icon: Wallet },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export function APIPage() {
  const { identity, login } = useInternetIdentity();
  const isAuthenticated = !!identity;

  const [activeTab, setActiveTab] = useState<DevPortalTab>("overview");
  const tablistRef = useRef<HTMLDivElement>(null);

  const { data: consumer, isLoading: consumerLoading } = useAPIConsumer();
  const { data: packages = [], isLoading: packagesLoading } =
    useAPIPricePackages();
  const { data: tokens = [] } = useAPITokens();

  // WCAG: arrow key navigation on tablist
  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    id: DevPortalTab,
  ) => {
    const tabIds = TABS.map((t) => t.id);
    const idx = tabIds.indexOf(id);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = TABS[(idx + 1) % TABS.length];
      setActiveTab(next.id);
      tablistRef.current
        ?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)
        ?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = TABS[(idx - 1 + TABS.length) % TABS.length];
      setActiveTab(prev.id);
      tablistRef.current
        ?.querySelector<HTMLButtonElement>(`[data-tab="${prev.id}"]`)
        ?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveTab(TABS[0].id);
      tablistRef.current
        ?.querySelector<HTMLButtonElement>(`[data-tab="${TABS[0].id}"]`)
        ?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      const last = TABS[TABS.length - 1];
      setActiveTab(last.id);
      tablistRef.current
        ?.querySelector<HTMLButtonElement>(`[data-tab="${last.id}"]`)
        ?.focus();
    }
  };

  return (
    <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide text-foreground flex items-center gap-2">
            <Key className="h-6 w-6 text-primary" aria-hidden />
            Developer Portal
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pay-as-you-go football data API. All pricing governed by DAO
            proposals.
          </p>
        </div>
        {consumer && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-card border border-border">
            <div
              className={`h-2 w-2 rounded-full ${consumer.isActive ? "bg-primary" : "bg-destructive"}`}
              aria-hidden
            />
            <span className="text-xs font-medium text-foreground">
              {consumer.isActive ? "Active" : "Revoked"}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {maskKey(consumer.apiKey)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() =>
                void navigator.clipboard
                  .writeText(toHex(consumer.apiKey))
                  .then(() => toast.success("Copied"))
              }
              aria-label="Copy API key"
              data-ocid="api.header-copy-key-button"
            >
              <Copy className="h-3 w-3" aria-hidden />
            </Button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Developer portal tabs"
        className="flex overflow-x-auto border-b border-border gap-0 -mb-px"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`tabpanel-${id}`}
            id={`tab-${id}`}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => setActiveTab(id)}
            onKeyDown={(e) => handleTabKeyDown(e, id)}
            data-tab={id}
            className={[
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              activeTab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            ].join(" ")}
            data-ocid={`api.tab-${id}`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div>
        {TABS.map(({ id }) => (
          <div
            key={id}
            id={`tabpanel-${id}`}
            role="tabpanel"
            aria-labelledby={`tab-${id}`}
            hidden={activeTab !== id}
          >
            {activeTab === id && !isAuthenticated ? (
              <UnauthenticatedPrompt onConnect={() => void login()} />
            ) : activeTab === id && id === "overview" ? (
              <OverviewTab
                consumer={consumer}
                packages={packages}
                tokens={tokens}
                consumerLoading={consumerLoading}
                packagesLoading={packagesLoading}
              />
            ) : activeTab === id && id === "keys" ? (
              <MyKeysTab
                consumer={consumer}
                tokens={tokens}
                consumerLoading={consumerLoading}
                tokensEmpty={tokens.filter((t) => t.isActive).length === 0}
              />
            ) : activeTab === id && id === "analytics" ? (
              <UsageAnalyticsTab
                consumer={consumer}
                tokens={tokens}
                consumerLoading={consumerLoading}
              />
            ) : activeTab === id ? (
              <BillingTab
                consumer={consumer}
                tokens={tokens}
                consumerLoading={consumerLoading}
              />
            ) : null}
          </div>
        ))}
      </div>

      {/* Paid access note */}
      <p className="text-[11px] text-muted-foreground border-t border-border/50 pt-4 flex items-center gap-1.5">
        <AlertCircle
          className="inline h-3 w-3 text-muted-foreground/60"
          aria-hidden
        />
        All API calls require a valid key with sufficient balance. No
        unauthenticated or free-tier access is available.
      </p>
    </div>
  );
}
