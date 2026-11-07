import React from "react";
import { Link, Outlet } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { Luggage } from "lucide-react";

export function AppShell() {
  const { activeRole, setActiveRole } = useAppStore();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Navigation Header */}
      <header className="border-b bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-blue-600">
            <Luggage className="h-6 w-6" />
            <span>LuggageStorage</span>
          </Link>

          {/* Role switcher preview (Phase 1A foundation) */}
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 rounded-lg p-1 text-sm">
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
              className="text-sm px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
            >
              System Health
            </Link>
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
          <p>© 2026 Global Luggage Storage Marketplace. Phase 1A Engineering Foundation.</p>
        </div>
      </footer>
    </div>
  );
}
