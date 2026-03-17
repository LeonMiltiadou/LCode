import { queryOptions } from "@tanstack/react-query";
import { ensureNativeApi } from "~/nativeApi";

export const serverQueryKeys = {
  all: ["server"] as const,
  config: () => ["server", "config"] as const,
  logs: () => ["server", "logs"] as const,
};

export function serverConfigQueryOptions() {
  return queryOptions({
    queryKey: serverQueryKeys.config(),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.server.getConfig();
    },
    staleTime: Infinity,
  });
}

export function serverLogsQueryOptions() {
  return queryOptions({
    queryKey: serverQueryKeys.logs(),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.logs.getRecentLogs();
    },
    staleTime: 0,
  });
}
