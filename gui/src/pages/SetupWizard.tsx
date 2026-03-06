import { useState, useEffect, useCallback } from "react"
import {
    Check,
    ChevronRight,
    ChevronLeft,
    Database,
    Key,
    Box,
    GitBranch,
    Brain,
    ClipboardCheck,
    Wand2,
    Plus,
    Trash2,
    Eye,
    EyeOff,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Info,
    Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    getAvailableProviders,
    getSuggestedModels,
    submitWizard,
    type AvailableProvider,
    type CatalogModel,
    type WizardCredential,
    type WizardModel,
    type WizardRoutingTier,
    type WizardBrainEntry,
    type WizardOnboardSummary,
} from "@/lib/wizard"

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
    { id: "provider", label: "Providers", icon: Database },
    { id: "credentials", label: "Credentials", icon: Key },
    { id: "models", label: "Models", icon: Box },
    { id: "routing", label: "Routing", icon: GitBranch },
    { id: "brain", label: "Brain", icon: Brain },
    { id: "summary", label: "Summary", icon: ClipboardCheck },
]

const STRATEGIES = [
    { value: "cheapest_available", label: "Cheapest Available", desc: "Route to the lowest-cost provider that has quota" },
    { value: "highest_quota", label: "Highest Quota", desc: "Route to the provider with the most tokens remaining" },
    { value: "round_robin", label: "Round Robin", desc: "Distribute requests evenly across all available providers" },
]

const TIERS = ["lite", "base", "thinking"]

// ── Wizard State type ─────────────────────────────────────────────────────────

interface ProviderState {
    provider: AvailableProvider
    credentials: WizardCredential[]
    models: WizardModel[]
    catalog: CatalogModel[]
    catalogLoaded: boolean
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function StepDot({ idx, current, label, Icon }: { idx: number; current: number; label: string; Icon: React.ElementType }) {
    const done = idx < current
    const active = idx === current
    return (
        <div className="flex flex-col items-center gap-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${done
                ? "bg-emerald-500 border-emerald-500 text-white"
                : active
                    ? "bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-500/30"
                    : "border-slate-300 dark:border-slate-700 text-slate-400"
                }`}>
                {done ? <Check size={18} /> : <Icon size={16} />}
            </div>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${active ? "text-violet-500" : done ? "text-emerald-500" : "text-slate-400"}`}>
                {label}
            </span>
        </div>
    )
}

function StepConnector({ done }: { done: boolean }) {
    return (
        <div className={`flex-1 h-0.5 mt-5 mx-1 rounded transition-all duration-500 ${done ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-800"}`} />
    )
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
    return (
        <div className="flex items-start gap-4 mb-8">
            <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-500/10">
                <Icon className="text-violet-600 dark:text-violet-400" size={22} />
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            </div>
        </div>
    )
}

// ── Step 1: Provider Selection ────────────────────────────────────────────────

