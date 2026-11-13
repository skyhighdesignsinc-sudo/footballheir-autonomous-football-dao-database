import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Menu, Moon, Shield, Sun, X, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useCallerICFCBalance, useCallerProfile } from "../hooks/useQueries";
import { useI18n } from "../i18n";
import type { Locale, Page } from "../types";

interface HeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const LOCALE_LABELS: Record<Locale, string> = { en: "EN", es: "ES", vi: "VI" };

function formatICFC(balance: bigint): string {
  const val = Number(balance) / 1e8;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(val < 10 ? 2 : 0);
}

export function Header({ currentPage, onNavigate }: HeaderProps) {
  const { login, clear, loginStatus, identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const { data: userProfile } = useCallerProfile();
  const { data: icfcBalance } = useCallerICFCBalance();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAuthenticated = !!identity;
  const isLoggingIn = loginStatus === "logging-in";

  const handleAuth = async () => {
    if (isAuthenticated) {
      await clear();
      queryClient.clear();
    } else {
      try {
        await login();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        if (msg === "User is already authenticated") {
          await clear();
          setTimeout(() => login(), 300);
        }
      }
    }
  };

  const navItems: { id: Page; label: string }[] = [
    { id: "home", label: t("nav.home") },
    { id: "proposals", label: t("nav.proposals") },
    { id: "governance", label: t("nav.governance") },
    { id: "forum", label: t("nav.forum") },
    { id: "api", label: t("nav.api") },
    { id: "docs", label: t("nav.docs") },
  ];

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {navItems.map((item) => {
        const isActive = currentPage === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onNavigate(item.id);
              if (mobile) setMobileOpen(false);
            }}
            data-ocid={`nav-${item.id}`}
            aria-label={`Navigate to ${item.label}`}
            aria-current={isActive ? "page" : undefined}
            className={[
              "relative text-sm font-medium tracking-wide transition-colors duration-150 rounded-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              mobile
                ? "w-full text-left py-3 px-4 min-h-[44px] flex items-center"
                : "px-3 py-1.5",
              isActive
                ? mobile
                  ? "text-primary bg-primary/10"
                  : "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-primary"
                : "text-muted-foreground hover:text-foreground",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {item.label}
          </button>
        );
      })}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Logo */}
          <button
            type="button"
            onClick={() => onNavigate("home")}
            aria-label="FootballHEIR – go to home"
            className="flex items-center gap-2.5 shrink-0 hover:opacity-85 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background rounded-sm"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary/10 border border-primary/30">
              <Shield className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="font-display text-sm font-bold tracking-widest text-foreground uppercase">
                FootballHEIR
              </span>
              <span className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase">
                Autonomous DAO
              </span>
            </div>
          </button>

          {/* Center nav — desktop */}
          <nav
            className="hidden md:flex items-center gap-0.5"
            aria-label="Main navigation"
          >
            <NavLinks />
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* ICFC balance badge — hidden below md, shown in mobile menu */}
            {isAuthenticated && icfcBalance !== undefined && (
              <Badge
                variant="outline"
                className="hidden md:flex items-center gap-1 font-mono text-xs border-primary/30 text-primary px-2 py-0.5"
                data-ocid="header-icfc-balance"
                aria-label={`ICFC balance: ${formatICFC(icfcBalance)}`}
              >
                <Zap className="h-3 w-3" aria-hidden />
                {formatICFC(icfcBalance)}&nbsp;ICFC
              </Badge>
            )}

            {/* User name pill */}
            {isAuthenticated && userProfile?.name && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-secondary/50 text-xs font-medium">
                <div
                  className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
                  aria-hidden
                />
                <span className="max-w-[100px] truncate min-w-0">
                  {userProfile.name}
                </span>
              </div>
            )}

            {/* Locale selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex items-center gap-1 h-8 px-2 font-mono text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  aria-label={`Language: ${LOCALE_LABELS[locale]}. Click to change`}
                  data-ocid="header-locale-selector"
                >
                  {LOCALE_LABELS[locale]}
                  <ChevronDown className="h-3 w-3" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[80px]">
                {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
                  <DropdownMenuItem
                    key={loc}
                    onClick={() => setLocale(loc)}
                    className={`font-mono text-xs ${locale === loc ? "text-primary" : ""}`}
                    data-ocid={`locale-${loc}`}
                  >
                    {LOCALE_LABELS[loc]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              data-ocid="header-theme-toggle"
            >
              {theme === "dark" ? (
                <Sun className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Moon className="h-3.5 w-3.5" aria-hidden />
              )}
            </Button>

            {/* Connect / Disconnect — hidden on mobile (shown in drawer) */}
            <Button
              onClick={handleAuth}
              disabled={isLoggingIn}
              size="sm"
              variant={isAuthenticated ? "outline" : "default"}
              className="hidden sm:flex h-8 px-3 text-xs font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              data-ocid="header-auth-btn"
              aria-label={
                isAuthenticated ? t("auth.disconnect") : t("auth.connect")
              }
            >
              {isLoggingIn
                ? t("auth.connecting")
                : isAuthenticated
                  ? t("auth.disconnect")
                  : t("auth.connect")}
            </Button>

            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  aria-label="Open navigation menu"
                  aria-expanded={mobileOpen}
                  aria-controls="mobile-nav-drawer"
                  data-ocid="header-mobile-menu"
                >
                  <Menu className="h-4 w-4" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent
                id="mobile-nav-drawer"
                side="right"
                className="w-72 bg-card border-border p-0"
              >
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="flex flex-col h-full">
                  {/* Drawer header */}
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary/10 border border-primary/30">
                        <Shield
                          className="h-3.5 w-3.5 text-primary"
                          aria-hidden
                        />
                      </div>
                      <span className="font-display text-sm font-bold tracking-widest uppercase">
                        FootballHEIR
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => setMobileOpen(false)}
                      aria-label="Close navigation menu"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>

                  {/* ICFC balance in mobile menu */}
                  {isAuthenticated && icfcBalance !== undefined && (
                    <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
                      <div
                        className="flex items-center gap-2 font-mono text-sm text-primary"
                        aria-label={`ICFC balance: ${formatICFC(icfcBalance)}`}
                      >
                        <Zap className="h-4 w-4" aria-hidden />
                        <span className="font-semibold">
                          {formatICFC(icfcBalance)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ICFC
                        </span>
                      </div>
                      {userProfile?.name && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {userProfile.name}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Nav links */}
                  <nav
                    className="flex flex-col py-2 flex-1"
                    aria-label="Mobile navigation"
                  >
                    <NavLinks mobile />
                  </nav>

                  {/* Footer actions */}
                  <div className="p-4 border-t border-border space-y-3">
                    {/* Auth button */}
                    <Button
                      onClick={() => {
                        handleAuth();
                        setMobileOpen(false);
                      }}
                      disabled={isLoggingIn}
                      size="default"
                      variant={isAuthenticated ? "outline" : "default"}
                      className="w-full text-sm min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                      data-ocid="mobile-auth-btn"
                      aria-label={
                        isAuthenticated
                          ? t("auth.disconnect")
                          : t("auth.connect")
                      }
                    >
                      {isLoggingIn
                        ? t("auth.connecting")
                        : isAuthenticated
                          ? t("auth.disconnect")
                          : t("auth.connect")}
                    </Button>

                    {/* Language selector */}
                    <div
                      className="flex items-center gap-1"
                      aria-label="Select language"
                    >
                      <span className="text-xs text-muted-foreground font-mono mr-1">
                        Lang:
                      </span>
                      {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
                        <button
                          type="button"
                          key={loc}
                          onClick={() => setLocale(loc)}
                          aria-label={`Switch language to ${loc}`}
                          aria-pressed={locale === loc}
                          className={`font-mono text-xs px-3 py-2 min-h-[44px] min-w-[44px] rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            locale === loc
                              ? "text-primary bg-primary/10"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          data-ocid={`mobile-locale-${loc}`}
                        >
                          {LOCALE_LABELS[loc]}
                        </button>
                      ))}

                      {/* Mobile theme toggle */}
                      <button
                        type="button"
                        onClick={() =>
                          setTheme(theme === "dark" ? "light" : "dark")
                        }
                        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                        className="ml-auto flex items-center justify-center h-11 w-11 rounded-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {theme === "dark" ? (
                          <Sun className="h-4 w-4" aria-hidden />
                        ) : (
                          <Moon className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
