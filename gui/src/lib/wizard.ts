/**
 * wizard.ts — API helper functions for the Setup Wizard GUI page.
 *
 * Calls the /admin/wizard/* endpoints introduced by the wizard module.
 */

import { fetcher, getAuthToken } from './api'

const API_BASE = '/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AvailableProvider {
    name: string
    display_name: string
    auth_type: string
    id: string | null
    enabled: boolean
    has_credentials: boolean
    credentials_count: number
    has_catalog: boolean
}

export interface CatalogModel {
    model_id: string
    display_name: string
    tier: string
    context_window: number
    input_cost_per_1k: number
    output_cost_per_1k: number
    supports_streaming: boolean
    supports_functions: boolean
    default_enabled: boolean
}

export interface WizardCredential {
    label: string
    secret_key: string
    auth_type: string
}

export interface WizardModel {
    model_id: string
    display_name: string
    tier: string
    context_window: number
    input_cost_per_1k: number
    output_cost_per_1k: number
    supports_streaming: boolean
    supports_functions: boolean
    enabled: boolean
}

export interface WizardProviderPayload {
    provider_name: string
    credentials: WizardCredential[]
    models: WizardModel[]
}

export interface WizardRoutingTierModel {
    provider: string
    model: string
}

export interface WizardRoutingTier {
    strategy: string
    fallback_on: (string | number)[]
    models: WizardRoutingTierModel[]
}

export interface WizardBrainEntry {
    provider_name: string
    credential_label: string
    model_id: string
    priority: number
}

export interface WizardOnboardRequest {
    providers: WizardProviderPayload[]
    routing_tiers: Record<string, WizardRoutingTier>
    brain_entries: WizardBrainEntry[]
}

export interface WizardOnboardSummary {
    providers: { name: string; id: string }[]
    credentials: { provider: string; label: string; id: string }[]
    models: { provider: string; model_id: string }[]
    routing: { tiers: string[] } | null
    brain: { provider: string; credential: string; model_id: string; priority: number }[]
}

export interface WizardOnboardResponse {
    ok: boolean
    summary: WizardOnboardSummary
}

// ── API helpers ───────────────────────────────────────────────────────────────

/** Fetch all available providers with their current onboarding status. */
export async function getAvailableProviders(): Promise<AvailableProvider[]> {
    return fetcher('/admin/wizard/providers/available')
}

/** Fetch the static model catalog for a given provider. */
export async function getSuggestedModels(
    providerName: string,
): Promise<{ provider: string; has_catalog: boolean; models: CatalogModel[] }> {
    return fetcher(`/admin/wizard/models/${providerName}`)
}

/** Submit the full wizard payload and persist everything in one transaction. */
export async function submitWizard(
    payload: WizardOnboardRequest,
): Promise<WizardOnboardResponse> {
    const token = getAuthToken()
    const res = await fetch(`${API_BASE}/admin/wizard/onboard`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Wizard submission failed (${res.status})`)
    }
    return res.json()
}