function ProviderStep({
    selected,
    onToggle,
}: {
    selected: AvailableProvider[]
    onToggle: (p: AvailableProvider) => void
}) {
    const [providers, setProviders] = useState<AvailableProvider[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [search, setSearch] = useState("")

    useEffect(() => {
        getAvailableProviders()
            .then(setProviders)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }, [])

    const filtered = providers.filter(p =>
        p.name.includes(search.toLowerCase()) || p.display_name.toLowerCase().includes(search.toLowerCase())
    )

    if (loading) return (
        <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-violet-500" size={32} />
        </div>
    )
    if (error) return (
        <div className="flex items-center gap-3 text-orange-500 bg-orange-50 dark:bg-orange-500/10 p-4 rounded-xl">
            <AlertCircle size={20} />
            <p className="text-sm">{error}</p>
        </div>
    )

    const isSelected = (p: AvailableProvider) => selected.some(s => s.name === p.name)

    return (
        <div>
            <SectionTitle icon={Database} title="Select Providers to Onboard" subtitle="Choose the AI providers you want to configure. You can add credentials and models for each one." />
            <Input
                placeholder="Search providers..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="mb-4 max-w-xs"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map(p => {
                    const sel = isSelected(p)
                    return (
                        <button
                            key={p.name}
                            onClick={() => onToggle(p)}
                            className={`relative text-left p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${sel
                                ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10 shadow-orange-200 dark:shadow-orange-900"
                                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-orange-200 dark:hover:border-orange-800"
                                }`}
                        >
                            {sel && (
                                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                                    <Check size={12} className="text-white" />
                                </span>
                            )}
                            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{p.display_name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{p.name}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px]">{p.auth_type}</Badge>
                                {p.has_catalog && <Badge variant="secondary" className="text-[10px]">catalog</Badge>}
                                {p.has_credentials && (
                                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px]">
                                        {p.credentials_count} cred{p.credentials_count !== 1 ? "s" : ""}
                                    </Badge>
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>
            {selected.length > 0 && (
                <p className="mt-4 text-sm text-violet-600 dark:text-violet-400 font-medium">
                    {selected.length} provider{selected.length !== 1 ? "s" : ""} selected
                </p>
            )}
        </div>
    )
}

// ── Step 2: Credentials ───────────────────────────────────────────────────────

function CredentialForm({ cred, onChange, onRemove }: {
    cred: WizardCredential; onChange: (c: WizardCredential) => void; onRemove: () => void
}) {
    const [show, setShow] = useState(false)
    return (
        <div className="flex gap-3 items-start p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Label</Label>
                    <Input
                        value={cred.label}
                        onChange={e => onChange({ ...cred, label: e.target.value })}
                        placeholder="my-api-key"
                        className="h-9 text-sm"
                    />
                </div>
                <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">API Key / Secret</Label>
                    <div className="relative">
                        <Input
                            type={show ? "text" : "password"}
                            value={cred.secret_key}
                            onChange={e => onChange({ ...cred, secret_key: e.target.value })}
                            placeholder="sk-..."
                            className="h-9 text-sm pr-9"
                        />
                        <button
                            type="button"
                            onClick={() => setShow(!show)}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                        >
                            {show ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>
            </div>
            <button onClick={onRemove} className="mt-6 text-orange-400 hover:text-orange-600 transition-colors">
                <Trash2 size={16} />
            </button>
        </div>
    )
}

function CredentialsStep({ providerStates, onUpdateCreds }: {
    providerStates: ProviderState[]
    onUpdateCreds: (providerName: string, creds: WizardCredential[]) => void
}) {
    if (providerStates.length === 0) {
        return (
            <div className="text-center py-16 text-slate-400">
                <Database size={40} className="mx-auto mb-3 opacity-30" />
                <p>No providers selected. Go back and select at least one provider.</p>
            </div>
        )
    }

    return (
        <div>
            <SectionTitle icon={Key} title="Add API Credentials" subtitle="Enter your API keys for each selected provider. All secrets are encrypted at rest." />
            <div className="space-y-8">
                {providerStates.map(ps => (
                    <div key={ps.provider.name}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{ps.provider.display_name}</h3>
                                {ps.provider.auth_type === "oauth2" && (
                                    <Badge variant="outline" className="text-[10px] gap-1">
                                        <Lock size={9} /> OAuth2
                                    </Badge>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => onUpdateCreds(ps.provider.name, [
                                    ...ps.credentials,
                                    { label: `${ps.provider.name}-key-${ps.credentials.length + 1}`, secret_key: "", auth_type: ps.provider.auth_type }
                                ])}
                            >
                                <Plus size={12} /> Add Credential
                            </Button>
                        </div>

                        {ps.provider.auth_type === "oauth2" && (
                            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3 mb-3">
                                <Info size={14} className="mt-0.5 shrink-0" />
                                <p>OAuth2 provider — create a placeholder credential here, then complete the OAuth flow in the Credentials page after setup.</p>
                            </div>
                        )}

                        {ps.credentials.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No credentials yet — click "Add Credential" above.</p>
                        ) : (
                            <div className="space-y-2">
                                {ps.credentials.map((cred, i) => (
                                    <CredentialForm
                                        key={i}
                                        cred={cred}
                                        onChange={updated => {
                                            const next = [...ps.credentials]
                                            next[i] = updated
                                            onUpdateCreds(ps.provider.name, next)
                                        }}
                                        onRemove={() => {
                                            const next = ps.credentials.filter((_, j) => j !== i)
                                            onUpdateCreds(ps.provider.name, next)
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Step 3: Models ────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
    lite: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
    base: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
    thinking: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
    "": "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
}

function ModelsStep({ providerStates, onUpdateModels }: {
    providerStates: ProviderState[]
    onUpdateModels: (providerName: string, models: WizardModel[]) => void
}) {
    if (providerStates.length === 0) {
        return (
            <div className="text-center py-16 text-slate-400">
                <Box size={40} className="mx-auto mb-3 opacity-30" />
                <p>No providers selected.</p>
            </div>
        )
    }

    const toggleModel = (ps: ProviderState, cat: CatalogModel) => {
        const existing = ps.models.find(m => m.model_id === cat.model_id)
        if (existing) {
            onUpdateModels(ps.provider.name, ps.models.filter(m => m.model_id !== cat.model_id))
        } else {
            onUpdateModels(ps.provider.name, [
                ...ps.models,
                {
                    model_id: cat.model_id,
                    display_name: cat.display_name,
                    tier: cat.tier,
                    context_window: cat.context_window,
                    input_cost_per_1k: cat.input_cost_per_1k,
                    output_cost_per_1k: cat.output_cost_per_1k,
                    supports_streaming: cat.supports_streaming,
                    supports_functions: cat.supports_functions,
                    enabled: true,
                }
            ])
        }
    }

    const addCustom = (ps: ProviderState) => {
        onUpdateModels(ps.provider.name, [
            ...ps.models,
            {
                model_id: "",
                display_name: "",
                tier: "",
                context_window: 128_000,
                input_cost_per_1k: 0,
                output_cost_per_1k: 0,
                supports_streaming: true,
                supports_functions: true,
                enabled: true,
            }
        ])
    }

    return (
        <div>
            <SectionTitle icon={Box} title="Select Models" subtitle="Choose which models to enable for each provider. Pre-built catalogs show pricing and tier info." />
            <div className="space-y-10">
                {providerStates.map(ps => (
                    <div key={ps.provider.name}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{ps.provider.display_name}</h3>
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => addCustom(ps)}>
                                <Plus size={12} /> Add Custom Model
                            </Button>
                        </div>

                        {!ps.catalogLoaded ? (
                            <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                                <Loader2 size={16} className="animate-spin" /> Loading catalog...
                            </div>
                        ) : ps.catalog.length > 0 ? (
                            <div className="space-y-2">
                                {ps.catalog.map(cat => {
                                    const sel = ps.models.some(m => m.model_id === cat.model_id)
                                    return (
                                        <label
                                            key={cat.model_id}
                                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${sel
                                                ? "border-violet-400 bg-violet-50 dark:bg-violet-500/10"
                                                : "border-slate-200 dark:border-slate-700 hover:border-violet-200 dark:hover:border-violet-800"
                                                }`}
                                        >
                                            <Checkbox
                                                checked={sel}
                                                onCheckedChange={() => toggleModel(ps, cat)}
                                                className="mt-0.5"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{cat.display_name}</span>
                                                    <Badge className={`text-[10px] ${TIER_COLORS[cat.tier] || TIER_COLORS[""]}`}>
                                                        {cat.tier || "—"}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-0.5 truncate">{cat.model_id}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-xs text-slate-500">in: ${cat.input_cost_per_1k.toFixed(4)}</p>
                                                <p className="text-xs text-slate-500">out: ${cat.output_cost_per_1k.toFixed(4)}</p>
                                                <p className="text-[10px] text-slate-400">per 1k tokens</p>
                                            </div>
                                        </label>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 italic mb-3">No pre-built catalog — add custom models below.</p>
                        )}

                        {/* Custom / manually-added models (those not from catalog) */}
                        {ps.models.filter(m => !ps.catalog.some(c => c.model_id === m.model_id)).map((m, i) => (
                            <div key={i} className="flex gap-2 items-center mt-2">
                                <Input
                                    placeholder="model-id"
                                    value={m.model_id}
                                    className="text-sm h-9 flex-1"
                                    onChange={e => {
                                        const updated = [...ps.models]
                                        const idx = updated.findIndex(x => x === m)
                                        updated[idx] = { ...m, model_id: e.target.value, display_name: e.target.value }
                                        onUpdateModels(ps.provider.name, updated)
                                    }}
                                />
                                <Select
                                    value={m.tier || "none"}
                                    onValueChange={v => {
                                        const updated = [...ps.models]
                                        const idx = updated.findIndex(x => x === m)
                                        updated[idx] = { ...m, tier: v === "none" ? "" : v }
                                        onUpdateModels(ps.provider.name, updated)
                                    }}
                                >
                                    <SelectTrigger className="w-32 h-9 text-sm">
                                        <SelectValue placeholder="Tier" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">—</SelectItem>
                                        {TIERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <button
                                    onClick={() => onUpdateModels(ps.provider.name, ps.models.filter(x => x !== m))}
                                    className="text-orange-400 hover:text-orange-600"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Step 4: Routing ───────────────────────────────────────────────────────────

function RoutingStep({ providerStates, routing, onRoutingChange }: {
    providerStates: ProviderState[]
    routing: Record<string, WizardRoutingTier>
    onRoutingChange: (r: Record<string, WizardRoutingTier>) => void
}) {
    const allModels: { provider: string; model: string; tier: string }[] = []
    for (const ps of providerStates) {
        for (const m of ps.models) {
            if (m.model_id) allModels.push({ provider: ps.provider.name, model: m.model_id, tier: m.tier })
        }
    }

    const strategy = Object.values(routing)[0]?.strategy || "cheapest_available"

    const setStrategy = (s: string) => {
        const next: Record<string, WizardRoutingTier> = {}
        for (const [k, v] of Object.entries(routing)) {
            next[k] = { ...v, strategy: s }
        }
        onRoutingChange(next)
    }

    const buildFromModels = (models: typeof allModels, strat: string): Record<string, WizardRoutingTier> => {
        const tiers: Record<string, WizardRoutingTier> = {}
        for (const tier of TIERS) {
            const tm = models.filter(m => m.tier === tier)
            if (tm.length) {
                tiers[tier] = { strategy: strat, fallback_on: [429, 503, "timeout"], models: tm.map(m => ({ provider: m.provider, model: m.model })) }
            }
        }
        if (models.length > 0) {
            tiers["auto"] = { strategy: strat, fallback_on: [429, 503, "timeout"], models: models.map(m => ({ provider: m.provider, model: m.model })) }
        }
        return tiers
    }

    return (
        <div>
            <SectionTitle icon={GitBranch} title="Routing Strategy" subtitle="Configure how the gateway routes requests across your providers and models." />

            <div className="mb-8">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Default Strategy</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {STRATEGIES.map(s => (
                        <button
                            key={s.value}
                            onClick={() => {
                                setStrategy(s.value)
                                onRoutingChange(buildFromModels(allModels, s.value))
                            }}
                            className={`text-left p-4 rounded-xl border-2 transition-all ${strategy === s.value
                                ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10"
                                : "border-slate-200 dark:border-slate-700 hover:border-orange-200"
                                }`}
                        >
                            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{s.label}</p>
                            <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Auto-Generated Tiers</h3>
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => onRoutingChange(buildFromModels(allModels, strategy))}
                    >
                        Regenerate from Models
                    </Button>
                </div>
                {Object.keys(routing).length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No tiers generated yet — select models first, then click Regenerate.</p>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(routing).map(([tierName, tierCfg]) => (
                            <div key={tierName} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge className="font-mono text-xs">{tierName}</Badge>
                                    <span className="text-xs text-slate-400">{tierCfg.strategy}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {tierCfg.models.map((m, i) => (
                                        <span key={i} className="text-[11px] bg-slate-100 dark:bg-slate-800 rounded px-2 py-0.5 font-mono">
                                            {m.provider}/{m.model}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Step 5: Brain ─────────────────────────────────────────────────────────────

function BrainStep({ providerStates, brain, onBrainChange }: {
    providerStates: ProviderState[]
    brain: WizardBrainEntry[]
    onBrainChange: (b: WizardBrainEntry[]) => void
}) {
    const candidates: { display: string; entry: WizardBrainEntry }[] = []
    for (const ps of providerStates) {
        for (const cred of ps.credentials) {
            for (const m of ps.models) {
                if (!m.model_id || !cred.label) continue
                candidates.push({
                    display: `${ps.provider.display_name} / ${cred.label} / ${m.model_id}`,
                    entry: {
                        provider_name: ps.provider.name,
                        credential_label: cred.label,
                        model_id: m.model_id,
                        priority: 10,
                    }
                })
            }
        }
    }

    const selectedIdx = brain.length > 0
        ? candidates.findIndex(c =>
            c.entry.provider_name === brain[0].provider_name &&
            c.entry.credential_label === brain[0].credential_label &&
            c.entry.model_id === brain[0].model_id)
        : -1

    return (
        <div>
            <SectionTitle icon={Brain} title="Brain Configuration" subtitle="The Brain is LLMWay's internal LLM used for system tasks. Select a provider/credential/model for it." />
            {candidates.length === 0 ? (
                <div className="flex items-start gap-3 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
                    <Info size={18} className="shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-sm">No candidates available</p>
                        <p className="text-xs mt-1">You need at least one provider with a credential and a model to configure the Brain. You can configure it later from the Brain page.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:border-violet-200 dark:hover:border-violet-700 transition-all"
                        onClick={() => onBrainChange([])}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedIdx === -1 ? "border-violet-500 bg-violet-500" : "border-slate-300"}`}>
                            {selectedIdx === -1 && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm text-slate-500">Skip (configure later)</span>
                    </div>
                    {candidates.map((c, i) => (
                        <div
                            key={i}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${i === selectedIdx ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10" : "border-slate-200 dark:border-slate-700 hover:border-violet-200 dark:hover:border-violet-800"}`}
                            onClick={() => onBrainChange([{ ...c.entry, priority: brain[0]?.priority ?? 10 }])}
                        >
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${i === selectedIdx ? "border-violet-500 bg-violet-500" : "border-slate-300"}`}>
                                {i === selectedIdx && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100 flex-1">{c.display}</span>
                        </div>
                    ))}
                    {brain.length > 0 && (
                        <div className="pt-2 flex items-center gap-3">
                            <Label className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Priority (lower = higher)</Label>
                            <Input
                                type="number"
                                className="w-28 h-9 text-sm"
                                value={brain[0].priority}
                                min={1}
                                max={999}
                                onChange={e => onBrainChange([{ ...brain[0], priority: parseInt(e.target.value) || 10 }])}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Step 6: Summary ───────────────────────────────────────────────────────────

function SummaryStep({ providerStates, routing, brain }: {
    providerStates: ProviderState[]
    routing: Record<string, WizardRoutingTier>
    brain: WizardBrainEntry[]
}) {
    return (
        <div>
            <SectionTitle icon={ClipboardCheck} title="Review & Confirm" subtitle="Review everything below before saving. Click Save to persist all configuration to LLMWay." />
            <div className="space-y-6">
                {providerStates.map(ps => (
                    <Card key={ps.provider.name} className="border-slate-200 dark:border-slate-800">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Database size={16} className="text-violet-500" />
                                {ps.provider.display_name}
                                <Badge variant="outline" className="text-[10px] ml-1">{ps.provider.auth_type}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-2">
                            {ps.credentials.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Credentials</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {ps.credentials.map((c, i) => (
                                            <Badge key={i} variant="secondary" className="text-xs gap-1">
                                                <Key size={10} /> {c.label}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {ps.models.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Models</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {ps.models.filter(m => m.model_id).map((m, i) => (
                                            <Badge key={i} className={`text-[10px] ${TIER_COLORS[m.tier] || TIER_COLORS[""]}`}>
                                                {m.model_id.split("/").pop()}
                                                {m.tier && ` · ${m.tier}`}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}

                {Object.keys(routing).length > 0 && (
                    <Card className="border-slate-200 dark:border-slate-800">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <GitBranch size={16} className="text-violet-500" /> Routing Tiers
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(routing).map(([k, v]) => (
                                    <div key={k} className="text-xs bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">
                                        <span className="font-mono font-bold">{k}</span>
                                        <span className="text-slate-400 ml-1">· {v.models.length} model{v.models.length !== 1 ? "s" : ""} · {v.strategy}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {brain.length > 0 && (
                    <Card className="border-slate-200 dark:border-slate-800">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Brain size={16} className="text-violet-500" /> Brain Assignment
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                                {brain[0].provider_name} / {brain[0].credential_label} / {brain[0].model_id}
                                <span className="text-slate-400 ml-2">(priority {brain[0].priority})</span>
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}

// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen({ summary, onReset }: { summary: WizardOnboardSummary; onReset: () => void }) {
    return (
        <div className="text-center py-12 px-6">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="text-emerald-500" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Setup Complete!</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8">Your providers, credentials, models, routing, and brain have been configured.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10 max-w-lg mx-auto">
                {([
                    ["Providers", summary.providers.length],
                    ["Credentials", summary.credentials.length],
                    ["Models", summary.models.length],
                    ["Brain", summary.brain.length],
                ] as [string, number][]).map(([label, count]) => (
                    <div key={label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{count}</p>
                        <p className="text-xs text-slate-500">{label}</p>
                    </div>
                ))}
            </div>
            <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={onReset}>Run Wizard Again</Button>
                <Button asChild className="bg-orange-600 hover:bg-orange-700">
                    <a href="/">Go to Dashboard</a>
                </Button>
            </div>
        </div>
    )
}

// ── Main SetupWizard page ─────────────────────────────────────────────────────

export function SetupWizard() {
    const [step, setStep] = useState(0)
    const [selectedProviders, setSelectedProviders] = useState<AvailableProvider[]>([])
    const [providerStates, setProviderStates] = useState<ProviderState[]>([])
    const [routing, setRouting] = useState<Record<string, WizardRoutingTier>>({})
    const [brain, setBrain] = useState<WizardBrainEntry[]>([])
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState("")
    const [savedSummary, setSavedSummary] = useState<WizardOnboardSummary | null>(null)

    // Sync provider states when selected providers change
    useEffect(() => {
        setProviderStates(prev => {
            // Keep existing states for already-selected providers, add new ones
            const next: ProviderState[] = selectedProviders.map(p => {
                const existing = prev.find(ps => ps.provider.name === p.name)
                if (existing) return existing
                return {
                    provider: p,
                    credentials: [],
                    models: [],
                    catalog: [],
                    catalogLoaded: false,
                }
            })
            return next
        })
    }, [selectedProviders])

    // Load model catalogs lazily on step 3
    const loadCatalogs = useCallback(async () => {
        const updated: ProviderState[] = []
        for (const ps of providerStates) {
            if (!ps.catalogLoaded && ps.provider.has_catalog) {
                try {
                    const resp = await getSuggestedModels(ps.provider.name)
                    updated.push({ ...ps, catalog: resp.models, catalogLoaded: true })
                } catch {
                    updated.push({ ...ps, catalogLoaded: true })
                }
            } else {
                updated.push(ps)
            }
        }
        setProviderStates(updated)
    }, [providerStates])

    useEffect(() => {
        if (step === 2) loadCatalogs()
    }, [step])  // eslint-disable-line react-hooks/exhaustive-deps

    const toggleProvider = (p: AvailableProvider) => {
        setSelectedProviders(prev =>
            prev.some(s => s.name === p.name)
                ? prev.filter(s => s.name !== p.name)
                : [...prev, p]
        )
    }

    const updateCreds = (providerName: string, creds: WizardCredential[]) => {
        setProviderStates(prev => prev.map(ps => ps.provider.name === providerName ? { ...ps, credentials: creds } : ps))
    }

    const updateModels = (providerName: string, models: WizardModel[]) => {
        setProviderStates(prev => prev.map(ps => ps.provider.name === providerName ? { ...ps, models } : ps))
    }

    const canNext = () => {
        if (step === 0) return selectedProviders.length > 0
        return true
    }

    const handleSave = async () => {
        setSaving(true)
        setSaveError("")
        try {
            const payload = {
                providers: providerStates.map(ps => ({
                    provider_name: ps.provider.name,
                    credentials: ps.credentials.filter(c => c.label),
                    models: ps.models.filter(m => m.model_id),
                })),
                routing_tiers: routing,
                brain_entries: brain,
            }
            const result = await submitWizard(payload)
            setSavedSummary(result.summary)
        } catch (e: any) {
            setSaveError(e.message)
        } finally {
            setSaving(false)
        }
    }

    const handleReset = () => {
        setStep(0)
        setSelectedProviders([])
        setProviderStates([])
        setRouting({})
        setBrain([])
        setSavedSummary(null)
        setSaveError("")
    }

    if (savedSummary) {
        return (
            <div className="max-w-3xl mx-auto">
                <SuccessScreen summary={savedSummary} onReset={handleReset} />
            </div>
        )
    }

    return (
        <div className="w-full">
            {/* Page header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
                    <Wand2 className="text-white" size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Setup Wizard</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Configure providers, credentials, models, routing, and brain in one guided flow.</p>
                </div>
            </div>

            {/* Stepper */}
            <div className="flex items-center mb-10 px-2">
                {STEPS.map((s, i) => (
                    <div key={s.id} className="flex items-center flex-1 last:flex-none">
                        <StepDot idx={i} current={step} label={s.label} Icon={s.icon} />
                        {i < STEPS.length - 1 && <StepConnector done={i < step} />}
                    </div>
                ))}
            </div>

            {/* Step content */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                <CardContent className="p-8">
                    {step === 0 && (
                        <ProviderStep selected={selectedProviders} onToggle={toggleProvider} />
                    )}
                    {step === 1 && (
                        <CredentialsStep providerStates={providerStates} onUpdateCreds={updateCreds} />
                    )}
                    {step === 2 && (
                        <ModelsStep providerStates={providerStates} onUpdateModels={updateModels} />
                    )}
                    {step === 3 && (
                        <RoutingStep providerStates={providerStates} routing={routing} onRoutingChange={setRouting} />
                    )}
                    {step === 4 && (
                        <BrainStep providerStates={providerStates} brain={brain} onBrainChange={setBrain} />
                    )}
                    {step === 5 && (
                        <SummaryStep providerStates={providerStates} routing={routing} brain={brain} />
                    )}
                </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
                <Button
                    variant="outline"
                    onClick={() => setStep(Math.max(0, step - 1))}
                    disabled={step === 0}
                    className="gap-1"
                >
                    <ChevronLeft size={16} /> Back
                </Button>
                <div className="flex items-center gap-3">
                    {saveError && (
                        <p className="text-sm text-orange-500 flex items-center gap-1">
                            <AlertCircle size={14} /> {saveError}
                        </p>
                    )}
                    {step < STEPS.length - 1 ? (
                        <Button
                            onClick={() => setStep(step + 1)}
                            disabled={!canNext()}
                            className="gap-1 bg-orange-600 hover:bg-orange-700"
                        >
                            Next <ChevronRight size={16} />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="gap-2 bg-orange-600 hover:bg-orange-700 min-w-[120px]"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            {saving ? "Saving..." : "Save Setup"}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
