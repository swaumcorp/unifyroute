import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Brain, Activity, Upload, Trophy, Zap, Trash2, Plus,
    CheckCircle2, XCircle, AlertCircle, RefreshCw, ChevronRight, Loader2
} from "lucide-react"
import {
    useBrainStatus, useBrainRanking, brainRunTests, brainRemoveProvider,
    brainImport, brainSelect, brainAssignProvider, updateBrainProvider,
    useProviders, useCredentials, useModels,
} from "@/lib/api"
import type { BrainProvider, BrainSelection, BrainTestResult } from "@/lib/api"

// ── Helpers ───────────────────────────────────────────────────────────────────

function HealthBadge({ health }: { health: BrainProvider["health"] }) {
    if (health.ok === null) {
        return <Badge variant="outline" className="text-slate-400 gap-1"><AlertCircle className="h-3 w-3" />Untested</Badge>
    }
    if (health.ok) {
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1"><CheckCircle2 className="h-3 w-3" />{health.latency_ms}ms</Badge>
    }
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>
}

function ScoreBadge({ score }: { score: number }) {
    const pct = Math.round(score * 100)
    const color = pct >= 70 ? "bg-emerald-500 hover:bg-emerald-600" :
        pct >= 40 ? "bg-amber-500 hover:bg-amber-600" : "bg-orange-500 hover:bg-orange-600"
    return <Badge className={`${color} font-mono`}>{pct}%</Badge>
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
    return (
        <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-500/10">
                <Icon className="h-5 w-5 text-orange-500" />
            </div>
            <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
        </div>
    )
}

// ── Tab: Status ───────────────────────────────────────────────────────────────

