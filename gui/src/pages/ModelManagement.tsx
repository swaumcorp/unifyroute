import { useState, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    PackageCheck, Search, Plus, Trash2, RefreshCw, Brain, Sparkles,
    CheckCircle2, XCircle, ChevronRight, Loader2, AlertCircle, Server
} from "lucide-react"
import { useModels, useProviders, updateModel, deleteModel } from "@/lib/api"
import { ErrorState } from "@/components/error-state"

// ── Tier badge ────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<string, { label: string; className: string }> = {
    lite: { label: "Lite", className: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 border-sky-200 dark:border-sky-500/30" },
    base: { label: "Base", className: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 border-violet-200 dark:border-violet-500/30" },
    thinking: { label: "Thinking", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30" },
    "": { label: "Unassigned", className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700" },
}

function TierBadge({ tier }: { tier: string }) {
    const cfg = TIER_CONFIG[tier ?? ""] ?? TIER_CONFIG[""]
    return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
            {cfg.label}
        </span>
    )
}

// ── Tier priority for heuristic ranking ──────────────────────────────────────

const TIER_PRIORITY: Record<string, number> = { base: 4, lite: 3, thinking: 2, "": 1 }

// ── Brain AI panel ────────────────────────────────────────────────────────────

interface BrainSuggestion {
    modelDbId: string
    modelId: string
    providerName: string
    action: "enable" | "disable"
    reason: string
}

function parseN(text: string): number {
    const m = text.match(/\b(\d+)\b/)
    return m ? Math.min(Math.max(parseInt(m[1], 10), 1), 20) : 3
}

function computeSuggestions(
    prompt: string,
    models: any[],
    providers: any[]
): BrainSuggestion[] {
    const lower = prompt.toLowerCase()
    const n = parseN(prompt)
    const wantsEnable = lower.includes("enable") || lower.includes("best") || lower.includes("top") || lower.includes("recommend")
    const wantsDisable = lower.includes("disable") || lower.includes("remove")

    const providerMap: Record<string, string> = {}
    for (const p of providers) providerMap[p.id] = p.display_name ?? p.name

    // Group models by provider
    const byProvider: Record<string, any[]> = {}
    for (const m of models) {
        if (!byProvider[m.provider_id]) byProvider[m.provider_id] = []
        byProvider[m.provider_id].push(m)
    }

    const suggestions: BrainSuggestion[] = []

    for (const [provId, provModels] of Object.entries(byProvider)) {
        const provName = providerMap[provId] ?? provId

        // Sort by tier priority desc, then alphabetically
        const sorted = [...provModels].sort((a, b) => {
            const tp = (TIER_PRIORITY[b.tier ?? ""] ?? 1) - (TIER_PRIORITY[a.tier ?? ""] ?? 1)
            if (tp !== 0) return tp
            return a.model_id.localeCompare(b.model_id)
        })

        if (wantsEnable || (!wantsEnable && !wantsDisable)) {
            // Enable top N, disable the rest
            sorted.forEach((m, idx) => {
                if (idx < n && !m.enabled) {
                    suggestions.push({
                        modelDbId: m.id,
                        modelId: m.model_id,
                        providerName: provName,
                        action: "enable",
                        reason: `Top-${idx + 1} model for ${provName} (tier: ${m.tier || "unassigned"})`,
                    })
                } else if (idx >= n && m.enabled) {
                    suggestions.push({
                        modelDbId: m.id,
                        modelId: m.model_id,
                        providerName: provName,
                        action: "disable",
                        reason: `Outside top ${n} for ${provName}`,
                    })
                }
            })
        } else if (wantsDisable) {
            // Disable bottom N
            const toDisable = sorted.slice(-n)
            for (const m of toDisable) {
                if (m.enabled) {
                    suggestions.push({
                        modelDbId: m.id,
                        modelId: m.model_id,
                        providerName: provName,
                        action: "disable",
                        reason: `Lower-priority model for ${provName} (tier: ${m.tier || "unassigned"})`,
                    })
                }
            }
        }
    }

    return suggestions
}

function BrainPanel({
    open,
    onClose,
    models,
    providers,
    onApplied,
}: {
    open: boolean
    onClose: () => void
    models: any[]
    providers: any[]
    onApplied: () => void
}) {
    const [prompt, setPrompt] = useState("")
    const [suggestions, setSuggestions] = useState<BrainSuggestion[] | null>(null)
    const [applying, setApplying] = useState(false)
    const [applied, setApplied] = useState(false)

    const handleGenerate = useCallback(() => {
        if (!prompt.trim()) return
        const s = computeSuggestions(prompt, models, providers)
        setSuggestions(s)
        setApplied(false)
    }, [prompt, models, providers])

    const handleApply = useCallback(async () => {
        if (!suggestions) return
        setApplying(true)
        try {
            await Promise.all(
                suggestions.map((s) =>
                    updateModel(s.modelDbId, { enabled: s.action === "enable" })
                )
            )
            setApplied(true)
            onApplied()
        } finally {
            setApplying(false)
        }
    }, [suggestions, onApplied])

    const enableCount = suggestions?.filter((s) => s.action === "enable").length ?? 0
    const disableCount = suggestions?.filter((s) => s.action === "disable").length ?? 0

    return (
        <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-orange-500" />
                        Ask Brain
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    <p className="text-sm text-muted-foreground">
                        Describe what you want — Brain will rank models by tier and suggest which to enable or disable.
                        <br />
                        <span className="text-xs">
                            Examples: <em>"enable best 3 models per provider"</em>, <em>"disable worst 5 models"</em>, <em>"keep top 2 per provider"</em>
                        </span>
                    </p>

                    <div className="flex gap-2">
                        <Textarea
                            className="min-h-[56px] text-sm resize-none flex-1"
                            placeholder="e.g. choose best 3 models for each provider"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault()
                                    handleGenerate()
                                }
                            }}
                        />
                        <Button
                            onClick={handleGenerate}
                            disabled={!prompt.trim()}
                            className="bg-orange-500 hover:bg-orange-600 text-white gap-2 self-end"
                        >
                            <Sparkles className="h-4 w-4" />
                            Suggest
                        </Button>
                    </div>

                    {suggestions !== null && (
                        <div className="space-y-3">
                            {suggestions.length === 0 ? (
                                <div className="flex items-center gap-2 p-4 rounded-lg bg-muted text-sm text-muted-foreground">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    No changes needed — models are already in the suggested state.
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="font-medium">Brain suggests:</span>
                                        {enableCount > 0 && (
                                            <span className="flex items-center gap-1 text-emerald-600">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                Enable {enableCount}
                                            </span>
                                        )}
                                        {disableCount > 0 && (
                                            <span className="flex items-center gap-1 text-rose-500">
                                                <XCircle className="h-3.5 w-3.5" />
                                                Disable {disableCount}
                                            </span>
                                        )}
                                    </div>

                                    <div className="rounded-md border divide-y max-h-72 overflow-y-auto">
                                        {suggestions.map((s) => (
                                            <div
                                                key={s.modelDbId}
                                                className={`flex items-center gap-3 px-3 py-2 text-sm ${s.action === "enable"
                                                    ? "bg-emerald-50/50 dark:bg-emerald-900/10"
                                                    : "bg-orange-50/50 dark:bg-orange-900/10"
                                                    }`}
                                            >
                                                {s.action === "enable"
                                                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                                    : <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                                                }
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-mono text-xs truncate">{s.modelId}</div>
                                                    <div className="text-xs text-muted-foreground">{s.reason}</div>
                                                </div>
                                                <Badge variant="outline" className="shrink-0 text-xs">{s.providerName}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {applied && (
                                <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Changes applied successfully!
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    {suggestions && suggestions.length > 0 && !applied && (
                        <Button
                            onClick={handleApply}
                            disabled={applying}
                            className="gap-2"
                        >
                            {applying
                                ? <><Loader2 className="h-4 w-4 animate-spin" />Applying…</>
                                : <><ChevronRight className="h-4 w-4" />Apply Changes</>
                            }
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ── Add Model Dialog ──────────────────────────────────────────────────────────

function AddModelDialog({
    open,
    onClose,
    providers,
    onAdded,
}: {
    open: boolean
    onClose: () => void
    providers: any[]
    onAdded: () => void
}) {
    const [form, setForm] = useState({ provider_id: "", model_id: "", tier: "" })
    const [adding, setAdding] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleAdd = async () => {
        if (!form.provider_id || !form.model_id.trim()) return
        setAdding(true)
        setError(null)
        try {
            const res = await fetch(`/api/admin/models`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    provider_id: form.provider_id,
                    model_id: form.model_id.trim(),
                    display_name: form.model_id.trim(),
                    tier: form.tier === "none" ? "" : form.tier,
                    context_window: 128000,
                    input_cost_per_1k: 0,
                    output_cost_per_1k: 0,
                    enabled: true,
                }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.detail || "Failed to add model")
            }
            setForm({ provider_id: "", model_id: "", tier: "" })
            onAdded()
            onClose()
        } catch (e: any) {
            setError(e.message || "Failed to add model")
        } finally {
            setAdding(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add Model Manually</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label>Provider</Label>
                        <Select
                            value={form.provider_id}
                            onValueChange={(v) => setForm((f) => ({ ...f, provider_id: v }))}
                        >
                            <SelectTrigger><SelectValue placeholder="Select provider…" /></SelectTrigger>
                            <SelectContent>
                                {providers.map((p: any) => (
                                    <SelectItem key={p.id} value={p.id}>{p.display_name ?? p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Model ID</Label>
                        <Input
                            placeholder="e.g. gpt-4o, claude-3-5-sonnet-20241022"
                            value={form.model_id}
                            onChange={(e) => setForm((f) => ({ ...f, model_id: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Tier <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Select
                            value={form.tier}
                            onValueChange={(v) => setForm((f) => ({ ...f, tier: v }))}
                        >
                            <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Unassigned</SelectItem>
                                <SelectItem value="lite">Lite</SelectItem>
                                <SelectItem value="base">Base</SelectItem>
                                <SelectItem value="thinking">Thinking</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleAdd}
                        disabled={adding || !form.provider_id || !form.model_id.trim()}
                    >
                        {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                        Add Model
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ModelManagement() {
    const { models, isLoading: modelsLoading, isError: modelsError, mutate: mutateModels } = useModels()
    const { providers, isLoading: provLoading, isError: provError } = useProviders()

    const [search, setSearch] = useState("")
    const [filterProvider, setFilterProvider] = useState("all")
    const [filterEnabled, setFilterEnabled] = useState<"all" | "enabled" | "disabled">("all")
    const [filterTier, setFilterTier] = useState("all")

    const [togglingId, setTogglingId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkDeleting, setBulkDeleting] = useState(false)

    const [addOpen, setAddOpen] = useState(false)
    const [brainOpen, setBrainOpen] = useState(false)

    const providerMap = useMemo(() => {
        const m: Record<string, string> = {}
        for (const p of providers ?? []) m[p.id] = p.display_name ?? p.name
        return m
    }, [providers])

    const filtered = useMemo(() => {
        if (!models) return []
        let list = [...models]

        if (filterProvider !== "all") list = list.filter((m) => m.provider_id === filterProvider)
        if (filterEnabled === "enabled") list = list.filter((m) => m.enabled)
        if (filterEnabled === "disabled") list = list.filter((m) => !m.enabled)
        if (filterTier !== "all") list = list.filter((m) => (m.tier ?? "") === (filterTier === "none" ? "" : filterTier))
        if (search.trim()) {
            const tokens = search.toLowerCase().split(/\s+/).filter(Boolean)
            list = list.filter((m) =>
                tokens.every((t) =>
                    m.model_id.toLowerCase().includes(t) ||
                    (m.display_name ?? "").toLowerCase().includes(t)
                )
            )
        }

        // Sort: provider name, then tier priority desc, then model_id
        list.sort((a, b) => {
            const pA = providerMap[a.provider_id] ?? ""
            const pB = providerMap[b.provider_id] ?? ""
            if (pA !== pB) return pA.localeCompare(pB)
            const tp = (TIER_PRIORITY[b.tier ?? ""] ?? 1) - (TIER_PRIORITY[a.tier ?? ""] ?? 1)
            if (tp !== 0) return tp
            return a.model_id.localeCompare(b.model_id)
        })

        return list
    }, [models, filterProvider, filterEnabled, filterTier, search, providerMap])

    const stats = useMemo(() => {
        if (!models) return { total: 0, enabled: 0, disabled: 0 }
        return {
            total: models.length,
            enabled: models.filter((m: any) => m.enabled).length,
            disabled: models.filter((m: any) => !m.enabled).length,
        }
    }, [models])

    const handleToggle = async (model: any) => {
        setTogglingId(model.id)
        try {
            await updateModel(model.id, { enabled: !model.enabled })
            await mutateModels()
        } catch (e) {
            console.error("Toggle failed", e)
        } finally {
            setTogglingId(null)
        }
    }

    const handleDelete = async (model: any) => {
        setDeletingId(model.id)
        try {
            await deleteModel(model.id)
            await mutateModels()
        } catch (e) {
            console.error("Delete failed", e)
        } finally {
            setDeletingId(null)
        }
    }

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return
        setBulkDeleting(true)
        try {
            await Promise.all([...selectedIds].map((id) => deleteModel(id)))
            setSelectedIds(new Set())
            await mutateModels()
        } catch (e) {
            console.error("Bulk delete failed", e)
        } finally {
            setBulkDeleting(false)
        }
    }

    const allFilteredSelected = filtered.length > 0 && filtered.every((m: any) => selectedIds.has(m.id))
    const someFilteredSelected = filtered.some((m: any) => selectedIds.has(m.id))

    const toggleSelectAll = () => {
        if (allFilteredSelected) {
            setSelectedIds(prev => {
                const next = new Set(prev)
                filtered.forEach((m: any) => next.delete(m.id))
                return next
            })
        } else {
            setSelectedIds(prev => {
                const next = new Set(prev)
                filtered.forEach((m: any) => next.add(m.id))
                return next
            })
        }
    }

    if (modelsLoading || provLoading) {
        return (
            <div className="p-8 flex justify-center mt-20">
                <RefreshCw className="animate-spin text-muted-foreground" />
            </div>
        )
    }
    if (modelsError || provError) return <ErrorState />

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-200 dark:border-violet-800">
                        <PackageCheck className="h-7 w-7 text-violet-500" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Model Management</h2>
                        <p className="text-muted-foreground pt-0.5">
                            Enable or disable models across all providers. Disabled models are hidden from the Provider Models page.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {selectedIds.size > 0 && (
                        <Button
                            variant="destructive"
                            className="gap-2"
                            disabled={bulkDeleting}
                            onClick={handleBulkDelete}
                        >
                            {bulkDeleting
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Trash2 className="h-4 w-4" />
                            }
                            Delete Selected ({selectedIds.size})
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => setBrainOpen(true)}
                    >
                        <Brain className="h-4 w-4 text-orange-500" />
                        Ask Brain
                    </Button>
                    <Button className="gap-2" onClick={() => setAddOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Add Model
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: "Total Models", value: stats.total, color: "text-foreground" },
                    { label: "Enabled", value: stats.enabled, color: "text-emerald-600 dark:text-emerald-400" },
                    { label: "Disabled", value: stats.disabled, color: "text-slate-400" },
                ].map(({ label, value, color }) => (
                    <Card key={label} className="border">
                        <CardHeader className="pb-1 pt-4 px-5">
                            <CardDescription className="text-xs">{label}</CardDescription>
                        </CardHeader>
                        <CardContent className="px-5 pb-4">
                            <p className={`text-2xl font-bold ${color}`}>{value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search models…"
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Provider filter */}
                <Select value={filterProvider} onValueChange={setFilterProvider}>
                    <SelectTrigger className="w-44">
                        <Server className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="Provider" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Providers</SelectItem>
                        {(providers ?? []).map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>{p.display_name ?? p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Tier filter */}
                <Select value={filterTier} onValueChange={setFilterTier}>
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="Tier" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Tiers</SelectItem>
                        <SelectItem value="lite">Lite</SelectItem>
                        <SelectItem value="base">Base</SelectItem>
                        <SelectItem value="thinking">Thinking</SelectItem>
                        <SelectItem value="none">Unassigned</SelectItem>
                    </SelectContent>
                </Select>

                {/* Enabled filter */}
                <Select value={filterEnabled} onValueChange={(v) => setFilterEnabled(v as any)}>
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="enabled">Enabled</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                            Models
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                ({filtered.length} of {stats.total})
                            </span>
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="rounded-b-lg overflow-hidden border-t">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="w-10">
                                        <Checkbox
                                            checked={allFilteredSelected}
                                            data-state={someFilteredSelected && !allFilteredSelected ? "indeterminate" : undefined}
                                            onCheckedChange={toggleSelectAll}
                                            aria-label="Select all"
                                        />
                                    </TableHead>
                                    <TableHead className="w-44">Provider</TableHead>
                                    <TableHead>Model ID</TableHead>
                                    <TableHead className="w-28">Tier</TableHead>
                                    <TableHead className="w-24 text-center">Enabled</TableHead>
                                    <TableHead className="w-16 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                                            No models match your filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((model: any) => {
                                        const isToggling = togglingId === model.id
                                        const isDeleting = deletingId === model.id
                                        const isSelected = selectedIds.has(model.id)
                                        return (
                                            <TableRow
                                                key={model.id}
                                                className={`transition-colors ${!model.enabled ? "opacity-50" : ""} ${isSelected ? "bg-primary/5" : ""}`}
                                            >
                                                <TableCell>
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={(checked) => {
                                                            setSelectedIds(prev => {
                                                                const next = new Set(prev)
                                                                if (checked) next.add(model.id)
                                                                else next.delete(model.id)
                                                                return next
                                                            })
                                                        }}
                                                        aria-label={`Select ${model.model_id}`}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5">
                                                        <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                        <span className="text-sm font-medium truncate max-w-36">
                                                            {providerMap[model.provider_id] ?? model.provider_id}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-mono text-xs text-foreground">
                                                        {model.model_id}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <TierBadge tier={model.tier ?? ""} />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isToggling ? (
                                                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                                                    ) : (
                                                        <Switch
                                                            checked={model.enabled}
                                                            onCheckedChange={() => handleToggle(model)}
                                                            aria-label={`Toggle ${model.model_id}`}
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-muted-foreground hover:text-destructive"
                                                        disabled={isDeleting}
                                                        onClick={() => handleDelete(model)}
                                                    >
                                                        {isDeleting
                                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            : <Trash2 className="h-3.5 w-3.5" />
                                                        }
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Dialogs */}
            <AddModelDialog
                open={addOpen}
                onClose={() => setAddOpen(false)}
                providers={providers ?? []}
                onAdded={mutateModels}
            />

            <BrainPanel
                open={brainOpen}
                onClose={() => setBrainOpen(false)}
                models={models ?? []}
                providers={providers ?? []}
                onApplied={mutateModels}
            />
        </div>
    )
}
