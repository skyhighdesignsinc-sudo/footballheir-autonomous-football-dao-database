import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { useMemo, useState } from "react";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { ProfileSetupModal } from "./components/ProfileSetupModal";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useCallerProfile } from "./hooks/useQueries";
import { I18nContext, useI18nState } from "./i18n";
import type { Page } from "./types";

import { APIPage } from "./pages/APIPage";
import { DocsPage } from "./pages/DocsPage";
import { ForumPage } from "./pages/ForumPage";
import { GovernancePage } from "./pages/GovernancePage";
// Lazy-load pages
import { HomePage } from "./pages/HomePage";
import { ProposalsPage } from "./pages/ProposalsPage";

function AppInner() {
  const { identity } = useInternetIdentity();
  const isAuthenticated = !!identity;
  const [currentPage, setCurrentPage] = useState<Page>("home");

  const {
    data: userProfile,
    isLoading: profileLoading,
    isFetched,
  } = useCallerProfile();
  const showProfileSetup =
    isAuthenticated && !profileLoading && isFetched && !userProfile?.name;

  const i18n = useI18nState();

  return (
    <I18nContext.Provider value={i18n}>
      {/* Skip-to-main-content link — visually hidden, visible on focus */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <Header currentPage={currentPage} onNavigate={setCurrentPage} />

        <main
          className="flex-1"
          id="main-content"
          tabIndex={-1}
          aria-label="Main content"
        >
          {currentPage === "home" && (
            <HomePage onNavigate={(page) => setCurrentPage(page as Page)} />
          )}
          {currentPage === "proposals" && <ProposalsPage />}
          {currentPage === "governance" && <GovernancePage />}
          {currentPage === "forum" && <ForumPage />}
          {currentPage === "api" && <APIPage />}
          {currentPage === "docs" && <DocsPage />}
        </main>

        <Footer onNavigate={setCurrentPage} />

        {showProfileSetup && <ProfileSetupModal />}
        <Toaster richColors closeButton />
      </div>
    </I18nContext.Provider>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AppInner />
    </ThemeProvider>
  );
}
