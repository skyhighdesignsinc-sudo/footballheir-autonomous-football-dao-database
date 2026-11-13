import { Badge } from "@/components/ui/badge";
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
import { Lock, Shield, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { UserProfile } from "../backend";
import { useCallerICFCBalance, useSaveProfile } from "../hooks/useQueries";
import { useI18n } from "../i18n";
import type { Locale } from "../types";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  vi: "Tiếng Việt",
};

export function ProfileSetupModal() {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [preferredLocale, setPreferredLocale] = useState<Locale>("en");
  const { mutateAsync: saveProfile, isPending } = useSaveProfile();
  const { data: icfcBalance } = useCallerICFCBalance();
  const { t } = useI18n();

  const isHolder = icfcBalance !== undefined && icfcBalance >= 100_000_000n; // ≥1 ICFC (8 decimals)
  const accessLevel = isHolder ? t("profile.holder") : t("profile.readonly");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      toast.error("Display name is required");
      return;
    }
    if (displayName.length > 32) {
      toast.error("Display name must be ≤ 32 characters");
      return;
    }

    const profile: UserProfile = {
      name: displayName.trim().slice(0, 32),
      icfcBalance: icfcBalance ?? 0n,
      lastBalanceCheck: BigInt(Date.now()) * 1_000_000n,
    };

    try {
      await saveProfile(profile);
      localStorage.setItem("footballheir_locale", preferredLocale);
      toast.success("Profile created — welcome to FootballHEIR!");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create profile",
      );
    }
  };

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-md bg-card border-border"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        aria-modal
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary/10 border border-primary/30">
              <Shield className="h-4.5 w-4.5 text-primary" aria-hidden />
            </div>
            <DialogTitle className="font-display tracking-wide text-lg">
              {t("profile.setup")}
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            Set up your FootballHEIR identity to start participating in the DAO.
          </DialogDescription>
        </DialogHeader>

        {/* Balance & access level */}
        <div className="flex items-center gap-3 py-3 px-3 rounded-sm bg-secondary/30 border border-border">
          <Zap className="h-4 w-4 text-primary shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              {t("balance.icfc")} balance
            </p>
            <p className="font-mono text-sm text-foreground">
              {icfcBalance !== undefined
                ? `${(Number(icfcBalance) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 4 })} ICFC`
                : "—"}
            </p>
          </div>
          <Badge
            variant={isHolder ? "default" : "secondary"}
            className="flex items-center gap-1 text-[10px] shrink-0"
          >
            {isHolder ? (
              <Zap className="h-2.5 w-2.5" aria-hidden />
            ) : (
              <Lock className="h-2.5 w-2.5" aria-hidden />
            )}
            {accessLevel}
          </Badge>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2" noValidate>
          <div className="space-y-1.5">
            <Label
              htmlFor="profile-display-name"
              className="text-xs font-medium tracking-wide"
            >
              {t("profile.displayName")}{" "}
              <span className="text-muted-foreground font-normal">
                (max 32 chars)
              </span>
            </Label>
            <Input
              id="profile-display-name"
              placeholder="e.g. MatchAnalyst7"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 32))}
              maxLength={32}
              autoFocus
              autoComplete="off"
              data-ocid="profile-name-input"
              aria-required
              aria-label={t("profile.displayName")}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {displayName.length}/32
            </p>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="profile-bio"
              className="text-xs font-medium tracking-wide"
            >
              {t("profile.bio")}{" "}
              <span className="text-muted-foreground font-normal">
                (optional, max 128 chars)
              </span>
            </Label>
            <Textarea
              id="profile-bio"
              placeholder="Briefly describe yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 128))}
              maxLength={128}
              rows={2}
              className="resize-none text-sm"
              data-ocid="profile-bio-input"
              aria-label={t("profile.bio")}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {bio.length}/128
            </p>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="profile-language"
              className="text-xs font-medium tracking-wide"
            >
              {t("profile.language")}
            </Label>
            <Select
              value={preferredLocale}
              onValueChange={(v) => setPreferredLocale(v as Locale)}
            >
              <SelectTrigger
                id="profile-language"
                data-ocid="profile-locale-select"
                aria-label={t("profile.language")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(
                  ([loc, label]) => (
                    <SelectItem key={loc} value={loc}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            className="w-full mt-2"
            disabled={isPending || !displayName.trim()}
            data-ocid="profile-save-btn"
          >
            {isPending ? "Creating..." : t("common.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
