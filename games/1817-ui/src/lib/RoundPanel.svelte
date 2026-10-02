<script lang="ts">
    import type { Snippet } from 'svelte'
    import { cashOwnedBy, companyMarketSpace, getCompany } from '@tabletop/18xx'
    import { CompanyToken } from '@tabletop/18xx-ui'
    import type { EighteenSeventeenSession } from './session.svelte.js'
    let {
        session,
        label,
        companyId,
        children
    }: {
        session: EighteenSeventeenSession
        label: string
        companyId: string
        children: Snippet
    } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const company = $derived(getCompany(gameState, companyId))
    const waitingFor = $derived(
        gameState.activePlayerIds.map((id) => session.getPlayerName(id)).join(', ')
    )
</script>

<section aria-label={label} class="round-panel">
    <header>
        <CompanyToken appearance={session.mapView.stations[company.id]} size={24} />
        <strong>{company.name}</strong>
        <span
            >{company.shareCount} shares · {money(
                companyMarketSpace(gameState.stockMarket, company.id).price
            )} · Treasury {money(
                Number(cashOwnedBy(gameState, { kind: 'company', companyId: company.id }))
            )}</span
        >
    </header>
    {@render children()}
    {#if !session.validActionTypes.length}<p>Waiting for {waitingFor}.</p>{/if}
</section>

<style>
    section {
        padding: 6px 0;
        font-size: 12px;
        color: var(--rail-text, #514536);
        text-align: center;
    }
    header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
    }
    .round-panel :global(p) {
        margin: 4px 0;
    }
    .round-panel :global(.choices) {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 8px;
        margin-top: 4px;
    }
    .round-panel :global(button) {
        padding: 5px 10px;
        font: inherit;
        color: inherit;
        cursor: pointer;
        background: var(--rail-surface, #fffdf8);
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 7px;
    }
    .round-panel :global(button:hover:not(:disabled)) {
        background: var(--rail-surface-raised, #efe7db);
    }
    .round-panel :global(button:disabled) {
        opacity: 0.45;
        cursor: default;
    }
</style>
