import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { DeveloperDrawer } from "./DeveloperDrawer";
import {
  Luggage,
  LogOut,
  Shield,
  Search,
  Briefcase,
  HelpCircle,
  User,
  Menu,
  X,
  Compass,
  Building2
} from "lucide-react";

/**
 * Main Application Shell
 * Strictly sanitized of internal developer tracking codes in normal customer views.
 * Developer diagnostics are encapsulated in the DEV-only DeveloperDrawer.
 */
export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isInitializing, logout, hasAnyPermission } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate("/", { replace: true });
  };

  const hasHostAccess =
    isAuthenticated &&
    Boolean(
      user?.roles?.some((role) =>
        ["HOST_OWNER", "HOST_STAFF", "SUPERADMIN"].includes(role)
      )
    );

  const hasAdminAccess =
    hasAnyPermission([
      "admin.user.read",
      "admin.role.read",
      "admin.audit.read",
      "admin.booking.read",
      "admin.host.read"
    ]) ||
    user?.roles?.includes("SUPERADMIN") ||
    user?.roles?.includes("SUPPORT");

  const adminEntryRoute = user?.roles?.includes("SUPERADMIN") ? "/admin" : "/admin/bookings";

  const isFindStorageActive = location.pathname.startsWith("/search");
  const isHowItWorksActive = location.pathname === "/how-it-works";
  const isBecomeHostActive = location.pathname === "/become-a-host";
  const isBookingsActive = location.pathname.startsWith("/portal");
  const isHelpActive = location.pathname === "/help";

  return (
    <div className="min-h-screen flex flex-col bg-sand-50 text-navy-950 font-sans">
      {/* Navigation Header */}
      <header className="border-b border-sand-200 bg-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-6 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
              aria-label="Open navigation menu"
              className="lg:hidden min-h-[44px] min-w-[44px] flex-shrink-0 inline-flex items-center justify-center rounded-xl border border-sand-200 text-navy-900 hover:bg-sand-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <Link
              to="/"
              className="flex items-center gap-2 font-extrabold text-base sm:text-xl text-navy-900 hover:text-terracotta-600 transition-colors min-h-[44px] min-w-0"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-terracotta-500 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                <Luggage className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="tracking-tight truncate">LuggageStorage</span>
            </Link>

            <nav
              aria-label="Primary navigation"
              className="hidden lg:flex items-center gap-1 text-sm font-semibold text-sand-700"
            >
              <Link
                to="/search"
                aria-current={isFindStorageActive ? "page" : undefined}
                className={`px-3 py-2 rounded-lg hover:bg-sand-100 hover:text-navy-900 flex items-center gap-1.5 transition-colors min-h-[44px] whitespace-nowrap ${
                  isFindStorageActive ? "text-terracotta-600 bg-terracotta-50" : ""
                }`}
              >
                <Search className="h-4 w-4" />
                <span>Find Storage</span>
              </Link>
              <Link
                to="/how-it-works"
                aria-current={isHowItWorksActive ? "page" : undefined}
                className={`px-3 py-2 rounded-lg hover:bg-sand-100 hover:text-navy-900 flex items-center transition-colors min-h-[44px] whitespace-nowrap ${
                  isHowItWorksActive ? "text-terracotta-600 bg-terracotta-50" : ""
                }`}
              >
                How It Works
              </Link>
              <Link
                to="/become-a-host"
                aria-current={isBecomeHostActive ? "page" : undefined}
                className={`px-3 py-2 rounded-lg hover:bg-sand-100 hover:text-navy-900 flex items-center transition-colors min-h-[44px] whitespace-nowrap ${
                  isBecomeHostActive ? "text-terracotta-600 bg-terracotta-50" : ""
                }`}
              >
                Become a Host
              </Link>
              <Link
                to="/portal/bookings"
                aria-current={isBookingsActive ? "page" : undefined}
                className={`px-3 py-2 rounded-lg hover:bg-sand-100 hover:text-navy-900 flex items-center gap-1.5 transition-colors min-h-[44px] whitespace-nowrap ${
                  isBookingsActive ? "text-terracotta-600 bg-terracotta-50" : ""
                }`}
              >
                <Briefcase className="h-4 w-4" />
                <span>My Bookings</span>
              </Link>
              <Link
                to="/help"
                aria-current={isHelpActive ? "page" : undefined}
                className={`px-3 py-2 rounded-lg hover:bg-sand-100 hover:text-navy-900 flex items-center gap-1.5 transition-colors min-h-[44px] whitespace-nowrap ${
                  isHelpActive ? "text-terracotta-600 bg-terracotta-50" : ""
                }`}
              >
                <HelpCircle className="h-4 w-4" />
                <span>Help</span>
              </Link>
            </nav>
          </div>

          {/* Controls & Auth Section */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Role-aware Host CTA */}
            {hasHostAccess ? (
              <Link
                to="/host/dashboard"
                aria-current={location.pathname.startsWith("/host") ? "page" : undefined}
                className="hidden sm:inline-flex items-center min-h-[44px] text-xs font-semibold px-3 py-2 rounded-lg border border-sand-200 text-navy-900 hover:bg-sand-100 transition-colors whitespace-nowrap"
              >
                Host Portal
              </Link>
            ) : (
              <Link
                to="/become-a-host"
                className="hidden sm:inline-flex items-center min-h-[44px] text-xs font-semibold px-3 py-2 rounded-lg border border-sand-200 text-navy-900 hover:bg-sand-100 transition-colors whitespace-nowrap"
              >
                Become a Host
              </Link>
            )}

            {/* Authentication Navigation */}
            {!isInitializing && (
              <>
                {isAuthenticated && user ? (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {hasAdminAccess && (
                      <Link
                        to={adminEntryRoute}
                        aria-current={location.pathname.startsWith("/admin") ? "page" : undefined}
                        className="hidden sm:inline-flex items-center gap-1 min-h-[44px] px-2.5 py-1.5 rounded-lg bg-navy-50 text-navy-800 text-xs font-semibold border border-navy-200 hover:bg-navy-100 transition whitespace-nowrap"
                      >
                        <Shield className="h-3.5 w-3.5 text-navy-600" />
                        Admin
                      </Link>
                    )}

                    <Link
                      to="/profile"
                      aria-current={location.pathname === "/profile" ? "page" : undefined}
                      className="flex items-center gap-2 text-sm text-navy-900 hover:text-terracotta-600 font-medium px-2.5 py-1.5 rounded-lg hover:bg-sand-100 transition-colors min-h-[44px]"
                    >
                      <div className="w-8 h-8 rounded-full bg-sand-200 text-navy-900 flex items-center justify-center font-bold text-xs shrink-0">
                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                      </div>
                      <span className="hidden sm:inline max-w-[120px] truncate">
                        {user.displayName}
                      </span>
                    </Link>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-sand-700 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Sign Out"
                      aria-label="Sign Out"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <Link
                      to="/login"
                      aria-current={location.pathname === "/login" ? "page" : undefined}
                      className="text-xs sm:text-sm px-2.5 sm:px-3.5 py-2 text-navy-900 hover:text-terracotta-600 hover:bg-sand-100 rounded-lg font-semibold transition-colors min-h-[44px] inline-flex items-center whitespace-nowrap"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      aria-current={location.pathname === "/register" ? "page" : undefined}
                      className="hidden sm:inline-flex text-xs sm:text-sm px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 text-white font-semibold rounded-lg shadow-sm transition-colors min-h-[44px] items-center whitespace-nowrap"
                    >
                      Register
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Responsive Mobile & Tablet Navigation Drawer (<lg) */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-drawer"
          className="lg:hidden fixed inset-0 z-50 flex bg-navy-950/60 backdrop-blur-[2px] animate-cwcp-fade"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMobileMenuOpen(false);
            }
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation menu"
            className="w-80 max-w-[85vw] h-full bg-white border-r border-sand-200 shadow-2xl flex flex-col"
          >
            <div className="px-5 h-16 border-b border-sand-200 bg-sand-50/80 flex items-center justify-between">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 font-extrabold text-lg text-navy-950"
              >
                <div className="w-8 h-8 rounded-lg bg-terracotta-500 text-white flex items-center justify-center">
                  <Luggage className="h-4 w-4" />
                </div>
                <span>LuggageStorage</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-sand-700 hover:text-navy-950 hover:bg-sand-200/70 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto p-4 space-y-1.5">
              <Link
                to="/search"
                aria-current={isFindStorageActive ? "page" : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors ${
                  isFindStorageActive
                    ? "bg-terracotta-50 text-terracotta-700 border border-terracotta-200"
                    : "text-navy-900 hover:bg-sand-100"
                }`}
              >
                <Search className="h-4 w-4 shrink-0" />
                <span>Find Storage</span>
              </Link>
              <Link
                to="/how-it-works"
                aria-current={isHowItWorksActive ? "page" : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors ${
                  isHowItWorksActive
                    ? "bg-terracotta-50 text-terracotta-700 border border-terracotta-200"
                    : "text-navy-900 hover:bg-sand-100"
                }`}
              >
                <Compass className="h-4 w-4 shrink-0" />
                <span>How It Works</span>
              </Link>
              <Link
                to="/become-a-host"
                aria-current={isBecomeHostActive ? "page" : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors ${
                  isBecomeHostActive
                    ? "bg-terracotta-50 text-terracotta-700 border border-terracotta-200"
                    : "text-navy-900 hover:bg-sand-100"
                }`}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span>Become a Host</span>
              </Link>
              <Link
                to="/portal/bookings"
                aria-current={isBookingsActive ? "page" : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors ${
                  isBookingsActive
                    ? "bg-terracotta-50 text-terracotta-700 border border-terracotta-200"
                    : "text-navy-900 hover:bg-sand-100"
                }`}
              >
                <Briefcase className="h-4 w-4 shrink-0" />
                <span>My Bookings</span>
              </Link>
              <Link
                to="/help"
                aria-current={isHelpActive ? "page" : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors ${
                  isHelpActive
                    ? "bg-terracotta-50 text-terracotta-700 border border-terracotta-200"
                    : "text-navy-900 hover:bg-sand-100"
                }`}
              >
                <HelpCircle className="h-4 w-4 shrink-0" />
                <span>Help</span>
              </Link>

              {(hasHostAccess || hasAdminAccess) && (
                <div className="pt-3 mt-3 border-t border-sand-200 space-y-1.5">
                  <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-sand-600">
                    Operations Workspaces
                  </p>
                  {hasHostAccess && (
                    <Link
                      to="/host/dashboard"
                      aria-current={location.pathname.startsWith("/host") ? "page" : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                      className="min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 text-navy-900 bg-sand-100 hover:bg-sand-200 transition-colors"
                    >
                      <Building2 className="h-4 w-4 text-terracotta-600 shrink-0" />
                      <span>Host Portal</span>
                    </Link>
                  )}
                  {hasAdminAccess && (
                    <Link
                      to={adminEntryRoute}
                      aria-current={location.pathname.startsWith("/admin") ? "page" : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                      className="min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 text-navy-900 bg-navy-50 hover:bg-navy-100 transition-colors"
                    >
                      <Shield className="h-4 w-4 text-navy-700 shrink-0" />
                      <span>Admin</span>
                    </Link>
                  )}
                </div>
              )}
            </nav>

            {!isInitializing && (
              <div className="p-4 border-t border-sand-200 bg-sand-50/70 space-y-2">
                {isAuthenticated && user ? (
                  <>
                    <Link
                      to="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="min-h-[44px] w-full px-3.5 py-2 rounded-xl border border-sand-200 bg-white text-sm font-semibold text-navy-900 hover:bg-sand-100 flex items-center gap-2.5"
                    >
                      <User className="h-4 w-4 text-terracotta-600 shrink-0" />
                      <span className="truncate">{user.displayName || "My Profile"}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="min-h-[44px] w-full px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 hover:bg-rose-100 flex items-center justify-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="min-h-[44px] px-3 py-2 rounded-xl border border-sand-300 bg-white text-sm font-semibold text-navy-900 hover:bg-sand-100 inline-flex items-center justify-center whitespace-nowrap"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-sm font-semibold inline-flex items-center justify-center whitespace-nowrap"
                    >
                      Register
                    </Link>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Outlet />
      </main>

      {/* Clean Production Footer */}
      <footer className="border-t border-sand-200 bg-white py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm">
            <div className="space-y-3">
              <p className="font-bold text-navy-900 text-xs uppercase tracking-wider">Luggage Storage</p>
              <div className="flex flex-col gap-2 text-sand-700">
                <Link to="/" className="hover:text-terracotta-600 transition">Find Safe Storage</Link>
                <Link to="/search" className="hover:text-terracotta-600 transition">City &amp; Station Map</Link>
                <Link to="/how-it-works" className="hover:text-terracotta-600 transition">How It Works</Link>
                <Link to="/portal/bookings" className="hover:text-terracotta-600 transition">Manage Bookings</Link>
              </div>
            </div>
            <div className="space-y-3">
              <p className="font-bold text-navy-900 text-xs uppercase tracking-wider">Partners</p>
              <div className="flex flex-col gap-2 text-sand-700">
                <Link to="/become-a-host" className="hover:text-terracotta-600 transition">Become a Storage Host</Link>
                <Link to="/host/dashboard" className="hover:text-terracotta-600 transition">Host Dashboard</Link>
                <Link to="/how-it-works" className="hover:text-terracotta-600 transition">Host Guarantee</Link>
              </div>
            </div>
            <div className="space-y-3">
              <p className="font-bold text-navy-900 text-xs uppercase tracking-wider">Support</p>
              <div className="flex flex-col gap-2 text-sand-700">
                <Link to="/help" className="hover:text-terracotta-600 transition">Help Center &amp; FAQs</Link>
                <Link to="/contact" className="hover:text-terracotta-600 transition">Contact Customer Care</Link>
                <Link to="/health" className="hover:text-terracotta-600 transition">System Status</Link>
              </div>
            </div>
            <div className="space-y-3">
              <p className="font-bold text-navy-900 text-xs uppercase tracking-wider">Company &amp; Legal</p>
              <div className="flex flex-col gap-2 text-sand-700">
                <Link to="/terms" className="hover:text-terracotta-600 transition">Terms of Service</Link>
                <Link to="/terms" className="hover:text-terracotta-600 transition">Privacy Policy</Link>
                <Link to="/terms" className="hover:text-terracotta-600 transition">Luggage Protection Policy</Link>
              </div>
            </div>
          </div>

          <div className="border-t border-sand-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-sand-600">
            <p>© 2026 LuggageStorage Sri Lanka. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link to="/terms" className="hover:text-navy-900 transition">Privacy</Link>
              <Link to="/terms" className="hover:text-navy-900 transition">Terms</Link>
              <Link to="/help" className="hover:text-navy-900 transition">Security</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Developer Diagnostics Drawer (DEV ONLY — compiled away in production) */}
      <DeveloperDrawer />
    </div>
  );
}
