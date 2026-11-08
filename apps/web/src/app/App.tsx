import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PublicOnlyRoute } from "@/components/auth/PublicOnlyRoute";

import { HealthPage } from "@/pages/HealthPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { SecurityPage } from "@/pages/SecurityPage";
import { SessionsPage } from "@/pages/SessionsPage";
import { ForbiddenPage } from "@/pages/ForbiddenPage";

import {
  PublicLandingPage,
  WebSearchDiscoveryPage,
  LocationProfileDetailPage,
  WebCheckoutSchedulePage,
  WebPaymentConfirmationPage,
  BecomeAHostLandingPage,
  HowItWorksPage,
  HelpCentreFaqPage,
  ContactUsPage,
  TermsPrivacyLegalPage,
  TravellerWebPortalPage
} from "@/pages/PublicMarketplacePages";

import {
  HostDashboardLayout,
  HostOverviewDashboardPage,
  HostLocationManagementPage,
  HostLocationProfileEditorPage,
  HostScheduleCalendarEditorPage,
  HostCapacityPoolsZonesPage,
  HostPricingRulesMultipliersPage,
  HostBookingManagementHubPage,
  HostWebCheckInOutOperationsPage,
  HostFinancialRevenueLedgerPage,
  HostPayoutAccountsHistoryPage,
  HostReviewManagementPage,
  HostStaffManagementRbacPage,
  HostBusinessProfileLegalPage
} from "@/pages/HostDashboardPages";

import {
  AdminDashboardLayout,
  AdminCommandDashboardPage,
  AdminHostVerificationQueuePage,
  AdminHostDirectoryManagementPage,
  AdminStorageLocationModerationPage,
  AdminGlobalBookingsLedgerPage,
  AdminPaymentTransactionsLogPage,
  AdminRefundManagementQueuePage,
  AdminHostPayoutBatchGenerationPage,
  AdminManualPayoutDisbursementPage,
  AdminDoubleEntryFinancialLedgerPage,
  AdminSupportTicketTriageQueuePage,
  AdminSupportTicketResolutionViewPage,
  AdminIncidentDisputeInvestigationPage,
  AdminReviewModerationQueuePage,
  AdminPromotionMarketingEnginePage,
  AdminPlatformSystemConfigurationPage,
  AdminSecurityComplianceAuditLogPage,
  AdminStaffRbacManagementPage
} from "@/pages/AdminDashboardPages";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

function AppRoutes() {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        {/* PW-001 through PW-011: Public Traveller Website Surface (11 Active Screens) */}
        <Route index element={<PublicLandingPage />} />
        <Route path="search" element={<WebSearchDiscoveryPage />} />
        <Route path="locations/:slug" element={<LocationProfileDetailPage />} />
        <Route path="checkout/:locId" element={<WebCheckoutSchedulePage />} />
        <Route path="booking/confirm" element={<WebPaymentConfirmationPage />} />
        <Route path="become-a-host" element={<BecomeAHostLandingPage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="help" element={<HelpCentreFaqPage />} />
        <Route path="contact" element={<ContactUsPage />} />
        <Route path="terms" element={<TermsPrivacyLegalPage />} />
        <Route path="portal/bookings" element={<TravellerWebPortalPage />} />

        {/* HD-001 through HD-014: Host Web Dashboard Surface (14 Active Screens) */}
        <Route
          element={
            <ProtectedRoute
              requiredRoles={["HOST_OWNER", "HOST_STAFF", "SUPERADMIN"]}
              allowDemoPreview={true}
            />
          }
        >
          <Route path="host" element={<HostDashboardLayout />}>
            <Route index element={<HostOverviewDashboardPage />} />
            <Route path="dashboard" element={<HostOverviewDashboardPage />} />
            <Route path="locations" element={<HostLocationManagementPage />} />
            <Route path="locations/:id" element={<HostLocationProfileEditorPage />} />
            <Route path="locations/:id/schedule" element={<HostScheduleCalendarEditorPage />} />
            <Route path="locations/:id/capacity" element={<HostCapacityPoolsZonesPage />} />
            <Route path="locations/:id/pricing" element={<HostPricingRulesMultipliersPage />} />
            <Route path="bookings" element={<HostBookingManagementHubPage />} />
            <Route path="operations" element={<HostWebCheckInOutOperationsPage />} />
            <Route path="finance" element={<HostFinancialRevenueLedgerPage />} />
            <Route path="payouts" element={<HostPayoutAccountsHistoryPage />} />
            <Route path="reviews" element={<HostReviewManagementPage />} />
            <Route path="staff" element={<HostStaffManagementRbacPage />} />
            <Route path="settings" element={<HostBusinessProfileLegalPage />} />
          </Route>
        </Route>

        {/* AD-001 through AD-018: Superadmin Web Dashboard Surface (18 Active Screens) */}
        <Route
          element={
            <ProtectedRoute
              requiredRoles={["SUPERADMIN", "SUPPORT"]}
              allowDemoPreview={true}
            />
          }
        >
          <Route path="admin" element={<AdminDashboardLayout />}>
            <Route index element={<AdminCommandDashboardPage />} />
            <Route path="hosts/review" element={<AdminHostVerificationQueuePage />} />
            <Route path="hosts" element={<AdminHostDirectoryManagementPage />} />
            <Route path="locations" element={<AdminStorageLocationModerationPage />} />
            <Route path="bookings" element={<AdminGlobalBookingsLedgerPage />} />
            <Route path="payments" element={<AdminPaymentTransactionsLogPage />} />
            <Route path="refunds" element={<AdminRefundManagementQueuePage />} />
            <Route path="payouts/batches" element={<AdminHostPayoutBatchGenerationPage />} />
            <Route path="payouts/disburse" element={<AdminManualPayoutDisbursementPage />} />
            <Route path="finance/ledger" element={<AdminDoubleEntryFinancialLedgerPage />} />
            <Route path="support" element={<AdminSupportTicketTriageQueuePage />} />
            <Route path="support/:id" element={<AdminSupportTicketResolutionViewPage />} />
            <Route path="incidents" element={<AdminIncidentDisputeInvestigationPage />} />
            <Route path="reviews" element={<AdminReviewModerationQueuePage />} />
            <Route path="promotions" element={<AdminPromotionMarketingEnginePage />} />
            <Route path="settings" element={<AdminPlatformSystemConfigurationPage />} />
            <Route path="audit" element={<AdminSecurityComplianceAuditLogPage />} />
            <Route path="staff" element={<AdminStaffRbacManagementPage />} />
          </Route>
        </Route>

        {/* System Health Check & Self-Service Email Verification */}
        <Route path="health" element={<HealthPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />

        {/* Public-only routes (redirects authenticated users away) */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* Protected authenticated routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings/security" element={<SecurityPage />} />
          <Route path="settings/sessions" element={<SessionsPage />} />
        </Route>

        {/* Error & Not Found routes */}
        <Route path="forbidden" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
