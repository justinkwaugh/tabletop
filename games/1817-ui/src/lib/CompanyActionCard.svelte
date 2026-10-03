<script lang="ts">
    import { CompanyToken } from '@tabletop/18xx-ui'
    import type { EighteenSeventeenSession } from './session.svelte.js'

    export type CardFact = { label: string; value: string }
    export type CardAction = {
        label: string
        detail?: string
        ariaLabel: string
        disabled?: boolean
        onclick: () => void
    }

    let {
        session,
        companyId,
        value,
        facts = [],
        actions = []
    }: {
        session: EighteenSeventeenSession
        companyId: string
        value?: string
        facts?: readonly CardFact[]
        actions?: readonly CardAction[]
    } = $props()
    const company = $derived(session.gameState.companies.find((item) => item.id === companyId))
</script>

<div class="company-card" aria-label={company?.name ?? companyId}>
    <div class="identity">
        <CompanyToken appearance={session.mapView.stations[companyId]} size={30} />
        {#if value}<span class="value">{value}</span>{/if}
    </div>
    {#if facts.length}
        <dl class="facts">
            {#each facts as fact (fact.label)}<div>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                </div>{/each}
        </dl>
    {/if}
    {#if actions.length}
        <div class="actions">
            {#each actions as action (action.label)}
                <button
                    disabled={action.disabled}
                    aria-label={action.ariaLabel}
                    onclick={action.onclick}
                >
                    <span class="action-label">{action.label}</span>
                    {#if action.detail}<span class="action-detail">{action.detail}</span>{/if}
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .company-card {
        flex: none;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        overflow: hidden;
        color: var(--rail-text, #514536);
    }
    .identity {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: clamp(4px, 1cqw, 10px) clamp(8px, 2cqw, 18px);
        background: var(--rail-surface-raised, #f3ede4);
        font-size: 15px;
    }
    .facts {
        display: flex;
        margin: 0;
        border-top: 1px solid var(--rail-border, #d8cbbc);
    }
    .facts div {
        flex: 1;
        padding: 4px 10px;
        text-align: center;
    }
    .facts div + div {
        border-left: 1px solid var(--rail-border, #d8cbbc);
    }
    dt {
        font-size: 9px;
        line-height: 11px;
        text-transform: uppercase;
        letter-spacing: 0.035em;
    }
    dd {
        margin: 0;
        font-size: 14px;
        font-variant-numeric: tabular-nums;
    }
    .actions {
        display: flex;
        align-self: stretch;
        border-top: 1px solid var(--rail-border, #d8cbbc);
    }
    button {
        position: relative;
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        padding: clamp(3px, 0.8cqw, 8px) clamp(7px, 1.6cqw, 16px);
        border: 0;
        background: var(--rail-surface-inset, #1b232d);
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    button + button::before {
        content: '';
        position: absolute;
        left: 0;
        top: 7px;
        bottom: 7px;
        border-left: 1px solid var(--rail-border, #d8cbbc);
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .action-label {
        font-size: 13px;
    }
    .action-detail {
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        color: var(--rail-muted, #887969);
    }
</style>
