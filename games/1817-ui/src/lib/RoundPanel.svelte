<script lang="ts">
    import type { Snippet } from 'svelte'
    import { companyMarketSpace, getCompany } from '@tabletop/18xx'
    import { CompanyActionCard, StockPanelHeading, type CardAction } from '@tabletop/18xx-ui'
    import { companyRoundFacts } from './roundFacts.js'
    import type { EighteenSeventeenSession } from './session.svelte.js'
    let {
        session,
        label,
        companyId,
        actions = [],
        children
    }: {
        session: EighteenSeventeenSession
        label: string
        companyId: string
        actions?: readonly CardAction[]
        children?: Snippet
    } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const waitingFor = $derived(
        gameState.activePlayerIds.map((id) => session.getPlayerName(id)).join(', ')
    )
</script>

<section aria-label={label} class="round-panel">
    <StockPanelHeading text={label} />
    <div class="subject">
        <CompanyActionCard
            {session}
            {companyId}
            title={getCompany(gameState, companyId).name}
            value={money(companyMarketSpace(gameState.stockMarket, companyId).price)}
            facts={companyRoundFacts(gameState, companyId, money)}
            {actions}
        />
    </div>
    {#if children}{@render children()}{/if}
    {#if !session.validActionTypes.length}<p class="waiting">Waiting for {waitingFor}.</p>{/if}
</section>

<style>
    section {
        container-type: inline-size;
        padding: 6px 0;
        font-size: 12px;
        color: var(--rail-text, #514536);
        text-align: center;
    }
    .subject {
        display: flex;
        justify-content: center;
        margin-bottom: 10px;
    }
    .waiting {
        margin: 6px 0 0;
        color: var(--rail-muted, #887969);
    }
    :global(.round-panel p) {
        margin: 4px 0;
    }
    :global(.round-panel .cards) {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        margin-top: 6px;
    }
    :global(.round-panel h3) {
        margin: 10px 0 4px;
        font-size: 12px;
        font-weight: 400;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
</style>
