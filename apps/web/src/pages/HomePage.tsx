import React from "react";
import { useAppStore } from "@/store/useAppStore";
import { ShieldCheck, Zap, Globe, Clock } from "lucide-react";

export function HomePage() {
  const { activeRole } = useAppStore();

  return (
    <div className="space-y-12">
      <div className="text-center space-y-4 max-w-3xl mx-auto pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
          <Zap className="h-4 w-4" />
          <span>Phase 1A Engineering Baseline</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
          Global Luggage Storage Marketplace
        </h1>
        <p className="text-lg text-slate-600">
          Active Surface Mode: <span className="font-semibold text-blue-600 capitalize">{activeRole}</span>. 
          Foundational shell supporting future Traveller discovery, Host fleet management, and Superadmin operations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
          <ShieldCheck className="h-8 w-8 text-blue-600" />
          <h3 className="font-bold text-lg">Decoupled Custody</h3>
          <p className="text-sm text-slate-600">
            Physical luggage release is strictly independent of financial disputes. Zero possessory lien.
          </p>
        </div>

        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
          <Clock className="h-8 w-8 text-blue-600" />
          <h3 className="font-bold text-lg">Atomic Concurrency</h3>
          <p className="text-sm text-slate-600">
            Multi-stage capacity holds (15m Host SLA, 10m Payment SLA) serialized on parent capacity pools.
          </p>
        </div>

        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
          <Globe className="h-8 w-8 text-blue-600" />
          <h3 className="font-bold text-lg">Global Data Standards</h3>
          <p className="text-sm text-slate-600">
            Exact integer minor-unit money arithmetic, dynamic exponents, PostGIS geospatial indexing.
          </p>
        </div>
      </div>
    </div>
  );
}
