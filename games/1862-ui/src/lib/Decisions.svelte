<script lang="ts">
    import { NonCharteredStationCost } from '@tabletop/1862'
    import { CompanyToken, DecisionResponse } from '@tabletop/18xx-ui'
    import type { Session1862 } from './session.svelte.js'
    let { session }: { session: Session1862 } = $props()
    const money = $derived(session.presentation.money)
    const busy = $derived(!session.canChooseAction)
    const state = $derived(session.gameState)
</script>

{#snippet company(companyId: string, size: number)}
    <CompanyToken appearance={session.mapView.stations[companyId]} {size} />
{/snippet}

{#if state.stationPurchase && session.stationCounts.length && session.canChooseAction}
    {@const companyId = state.stationPurchase}
    <section class="centered-panel decision title-panel" aria-label="Stations">
        <h3>
            {@render company(companyId, 26)}
            <span>{session.companyName(companyId)} has floated</span>
        </h3>
        <p class="note">
            Choose how many stations it buys, home included, at {money(NonCharteredStationCost)} each
            from its treasury. Only mergers bring it more.
        </p>
        <div class="choices" role="group" aria-label="Stations to buy">
            {#each session.stationCounts as count (count)}
                <button class="action-button" onclick={() => session.buyStations(count)}
                    >{count} for {money(count * NonCharteredStationCost)}</button
                >
            {/each}
        </div>
    </section>
{:else if state.fines && session.fineSales.length}
    <section class="centered-panel decision title-panel" aria-label="Fine">
        <h3><span>Sell shares to pay the fine of {money(state.fines[0].amount)}</span></h3>
        <div class="choices" role="group" aria-label="Sales">
            {#each session.fineSales as sale (`${sale.companyId}-${sale.shares}`)}
                <button
                    class="action-button"
                    onclick={() => session.sellForFine(sale.companyId, sale.shares)}
                    >{@render company(sale.companyId, 18)} Sell {sale.shares} for {money(
                        sale.proceeds
                    )}</button
                >
            {/each}
        </div>
    </section>
{:else if session.myMergerDecision?.kind === 'answer' && state.mergerProposal}
    {@const proposal = state.mergerProposal}
    <section class="centered-panel decision title-panel" aria-label="Merger proposal">
        <DecisionResponse
            label="Merger proposal"
            disabled={busy}
            onAccept={() => session.answerMerger(true)}
            onDecline={() => session.answerMerger(false)}
            acceptLabel="Agree"
            declineLabel="Refuse"
        >
            {@render company(proposal.companyId, 24)}{@render company(proposal.partnerId, 24)}
            <span>
                {session.companyName(proposal.companyId)} proposes
                {proposal.kind === 'merge' ? 'a merger with' : 'to acquire'}
                {session.companyName(proposal.partnerId)};
                {session.companyName(proposal.survivorId)} would survive.
            </span>
        </DecisionResponse>
    </section>
{:else if session.myMergerDecision?.kind === 'option' && state.shareMerge?.option}
    {@const merge = state.shareMerge}
    {@const option = merge.option!}
    <section class="centered-panel decision title-panel" aria-label="Option share">
        <DecisionResponse
            label="Option share"
            disabled={busy}
            onAccept={() => session.decideOption(true)}
            onDecline={() => session.decideOption(false)}
            acceptLabel={`Redeem for ${money(option.redeemCost)}`}
            declineLabel={`Give up for ${money(option.sellValue)}`}
        >
            {@render company(merge.survivorId, 24)}
            <span>
                {option.holder === 'company'
                    ? `The companies hold an option ${session.companyInitials(merge.survivorId)} share.`
                    : `You hold an option ${session.companyInitials(merge.survivorId)} share.`}
                Redeem it to keep it, or give it up to the Market.
            </span>
        </DecisionResponse>
    </section>
{/if}

<style>
    .decision {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }
    h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 14px;
    }
    .note {
        margin: 0;
        max-width: 34em;
        text-align: center;
        font-size: 12px;
        color: var(--rail-text, #786550);
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
    .choices button {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
</style>
