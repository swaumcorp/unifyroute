import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Save, RefreshCw, AlertCircle, CheckCircle2, Zap, Cpu, BookOpen, Settings2, Activity } from "lucide-react"
import { useRoutingConfig, saveRoutingConfig, useProviders, useCredentials, useModels } from "@/lib/api"
import { ErrorState } from "@/components/error-state"
import * as yaml from "js-yaml"

// ── Type Definitions ──────────────────────────────────────────────────────────

interface RoutingTierConfig {
    strategy?: string
    min_quota_remaining?: number
    fallback_on?: any[]
    models?: Array<{ provider: string; model: string }>
}

interface RoutingYamlConfig {
    tiers?: {
        auto?: RoutingTierConfig
        lite?: RoutingTierConfig
        base?: RoutingTierConfig
        thinking?: RoutingTierConfig
        [key: string]: RoutingTierConfig | undefined
    }
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function RoutingStrategy() {
    const { routingConfig, isLoading: configLoading, isError: configError, mutate } = useRoutingConfig()
    const { providers: allProviders } = useProviders()
    const { credentials: allCredentials } = useCredentials()
    const { models: allModels } = useModels()

    const [globalStrategy, setGlobalStrategy] = useState<"highest_quota" | "cheapest_available">("highest_quota")
    const [tierModels, setTierModels] = useState<{ lite: Set<string>, base: Set<string>, thinking: Set<string> }>({
        lite: new Set(),
        base: new Set(),
        thinking: new Set()
    })

    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState("")
    const [saveSuccess, setSaveSuccess] = useState(false)
    
    // Original config object to preserve other settings when saving
    const [originalConfigObj, setOriginalConfigObj] = useState<RoutingYamlConfig>({})

    // Parse incoming YAML config and populate state
    useEffect(() => {
        if (routingConfig !== undefined && routingConfig !== null) {
            try {
                const parsed = yaml.load(routingConfig) as RoutingYamlConfig;
                setOriginalConfigObj(parsed || {});
                
                const getTierModelsSet = (tierName: "lite" | "base" | "thinking") => {
                    const models = parsed?.tiers?.[tierName]?.models || [];
                    return new Set(models.map(m => `${m.provider}::${m.model}`));
                };

                setTierModels({
                    lite: getTierModelsSet("lite"),
                    base: getTierModelsSet("base"),
                    thinking: getTierModelsSet("thinking")
                });

                // Infer global strategy. If any tier has cheapest_available, set it to cost, otherwise quota.
                const hasCostStrategy = ["lite", "base", "thinking", "auto"].some(t => 
                    parsed?.tiers?.[t]?.strategy === "cheapest_available"
                );
                
                setGlobalStrategy(hasCostStrategy ? "cheapest_available" : "highest_quota");

            } catch (e) {
                console.error("Error parsing routing.yaml:", e);
                setSaveError("Failed to parse the existing configuration. Continuing will overwrite it.");
            }
        }
    }, [routingConfig]);

    // Gather available models mapped by provider
    const availableModels = useMemo(() => {
        if (!allProviders || !allCredentials || !allModels) return [];
        
        const enabledProvidersMap = new Map();
        allProviders.filter((p: any) => p.enabled).forEach((p: any) => {
            enabledProvidersMap.set(p.id, p);
        });

        const enabledModels: Array<{ id: string, providerId: string, providerName: string, providerDisplayName: string, modelId: string }> = [];

        allModels.filter((m: any) => m.enabled).forEach((m: any) => {
            const provider = enabledProvidersMap.get(m.provider_id);
            if (provider) {
                enabledModels.push({
                    id: m.id,
                    providerId: provider.id,
                    providerName: provider.name,
                    providerDisplayName: provider.display_name,
                    modelId: m.model_id
                });
            }
        });

        // Group by provider for cleaner UI display
        const grouped = new Map<string, { providerName: string, providerDisplayName: string, models: Array<{modelId: string, fullId: string}> }>();
        enabledModels.forEach(m => {
            const key = m.providerId;
            if (!grouped.has(key)) {
                grouped.set(key, { providerName: m.providerName, providerDisplayName: m.providerDisplayName, models: [] });
            }
            grouped.get(key)!.models.push({ modelId: m.modelId, fullId: `${m.providerName}::${m.modelId}` });
        });
        
        return Array.from(grouped.values());
    }, [allProviders, allCredentials, allModels]);


    const handleSave = async () => {
        setIsSaving(true)
        setSaveError("")
        setSaveSuccess(false)
        
        try {
            // Build the new config object
            const newConfig: RoutingYamlConfig = { ...originalConfigObj };
            if (!newConfig.tiers) {
                newConfig.tiers = {};
            }
            
            // Helper to build a tier
            const buildTierConfig = (tierName: "lite" | "base" | "thinking", existingTier?: RoutingTierConfig) => {
                const modelList = Array.from(tierModels[tierName]).map(id => {
                    const [provider, model] = id.split("::");
                    return { provider, model };
                });
                
                return {
                    ...existingTier,
                    strategy: globalStrategy,
                    fallback_on: existingTier?.fallback_on || [429, 503, "timeout"],
                    models: modelList
                };
            };

            newConfig.tiers.lite = buildTierConfig("lite", newConfig.tiers.lite);
            newConfig.tiers.base = buildTierConfig("base", newConfig.tiers.base);
            newConfig.tiers.thinking = buildTierConfig("thinking", newConfig.tiers.thinking);
            
            // Also update 'auto' tier to match the strategy, but don't touch its models 
            if (newConfig.tiers.auto) {
                newConfig.tiers.auto.strategy = globalStrategy;
            } else {
                 newConfig.tiers.auto = {
                    strategy: globalStrategy,
                    fallback_on: [429, 503, "timeout"]
                }
            }

            // Serialize to YAML
            const yamlString = yaml.dump(newConfig, { indent: 2, skipInvalid: true });
            
            await saveRoutingConfig(yamlString)
            await mutate()
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 3000)
        } catch (e: any) {
            setSaveError(e.message || "Failed to save configuration")
        } finally {
            setIsSaving(false)
        }
    }

