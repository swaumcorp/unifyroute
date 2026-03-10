import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLogs, useLogStats, useProviders } from "@/lib/api"
import { ErrorState } from "@/components/error-state"
import { Activity, AlertTriangle, Zap, RefreshCw, ChevronDown, ChevronRight, Search } from "lucide-react"

function statusBadge(status: string) {
    const ok = status?.startsWith("success")
    return (
        <Badge variant={ok ? "default" : "destructive"} className={ok ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0" : ""}>
            {ok ? "success" : status || "error"}
        </Badge>
    )
}

function formatTs(ts: string) {
    try {
        const d = new Date(ts)
        return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" })
    } catch {
        return ts
    }
}

function LogRow({ log }: { log: any }) {
    const [expanded, setExpanded] = useState(false)
    const hasDetail = log.prompt_json || log.response_text

    return (
        <>
            <TableRow
                className={`${hasDetail ? "cursor-pointer hover:bg-muted/50" : ""} transition-colors`}
                onClick={() => hasDetail && setExpanded(e => !e)}
            >
                <TableCell className="w-6 text-muted-foreground">
                    {hasDetail
                        ? (expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)
                        : null}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{formatTs(log.created_at)}</TableCell>
                <TableCell className="text-sm font-medium">{log.provider}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground max-w-[160px] truncate" title={log.actual_model}>{log.actual_model}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate" title={log.model_alias}>{log.model_alias}</TableCell>
                <TableCell className="text-right font-mono text-xs">{(log.prompt_tokens ?? 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-xs">{(log.completion_tokens ?? 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-xs text-green-600">${Number(log.cost_usd ?? 0).toFixed(5)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{log.latency_ms != null ? `${log.latency_ms}ms` : "–"}</TableCell>
                <TableCell>{statusBadge(log.status)}</TableCell>
            </TableRow>
            {expanded && (
                <TableRow className="bg-muted/10">
                    <TableCell colSpan={10} className="py-3 px-6">
                        <div className="grid grid-cols-2 gap-4">
                            {log.prompt_json && (
                                <div>
                                    <div className="text-xs font-semibold text-muted-foreground mb-1">Prompt</div>
                                    <pre className="text-xs bg-muted/40 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words">
                                        {(() => {
                                            try {
                                                return JSON.stringify(JSON.parse(log.prompt_json), null, 2)
                                            } catch {
                                                return log.prompt_json
                                            }
                                        })()}
                                    </pre>
                                </div>
                            )}
                            {log.response_text && (
                                <div>
                                    <div className="text-xs font-semibold text-muted-foreground mb-1">Response</div>
                                    <pre className="text-xs bg-muted/40 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words">{log.response_text}</pre>
                                </div>
                            )}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    )
}

const PAGE_SIZE = 25

export function Logs() {
    const [page, setPage] = useState(1)
    const [provider, setProvider] = useState("all")
    const [status, setStatus] = useState("all")
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")

    // Debounce search input
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setSearch(val)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(val)
            setPage(1)
        }, 400)
    }, [])

    const { logs, total, isLoading, isError, mutate } = useLogs(
        page, PAGE_SIZE,
        provider !== "all" ? provider : undefined,
        status !== "all" ? status : undefined,
        undefined,
        debouncedSearch || undefined
    )
    const { stats, isLoading: statsLoading } = useLogStats(24)
    const { providers } = useProviders()

    // Auto-refresh every 30 seconds
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    useEffect(() => {
        intervalRef.current = setInterval(() => mutate(), 30000)
        return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }, [mutate])

    if (isError) return <ErrorState />

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    const providerList: string[] = Array.isArray(providers)
        ? Array.from(new Set(providers.map((p: any) => p.name))).sort()
        : []

    const statsItems = [
        {
            label: "Requests (24h)",
            value: statsLoading ? "…" : (stats?.total_requests ?? 0).toLocaleString(),
            icon: Activity,
            sub: `Error rate: ${stats?.error_rate_percent ?? 0}%`
        },
        {
            label: "Avg Latency",
            value: statsLoading ? "…" : `${stats?.avg_latency_ms ?? 0}ms`,
            icon: Zap,
            sub: "Last 24 hours"
        },
        {
            label: "Errors (24h)",
            value: statsLoading ? "…" : Math.round(((stats?.error_rate_percent ?? 0) / 100) * (stats?.total_requests ?? 0)).toLocaleString(),
            icon: AlertTriangle,
            sub: `${stats?.error_rate_percent ?? 0}% error rate`
        },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Sessions &amp; Logs</h2>
                    <p className="text-muted-foreground pt-1">Request history, token counts, costs, and response details.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => mutate()}>
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            {/* Stats cards */}
            <div className="grid gap-4 md:grid-cols-3">
                {statsItems.map(({ label, value, icon: Icon, sub }) => (
                    <Card key={label}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{label}</CardTitle>
                            <Icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{value}</div>
                            <p className="text-xs text-muted-foreground">{sub}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Logs table */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <CardTitle>Request Log</CardTitle>
                            <CardDescription className="mt-0.5">
                                {isLoading ? "Loading…" : `${total.toLocaleString()} total records`}
                                {total > 0 && ` · Page ${page} of ${totalPages}`}
                            </CardDescription>
                        </div>
                        {/* Filters */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search prompts…"
                                    className="pl-8 h-8 w-[180px] text-sm"
                                    value={search}
                                    onChange={handleSearchChange}
                                />
                            </div>
                            <Select value={provider} onValueChange={v => { setProvider(v); setPage(1) }}>
                                <SelectTrigger className="h-8 w-[130px] text-sm">
                                    <SelectValue placeholder="All Providers" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Providers</SelectItem>
                                    {providerList.map(p => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={status} onValueChange={v => { setStatus(v); setPage(1) }}>
                                <SelectTrigger className="h-8 w-[110px] text-sm">
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="success">Success</SelectItem>
                                    <SelectItem value="error">Error</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="rounded-b-lg border-t overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-6" />
                                    <TableHead>Time</TableHead>
                                    <TableHead>Provider</TableHead>
                                    <TableHead>Model</TableHead>
                                    <TableHead>Alias</TableHead>
                                    <TableHead className="text-right">Prompt Tokens</TableHead>
                                    <TableHead className="text-right">Completion Tokens</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                    <TableHead className="text-right">Latency</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                                            Loading logs…
                                        </TableCell>
                                    </TableRow>
                                ) : logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                                            No logs yet. Make some requests and they'll appear here.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log: any) => (
                                        <LogRow key={log.id} log={log} />
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-3 border-t text-sm text-muted-foreground">
                            <span>
                                Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
