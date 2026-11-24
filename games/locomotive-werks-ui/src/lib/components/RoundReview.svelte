<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { DemandChange, type MarketStep } from '@tabletop/locomotive-werks'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ReviewStage, type RoundReview } from '$lib/model/session.svelte.js'
    import LocomotiveBadge from './LocomotiveBadge.svelte'

    // The end of the last round, one phase at a time: what each player shipped, the taxes and the
    // Player Order they set, and how Market Demands moved each locomotive's dice.
    let { review }: { review: RoundReview } = $props()

    const gameSession = getGameSession()

    const stage = $derived(gameSession.reviewStage)
    const nextRound = $derived(review.round + 1)
    const order = $derived(
        review.taxes.playerOrder.map((playerId, index) => ({
            place: index + 1,
            playerId,
            payment: review.taxes.payments.find((payment) => payment.playerId === playerId)
        }))
    )
    const nextLabel = $derived(
        stage === ReviewStage.Production
            ? 'Next: Taxes'
            : stage === ReviewStage.Taxes
              ? 'Next: Market Demands'
              : `On to Round ${nextRound}`
    )

    function change(step: MarketStep): string {
        switch (step.change) {
            case DemandChange.Obsolete:
                return `Obsolete · ${step.returned} dice return`
            case DemandChange.Shrunk:
                return 'Loses a die'
            case DemandChange.Filled:
                return step.added > 0 ? `Gains ${step.added} dice` : 'Keeps its dice'
            case DemandChange.Grown:
                return step.added > 0 ? 'Gains a die' : 'At its limit'
        }
    }
</script>

<div class="review" role="region" aria-label="Round review">
    {#if stage === ReviewStage.Production}
        <table>
            <caption>Shipped this Production</caption>
            <thead>
                <tr>
                    <th>Player</th>
                    <th class="number">Units</th>
                    <th class="number">Income</th>
                </tr>
            </thead>
            <tbody>
                {#each review.production as row (row.playerId)}
                    <tr>
                        <td><PlayerName playerId={row.playerId} /></td>
                        <td class="number">{row.units}</td>
                        <td class="number strong">${row.income}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {:else if stage === ReviewStage.Taxes}
        <table>
            <caption>Taxes and Player Order for Round {nextRound}</caption>
            <thead>
                <tr>
                    <th class="number">Order</th>
                    <th>Player</th>
                    <th class="number">Tax</th>
                    <th class="number">Cash</th>
                </tr>
            </thead>
            <tbody>
                {#each order as row (row.playerId)}
                    <tr>
                        <td class="number strong">{row.place}</td>
                        <td><PlayerName playerId={row.playerId} /></td>
                        <td class="number">${row.payment?.tax ?? 0}</td>
                        <td class="number strong">${row.payment?.cash ?? 0}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {:else}
        <table>
            <caption>Market Demands</caption>
            <thead>
                <tr>
                    <th>Locomotive</th>
                    <th>Change</th>
                    <th>Rolled</th>
                </tr>
            </thead>
            <tbody>
                {#each review.market.steps as step (step.locomotiveId)}
                    <tr>
                        <td><LocomotiveBadge locomotiveId={step.locomotiveId} /></td>
                        <td>{change(step)}</td>
                        <td class="strong">{step.rolls.join(' · ') || '—'}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
    <div class="row">
        <button type="button" class="primary" onclick={() => gameSession.advanceReview()}
            >{nextLabel}</button
        >
        {#if stage !== ReviewStage.MarketDemands}
            <button type="button" class="secondary" onclick={() => gameSession.finishReview()}
                >Skip to Round {nextRound}</button
            >
        {/if}
    </div>
</div>

<style>
    .review {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        max-width: 100%;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }

    table {
        border-collapse: collapse;
        font-size: 13px;
    }

    caption {
        padding-bottom: 2px;
        white-space: nowrap;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #232d36;
    }

    th {
        border-bottom: 1.5px solid #a7b8c5;
        padding: 1px 8px;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-align: left;
        text-transform: uppercase;
        color: #46596b;
    }

    td {
        border-bottom: 1px solid #d0dae2;
        padding: 2px 8px;
        white-space: nowrap;
    }

    .number {
        text-align: center;
    }

    .strong {
        font-weight: 700;
    }
</style>
