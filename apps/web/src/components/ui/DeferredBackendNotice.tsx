import React from "react";
import { Info, ShieldCheck, Clock } from "lucide-react";

export interface ScreenHeaderBadgeProps {
  screenId: string;
  title: string;
  subtitle?: string;
  workflows?: string[];
  roleScope?: string;
  backendStatus?: "LIVE_PHASE_1B" | "HYBRID_PREVIEW" | "UI_SIMULATION";
  rightSlot?: React.ReactNode;
}

export function ScreenHeaderBadge({
  screenId,
  title,
  subtitle,
  workflows = [],
  roleScope,
  backendStatus = "UI_SIMULATION",
  rightSlot
}: ScreenHeaderBadgeProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm mb-6"
      data-screen-id={screenId}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-900 text-white">
              {screenId}
            </span>
            {roleScope && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                {roleScope}
              </span>
            )}
            {workflows.map((wf) => (
              <span
                key={wf}
                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-600"
              >
                {wf}
              </span>
            ))}
            {backendStatus === "LIVE_PHASE_1B" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live Phase 1B API
              </span>
            )}
            {backendStatus === "HYBRID_PREVIEW" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Clock className="h-3 w-3" />
                Live RBAC + Domain Preview
              </span>
            )}
            {backendStatus === "UI_SIMULATION" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <Info className="h-3 w-3" />
                Demo Simulation • Interactive UI Preview (Domain API Phase 3+)
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm sm:text-base text-slate-600 mt-1">{subtitle}</p>}
        </div>
        {rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
      </div>
    </div>
  );
}

export interface DeferredBackendNoticeProps {
  featureName: string;
  targetPhase?: string;
  description?: string;
}

export function DeferredBackendNotice({
  featureName,
  targetPhase = "Phase 3–6 Domain Backend",
  description
}: DeferredBackendNoticeProps) {
  return (
    <div className="rounded-xl bg-amber-50/90 border border-amber-200 p-4 flex items-start gap-3 text-amber-900 text-xs sm:text-sm">
      <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold">
          {featureName} — Demo Simulation ({targetPhase})
        </p>
        <p className="text-amber-800/90 mt-0.5">
          {description ||
            "Demo Simulation only: state transitions on this screen operate against typed local preview state. No live financial, payment gateway, or custody database mutation is persisted prior to domain backend activation."}
        </p>
      </div>
    </div>
  );
}