function StatusTab() {
    const { providers, isLoading, mutate } = useBrainStatus()
    const { providers: allProviders } = useProviders()
    const { credentials: allCredentials } = useCredentials()
    const { models: allModels } = useModels()

    const [testing, setTesting] = useState(false)
    const [testResults, setTestResults] = useState<BrainTestResult[] | null>(null)
    const [testError, setTestError] = useState<string | null>(null)

    const [removing, setRemoving] = useState<string | null>(null)
    const [removeError, setRemoveError] = useState<string | null>(null)

    // Inline priority editing
    const [editingPriority, setEditingPriority] = useState<string | null>(null)
    const [priorityValue, setPriorityValue] = useState<string>("")
    const [savingPriority, setSavingPriority] = useState<string | null>(null)

    const [assignOpen, setAssignOpen] = useState(false)
    const [assignForm, setAssignForm] = useState({ provider_id: "", credential_id: "", model_id: "", priority: "100" })
    const [assigning, setAssigning] = useState(false)
    const [assignError, setAssignError] = useState<string | null>(null)

    async function handleRunTests() {
        setTesting(true)
        setTestError(null)
        try {
            const r = await brainRunTests()
            setTestResults(r.results)
            await mutate()
        } catch (e: any) {
            setTestError(e.message || "Test failed")
        } finally {
            setTesting(false)
        }
    }

    async function handleRemove(id: string) {
        setRemoving(id)
        setRemoveError(null)
        try {
            await brainRemoveProvider(id)
            await mutate()
        } catch (e: any) {
            setRemoveError(e.message || "Remove failed")
        } finally {
            setRemoving(null)
        }
    }

    async function handleSavePriority(id: string) {
        const val = parseInt(priorityValue)
        if (isNaN(val) || val < 1) return
        setSavingPriority(id)
        try {
            await updateBrainProvider(id, { priority: val })
            await mutate()
        } catch { /* silently ignore */ } finally {
            setSavingPriority(null)
            setEditingPriority(null)
        }
    }

    async function handleAssign(e: React.FormEvent) {
        e.preventDefault()
        if (!assignForm.provider_id || !assignForm.credential_id || !assignForm.model_id) return
        setAssigning(true)
        setAssignError(null)
        try {
            await brainAssignProvider({
                provider_id: assignForm.provider_id,
                credential_id: assignForm.credential_id,
                model_id: assignForm.model_id,
                priority: parseInt(assignForm.priority) || 100,
            })
            await mutate()
            setAssignOpen(false)
            setAssignForm({ provider_id: "", credential_id: "", model_id: "", priority: "100" })
        } catch (e: any) {
            setAssignError(e.message || "Assign failed")
        } finally {
            setAssigning(false)
        }
    }

    if (isLoading) return <div className="py-12 text-center text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading brain status…</div>

    return (
        <div className="space-y-6">
            <SectionHeader icon={Activity} title="Assigned Providers" subtitle="Provider/credential/model triples assigned to the Brain for internal system use" />

            <div className="flex gap-2 mb-4">
                <Button
                    variant="outline"
                    onClick={handleRunTests}
                    disabled={testing}
                    className="gap-2"
                >
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {testing ? "Testing…" : "Test All Credentials"}
                </Button>
                <Button onClick={() => setAssignOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Assign Provider
                </Button>
            </div>

            {testError && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{testError}</div>
            )}
            {removeError && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{removeError}</div>
            )}

            {testResults && (
                <div className="rounded-md border p-4 space-y-2 bg-slate-50 dark:bg-slate-900">
                    <p className="text-sm font-medium mb-2">
                        Test results — <span className="text-emerald-600">{testResults.filter(r => r.ok).length} healthy</span>
                        {" / "}
                        <span className="text-rose-600">{testResults.filter(r => !r.ok).length} failed</span>
                    </p>
                    {testResults.map(r => (
                        <div key={r.brain_config_id} className="flex items-center gap-2 text-sm">
                            {r.ok
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                : <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                            }
                            <span className="font-medium">{r.provider}</span>
                            <span className="text-muted-foreground">· {r.credential_label}</span>
                            <span className="text-muted-foreground font-mono text-xs truncate max-w-48">{r.model_id}</span>
                            {r.ok && <span className="text-muted-foreground">{r.latency_ms}ms</span>}
                            {!r.ok && <span className="text-rose-500 text-xs">{r.message}</span>}
                        </div>
                    ))}
                </div>
            )}

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Provider</TableHead>
                            <TableHead>Credential</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead>
                                Priority
                                <span className="font-normal text-muted-foreground ml-1 text-xs">(lower = first)</span>
                            </TableHead>
                            <TableHead>Health</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {providers.map((p) => (
                            <TableRow key={p.id}>
                                <TableCell className="font-medium">
                                    <div>{p.provider_display}</div>
                                    <div className="text-xs text-muted-foreground">{p.provider}</div>
                                </TableCell>
                                <TableCell>{p.credential_label}</TableCell>
                                <TableCell className="font-mono text-xs max-w-60 truncate">{p.model_id}</TableCell>
                                <TableCell>
                                    {editingPriority === p.id ? (
                                        <input
                                            type="number"
                                            min={1}
                                            max={1000}
                                            className="w-20 rounded border border-input bg-background px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                                            value={priorityValue}
                                            autoFocus
                                            onChange={e => setPriorityValue(e.target.value)}
                                            onBlur={() => handleSavePriority(p.id)}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") handleSavePriority(p.id)
                                                if (e.key === "Escape") { setEditingPriority(null) }
                                            }}
                                        />
                                    ) : (
                                        <button
                                            className="cursor-pointer rounded px-2 py-0.5 text-sm font-mono border border-transparent hover:border-input hover:bg-muted transition-colors"
                                            title="Click to edit priority"
                                            onClick={() => { setEditingPriority(p.id); setPriorityValue(String(p.priority)) }}
                                        >
                                            {savingPriority === p.id
                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                : p.priority
                                            }
                                        </button>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <HealthBadge health={p.health} />
                                    {p.health.ok !== null && (
                                        <p className="text-xs text-muted-foreground mt-1 max-w-40 truncate" title={p.health.message}>
                                            {p.health.message}
                                        </p>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        disabled={removing === p.id}
                                        onClick={() => handleRemove(p.id)}
                                    >
                                        {removing === p.id
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <Trash2 className="h-3.5 w-3.5" />
                                        }
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {providers.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                    No providers assigned to Brain yet. Use <strong>Assign Provider</strong> or the <strong>Import</strong> tab.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Assign Dialog */}
            <Dialog open={assignOpen} onOpenChange={(v: boolean) => !v && setAssignOpen(false)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Assign Provider to Brain</DialogTitle>
                        <DialogDescription>Select a provider, credential, and model to give the Brain access to.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAssign} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Provider</Label>
                            <Select value={assignForm.provider_id} onValueChange={(v: string) => setAssignForm(f => ({ ...f, provider_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select provider…" /></SelectTrigger>
                                <SelectContent>
                                    {/* Only show enabled providers that have at least one credential */}
                                    {(allProviders ?? []).filter((p: any) =>
                                        p.enabled && (allCredentials ?? []).some((c: any) => c.provider_id === p.id)
                                    ).map((p: any) => (
                                        <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Credential</Label>
                            <Select value={assignForm.credential_id} onValueChange={(v: string) => setAssignForm(f => ({ ...f, credential_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select credential…" /></SelectTrigger>
                                <SelectContent>
                                    {(allCredentials ?? [])
                                        .filter((c: any) => !assignForm.provider_id || c.provider_id === assignForm.provider_id)
                                        .map((c: any) => (
                                            <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Model ID</Label>
                            <Select value={assignForm.model_id} onValueChange={(v: string) => setAssignForm(f => ({ ...f, model_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select model…" /></SelectTrigger>
                                <SelectContent>
                                    {(allModels ?? [])
                                        .filter((m: any) => !assignForm.provider_id || m.provider_id === assignForm.provider_id)
                                        .map((m: any) => (
                                            <SelectItem key={m.id} value={m.model_id}>{m.model_id}</SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Priority <span className="text-muted-foreground font-normal">(lower = preferred)</span></Label>
                            <Input
                                type="number"
                                min={1}
                                max={1000}
                                value={assignForm.priority}
                                onChange={e => setAssignForm(f => ({ ...f, priority: e.target.value }))}
                            />
                        </div>
                        {assignError && <p className="text-sm text-destructive">{assignError}</p>}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={assigning || !assignForm.provider_id || !assignForm.credential_id || !assignForm.model_id}>
                                {assigning ? "Assigning…" : "Assign"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ── Tab: Ranking ──────────────────────────────────────────────────────────────

function RankingTab() {
    const { ranking, isLoading, mutate } = useBrainRanking()
    const [refreshing, setRefreshing] = useState(false)

    async function handleRefresh() {
        setRefreshing(true)
        try {
            await brainRunTests()
            await mutate()
        } finally {
            setRefreshing(false)
        }
    }

    if (isLoading) return <div className="py-12 text-center text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading ranking…</div>

    return (
        <div className="space-y-6">
            <SectionHeader icon={Trophy} title="Provider Ranking" subtitle="Composite score based on priority, health, quota, and latency. Higher is better." />

            <div className="flex gap-2 mb-2">
                <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="gap-2">
                    {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {refreshing ? "Refreshing…" : "Re-run Tests & Refresh"}
                </Button>
            </div>

            {/* Score legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground border rounded-md p-3 bg-slate-50 dark:bg-slate-900">
                <span className="font-medium">Score factors:</span>
                <span>Priority <strong>40%</strong></span>
                <span>Health <strong>30%</strong></span>
                <span>Quota <strong>20%</strong></span>
                <span>Latency <strong>10%</strong></span>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">Rank</TableHead>
                            <TableHead>Provider</TableHead>
                            <TableHead>Credential</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Health</TableHead>
                            <TableHead>Latency</TableHead>
                            <TableHead>Score</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ranking.map((r) => (
                            <TableRow key={r.brain_config_id} className={r.rank === 1 ? "bg-emerald-50/50 dark:bg-emerald-900/10" : ""}>
                                <TableCell>
                                    {r.rank === 1
                                        ? <Trophy className="h-4 w-4 text-amber-500" />
                                        : <span className="text-muted-foreground font-mono">#{r.rank}</span>
                                    }
                                </TableCell>
                                <TableCell className="font-medium">{r.provider}</TableCell>
                                <TableCell>{r.credential_label}</TableCell>
                                <TableCell className="font-mono text-xs max-w-48 truncate">{r.model_id}</TableCell>
                                <TableCell><Badge variant="outline" className="font-mono">{r.priority}</Badge></TableCell>
                                <TableCell>
                                    {r.health_ok
                                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        : <XCircle className="h-4 w-4 text-rose-500" />
                                    }
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                    {r.latency_ms >= 10000 ? "–" : `${r.latency_ms}ms`}
                                </TableCell>
                                <TableCell><ScoreBadge score={r.score} /></TableCell>
                            </TableRow>
                        ))}
                        {ranking.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                    No brain providers assigned yet, or no test data available.
                                    Go to <strong>Status</strong> and click <strong>Test All Credentials</strong> first.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

// ── Tab: Import ───────────────────────────────────────────────────────────────

const IMPORT_EXAMPLE = `providers:
  - name: fireworks
    display_name: Fireworks AI
    credentials:
      - label: my-fw-key
        api_key: fw-YOUR-KEY-HERE
    models:
      - accounts/fireworks/models/llama-v3p1-8b-instruct

brain_assignments:
  - provider: fireworks
    credential_label: my-fw-key
    models:
      - accounts/fireworks/models/llama-v3p1-8b-instruct
    priority: 10`

function ImportTab() {
    const { mutate } = useBrainStatus()
    const [format, setFormat] = useState<"yaml" | "json">("yaml")
    const [content, setContent] = useState(IMPORT_EXAMPLE)
    const [importing, setImporting] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    async function handleImport(e: React.FormEvent) {
        e.preventDefault()
        setImporting(true)
        setError(null)
        setResult(null)
        try {
            const r = await brainImport(format, content)
            setResult(r)
            await mutate()
        } catch (ex: any) {
            setError(ex.message || "Import failed")
        } finally {
            setImporting(false)
        }
    }

    return (
        <div className="space-y-6">
            <SectionHeader icon={Upload} title="Bulk Import" subtitle="Import providers, credentials, and brain assignments from YAML or JSON in one step." />

            <form onSubmit={handleImport} className="space-y-4">
                <div className="space-y-1.5">
                    <Label>Format</Label>
                    <Select value={format} onValueChange={v => setFormat(v as "yaml" | "json")}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="yaml">YAML</SelectItem>
                            <SelectItem value="json">JSON</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label>Payload</Label>
                    <Textarea
                        className="font-mono text-sm h-72 resize-y"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder={format === "yaml" ? IMPORT_EXAMPLE : '{"providers":[], "brain_assignments":[]}'}
                        spellCheck={false}
                    />
                </div>

                {error && <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>}

                {result && (
                    <div className={`p-4 rounded-md border text-sm space-y-2 ${result.status === "success" ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200" : "bg-amber-50 dark:bg-amber-900/10 border-amber-200"}`}>
                        <p className="font-semibold capitalize">{result.status === "success" ? "✅ Import complete" : "⚠️ Partial import"}</p>
                        <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                            <span>Providers created:</span><span className="text-foreground font-medium">{result.providers_created?.length ?? 0} ({result.providers_created?.join(", ") || "–"})</span>
                            <span>Credentials created:</span><span className="text-foreground font-medium">{result.credentials_created?.length ?? 0}</span>
                            <span>Models added:</span><span className="text-foreground font-medium">{result.models_created ?? 0}</span>
                            <span>Brain assignments:</span><span className="text-foreground font-medium">{result.brain_assignments_created ?? 0} new, {result.brain_assignments_skipped ?? 0} skipped</span>
                        </div>
                        {result.errors?.length > 0 && (
                            <div className="mt-2">
                                <p className="text-destructive font-medium">Errors:</p>
                                <ul className="list-disc list-inside text-destructive text-xs space-y-1 mt-1">
                                    {result.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                <Button type="submit" disabled={importing || !content.trim()} className="gap-2">
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {importing ? "Importing…" : "Run Import"}
                </Button>
            </form>
        </div>
    )
}

// ── Tab: Select ───────────────────────────────────────────────────────────────

function SelectTab() {
    const [selecting, setSelecting] = useState(false)
    const [selection, setSelection] = useState<BrainSelection | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function handleSelect() {
        setSelecting(true)
        setError(null)
        try {
            const result = await brainSelect()
            setSelection(result)
        } catch (e: any) {
            setError(e.message || "Selection failed")
        } finally {
            setSelecting(false)
        }
    }

    return (
        <div className="space-y-6">
            <SectionHeader icon={Zap} title="Brain Select" subtitle="Ask the Brain to pick the best available provider/credential/model right now." />

            <div className="max-w-lg">
                <Button onClick={handleSelect} disabled={selecting} className="gap-2 bg-[#F54927] hover:bg-[#D43111] text-white">
                    {selecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    {selecting ? "Selecting…" : "Select Best Provider"}
                </Button>

                {error && <div className="mt-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>}

                {selection && (
                    <div className={`mt-6 rounded-xl border p-5 space-y-4 ${selection.ok
                        ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10"
                        : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10"
                        }`}>
                        <div className="flex items-center gap-2">
                            {selection.ok
                                ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                : <AlertCircle className="h-5 w-5 text-amber-500" />
                            }
                            <span className="font-semibold text-base">
                                {selection.ok ? "Selection successful" : "No healthy provider available"}
                            </span>
                        </div>

                        {selection.ok ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                                    <span className="text-muted-foreground">Provider</span>
                                    <span className="font-medium">{selection.provider}</span>
                                    <span className="text-muted-foreground">Credential</span>
                                    <span className="font-medium">{selection.credential_label}</span>
                                    <span className="text-muted-foreground">Model</span>
                                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{selection.model_id}</span>
                                    <span className="text-muted-foreground">Score</span>
                                    <span><ScoreBadge score={selection.score} /></span>
                                </div>
                                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                                    <p className="text-xs text-muted-foreground flex items-start gap-1">
                                        <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                        {selection.reason}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">{selection.reason}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Main Brain Page ───────────────────────────────────────────────────────────

type Tab = "status" | "ranking" | "import" | "select"

const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "status", label: "Status", icon: Activity },
    { id: "ranking", label: "Ranking", icon: Trophy },
    { id: "import", label: "Import", icon: Upload },
    { id: "select", label: "Select", icon: Zap },
]

export function BrainPage() {
    const [tab, setTab] = useState<Tab>("status")

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/20 border border-orange-200 dark:border-orange-800">
                    <Brain className="h-7 w-7 text-orange-500" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Brain</h2>
                    <p className="text-muted-foreground pt-0.5">
                        Internal provider manager — selects the best LLM for system operations.
                    </p>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id
                            ? "border-orange-500 text-orange-600 dark:text-orange-400"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300"
                            }`}
                    >
                        <t.icon className="h-4 w-4" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div>
                {tab === "status" && <StatusTab />}
                {tab === "ranking" && <RankingTab />}
                {tab === "import" && <ImportTab />}
                {tab === "select" && <SelectTab />}
            </div>
        </div>
    )
}
