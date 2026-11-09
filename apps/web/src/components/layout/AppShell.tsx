import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { DeveloperDrawer } from "./DeveloperDrawer";
import { Luggage, LogOut, Shield, Search, Briefcase, HelpCircle, User } from "lucide-react";

/**
 * Main Application Shell
 * Strictly sanitized of internal developer tracking codes in normal customer views.
 * Developer diagnostics are encapsulated in the DEV-only DeveloperDrawer.
 */
export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isInitializing, logout, hasAnyPermission } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const hasAdminAccess =
    hasAnyPermission(["admin.user.read", "admin.role.read", "admin.audit.read"]) ||
    user?.roles?.includes("SUPERADMIN") ||
    user?.roles?.includes("SUPPORT");

  return (
    <div className="min-h-screen flex flex-col bg-sand-50 text-navy-950 font-sans">
      {/* Navigation Header */}
      <header className="border-b border-sand-200 bg-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 font-extrabold text-xl text-navy-900 hover:text-terracotta-600 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-terracotta-500 text-white flex items-center justify-center shadow-sm">
                <Luggage className="h-5 w-5" />
              </div>
              <span className="tracking-tight">LuggageStorage</span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1 text-sm font-semibold text-sand-700">
              <Link
                to="/search"
                className={`px-3 py-2 rounded-lg hover:bg-sand-100 hover:text-navy-900 flex items-center gap-1.5 transition-colors ${
                  location.pathname.startsWith("/search") ? "text-terracotta-600 bg-terracotta-50" : ""
                }`}
              >
                <Search className="h-4 w-4" />
                <span>Find Storage</span>
              </Link>
              <Link
                to="/how-it-works"
                className={`px-3 py-2 rounded-lg hover:bg-sand-100 hover:text-navy-900 transition-colors ${
                  location.pathname === "/how-it-works" ? "text-terracotta-600 bg-terracotta-50" : ""
                }`}
              >
                How It Works
              </Link>
              <Link
                to="/become-a-host"
                className={`px-3 py-2 rounded-lg hover:bg-sand-100 hover:text-navy-900 transition-colors ${
                  location.pathname === "/become-a-host" ? "text-terracotta-600 bg-terracotta-50" : ""
                }`}
              >
                Become a Host
              </Link>
              <Link
                to="/portal/bookings"
                className={`px-3 py-2 rounded-lg hover:bg-sand-100 hover:text-navy-900 flex items-center gap-1.5 transition-colors ${
                  location.pathname.startsWith("/portal") ? "text-terracotta-600 bg-terracotta-50" : ""
                }`}
              >
                <Briefcase className="h-4 w-4" />
                <span>My Bookings</span>
              </Link>
              <Link
                to="/help"
                className={`px-3 py-2 rounded-lg hover:bg-sand-100 hover:text-navy-900 flex items-center gap-1.5 transition-colors ${
                  location.pathname === "/help" ? "text-terracotta-600 bg-terracotta-50" : ""
                }`}
              >
                <HelpCircle className="h-4 w-4" />
                <span>Help</span>
              </Link>
            </nav>
          </div>

          {/* Controls & Auth Section */}
          <div className="flex items-center gap-3">
            {/* Direct Link to Host Hub if user is host */}
            <Link
              to="/host/dashboard"
              className="hidden sm:inline-flex text-xs font-semibold px-3 py-1.5 rounded-lg border border-sand-200 text-navy-900 hover:bg-sand-100 transition-colors"
            >
              Host Portal
            </Link>

            {/* Authentication Navigation */}
            {!isInitializing && (
              <>
                {isAuthenticated && user ? (
                  <div className="flex items-center gap-2">
                    {hasAdminAccess && (
                      <Link
                        to="/admin"
                        className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-navy-50 text-navy-800 text-xs font-semibold border border-navy-200 hover:bg-navy-100 transition"
                      >
                        <Shield className="h-3 w-3 text-navy-600" />
                        Admin
                      </Link>
                    )}

                    <Link
                      to="/profile"
                      className="flex items-center gap-2 text-sm text-navy-900 hover:text-terracotta-600 font-medium px-2.5 py-1.5 rounded-lg hover:bg-sand-100 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-sand-200 text-navy-900 flex items-center justify-center font-bold text-xs">
                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                      </div>
                      <span className="hidden sm:inline max-w-[120px] truncate">
                        {user.displayName}
                      </span>
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="p-2 text-sand-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Sign Out"
                      aria-label="Sign Out"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      to="/login"
                      className="text-xs sm:text-sm px-3.5 py-2 text-navy-900 hover:text-terracotta-600 font-medium transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      className="text-xs sm:text-sm px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 text-white font-semibold rounded-lg shadow-sm transition-colors min-h-[38px] flex items-center"
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
                <Link to="/search" className="hover:text-terracotta-600 transition">City & Station Map</Link>
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
                <Link to="/help" className="hover:text-terracotta-600 transition">Help Center & FAQs</Link>
                <Link to="/contact" className="hover:text-terracotta-600 transition">Contact Customer Care</Link>
                <Link to="/health" className="hover:text-terracotta-600 transition">System Status</Link>
              </div>
            </div>
            <div className="space-y-3">
              <p className="font-bold text-navy-900 text-xs uppercase tracking-wider">Company & Legal</p>
              <div className="flex flex-col gap-2 text-sand-700">
                <Link to="/terms" className="hover:text-terracotta-600 transition">Terms of Service</Link>
                <Link to="/terms" className="hover:text-terracotta-600 transition">Privacy Policy</Link>
                <Link to="/terms" className="hover:text-terracotta-600 transition">Luggage Protection Policy</Link>
              </div>
            </div>
          </div>

          <div className="border-t border-sand-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-sand-600">
            <p>© 2026 Global Luggage Storage Marketplace. All rights reserved.</p>
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
