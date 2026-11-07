import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { Activity, CheckCircle2, XCircle } from "lucide-react";

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
}

export function HealthPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => fetchApi<HealthData>("/health"),
    refetchInterval: 10000
  });

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center gap-3 border-b pb-4">
        <Activity className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold">System Health & API Connectivity</h2>
      </div>

      {isLoading && (
        <div className="text-center py-8 text-slate-500 animate-pulse">
          Connecting to Fastify Backend API...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700">
          <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Backend Unreachable</p>
            <p className="text-sm">{(error as Error).message}</p>
            <p className="text-xs text-red-500 mt-2">
              Ensure apps/api is running at http://localhost:3000
            </p>
          </div>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-700 font-semibold bg-green-50 p-3 rounded-lg border border-green-200">
            <CheckCircle2 className="h-5 w-5" />
            <span>Fastify Modular Monolith Connected</span>
          </div>

          <div className="text-sm space-y-2 bg-slate-50 p-4 rounded-lg font-mono">
            <p><span className="text-slate-500">API Status:</span> {data.data.status}</p>
            <p><span className="text-slate-500">Server Time:</span> {data.data.timestamp}</p>
            <p><span className="text-slate-500">Uptime:</span> {data.data.uptime.toFixed(1)}s</p>
            {data.meta?.correlationId && (
              <p><span className="text-slate-500">Correlation ID:</span> {data.meta.correlationId}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
