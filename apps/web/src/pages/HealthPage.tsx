import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { Activity, RefreshCw } from "lucide-react";

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
}

export function HealthPage() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => fetchApi<HealthData>("/health"),
    refetchInterval: 10000
  });

  return (
    <Card className="max-w-xl mx-auto my-8 bg-white p-6 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-terracotta-50 text-terracotta-600 border border-terracotta-200">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-navy-950">
              System Health &amp; API Connectivity
            </h1>
            <p className="text-xs text-sand-700">Live platform service heartbeat</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          isLoading={isFetching}
          onClick={() => void refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3 py-4">
          <LoadingSkeleton variant="text" className="w-1/2" />
          <LoadingSkeleton className="h-24 w-full" />
        </div>
      )}

      {error && (
        <Alert variant="danger" title="Service Unreachable">
          <div className="space-y-2">
            <p className="text-sm">{(error as Error).message}</p>
            {import.meta.env.DEV && (
              <p className="text-xs text-rose-700">
                Ensure apps/api is running at http://localhost:3000
              </p>
            )}
            <div className="pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {data && (
        <div className="space-y-4">
          <Alert variant="success">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">
                {import.meta.env.DEV
                  ? "Fastify Modular Monolith Connected"
                  : "API Service Connected"}
              </span>
              <Badge variant="success" size="sm">
                Healthy
              </Badge>
            </div>
          </Alert>

          <div className="text-sm space-y-2 bg-sand-50 border border-sand-200 p-4 rounded-xl font-mono text-navy-950">
            <p>
              <span className="text-sand-700">API Status:</span> {data.data.status}
            </p>
            <p>
              <span className="text-sand-700">Server Time:</span> {data.data.timestamp}
            </p>
            <p>
              <span className="text-sand-700">Uptime:</span> {data.data.uptime.toFixed(1)}s
            </p>
            {import.meta.env.DEV && data.meta?.correlationId && (
              <p>
                <span className="text-sand-700">Correlation ID:</span> {data.meta.correlationId}
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
