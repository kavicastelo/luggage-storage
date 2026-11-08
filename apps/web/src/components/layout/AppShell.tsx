import React from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Luggage, LogOut, Shield } from "lucide-react";

export function AppShell() {
  const navigate = useNavigate();
  const { activeRole, setActiveRole } = useAppStore();
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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Navigation Header */}
      <header className="border-b bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-blue-600">
            <Luggage className="h-6 w-6" />
            <span>LuggageStorage</span>
          </Link>

          {/* Controls & Auth Section */}
          <div className="flex items-center gap-3">
            {/* Role switcher preview (Phase 1A foundation) */}
            <div className="hidden md:flex bg-slate-100 rounded-lg p-1 text-sm">
              <button
                onClick={() => setActiveRole("traveller")}
                className={`px-3 py-1 rounded-md font-medium transition ${
                  activeRole === "traveller" ? "bg-white shadow text-blue-600" : "text-slate-600"
                }`}
              >
                Traveller
              </button>
              <button
                onClick={() => setActiveRole("host")}
                className={`px-3 py-1 rounded-md font-medium transition ${
                  activeRole === "host" ? "bg-white shadow text-blue-600" : "text-slate-600"
                }`}
              >
                Host
              </button>
              <button
                onClick={() => setActiveRole("admin")}
                className={`px-3 py-1 rounded-md font-medium transition ${
                  activeRole === "admin" ? "bg-white shadow text-blue-600" : "text-slate-600"
                }`}
              >
                Admin
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

      {/* Footer */}
      <footer className="border-t bg-white py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          <p>© 2026 Global Luggage Storage Marketplace. Phase 1B Identity & Web Auth.</p>
        </div>
      </footer>
    </div>
  );
}
