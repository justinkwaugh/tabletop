<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { getCompany } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'

    let { session }: { session: EighteenXXSessionView } = $props()
    const money = $derived(session.presentation.money)
    const module = $derived(session.companyAuction)
    const pending = $derived.by(() => {
        assertExists(module.pending, 'Formation requires a won company auction')
        return module.pending
    })
    const terms = $derived.by(() => {
        assertExists(module.model, 'Formation requires company auctions')
        return module.model.terms
    })
    const company = $derived(getCompany(session.gameState, pending.companyId))
    const choice = $derived(module.formationChoice)
    const reason = $derived(choice ? module.formationReason(choice) : 'Choose a size.')
    const startPrice = $derived(
        session.stockMarketChart.space(terms.startSpace(session.gameState, pending.price)).price
    )
</script>

<article class="centered-panel" aria-label="Company formation">
    <div class="formation">
        <div class="company">
            <CompanyToken appearance={session.mapView.stations[company.id]} size={48} />
            <div>
                <strong>{company.name}</strong>
                <span
                    >{session.getPlayerName(pending.playerId)} won for {money(pending.price)} · starts
                    at {money(startPrice)}</span
                >
            </div>
        </div>
        <div class="choices" role="group" aria-label="Company size">
            {#each module.shareCounts as shareCount (shareCount)}
                <button
                    aria-pressed={choice?.shareCount === shareCount}
                    disabled={!module.canForm}
                    onclick={() => module.setShareCount(shareCount)}>{shareCount} shares</button
                >
            {/each}
        </div>
        {#if module.contributions.length}
            <div class="choices" role="group" aria-label="Privates contributed">
                {#each module.contributions as privateId (privateId)}
                    <button
                        aria-pressed={choice?.privateIds.includes(privateId)}
                        disabled={!module.canForm}
                        onclick={() => module.toggleContribution(privateId)}
                        >{getCompany(session.gameState, privateId).name}</button
                    >
                {/each}
            </div>
        {/if}
        {#if reason}<p role="status">{reason}</p>{/if}
        <button
            class="action-button"
            disabled={!module.canForm || !!reason}
            onclick={() => module.form()}>Form {company.name}</button
        >
    </div>
</article>

<style>
    .formation {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }
    .company {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .company div {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .company span,
    p {
        margin: 0;
        font-size: 12px;
        color: var(--rail-text, #786550);
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
    button {
        font: inherit;
        padding: 6px 12px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        background: var(--rail-surface, white);
        color: inherit;
        cursor: pointer;
    }
    button[aria-pressed='true'] {
        border-color: var(--rail-focus, #796047);
        background: var(--rail-surface-selected, #e6dccd);
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
</style>
