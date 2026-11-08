import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Luggage, LogOut, Shield, Search, Briefcase, HelpCircle } from "lucide-react";

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeRole, setActiveRole } = useAppStore();
  const { user, isAuthenticated, isInitializing, logout, hasAnyPermission } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const handleRoleSwitch = (role: "traveller" | "host" | "admin") => {
    setActiveRole(role);
    if (role === "traveller") navigate("/");
    if (role === "host") navigate("/host/dashboard");
    if (role === "admin") navigate("/admin");
  };

  const hasAdminAccess =
    hasAnyPermission(["admin.user.read", "admin.role.read", "admin.audit.read"]) ||
    user?.roles?.includes("SUPERADMIN") ||
    user?.roles?.includes("SUPPORT");

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Navigation Header */}
      <header className="border-b bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-extrabold text-xl text-blue-600">
              <Luggage className="h-6 w-6" />
              <span>LuggageStorage</span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold text-slate-600">
              <Link
                to="/search"
                className={`px-3 py-1.5 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 ${
                  location.pathname.startsWith("/search") ? "text-blue-600 bg-blue-50" : ""
                }`}
              >
                <Search className="h-3.5 w-3.5" />
                <span>Find Storage (PW-002)</span>
              </Link>
              <Link
                to="/how-it-works"
                className={`px-3 py-1.5 rounded-lg hover:bg-slate-100 ${
                  location.pathname === "/how-it-works" ? "text-blue-600 bg-blue-50" : ""
                }`}
              >
                How It Works
              </Link>
              <Link
                to="/become-a-host"
                className={`px-3 py-1.5 rounded-lg hover:bg-slate-100 ${
                  location.pathname === "/become-a-host" ? "text-blue-600 bg-blue-50" : ""
                }`}
              >
                Become a Host
              </Link>
              <Link
                to="/portal/bookings"
                className={`px-3 py-1.5 rounded-lg hover:bg-slate-100 flex items-center gap-1 ${
                  location.pathname.startsWith("/portal") ? "text-blue-600 bg-blue-50" : ""
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                <span>My Bookings</span>
              </Link>
              <Link
                to="/help"
                className={`px-3 py-1.5 rounded-lg hover:bg-slate-100 flex items-center gap-1 ${
                  location.pathname === "/help" ? "text-blue-600 bg-blue-50" : ""
                }`}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Help</span>
              </Link>
            </nav>
          </div>

          {/* Controls & Auth Section */}
          <div className="flex items-center gap-3">
            {/* Surface Switcher: Public Web (PW) / Host Dashboard (HD) / Admin Dashboard (AD) */}
            <div className="hidden md:flex bg-slate-100 rounded-xl p-1 text-xs">
              <button
                onClick={() => handleRoleSwitch("traveller")}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  activeRole === "traveller" &&
                  !location.pathname.startsWith("/host") &&
                  !location.pathname.startsWith("/admin")
                    ? "bg-white shadow text-blue-600"
                    : "text-slate-600"
                }`}
              >
                Traveller Web (11)
              </button>
              <button
                onClick={() => handleRoleSwitch("host")}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  activeRole === "host" || location.pathname.startsWith("/host")
                    ? "bg-white shadow text-blue-600"
                    : "text-slate-600"
                }`}
              >
                Host Hub (14)
              </button>
              <button
                onClick={() => handleRoleSwitch("admin")}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  activeRole === "admin" || location.pathname.startsWith("/admin")
                    ? "bg-white shadow text-purple-700"
                    : "text-slate-600"
                }`}
              >
                Admin Hub (18)
              </button>
            </div>

            <Link
              to="/health"
              className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
            >
              Health
            </Link>

            {/* Authentication Navigation */}
            {!isInitializing && (
              <>
                {isAuthenticated && user ? (
                  <div className="flex items-center gap-2">
                    {hasAdminAccess && (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200">
                        <Shield className="h-3 w-3" />
                        Admin
                      </span>
                    )}

                    <Link
                      to="/profile"
                      className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600 font-medium px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition"
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                      <span className="hidden sm:inline max-w-[120px] truncate">
                        {user.displayName}
                      </span>
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
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
                      className="text-xs sm:text-sm px-3 py-1.5 text-slate-700 hover:text-blue-600 font-medium transition"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      className="text-xs sm:text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition"
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

      {/* Footer with Full Web Surface Directory */}
      <footer className="border-t bg-white py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
            <div className="space-y-2">
              <p className="font-bold text-slate-900 uppercase">Public Website (PW-001..011)</p>
              <div className="flex flex-col gap-1 text-slate-600">
                <Link to="/" className="hover:text-blue-600">PW-001 Landing Page</Link>
                <Link to="/search" className="hover:text-blue-600">PW-002 Search & Map</Link>
                <Link to="/locations/colombo-fort-railway-hub" className="hover:text-blue-600">PW-003 Location Detail</Link>
                <Link to="/checkout/loc-cmb-fort-01" className="hover:text-blue-600">PW-004 Web Checkout</Link>
                <Link to="/booking/confirm" className="hover:text-blue-600">PW-005 Confirmation Pass</Link>
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-bold text-slate-900 uppercase">Discovery & Legal</p>
              <div className="flex flex-col gap-1 text-slate-600">
                <Link to="/become-a-host" className="hover:text-blue-600">PW-006 Become a Host</Link>
                <Link to="/how-it-works" className="hover:text-blue-600">PW-007 How It Works</Link>
                <Link to="/help" className="hover:text-blue-600">PW-008 Help & FAQs</Link>
                <Link to="/contact" className="hover:text-blue-600">PW-009 Contact Us</Link>
                <Link to="/terms" className="hover:text-blue-600">PW-010 Terms & Privacy</Link>
                <Link to="/portal/bookings" className="hover:text-blue-600">PW-011 Traveller Portal</Link>
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-bold text-slate-900 uppercase">Host Dashboard (HD-001..014)</p>
              <div className="flex flex-col gap-1 text-slate-600">
                <Link to="/host/dashboard" className="hover:text-blue-600">HD-001 Host Overview</Link>
                <Link to="/host/locations" className="hover:text-blue-600">HD-002..006 Locations & Pricing</Link>
                <Link to="/host/bookings" className="hover:text-blue-600">HD-007..008 Bookings & Audit</Link>
                <Link to="/host/operations" className="hover:text-blue-600">HD-009 Check-In/Out Desk</Link>
                <Link to="/host/finance" className="hover:text-blue-600">HD-010..014 Finance & RBAC</Link>
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-bold text-slate-900 uppercase">Superadmin (AD-001..018)</p>
              <div className="flex flex-col gap-1 text-slate-600">
                <Link to="/admin" className="hover:text-purple-700">AD-001 Command Dashboard</Link>
                <Link to="/admin/hosts/review" className="hover:text-purple-700">AD-002..004 KYC & Moderation</Link>
                <Link to="/admin/bookings" className="hover:text-purple-700">AD-005..010 Ledger & Payouts</Link>
                <Link to="/admin/support" className="hover:text-purple-700">AD-011..014 Support & Disputes</Link>
                <Link to="/admin/audit" className="hover:text-purple-700">AD-015..018 Audit & Staff RBAC</Link>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
            <p>
              © 2026 Global Luggage Storage Marketplace. Phase 1B Identity & Phase 2 Complete
              Product UI/UX (43 Web Screens + 70 Mobile Screens).
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
