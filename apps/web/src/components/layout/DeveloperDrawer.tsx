import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import {
  WEB_PUBLIC_SCREENS,
  WEB_HOST_SCREENS,
  WEB_ADMIN_SCREENS,
} from "@/data/mock-marketplace";
import { Wrench, X, ExternalLink, Shield, Palette } from "lucide-react";


/**
 * Developer Diagnostics Drawer
 * Strictly restricted to Development Mode via import.meta.env.DEV.
 * In production builds, this component returns null and is tree-shaken away,
 * guaranteeing ZERO developer codes appear in the customer DOM.
 */
export function DeveloperDrawer() {
  // Production compile-time boundary: completely suppressed in production
  if (!import.meta.env.DEV) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"pw" | "hd" | "ad" | "foundation">("pw");
  const location = useLocation();
  const navigate = useNavigate();
  const { activeRole, setActiveRole } = useAppStore();

  const handleRoleChange = (role: "traveller" | "host" | "admin") => {
    setActiveRole(role);
    if (role === "traveller") navigate("/");
    if (role === "host") navigate("/host/dashboard");
    if (role === "admin") navigate("/admin");
  };

  return (
    <aside
      aria-label="Developer Diagnostics"
      className="fixed bottom-4 right-4 z-50 select-none font-sans"
      data-testid="developer-diagnostics-drawer"
    >
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-navy-900 text-white rounded-full shadow-lg border border-navy-700 hover:bg-navy-800 transition-all text-xs font-semibold"
          title="Open Developer Diagnostics Drawer"
        >
          <Wrench className="w-3.5 h-3.5 text-terracotta-400" />
          <span>Dev Tools</span>
          <span className="px-1.5 py-0.2 bg-terracotta-500 text-white rounded text-[10px]">
            DEV
          </span>
        </button>
      ) : (
        <div className="w-96 max-h-[80vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-sand-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-navy-950 text-white border-b border-navy-800">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-terracotta-400" />
              <div>
                <h2 className="text-xs font-bold leading-none">Developer Diagnostics</h2>
                <p className="text-[10px] text-sand-400 mt-0.5">DEV-ONLY INSPECTION DRAWER</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-sand-400 hover:text-white hover:bg-navy-800 transition"
              aria-label="Close Developer Diagnostics Drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Role & Foundation Quick Links */}
          <div className="p-3 bg-sand-50 border-b border-sand-200 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-navy-900">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-terracotta-500" /> Active Role Simulation
              </span>
              <div className="flex gap-1">
                {(["traveller", "host", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRoleChange(r)}
                    className={`px-2 py-0.5 rounded capitalize text-[10px] font-bold ${
                      activeRole === r
                        ? "bg-navy-900 text-white"
                        : "bg-sand-200/80 text-navy-900 hover:bg-sand-300"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-1">
              <Link
                to="/dev/foundation-preview"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between px-2.5 py-1.5 bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-800 rounded-lg border border-terracotta-200 text-xs font-semibold transition"
              >
                <span className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-terracotta-600" /> CWCP Foundation Preview
                </span>
                <ExternalLink className="w-3 h-3 text-terracotta-600" />
              </Link>
            </div>
          </div>

          {/* Screen Tabs */}
          <div className="flex border-b border-sand-200 bg-sand-100/50 text-[11px] font-semibold text-sand-700">
            <button
              onClick={() => setActiveTab("pw")}
              className={`flex-1 py-2 text-center border-b-2 transition ${
                activeTab === "pw"
                  ? "border-terracotta-500 text-navy-950 bg-white font-bold"
                  : "border-transparent hover:text-navy-950"
              }`}
            >
              Public Web (11)
            </button>
            <button
              onClick={() => setActiveTab("hd")}
              className={`flex-1 py-2 text-center border-b-2 transition ${
                activeTab === "hd"
                  ? "border-terracotta-500 text-navy-950 bg-white font-bold"
                  : "border-transparent hover:text-navy-950"
              }`}
            >
              Host Hub (14)
            </button>
            <button
              onClick={() => setActiveTab("ad")}
              className={`flex-1 py-2 text-center border-b-2 transition ${
                activeTab === "ad"
                  ? "border-terracotta-500 text-navy-950 bg-white font-bold"
                  : "border-transparent hover:text-navy-950"
              }`}
            >
              Admin Hub (18)
            </button>
          </div>

          {/* Screen List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-60 text-xs">
            {activeTab === "pw" &&
              WEB_PUBLIC_SCREENS.map((s) => (
                <Link
                  key={s.id}
                  to={s.route}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition ${
                    location.pathname === s.route
                      ? "bg-terracotta-100/70 text-terracotta-900 font-semibold"
                      : "hover:bg-sand-100 text-navy-900"
                  }`}
                >
                  <span className="truncate pr-2">{s.name}</span>
                  <span className="font-mono text-[10px] text-sand-500 bg-sand-200/50 px-1 py-0.5 rounded flex-shrink-0">
                    {s.id}
                  </span>
                </Link>
              ))}

            {activeTab === "hd" &&
              WEB_HOST_SCREENS.map((s) => (
                <Link
                  key={s.id}
                  to={s.route}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition ${
                    location.pathname === s.route
                      ? "bg-terracotta-100/70 text-terracotta-900 font-semibold"
                      : "hover:bg-sand-100 text-navy-900"
                  }`}
                >
                  <span className="truncate pr-2">{s.name}</span>
                  <span className="font-mono text-[10px] text-sand-500 bg-sand-200/50 px-1 py-0.5 rounded flex-shrink-0">
                    {s.id}
                  </span>
                </Link>
              ))}

            {activeTab === "ad" &&
              WEB_ADMIN_SCREENS.map((s) => (
                <Link
                  key={s.id}
                  to={s.route}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition ${
                    location.pathname === s.route
                      ? "bg-purple-100 text-purple-900 font-semibold"
                      : "hover:bg-sand-100 text-navy-900"
                  }`}
                >
                  <span className="truncate pr-2">{s.name}</span>
                  <span className="font-mono text-[10px] text-sand-500 bg-sand-200/50 px-1 py-0.5 rounded flex-shrink-0">
                    {s.id}
                  </span>
                </Link>
              ))}
          </div>

          {/* Footer Notice */}
          <div className="p-2 bg-sand-100 border-t border-sand-200 text-center">
            <p className="text-[10px] text-sand-600">
              Guarded by <code className="font-mono text-terracotta-700">import.meta.env.DEV</code>. Excluded from production customer DOM.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
