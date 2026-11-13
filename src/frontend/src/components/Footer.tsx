import { ExternalLink, Shield } from "lucide-react";
import { SiGithub, SiX } from "react-icons/si";
import { useI18n } from "../i18n";
import type { Page } from "../types";

const ICFC_LEDGER = "ddsp7-7iaaa-aaaaq-aacqq-cai";
const YEAR = new Date().getFullYear();
const CAFFEINE_URL = `https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
  typeof window !== "undefined" ? window.location.hostname : "",
)}`;

interface FooterProps {
  onNavigate?: (page: Page) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const { t } = useI18n();

  const navLinks: { id: Page; label: string }[] = [
    { id: "home", label: t("nav.home") },
    { id: "proposals", label: t("nav.proposals") },
    { id: "governance", label: t("nav.governance") },
    { id: "forum", label: t("nav.forum") },
    { id: "api", label: t("nav.api") },
  ];

  return (
    <footer className="border-t border-border bg-card" aria-label="Site footer">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary/10 border border-primary/30">
                <Shield className="h-3.5 w-3.5 text-primary" aria-hidden />
              </div>
              <span className="font-display text-sm font-bold tracking-widest uppercase text-foreground">
                FootballHEIR
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
              The first fully on-chain, DAO-governed football database on the
              Internet Computer.
            </p>
            <div className="flex items-center gap-4 pt-1">
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-8 w-8 -ml-1 text-muted-foreground hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="FootballHEIR on X (Twitter)"
              >
                <SiX className="h-4 w-4" aria-hidden />
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-8 w-8 -ml-1 text-muted-foreground hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="FootballHEIR on GitHub"
              >
                <SiGithub className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <nav aria-label="Footer navigation">
            <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
              Navigate
            </h3>
            <ul className="space-y-1">
              {navLinks.map((item) => (
                <li key={item.id}>
                  {onNavigate ? (
                    <button
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 min-h-[36px] flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground py-1.5 flex items-center">
                      {item.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* On-chain info */}
          <div>
            <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
              On-Chain
            </h3>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                ICFC Ledger Canister
              </p>
              <a
                href={`https://dashboard.internetcomputer.org/canister/${ICFC_LEDGER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-mono text-[10px] text-primary/80 hover:text-primary transition-colors break-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                aria-label={`View ICFC ledger canister ${ICFC_LEDGER} on ICP Dashboard`}
              >
                {ICFC_LEDGER}
                <ExternalLink className="h-2.5 w-2.5 shrink-0" aria-hidden />
              </a>
              <p className="text-xs text-muted-foreground mt-3">
                Powered by Internet Computer
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px] text-muted-foreground">
          <p>
            © {YEAR}. Built with love using{" "}
            <a
              href={CAFFEINE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              caffeine.ai
            </a>
          </p>
          <p className="font-mono tracking-wide">
            ICFC DAO — Zero hard-coded data at genesis
          </p>
        </div>
      </div>
    </footer>
  );
}
