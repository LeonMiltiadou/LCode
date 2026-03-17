import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  ArrowDownIcon,
  InfoIcon,
  SearchIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import type { LogEntry, LogLevel } from "@t3tools/contracts";
import { serverLogsQueryOptions } from "../lib/serverReactQuery";
import { readNativeApi } from "../nativeApi";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SidebarInset } from "~/components/ui/sidebar";
import { isElectron } from "../env";

type LogLevelFilter = LogLevel | "all";

const LOG_LEVEL_CONFIG: Record<
  LogLevel,
  { label: string; icon: typeof InfoIcon; className: string; bgClassName: string }
> = {
  info: {
    label: "Info",
    icon: InfoIcon,
    className: "text-cyan-500",
    bgClassName: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  },
  warn: {
    label: "Warn",
    icon: AlertTriangleIcon,
    className: "text-yellow-500",
    bgClassName: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  },
  error: {
    label: "Error",
    icon: AlertCircleIcon,
    className: "text-red-500",
    bgClassName: "bg-red-500/10 text-red-500 border-red-500/20",
  },
  event: {
    label: "Event",
    icon: SparklesIcon,
    className: "text-purple-500",
    bgClassName: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  },
};

function formatLogTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  } catch {
    return iso;
  }
}

function formatContext(context: Record<string, unknown> | undefined): string | null {
  if (!context) return null;
  const entries = Object.entries(context).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return null;
  return entries
    .map(([k, v]) => {
      const formatted = typeof v === "string" ? v : JSON.stringify(v);
      return `${k}=${formatted}`;
    })
    .join(" ");
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const config = LOG_LEVEL_CONFIG[entry.level];
  const Icon = config.icon;
  const contextStr = formatContext(entry.context);

  return (
    <div className="group flex items-start gap-2 px-3 py-1 font-mono text-xs leading-5 hover:bg-accent/50 transition-colors">
      <span className="shrink-0 w-[85px] text-muted-foreground/60 tabular-nums">
        {formatLogTimestamp(entry.timestamp)}
      </span>
      <span className={`shrink-0 flex items-center gap-1 w-[52px] ${config.className}`}>
        <Icon className="size-3" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {config.label}
        </span>
      </span>
      <span className="shrink-0 text-muted-foreground/70">[{entry.scope}]</span>
      <span className="flex-1 min-w-0 text-foreground break-words">
        {entry.message}
        {contextStr ? (
          <span className="ml-1.5 text-muted-foreground/50">{contextStr}</span>
        ) : null}
      </span>
    </div>
  );
}

function LogsRouteView() {
  const logsQuery = useQuery(serverLogsQueryOptions());
  const [liveEntries, setLiveEntries] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LogLevelFilter>("all");
  const [scopeFilter, setScopeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollBottomRef = useRef<HTMLDivElement>(null);

  // Subscribe to live log events
  useEffect(() => {
    const api = readNativeApi();
    if (!api) return;

    const unsubscribe = api.logs.onLogEvent((entry) => {
      setLiveEntries((prev) => {
        const next = [...prev, entry];
        // Keep at most 2000 live entries to prevent memory issues
        if (next.length > 2000) {
          return next.slice(-1500);
        }
        return next;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll && scrollBottomRef.current) {
      scrollBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveEntries.length, autoScroll]);

  // Detect manual scroll to pause auto-scroll
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 40;
    setAutoScroll(isAtBottom);
  }, []);

  // Merge initial logs with live entries (dedupe by id)
  const allEntries = useMemo(() => {
    const initial = logsQuery.data ?? [];
    const seenIds = new Set(initial.map((e) => e.id));
    const uniqueLive = liveEntries.filter((e) => !seenIds.has(e.id));
    return [...initial, ...uniqueLive];
  }, [logsQuery.data, liveEntries]);

  // Apply filters
  const filteredEntries = useMemo(() => {
    return allEntries.filter((entry) => {
      if (levelFilter !== "all" && entry.level !== levelFilter) return false;
      if (scopeFilter && !entry.scope.toLowerCase().includes(scopeFilter.toLowerCase()))
        return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesMessage = entry.message.toLowerCase().includes(query);
        const matchesScope = entry.scope.toLowerCase().includes(query);
        const matchesContext = formatContext(entry.context)?.toLowerCase().includes(query);
        if (!matchesMessage && !matchesScope && !matchesContext) return false;
      }
      return true;
    });
  }, [allEntries, levelFilter, scopeFilter, searchQuery]);

  // Collect unique scopes for the scope filter
  const uniqueScopes = useMemo(() => {
    const scopes = new Set(allEntries.map((e) => e.scope));
    return Array.from(scopes).sort();
  }, [allEntries]);

  // Count by level for the filter badges
  const countsByLevel = useMemo(() => {
    const counts: Record<LogLevel, number> = { info: 0, warn: 0, error: 0, event: 0 };
    for (const entry of allEntries) {
      counts[entry.level]++;
    }
    return counts;
  }, [allEntries]);

  const clearLogs = useCallback(() => {
    setLiveEntries([]);
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setAutoScroll(true);
  }, []);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {/* Header */}
        {isElectron && (
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-5">
            <span className="text-xs font-medium tracking-wide text-muted-foreground/70">
              Logs
            </span>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          {/* Level filter buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                levelFilter === "all"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-accent"
              }`}
              onClick={() => setLevelFilter("all")}
            >
              All ({allEntries.length})
            </button>
            {(Object.keys(LOG_LEVEL_CONFIG) as LogLevel[]).map((level) => {
              const config = LOG_LEVEL_CONFIG[level];
              const count = countsByLevel[level];
              return (
                <button
                  key={level}
                  type="button"
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    levelFilter === level
                      ? config.bgClassName
                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                  }`}
                  onClick={() => setLevelFilter(levelFilter === level ? "all" : level)}
                >
                  {config.label} ({count})
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Scope filter */}
          {uniqueScopes.length > 0 && (
            <div className="relative">
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                className="h-6 appearance-none rounded-md border border-border bg-background px-2 pr-6 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="">All scopes</option>
                {uniqueScopes.map((scope) => (
                  <option key={scope} value={scope}>
                    {scope}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search */}
          <div className="relative ml-auto flex items-center">
            <SearchIcon className="absolute left-2 size-3 text-muted-foreground/50" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter logs..."
              className="h-6 w-48 pl-7 pr-7 text-[11px]"
              spellCheck={false}
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery("")}
              >
                <XIcon className="size-3" />
              </button>
            )}
          </div>

          {/* Actions */}
          <Button size="xs" variant="ghost" onClick={clearLogs} title="Clear live logs">
            <TrashIcon className="size-3" />
          </Button>
        </div>

        {/* Log entries */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          onScroll={handleScroll}
        >
          {filteredEntries.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {allEntries.length === 0 ? "No log entries yet." : "No logs match your filters."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  {allEntries.length === 0
                    ? "Logs will appear here as the server produces them."
                    : "Try adjusting the level, scope, or search filters."}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-1">
              {filteredEntries.map((entry) => (
                <LogEntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
          <div ref={scrollBottomRef} />
        </div>

        {/* Auto-scroll indicator */}
        {!autoScroll && (
          <div className="absolute bottom-4 right-4">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shadow-lg"
              onClick={scrollToBottom}
            >
              <ArrowDownIcon className="size-3" />
              <span className="text-xs">Scroll to bottom</span>
            </Button>
          </div>
        )}
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/logs")({
  component: LogsRouteView,
});
