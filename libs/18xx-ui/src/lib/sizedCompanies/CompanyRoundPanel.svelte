<script lang="ts">
    import type { Snippet } from 'svelte'
    import CompanyActionCard, { type CardAction } from '../stock/CompanyActionCard.svelte'
    import StockPanelHeading from '../stock/StockPanelHeading.svelte'
    import type { SizedCompanySessionView } from '../session/sizedCompanySession.svelte.js'
    import { companyRoundFacts } from './companyRoundFacts.js'
    let {
        session,
        label,
        companyId,
        actions = [],
        children
    }: {
        session: SizedCompanySessionView
        label: string
        companyId: string
        actions?: readonly CardAction[]
        children?: Snippet
    } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const rules = $derived(session.sizedCompanies)
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
            title={session.companyName(companyId)}
            value={money(rules.market.price(gameState, companyId))}
            facts={companyRoundFacts(rules, gameState, companyId, money, (id) =>
                session.companyName(id)
            )}
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
    .round-panel :global(p) {
        margin: 4px 0;
    }
    .round-panel :global(.cards) {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        margin-top: 6px;
    }
    .round-panel :global(h3) {
        margin: 10px 0 4px;
        font-size: 12px;
        font-weight: 400;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
</style>