    const toggleModel = (tier: "lite" | "base" | "thinking", modelFullId: string) => {
        setTierModels(prev => {
            const newSet = new Set(prev[tier]);
            if (newSet.has(modelFullId)) {
                newSet.delete(modelFullId);
            } else {
                newSet.add(modelFullId);
            }
            return {
                ...prev,
                [tier]: newSet
            };
        });
    };

    if (configError) return <ErrorState />

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Routing Strategy</h2>
                    <p className="text-muted-foreground pt-1">
                        Configure how the gateway decides which model to use when a request is received.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => mutate()}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || configLoading}>
                        {isSaving
                            ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                            : <><Save className="mr-2 h-4 w-4" /> Apply Changes</>
                        }
                    </Button>
                </div>
            </div>

            {/* Status messages */}
            {saveError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {saveError}
                </div>
            )}
            {saveSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    Configuration saved and applied successfully.
                </div>
            )}

            {configLoading ? (
                 <div className="flex justify-center py-20">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <>
                    {/* Global Strategy Selection */}
                    <Card className="border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                         {/* Decorative background element */}
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                            <Settings2 className="w-48 h-48" />
                        </div>
                        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b">
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-blue-500" />
                                Global Strategy
                            </CardTitle>
                            <CardDescription>
                                Determine how the application behaves when deciding which assigned model to use.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                             <RadioGroup 
                                value={globalStrategy} 
                                onValueChange={(v) => setGlobalStrategy(v as any)}
                                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                            >
                                <Label
                                    htmlFor="strategy-quota"
                                    className={`flex flex-col gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                        globalStrategy === 'highest_quota' 
                                        ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20' 
                                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-900 bg-slate-100/50 dark:bg-slate-800/30'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem value="highest_quota" id="strategy-quota" />
                                        <span className="font-semibold text-base">Optimize for Availability</span>
                                    </div>
                                    <p className="text-sm pl-6 text-muted-foreground leading-relaxed">
                                        Prioritize models from providers with the <strong className="text-foreground">highest remaining quota</strong>. 
                                        This provides maximum resilience and ensures users rarely hit rate limits, guaranteeing they get an available model.
                                    </p>
                                </Label>

                                <Label
                                    htmlFor="strategy-cost"
                                    className={`flex flex-col gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                        globalStrategy === 'cheapest_available' 
                                        ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20' 
                                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-900 bg-slate-100/50 dark:bg-slate-800/30'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem value="cheapest_available" id="strategy-cost" />
                                        <span className="font-semibold text-base">Optimize for Cost</span>
                                    </div>
                                    <p className="text-sm pl-6 text-muted-foreground leading-relaxed">
                                        Always attempt to route the request to the <strong className="text-foreground">cheapest available model</strong> among the selected options.
                                        It will fallback to more expensive models only if rate limited.
                                    </p>
                                </Label>
                            </RadioGroup>
                        </CardContent>
                    </Card>

                    {/* Model Assignment Section */}
                    <div className="space-y-4 pt-4">
                        <div>
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Cpu className="h-5 w-5 text-indigo-500" />
                                Model Assignment
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Assign enabled models to task complexity tiers. The application automatically determines the complexity of a user's prompt and routes it to the models defined below.
                            </p>
                        </div>

                        {availableModels.length === 0 ? (
                            <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                                <CardContent className="pt-6 text-center text-amber-800 dark:text-amber-400">
                                    <p>No models are currently enabled or properly configured.</p>
                                    <Button variant="link" className="text-amber-700 dark:text-amber-300 px-0" onClick={() => window.location.href='/models'}>
                                        Go to Model Management to enable some models.
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                
                                {/* Simple Ask (Lite) */}
                                <Card className="border-sky-200 dark:border-sky-900 shadow-sm flex flex-col">
                                    <CardHeader className="bg-sky-50 dark:bg-sky-950/30 border-b border-sky-100 dark:border-sky-900/50">
                                        <CardTitle className="text-lg text-sky-700 dark:text-sky-300 flex items-center gap-2">
                                            <Zap className="h-4 w-4" />
                                            Simple Ask
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Fast and cheap models for quick questions and high-volume tasks.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-4 flex-1 space-y-4">
                                        {availableModels.map(group => (
                                            <div key={`lite-${group.providerName}`} className="space-y-2">
                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    {group.providerDisplayName}
                                                </h4>
                                                <div className="space-y-1.5 pl-1">
                                                    {group.models.map(m => (
                                                        <label key={`lite-${m.fullId}`} className="flex items-start gap-2 cursor-pointer group">
                                                            <Checkbox 
                                                                className="mt-0.5"
                                                                checked={tierModels.lite.has(m.fullId)} 
                                                                onCheckedChange={() => toggleModel("lite", m.fullId)}
                                                            />
                                                            <span className="text-sm font-mono break-all leading-tight group-hover:text-foreground text-muted-foreground transition-colors">
                                                                {m.modelId}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                    <CardFooter className="bg-slate-50/50 dark:bg-slate-900/30 border-t py-3 flex justify-between">
                                        <span className="text-xs text-muted-foreground">Selected: <strong className="text-foreground">{tierModels.lite.size}</strong></span>
                                        {tierModels.lite.size === 0 && <span className="text-xs text-amber-500 font-medium">None selected!</span>}
                                    </CardFooter>
                                </Card>

                                {/* Normal Ask (Base) */}
                                <Card className="border-violet-200 dark:border-violet-900 shadow-sm flex flex-col">
                                    <CardHeader className="bg-violet-50 dark:bg-violet-950/30 border-b border-violet-100 dark:border-violet-900/50">
                                        <CardTitle className="text-lg text-violet-700 dark:text-violet-300 flex items-center gap-2">
                                            <Cpu className="h-4 w-4" />
                                            Better Model
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Capable models for balanced, everyday intelligent tasks and light coding.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-4 flex-1 space-y-4">
                                        {availableModels.map(group => (
                                            <div key={`base-${group.providerName}`} className="space-y-2">
                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    {group.providerDisplayName}
                                                </h4>
                                                <div className="space-y-1.5 pl-1">
                                                    {group.models.map(m => (
                                                        <label key={`base-${m.fullId}`} className="flex items-start gap-2 cursor-pointer group">
                                                            <Checkbox 
                                                                className="mt-0.5"
                                                                checked={tierModels.base.has(m.fullId)} 
                                                                onCheckedChange={() => toggleModel("base", m.fullId)}
                                                            />
                                                            <span className="text-sm font-mono break-all leading-tight group-hover:text-foreground text-muted-foreground transition-colors">
                                                                {m.modelId}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                    <CardFooter className="bg-slate-50/50 dark:bg-slate-900/30 border-t py-3 flex justify-between">
                                        <span className="text-xs text-muted-foreground">Selected: <strong className="text-foreground">{tierModels.base.size}</strong></span>
                                        {tierModels.base.size === 0 && <span className="text-xs text-amber-500 font-medium">None selected!</span>}
                                    </CardFooter>
                                </Card>

                                {/* Complex (Thinking) */}
                                <Card className="border-amber-200 dark:border-amber-900 shadow-sm flex flex-col">
                                    <CardHeader className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/50">
                                        <CardTitle className="text-lg text-amber-700 dark:text-amber-300 flex items-center gap-2">
                                            <BookOpen className="h-4 w-4" />
                                            Reasoning Model
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Large, intelligent models for complex reasoning, planning, and advanced coding.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-4 flex-1 space-y-4">
                                        {availableModels.map(group => (
                                            <div key={`thinking-${group.providerName}`} className="space-y-2">
                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    {group.providerDisplayName}
                                                </h4>
                                                <div className="space-y-1.5 pl-1">
                                                    {group.models.map(m => (
                                                        <label key={`thinking-${m.fullId}`} className="flex items-start gap-2 cursor-pointer group">
                                                            <Checkbox 
                                                                className="mt-0.5"
                                                                checked={tierModels.thinking.has(m.fullId)} 
                                                                onCheckedChange={() => toggleModel("thinking", m.fullId)}
                                                            />
                                                            <span className="text-sm font-mono break-all leading-tight group-hover:text-foreground text-muted-foreground transition-colors">
                                                                {m.modelId}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                    <CardFooter className="bg-slate-50/50 dark:bg-slate-900/30 border-t py-3 flex justify-between">
                                        <span className="text-xs text-muted-foreground">Selected: <strong className="text-foreground">{tierModels.thinking.size}</strong></span>
                                        {tierModels.thinking.size === 0 && <span className="text-xs text-amber-500 font-medium">None selected!</span>}
                                    </CardFooter>
                                </Card>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
