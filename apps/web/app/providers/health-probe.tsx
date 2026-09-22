"use client";

import { useQuery } from "@tanstack/react-query";

interface HealthPayload {
  status: string;
  uptime: number;
  timestamp: string;
}

/**
 * Small demonstration that the QueryClientProvider is real: queries the API
 * health endpoint. Endpoint is dev-local (api runs on :3001); the probe shows
 * an offline state instead of crashing when the api is not running.
 */
export function HealthProbe() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("http://127.0.0.1:3001/health");
      if (!res.ok) {
        throw new Error(`health check failed with status ${res.status}`);
      }
      return (await res.json()) as HealthPayload;
    },
    retry: false,
  });

  if (isPending) {
    return <span className="text-zinc-400">checking api…</span>;
  }

  if (isError) {
    return <span className="text-amber-600">api offline</span>;
  }

  return <span className="text-emerald-600">api {data.status}</span>;
}